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
    {BaikalUsbInterface} = require('./BaikalUsbInterface'),
    {BaikalUsbBoard} = require('./BaikalUsbBoard');

class BaikalUsbDevice extends EventEmitter {
    constructor(usbDevice) {
        super();
        this.usbDevice = usbDevice;
        this.type = "baikalusb";

        this.workQueue = [];
        this.boards = [];

        this.cutOffTemperature = BAIKAL_CUTOFF_TEMP;
        this.fanSpeed = BAIKAL_FANSPEED_DEF;

        this.usbInterface = new BaikalUsbInterface(usbDevice);

        this.usbInterface.on('reset', this._handleReset.bind(this));
        this.usbInterface.on('set_option', this._handleSetOption.bind(this));
        this.usbInterface.on('idle', this._handleIdle.bind(this));

        this.target = null;
        this.algorithm = null;
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

    async _setOptions() {
        this.boards.forEach(async board => {
            await board.setOption(this.cutOffTemperature, this.fanSpeed);
        });

    }

    /**
     * Called when the device was resetted
     * @param message
     * @returns {Promise<void>}
     * @private
     */
    async _handleReset(message) {
        this.boards = [];

        for(let boardId=0; boardId<message.device_count; boardId++) {

            const board = new BaikalUsbBoard(this.usbInterface, boardId);
            board.setAlgorithm(this.algorithm);
            board.setTarget(this.target);

            board.on('nonce_found', (work, board_name, nonce) => { this.emit('nonce_found', work, board_name, nonce) });
            board.on('error', () => { this.reset() });

            await board.requestInfo();
            await board.setOption(this.cutOffTemperature, this.fanSpeed);

            this.boards.push(board);
        }
    }

    _checkTemperature() {
        const temperatures = this.boards.filter(board => typeof board.temperature !== null).map(board => board.temperature),
            maxTemperature = Math.max(...temperatures);

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

    setAlgorithm(algorithm) {
        this.algorithm = algorithm;
        this.boards.forEach(board => {
            board.setAlgorithm(algorithm);
        })
    }

    setTarget(target) {
        this.target = target;
        this.boards.forEach(board => {
            board.setTarget(target);
        })
    }


    setFanSpeed(fanSpeed) {
        if(fanSpeed < 0 || fanSpeed > 100) {
            throw 'Fan value out of bounds';
        }

        this.fanSpeed = fanSpeed;

        this._setOptions();
    }

    async _workLoop() {
        if(!this.usbInterface.connected) {
            return;
        }

        this.boards.forEach(async board => {
            if(this.workQueue.length > 0) {
                const work = this.workQueue.pop();

                await board.addWork(work)
            }
        });


        this._checkTemperature();
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