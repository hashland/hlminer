const {
        BAIKAL_STATUS_NONCE_READY,
        BAIKAL_STATUS_JOB_EMPTY,
        BAIKAL_STATUS_NEW_MINER,
        toBaikalAlgorithm
    } = require('./constants'),
    {bits192, maximumTarget} = require('../../../stratum/algorithm/constants'),
    bignum = require('bignum'),
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

        this.target = null;
        this.lastNonceFoundAt = 0;
        this.lastNonceWorkIndex = null;
        this.noncesFound = 0;
    }

    getHashRate() {
        return this.clock * this.asicCount * 512;
    }

    setTarget(target) {
        // target is managed in the hashboards with 8 bytes accurancy, so strip away the rest
        this.target = target.div(bits192);
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
                        work = this.ringBuffer.get(workIndex),
                        now = Date.now();

                    //this.index
                    console.log(`Found for ${message.board_id}: ${workIndex} / ${this.ringBuffer.index}`);


                    const timeSinceLastNonce = this.lastNonceFoundAt ? now - this.lastNonceFoundAt : 0;

                    this.lastNonceFoundAt = now;
                    this.lastNonceWorkIndex = workIndex;
                    this.noncesFound++;

                    const workRemain = Math.abs((workIndex-255-this.ringBuffer.index)%255);

                    console.log(`workRemain: ${workRemain} timeSinceLastNonce: ${timeSinceLastNonce}`);


                    this.emit('nonce_found', work, `BLKU ${this.id}`, message.nonce);

                } catch(e) {
                    console.log('Could not find work for workIndex: ',e);

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
            await this.usbInterface.sendWork(this.id, workIndex, toBaikalAlgorithm(work.algorithm), this.target, work.blockHeader);

            //TODO: Move this into a work loop
            await this.usbInterface.requestResult(this.id);
        } catch(e) {
            console.log(`Could not send work to device: ${e}`);
        }

    }
}

exports.BaikalUsbBoard = BaikalUsbBoard;