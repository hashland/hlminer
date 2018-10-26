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
    {Device} = require('../Device'),
    {RingBuffer} = require('../../util/RingBuffer'),
    {BaikalUsbInterface} = require('./BaikalUsbInterface');

class BaikalUsbDevice extends Device {
    constructor() {
        super();
        this.type = "baikalusb";

        this.workQueue = [];
        this.boards = [];

        this.cutOffTemperature = BAIKAL_CUTOFF_TEMP;
        this.fanSpeed = BAIKAL_FANSPEED_DEF;

        this.ringBuffer = new RingBuffer(BAIKAL_WORK_FIFO);
        this.deviceCount = 0;

        this.usbInterface = new BaikalUsbInterface();

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
        const device = this.boards.find(d => d.id === message.board_id);

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
        const device = this.boards.find(d => d.id === message.board_id);

        if(!device) {
            console.log('Could not find device for result');
            return;
        }

        switch(message.status) {
            case BAIKAL_STATUS_NONCE_READY:

                try {
                    const workIndex = message.work_idx,
                        work = this.ringBuffer.get(workIndex);

                    console.log('Found for ' + workIndex);

                    this.emit('nonce_found', work, `BLKU ${message.board_id}`, message.nonce);

                } catch(e) {
                    console.log('Could not find work for workIndex: ' + e);

                }

                break;

            case BAIKAL_STATUS_JOB_EMPTY:
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
        let device = this.boards.find(d => d.id == message.board_id);

        const isNew = !device;

        if(isNew) {
            device = {
                temp: 0
            };
        }

        device.id = message.board_id;

        ['fw_ver', 'hw_ver', 'clock', 'asic_count', 'asic_ver']
            .forEach((i) => device[i] = message[i]);

       if(isNew) {
            this.boards.push(device);
        }
    }

    /**
     * Called when the device was resetted
     * @param message
     * @returns {Promise<void>}
     * @private
     */

    async _handleReset(message) {
        this.boards = [];
        this.deviceCount = message.device_count;

        for(let deviceId=0; deviceId<this.deviceCount; deviceId++) {
            await this.usbInterface.requestInfo(deviceId);
            await this.usbInterface.setOption(deviceId, this.cutOffTemperature, this.fanSpeed);
        }
    }

    _checkTemperature() {
        const temperatures = this.boards.filter(d => typeof d.temp !== "undefined").map(d => d.temp),
            maxTemperature = Math.max(...temperatures);

        if(temperatures.length != this.boards.length) {
            console.log('Warning: Could not get temperatures for all boards');
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
        for(let deviceId=0; deviceId<this.deviceCount; deviceId++){
            if(this.workQueue.length > 0) {
                const work = this.workQueue.pop(),
                    workIndex = this.ringBuffer.push(work);

                await this.usbInterface.sendWork(deviceId, workIndex, toBaikalAlgorithm(work.algorithm), work.target, work.blockHeader);
            }

            await this.usbInterface.requestResult(deviceId);
        }

        this._checkTemperature();
    }

    async _setOptions() {
        for(let deviceId=0; deviceId<this.deviceCount; deviceId++) {
            await this.usbInterface.setOption(deviceId, this.cutOffTemperature, this.fanSpeed);
        }
    }

    /**
     * Device Interface
     */
    async start() {
        await this.usbInterface.connect();
        await this.usbInterface.requestReset();

        this.workLoopInterval = setInterval(this._workLoop.bind(this), 250);
    }

    async stop() {
        clearInterval(this.workLoopInterval);

        await this.usbInterface.requestIdle();
        await this.disconnect();
    }

    async reset() {
        await this.stop();
        await this.start();
    }

    needsWork() {
        return this.workQueue.length < 10;
    }

    async addToWorkQueue(work) {
        this.workQueue.push(work);
    }

    clearWorkQueue() {
        this.workQueue = [];
    }
}

exports.BaikalUsbDevice = BaikalUsbDevice;