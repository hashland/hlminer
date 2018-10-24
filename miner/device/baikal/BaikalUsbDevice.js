const

    {
        BAIKAL_FAN_TEMP_STEPS,
        BAIKAL_CUTOFF_TEMP,
        BAIKAL_FANSPEED_DEF,
        BAIKAL_STATUS_NONCE_READY,
        BAIKAL_STATUS_JOB_EMPTY,
        BAIKAL_STATUS_NEW_MINER,
        BAIKAL_WORK_FIFO,
        toBaikalAlgorithm
    } = require('./constants'),
    EventEmitter = require('events'),
    {RingBuffer} = require('../../util/RingBuffer'),
    {BaikalUsbInterface} = require('./BaikalUsbInterface');

class BaikalUsbDevice extends EventEmitter {
    constructor(usbDevice) {
        super();

        this.devices = [];

        this.cutOffTemperature = BAIKAL_CUTOFF_TEMP;
        this.fanSpeed = BAIKAL_FANSPEED_DEF;

        this.buffer = new RingBuffer(BAIKAL_WORK_FIFO);
        this.deviceCount = 0;

        this.usbInterface = new BaikalUsbInterface(usbDevice);

        this.jobEmpty = false;

        this.usbInterface.on('reset', this._handleReset.bind(this));
        this.usbInterface.on('info', this._handleInfo.bind(this));
        this.usbInterface.on('result', this._handleResult.bind(this));
        this.usbInterface.on('set_option', this._handleSetOption.bind(this));
        this.usbInterface.on('send_work', this._handleSendWork.bind(this));
        this.usbInterface.on('idle', this._handleIdle.bind(this));


    }

    /**
     * Device was sent to idle mode
     * @param message
     * @returns {Promise<void>}
     * @private
     */
    async _handleIdle(message) {
        console.log('Device is now idle');
    }

    /**
     * Set option request for the given device was successful
     * @param message
     * @returns {Promise<void>}
     * @private
     */
    async _handleSetOption(message) {
       //just swallow this event
    }

    /**
     * New work was sent to the given device
     * @param message
     * @returns {Promise<void>}
     * @private
     */
    async _handleSendWork(message) {
        const device = this.devices.find(d => d.id === message.device_id);

        if(!device) {
            console.log('Could not find device for send_work');
            return;
        }

        device.clk = message.param << 1;
    }

    /**
     * Result request for the given device
     * @param message
     * @returns {Promise<void>}
     * @private
     */
    async _handleResult(message) {
        const device = this.devices.find(d => d.id === message.device_id);

        if(!device) {
            console.log('Could not find device for result');
            return;
        }

        switch(message.status) {
            case BAIKAL_STATUS_NONCE_READY:

                try {
                    const workIndex = message.work_idx,
                        work = this.buffer.get(workIndex);

                    this.emit('nonce_found', work, `BLKU ${message.device_id}`, message.nonce);

                } catch(e) {
                    console.log('Could not find work for workIndex: ' + e);

                }

                break;

            case BAIKAL_STATUS_JOB_EMPTY:
                this.jobEmpty = true;
                break;

            case BAIKAL_STATUS_NEW_MINER:
                this.reset();
                break;
        }

        device.temp = message.temp;
    }

    /**
     * Info Request for the given device
     * @param message
     * @returns {Promise<void>}
     * @private
     */
    async _handleInfo(message) {
        let device = this.devices.find(d => d.id == message.device_id);

        const isNew = !device;

        if(isNew) {
            device = {
                temp: 0
            };
        }

        device.id = message.device_id;

        ['fw_ver', 'hw_ver', 'clock', 'asic_count', 'asic_ver']
            .forEach((i) => device[i] = message[i]);

       if(isNew) {
            this.devices.push(device);
        }
    }

    /**
     * Called when the device was resetted
     * @param message
     * @returns {Promise<void>}
     * @private
     */

    async _handleReset(message) {
        this.devices = [];
        this.deviceCount = message.device_count;

        for(let deviceId=0; deviceId<this.deviceCount; deviceId++) {
            await this.usbInterface.requestInfo(deviceId);
            await this.usbInterface.setOption(deviceId, this.cutOffTemperature, this.fanSpeed);
        }
    }

    _checkTemperature() {
        const temperatures = this.devices.filter(d => typeof d.temp !== "undefined").map(d => d.temp),
            maxTemperature = Math.max(...temperatures);

        if(temperatures.length != this.devices.length) {
            console.log('Warning: Could not get temperatures for all devices');
        }

        let fanSpeed = 100;

        for (const temp in BAIKAL_FAN_TEMP_STEPS) {
            const speed = BAIKAL_FAN_TEMP_STEPS[temp];

            if(maxTemperature < temp) {
                fanSpeed = speed;
                break;
            }
        }

        if(fanSpeed != this.fanSpeed) {
            console.log('>>>>>>>>>>>>>>> MAX TEMP CHANGED TO ' + maxTemperature + ' SETTING FAN SPEED TO ' + fanSpeed);

            this.setFanSpeed(fanSpeed);
        }
    }

    setFanSpeed(fanSpeed) {
        if(fanSpeed < 0 || fanSpeed > 100) {
            throw 'Fan value out of bounds';
        }

        this.fanSpeed = fanSpeed;

        this._setOptions();
    }



    async _workLoop() {
        this.jobEmpty = false;

        for(let i =0; i<this.deviceCount; i++){
            await this.usbInterface.requestResult(i);
        }

        this._checkTemperature();
    }

    /**
     * Device Interface
     */

    async start() {
        this.usbInterface.connect();
        this.usbInterface.requestReset();

        this.workLoopInterval = setInterval(this._workLoop.bind(this), 250);
    }

    async _setOptions() {
        for(let deviceId=0; deviceId<this.deviceCount; deviceId++) {
            await this.usbInterface.setOption(deviceId, this.cutOffTemperature, this.fanSpeed);
        }
    }

    async stop() {
        clearInterval(this.workLoopInterval);
        this.usbInterface.requestIdle();
    }

    async reset() {
        await this.stop();

        await this.usbInterface.resetUsb();

        await this.start();
    }


    needsWork() {
        return this.jobEmpty === true;
    }

    async addToWorkQueue(work) {
        const workIndex = this.buffer.push(work);
        const deviceId = workIndex % this.deviceCount;

        try {
            await this.usbInterface.sendWork(deviceId , workIndex, toBaikalAlgorithm(work.algorithm), work.target, work.blockHeader);


        } catch(e) {
            this.reset();
        }

    }

    clearWorkQueue() {

    }
}

exports.BaikalUsbDevice = BaikalUsbDevice;