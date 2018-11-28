const StratumClientFactory = require('../stratum/client/ClientFactory').ClientFactory,
    {DeviceFactory} = require('./device/DeviceFactory'),
    {WorkGenerator} = require('./WorkGenerator'),
    Koa = require('koa'),
    app = new Koa(),
    {name, version} = require('root-require')('package.json'),
    {AlgorithmFactory} = require('../stratum/algorithm/AlgorithmFactory');

class Miner {
    constructor(algorithm, host, port, user, password, includeCpuDevice, protocolDump) {
        this.devices = DeviceFactory.createAvailableDevices(includeCpuDevice);
        this.jobs = [];
        this.mainLoopInterval = null;
        this.statsInterval = null;

        this.algorithm = AlgorithmFactory.createAlgorithm(algorithm);

        this.devices.forEach(device => {
            device.setAlgorithm(this.algorithm)
        });

        if(null === this.algorithm) {
            throw `Unknown algorithm: ${algorithm}`
        }

        this.client = StratumClientFactory.createClient(algorithm, {
            algorithm: algorithm,
            host: host,
            port: port,
            user: user,
            password: password,
            agent: `${name}/${version}`,
            debug: protocolDump
        });

        this.client.on('authorized', this._handleClientConnect.bind(this));
        this.client.on('disconnect', this._handleClientDisconnect.bind(this));
        this.client.on('subscribed', this._handleClientSubscription.bind(this));
        this.client.on('mining.set_difficulty', this._handleClientDiffChange.bind(this));
        this.client.on('notify', this._handleClientNotify.bind(this));

        this.startTime = 0;
        this._registerWebHooks();
    }

    _registerWebHooks() {
        app.use(async ctx => {
            ctx.body = {
                start_time: this.startTime,
                version: version,
                pools: [{
                    algorithm: this.client.algorithm,
                    host: this.client.host,
                    port: this.client.port,
                    user: this.client.user,
                    password: this.client.password
                }],
                devices: this.devices.map(d => {

                    return {
                        type: d.type,
                        hashrate: d.getHashrate(),
                        effective_hashrate: d.getEffectiveHashrate(),
                        boards: d.boards.map(board => {
                            return {
                                id: board.getId(),

                                hardware_version: board.getHardwareVersion(),
                                firmware_version: board.getFirmwareVersion(),

                                chip_count: board.getChipCount(),
                                chip_clock: board.getChipClock(),

                                temperature: board.getTemperature(),


                                difficulty: board.getDifficulty(),
                                hashrate: board.getHashrate(),
                                effective_hashrate: board.getEffectiveHashrate(),

                                algorithm: board.getAlgorithm() != null ? board.getAlgorithm().getName() : null
                            }
                        })
                    }
                })
            };
        });
    }

    _clearJobs() {
        this.jobs = [];
        this.devices.forEach(dev => dev.clearWorkQueue());
    }

    _handleClientDiffChange([difficulty]) {
        console.log(`Difficulty changed to ${difficulty}`);

        this.difficulty = difficulty;
        this.target = this.algorithm.getTargetForDifficulty(difficulty);

        this.devices.forEach(device => {
            device.setTarget(this.target)
        });
    }

    _handleClientConnect() {
        console.log('Stratum client connected');
        this._clearJobs();
    }

    _handleClientSubscription() {
        console.log('Stratum client subscribed');
        this.workGenerator = new WorkGenerator(this.algorithm, this.client);
    }

    _handleClientDisconnect(reason) {
        console.log(`Stratum client disconnected: ${reason}`);
        this._clearJobs();
    }

    _handleClientNotify(job, cleanJobs) {
        if (true === cleanJobs) {
            this._clearJobs();
        }

        this.workGenerator.setJob(job);

        this.jobs.push(job);
    }

    _handleMainLoop() {
        this.devices.forEach(dev => {
            try {
                while(dev.needsWork()) {
                        const work = this.workGenerator.generateWork();
                        dev.addToWorkQueue(work);
                }
            } catch (e) {
                console.log(`Could not generate work: ${e}`);
            }
        });
    }

    _handleStats() {
        this.printStats();
    }

    _handleShareFound(share) {
        const work = share.work;

        if(share.difficulty < this.client.difficulty) {
            console.log(`Share difficulty ${share.difficulty} was lower than work difficulty (${this.client.difficulty}), discarded`);
            return;
        }

        const params = work.job.toSubmitArray(share.nonce, work.nonce2);

        this.client.submit(params).then(() => {
            console.log(`[Share accepted] diff: ${share.difficulty}/${this.client.difficulty} from board_id: ${share.board_id}`);

        }, err => {
            console.log(`[Share rejected] diff: ${share.difficulty}/${this.client.difficulty} from board_id: ${share.board_id} | reason: ${err}`);
        })


    }

    formatHashrate(hashrate) {
        return (hashrate / 1000 / 1000).toFixed(2) + " GH/s";
    }

    printStats() {
        this.devices.forEach(device => {
            const
                deviceInfo = `[${device.getId()}] hashrate: ${this.formatHashrate(device.getHashrate())}, ${this.formatHashrate(device.getEffectiveHashrate())} (effective)`,
                boardsInfo = device.boards.map(board => ` |- [${board.id}] hashrate: ${this.formatHashrate(board.getHashrate())}, ${this.formatHashrate(board.getEffectiveHashrate())} (effective), hw_ver: ${board.getHardwareVersion()}, fw_ver: ${board.getFirmwareVersion()},  temp: ${board.temperature}°C` ).join("\n");

            console.log("");
            console.log(deviceInfo);
            console.log(boardsInfo);
            console.log("");

        });
    }

    start() {
        this.startTime = Date.now() / 1000 | 0;

        this.devices.forEach(dev => {
            dev.start();
            dev.on('share_found', this._handleShareFound.bind(this));
        });

        //TODO: Promise after init
        this.client.connect();

        this.mainLoopInterval = setInterval(
            this._handleMainLoop.bind(this),
            250
        );

        this.statsInterval = setInterval(
            this._handleStats.bind(this),
            5000
        );

        app.listen(3000);
    }

    async shutdown() {
        clearInterval(this.mainLoopInterval);
        clearInterval(this.statsInterval);

        this.devices.forEach(dev => {
            dev.stop();
        });
    }
}

exports.Miner = Miner;