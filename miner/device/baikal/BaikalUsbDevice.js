const

    {
        BAIKAL_ID_VENDOR,
        BAIKAL_ID_PRODUCT,
        BAIKAL_GET_RESULT,
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
    }

    _checkTemperature() {
        const temperatures = this.devices.map(d => d.temp),
            maxTemperature = Math.max(...temperatures);

        let fanSpeed;

        if (maxTemperature < 30) {
            fanSpeed = 0;
        } else if ( maxTemperature < 35 ) {
            fanSpeed = 15;
        } else if ( maxTemperature < 40 ) {
            fanSpeed = 30;
        } else if ( maxTemperature < 45 ) {
            fanSpeed = 45;
        } else if ( maxTemperature < 50 ) {
            fanSpeed = 70;
        } else {
            fanSpeed = 100;
        }

        if(fanSpeed != this.fanSpeed) {
            console.log('>>>>>>>>>>>>>>> MAX TEMP CHANGED TO ' + maxTemperature + ' SETTING FAN SPEED TO ' + fanSpeed);
            this.fanSpeed = fanSpeed;
        }

        this.usbInterface.setOptions(this.cutOffTemperature, this.fanSpeed);
    }

    setFanSpeed(fanSpeed) {
        if(fanSpeed < 0 || fanSpeed > 100) {
            throw 'Fan value out of bounds';
        }

        this.fanSpeed = fanSpeed;

        this.reconfigureDevices();
    }



    async _workLoop() {
        for(let i =0; i<this.deviceCount; i++){

            const result = await this.usbInterface.requestResult(i);
            const device = this.devices.find(d => d.id === result.device_id);

            if(!device) {
                console.log('Could not find device for result');
                return;
            }

            switch(result.status) {
                case BAIKAL_STATUS_NONCE_READY:

                    try {
                        const workIndex = result.work_idx,
                            work = this.buffer.get(workIndex);

                        this.emit('nonce_found', work, result.nonce);

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

            if(device)
                device.temp = result.temp;

        }

        this._checkTemperature();
    }

    /**
     * Device Interface
     */

    async start() {
        this.usbInterface.connect();
        this.workLoopInterval = setInterval(this._workLoop.bind(this), 250);

        const msg = await this.usbInterface.resetHashboard();
        const deviceCount = msg.device_count;

        this.devices = [];
        this.deviceCount = deviceCount;

        for(let i=0; i<deviceCount; i++) {
            const info = await this.usbInterface.getInfo(i),
                device = {
                    id: info.device_id,
                    fw_ver: info.fw_ver,
                    hw_ver: info.hw_ver,
                    clock: info.clock,
                    asic_count: info.asic_count,
                    asic_ver: info.asic_ver,
                    temp: 0
                };

            this.devices.push(device);
        }

        await this.usbInterface.setOptions(this.cutOffTemperature, this.fanSpeed);
    }

    async stop() {
        clearInterval(this.workLoopInterval);
        this.setIdle();
    }

    async reset() {
        await this.usbInterface.resetUsb();
        this.start();
    }


    needsWork() {
        return this.jobEmpty === true;
    }

    async addToWorkQueue(work) {
        const workIndex = this.buffer.push(work);
        const deviceId = workIndex % this.deviceCount;

        try {
            const res = await this.usbInterface.sendWork(deviceId , workIndex, toBaikalAlgorithm(work.algorithm), work.target, work.blockHeader);

            const device = this.devices.find(d => d.id === res.device_id);

            if(device)
                device.clk = res.param << 1;


        } catch(e) {
            this.reset();
        }

    }

    clearWorkQueue() {

    }
}

exports.BaikalUsbDevice = BaikalUsbDevice;