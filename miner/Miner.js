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

        this.algorithm = AlgorithmFactory.createAlgorithm(algorithm);

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
                miner: {
                    start_time: this.startTime,
                    pools: [{
                        algorithm: this.client.algorithm,
                        host: this.client.host,
                        port: this.client.port,
                        user: this.client.user,
                        password: this.client.password
                    }]
                },
                devices: this.devices.map(d => {
                    return {
                        "type": d.type,
                        "boards": d.boards.map(board => {
                            return {
                                temperature: board.temperature,
                                hardwareVersion: board.hardwareVersion,
                                firmwareVersion: board.firmwareVersion,
                                clock: board.clock,
                                asicVersion: board.asicVersion,
                                asicCount: board.asicCount

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

    _handleNonceFound(work, deviceId, nonce) {
        const
            header = this.algorithm.createBlockHeaderFromJob(work.job, work.extraNonce1, work.nonce2, nonce),
            hashBignum = this.algorithm.hashBignum(header),
            shareDiff = this.algorithm.getHashDifficulty(hashBignum).toNumber();

        if(shareDiff < 1 || shareDiff < this.difficulty) {
            console.log(`Share difficulty ${shareDiff} was lower than work difficulty (${this.client.difficulty}), discarded`);
            return;
        }

        const params = work.job.toSubmitArray(nonce, work.nonce2);

        this.client.submit(params).then(() => {
            console.log(`[Share accepted] diff: ${shareDiff}/${this.client.difficulty} | device: ${deviceId}`);

        }, err => {
            console.log(`[Share rejected] diff: ${shareDiff}/${this.client.difficulty} | device: ${deviceId} | reason: ${err}`);
        })

    }

    start() {
        this.startTime = Date.now() / 1000 | 0;

        this.devices.forEach(dev => {
            dev.start();
            dev.on('nonce_found', this._handleNonceFound.bind(this));
        });

        //TODO: Promise after init
        this.client.connect();

        this.mainLoopInterval = setInterval(
            this._handleMainLoop.bind(this),
            250
        );

        app.listen(3000);
    }

    async shutdown() {
        clearInterval(this.mainLoopInterval);

        this.devices.forEach(dev => {
            dev.stop();
        });
    }
}

exports.Miner = Miner;