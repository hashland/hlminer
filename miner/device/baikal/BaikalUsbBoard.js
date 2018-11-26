const {
        BAIKAL_STATUS_NONCE_READY,
        BAIKAL_STATUS_JOB_EMPTY,
        BAIKAL_STATUS_NEW_MINER,
        toBaikalAlgorithm
    } = require('./constants'),
    {RingBuffer} = require('../../util/RingBuffer'),
    EventEmitter = require('events');

class BaikalUsbBoard extends EventEmitter {
    constructor(usbInterface, id) {
        super();

        this.usbInterface = usbInterface;
        this.id = id;

        this.usbInterface.on('info', this._handleInfo.bind(this));
        this.usbInterface.on('result', this._handleResult.bind(this));

        this.firmwareVersion = null;
        this.hardwareVersion = null;
        this.clock = null;
        this.asicCount = null;
        this.asicVersion = null;
        this.temperature = null;

        this.ringBuffer = new RingBuffer(255);
    }


    /**
     * Info Request for the given device
     * @param message
     * @returns {Promise<void>}
     * @private
     */
    async _handleInfo(message) {
        if(message.board_id !== this.id)
            return;

        this.firmwareVersion = message.fw_ver;
        this.hardwareVersion = message.hw_ver;
        this.clock = message.clock;
        this.asicCount = message.asic_count;
        this.asicVersion = message.asic_ver;
    }

    /**
     * Result request for the given device
     * @param message
     * @returns {Promise<void>}
     * @private
     */
    async _handleResult(message) {
        if(message.board_id !== this.id)
            return;

        switch(message.status) {
            case BAIKAL_STATUS_NONCE_READY:

                try {
                    const workIndex = message.work_idx,
                        work = this.ringBuffer.get(workIndex);

                    //this.index
                    console.log(`Found for ${message.board_id}: ${workIndex} / ${this.ringBuffer.index}`);

                    this.emit('nonce_found', work, `BLKU ${this.id}`, message.nonce);

                } catch(e) {
                    console.log('Could not find work for workIndex: ' + e);

                }

                break;

            case BAIKAL_STATUS_JOB_EMPTY:
                break;

            case BAIKAL_STATUS_NEW_MINER:
                this.emit('error');
                break;
        }

        this.temperature = message.temp;
    }

    async requestInfo() {
        return await this.usbInterface.requestInfo(this.id);
    }

    async setOption(cutOffTemperature, fanSpeed) {
        return await this.usbInterface.setOption(this.id, cutOffTemperature, fanSpeed);
    }

    async addWork(work) {
        const workIndex = this.ringBuffer.push(work);

        try {
            await this.usbInterface.sendWork(this.id, workIndex, toBaikalAlgorithm(work.algorithm), work.target, work.blockHeader);

            //TODO: Move this into a work loop
            await this.usbInterface.requestResult(this.id);
        } catch(e) {
            console.log(`Could not send work to device: ${e}`);
        }

    }
}

exports.BaikalUsbBoard = BaikalUsbBoard;