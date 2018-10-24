const StratumClientFactory = require('../stratum/client/ClientFactory').ClientFactory,
    {DeviceFactory} = require('./device/DeviceFactory'),
    {WorkGenerator} = require('./WorkGenerator'),
    bignum = require('bignum');

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

        this.client.on('disconnect', this._handleClientDisconnect.bind(this));
        this.client.on('subscribed', this._handleClientSubscription.bind(this));

        this.client.on('notify', this._handleClientNotify.bind(this));
    }

    _clearJobs() {
        this.jobs = [];
        this.devices.forEach(dev => dev.clearWorkQueue());
    }

    _handleClientSubscription() {
        this.workGenerator = new WorkGenerator(this.client);
    }

    _handleClientDisconnect() {
        console.log('Client was disconnected, reconnecting');
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

            if(dev.needsWork()) {
                try {
                    const work = this.workGenerator.generateWork();
                    dev.addToWorkQueue(work);
                } catch(e) {
                    console.log(e);
                }
            }
        });
    }

    _handleNonceFound(work, nonce) {
        const header = work.job.createBlockHeader(work.extraNonce1, work.nonce2, nonce),
            hash = work.job.hash(header);


        const hashBignum = bignum.fromBuffer(hash, {endian: 'little', size: 32}),
            shareDiff = work.job.maximumTarget / hashBignum.toNumber() * work.job.multiplier;

        console.log(`Found share with difficulty ${shareDiff.toFixed(3)}`);

        const params = [
            work.job.id,
            work.nonce2,
            work.job.time,
            nonce
        ];

        this.client.submit(params).then(() => {
            console.log('Share was accepted :-)');

        }, err => {
            console.log(`SHARE WAS NOT ACCEPTED: ${err}`);
        })

    }

    start() {
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
    }

    async shutdown() {
        clearInterval(this.mainLoopInterval);

        this.devices.forEach(dev => {
            dev.stop();
        });
    }
}

exports.Miner = Miner;