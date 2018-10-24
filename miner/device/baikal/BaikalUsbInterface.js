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
        this.usbKernelDriverWasAttached = false;
        this.usbOutEndpoint = null;
        this.usbInEndpoint = null;
    }

    async connect() {
        if(!this.usbDevice)
            throw 'Missing usbDevice';

        this.usbDevice.open();
        await this.resetUsb();

        this.usbDeviceInterface = this.usbDevice.interface(1);

        if (this.usbDeviceInterface.isKernelDriverActive()) {
            this.usbKernelDriverWasAttached = true;
            this.usbDeviceInterface.detachKernelDriver();
        } else {
            this.usbKernelDriverWasAttached = false;
        }

        this.usbDeviceInterface.claim();

        this.usbOutEndpoint = this.usbDeviceInterface.endpoints[0];
        this.usbOutEndpoint.transferType = usb.LIBUSB_TRANSFER_TYPE_BULK;


        this.usbInEndpoint = this.usbDeviceInterface.endpoints[1];
        this.usbInEndpoint.on('data', this._handleUsbData.bind(this));
        this.usbInEndpoint.startPoll(1);
    }

    _handleUsbData(buffer) {
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

        const targetBuffer = target.toBuffer().slice(0,8).swap32();
        targetBuffer.copy(data, pos);
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

            const buf = MessageFactory.createBuffer(cmd, deviceId, param, dest, data);

            this.usbOutEndpoint.transfer(buf, err => {
                if(err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }



    disconnect() {
        this.usbDeviceInterface.release(() => {
            if (this.usbKernelDriverWasAttached) {
                this.usbDeviceInterface.attachKernelDriver();
            }

            this.usbDevice.close();
        })
    }

}

exports.BaikalUsbInterface = BaikalUsbInterface;