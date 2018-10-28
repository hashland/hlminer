const StratumClientFactory = require('../stratum/client/ClientFactory').ClientFactory,
    {DeviceFactory} = require('./device/DeviceFactory'),
    {WorkGenerator} = require('./WorkGenerator'),
    bignum = require('bignum'),
    Koa = require('koa'),
    app = new Koa();

class Miner {
    constructor(algorithm, host, port, user, password, includeCpuDevice) {
        this.devices = DeviceFactory.createAvailableDevices(includeCpuDevice);
        this.jobs = [];
        this.mainLoopInterval = null;

        this.client = StratumClientFactory.createClient(algorithm, {
            algorithm: algorithm,
            host: host,
            port: port,
            user: user,
            password: password,
            agent: 'hlminer/0.1'
        });

        this.client.on('connect', this._handleClientConnect.bind(this));
        this.client.on('disconnect', this._handleClientDisconnect.bind(this));
        this.client.on('subscribed', this._handleClientSubscription.bind(this));

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
                        "type": d.type
                    }
                })
            };
        });
    }

    _clearJobs() {
        this.jobs = [];
        this.devices.forEach(dev => dev.clearWorkQueue());
    }

    _handleClientConnect() {
        console.log('Stratum client connected');
        this._clearJobs();
    }

    _handleClientSubscription() {
        console.log('Stratum client subscribed');
        this.workGenerator = new WorkGenerator(this.client);
    }

    _handleClientDisconnect(reason) {
        console.log(`Stratum client disconnected: ${reason}`);
        this._clearJobs();

        setTimeout(() => {
            this.client.connect();
        }, 3000);

        //TODO: add variable delay
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

            while(dev.needsWork()) {
                const work = this.workGenerator.generateWork();
                dev.addToWorkQueue(work);
            }
        });
    }

    _handleNonceFound(work, deviceId, nonce) {
        const header = work.job.createBlockHeader(work.extraNonce1, work.nonce2, nonce),
            hash = work.job.hash(header);


        const hashBignum = bignum.fromBuffer(hash, {endian: 'little', size: 32}),
            shareDiff = work.job.maximumTarget / hashBignum.toNumber() * work.job.multiplier;

        if(shareDiff < 1 || shareDiff < this.client.difficulty) {
            console.log(`Share difficulty ${shareDiff} was lower than work difficulty (${this.client.difficulty}), target is: ${work.target.toBuffer().toString('hex')} possible hardware error`);
            return;
        }

        console.log(`[Found share] Difficulty ${shareDiff.toFixed(3)} (work diff: ${this.client.difficulty}) on device: ${deviceId}`);

        const params = [
            work.job.id,
            work.nonce2,
            work.job.time,
            nonce
        ];

        const me = this;

        this.client.submit(params).then(() => {
            console.log('Share was accepted :-)');

        }, err => {
            console.log(`SHARE WAS NOT ACCEPTED: ${err}`);
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