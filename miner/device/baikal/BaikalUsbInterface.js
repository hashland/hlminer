const
    EventEmitter            = require('events'),
    usb                     = require('usb'),
    {MessageFactory}        = require('./MessageFactory'),
    fs                      = require('fs'),
    {    BAIKAL_RESET,
        BAIKAL_GET_INFO,
        BAIKAL_SET_OPTION,
        BAIKAL_SET_IDLE,
        BAIKAL_SEND_WORK,
        BAIKAL_GET_RESULT,
        BAIKAL_SET_ID,
        BAIKAL_ID_VENDOR,
        BAIKAL_ID_PRODUCT,
        BAIKAL_CUTOFF_TEMP,
        BAIKAL_FANSPEED_DEF,
        BAIKAL_STATUS_NONCE_READY,
        BAIKAL_STATUS_JOB_EMPTY,
        BAIKAL_STATUS_NEW_MINER,
        BAIKAL_WORK_FIFO,
        toBaikalAlgorithm
} = require('./constants');

class BaikalUsbInterface extends EventEmitter {
    constructor(usbDevice) {
        super();
        this.usbDevice = usbDevice;
        this.usbDeviceInterface = null;
        this.usbOutEndpoint = null;
        this.usbInEndpoint = null;
        this.connected = false;
    }

    async connect() {
        if(this.connected === true)
            return;

        if(!this.usbDevice)
            throw 'Could not find baikalusb device';

        this.usbDevice.open();
        await this.resetUsb();

        this.usbDeviceInterface = this.usbDevice.interface(1);

        if (this.usbDeviceInterface.isKernelDriverActive()) {
            this.usbDeviceInterface.detachKernelDriver();
        }

        this.usbDeviceInterface.claim();

        this.usbOutEndpoint = this.usbDeviceInterface.endpoints[0];
        this.usbOutEndpoint.transferType = usb.LIBUSB_TRANSFER_TYPE_BULK;


        this.usbInEndpoint = this.usbDeviceInterface.endpoints[1];
        this.usbInEndpoint.transferType = usb.LIBUSB_TRANSFER_TYPE_BULK;
        this.usbInEndpoint.startPoll(1, 512);
        this.usbInEndpoint.on('end', this._handleUsbEnd.bind(this));
        this.usbInEndpoint.on('data', this._handleUsbData.bind(this));
        this.usbInEndpoint.on('error', this._handleUsbError.bind(this));
        this.connected = true;
    }

    disconnect() {
        return new Promise((resolve, reject) => {
            if(!this.connected) {
                reject();
                return;
            }

            this.connected = false;

            this.usbInEndpoint.stopPoll(err => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve();

                this._closeUsb();
            });
        });
    }


    _closeUsb() {
        return new Promise(
            (resolve, reject) => {
                this.usbDeviceInterface.release(true, err => {
                    if(err) {
                        reject(err);
                        return;
                    }

                    try {
                        this.usbDevice.close();
                        resolve();
                    } catch(e) {
                        reject(e);
                    }

                });
            }
        );
    }

    async _handleUsbEnd() {
        console.log('USB polling ended, restarting');
        if(!this.connected) {
            console.log('Reconnecting USB');
            await this.connect();
        } else {
            this.usbInEndpoint.startPoll(1, 512);
        }
    }

    async _handleUsbError(err) {
        console.log(err);

        switch(err.errno) {
            case usb.LIBUSB_TRANSFER_STALL:
                console.log('USB Transfer stalled, clearHalt');
                this.usbInEndpoint.clearHalt(err => {});
                break;

            case usb.LIBUSB_TRANSFER_ERROR:
                console.log('USB Transfer error, disconnecting');
                await this.disconnect();
                break;

            default:
                console.log(`Unhandled USB error: ${err}`);
                break;
        }
    }

    _handleUsbData(buffer) {
        try {
            const message = MessageFactory.createMessageFromBuffer(buffer);

            switch(message.cmd) {
                case BAIKAL_RESET:
                    this.emit('reset', message);
                    break;

                case BAIKAL_GET_INFO:
                    this.emit('info', message);
                    break;

                case BAIKAL_SET_OPTION:
                    this.emit('set_option', message);
                    break;

                case BAIKAL_GET_RESULT:
                    this.emit('result', message);
                    break;

                case BAIKAL_SEND_WORK:
                    this.emit('send_work', message);
                    break;


                default:
                    console.log('Received unknown message');
                    console.log(message);
                    break;
            }
        } catch (e) {
            console.log(`Could not create message from usbBuffer: ${e}`);
        }
    }

    resetUsb() {
        return new Promise((resolve, reject) => {

            this.usbDevice.reset((err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });

        });
    }

    async requestReset() {
        return this._sendMessage(BAIKAL_RESET);
    }

    async requestInfo(deviceId) {
        return this._sendMessage(BAIKAL_GET_INFO, deviceId);
    }

    async requestIdentify(deviceId) {
        return this._sendMessage(BAIKAL_SET_ID, deviceId);
    }

    async requestIdle() {
        return this._sendMessage(BAIKAL_SET_IDLE);
    }

    async sendWork(deviceId, workIndex, algorithm, target, header) {
        const data = Buffer.alloc(header.length+10, 0);

        let pos = 0;
        data.writeUInt8(algorithm, pos++);
        data.writeUInt8(deviceId, pos++);

        target
            .toBuffer({
                size: 4
            })
            .slice(0,8)
            .swap32()
            .copy(data, pos);

        pos += 8;

        header.copy(data, 10);

        return this._sendMessage(BAIKAL_SEND_WORK, deviceId, workIndex, 0, data);
    }

    requestResult(deviceId) {
        return this._sendMessage(BAIKAL_GET_RESULT, deviceId);
    }

    async setOption(deviceId, cutoffTemp, fanSpeed) {
        const data = Buffer.alloc(4);
        let pos = 0;

        /*
        data.writeUInt8(((clk / 10) % 20) + 2, pos++);
        data.writeUInt8(algo, pos++);
        */
        //has no effect on baikal gb
        data.writeUInt8(0, pos++);
        data.writeUInt8(0, pos++);

        data.writeUInt8(cutoffTemp, pos++);
        data.writeUInt8(fanSpeed, pos++);

        return this._sendMessage(BAIKAL_SET_OPTION, deviceId, 0, 0, data);
    }

    /**
     *
     * @param cmd
     * @param deviceId
     * @param param
     * @param dest
     * @param data
     * @returns {Promise<any>}
     * @private
     */
    _sendMessage(cmd, deviceId = 0, param = 0, dest = 0, data = null) {
        return new Promise((resolve, reject) => {
            if(!this.connected) {
                reject('Not connected');
            }

            const buf = MessageFactory.createBuffer(cmd, deviceId, param, dest, data);

            try {
                this.usbOutEndpoint.transfer(buf, err => {
                    if(err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });

            } catch(e) {
                console.log(`Could not send via USB: ${e}`);
            }
        });
    }
}

exports.BaikalUsbInterface = BaikalUsbInterface;