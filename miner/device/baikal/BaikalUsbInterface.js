const
    usb                     = require('usb'),
    {MessageFactory}        = require('./MessageFactory'),
    ioctl                   = require('ioctl'),
    // Equivalent of the _IO('U', 20) constant in the linux kernel.
    USBDEVFS_RESET          = "U".charCodeAt(0) << (4*2) | 20,
    fs                      = require('fs'), {
        BAIKAL_RESET,
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

class BaikalUsbInterface {
    constructor(usbDevice) {
        this.usbDevice = usbDevice;
        this.usbDeviceInterface = null;
        this.usbKernelDriverWasAttached = false;
        this.usbOutEndpoint = null;
        this.usbInEndpoint = null;
        this.usbMutex = false;
    }

    connect() {
        if(!this.usbDevice)
            throw 'Missing usbDevice';

        this.usbDevice.open();

        this.usbDeviceInterface = this.usbDevice.interface(1);

        if (this.usbDeviceInterface.isKernelDriverActive()) {
            this.usbKernelDriverWasAttached = true;
            this.usbDeviceInterface.detachKernelDriver();
        } else {
            this.usbKernelDriverWasAttached = false;
        }

        this.usbDeviceInterface.claim();

        this.usbOutEndpoint = this.usbDeviceInterface.endpoints[0];
        this.usbInEndpoint = this.usbDeviceInterface.endpoints[1];

        this.usbOutEndpoint.transferType = usb.LIBUSB_TRANSFER_TYPE_BULK;
    }



    resetUsb() {
        return new Promise(
            (resolve, reject) => {
                console.log(`Resetting USB`);

                fs.open(`/dev/bus/usb/${('00' + this.usbDevice.busNumber).slice(-3)}/${('00' + this.usbDevice.deviceAddress).slice(-3)}`, 'w+', (err, fd) => {
                    const ret = ioctl(fd, USBDEVFS_RESET, 0);

                    if(ret < 0) {
                        console.log('Could not reset usb device');
                        reject();

                    } else {
                        console.log('USB reset successful');
                        resolve();
                    }
                });

            }
        )
    }

    resetHashboard() {
        return this._sendMessage(BAIKAL_RESET);

    }

    async getInfo(deviceId) {
        return this._sendMessage(BAIKAL_GET_INFO, deviceId);
    }


    async identify(deviceId) {
        return this._sendMessage(BAIKAL_SET_ID, deviceId);
    }

    async setIdle() {
        return this._sendMessage(BAIKAL_SET_IDLE);
    }

    async sendWork(deviceId, workIndex, algorithm, target, header) {
        const data = Buffer.alloc(header.length+10, 0);

        let pos = 0;
        data.writeUInt8(algorithm, pos++);
        data.writeUInt8(deviceId, pos++);

        //todo: target is 64bit switch to bignum
        data.writeInt32LE(target, pos);
        data.writeInt32LE(0, pos+4);
        pos += 8;

        header.copy(data, 10);

        return await this._sendMessage(BAIKAL_SEND_WORK, deviceId, workIndex, 0, data);
    }

    requestResult(deviceId) {
        return this._sendMessage(BAIKAL_GET_RESULT, deviceId);
    }

    async setOptions(cutoffTemp, fanSpeed) {

        for(let i=0; i<this.deviceCount; i++) {
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

            const test = await this._sendMessage(BAIKAL_SET_OPTION, i, 0, 0, data);
        }

    }


    _waitForUsb() {
        const me = this;

        return new Promise((resolve, reject) => {
            if(me.usbMutex === false) {
                resolve();
                return;
            }

            const waitInterval = setInterval(() => {
                console.log('Waiting for USB');

                if (me.usbMutex === false) {
                    clearInterval(waitInterval);
                    resolve();
                }
            }, 50);



        });
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
        const me = this;

        return new Promise((resolve, reject) => {

            this._waitForUsb().then(() => {
                const buf = MessageFactory.createBuffer(cmd, deviceId, param, dest, data);

                this.usbMutex = true;

                this.usbOutEndpoint.transfer(buf, err => {

                    if(err) {
                        reject(err);
                    } else {
                        this.usbInEndpoint.transfer(512, (err, buffer) => {
                            this.usbMutex = false;

                            if(err) {
                                reject(err);
                            } else {
                                const message = MessageFactory.createMessageFromBuffer(buffer);
                                resolve(message);
                            }
                        });
                    }
                });
            })

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