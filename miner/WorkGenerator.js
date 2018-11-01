const
    { NonceGenerator } = require('../stratum/generator/NonceGenerator'),
    { AsciiGenerator } = require('../stratum/generator/AsciiGenerator'),
    Algorithm = require('../stratum/Algorithm'),
    { Work } = require('./Work');

class WorkGenerator {
    constructor(client) {
        this.client = client;
    }

    setJob(job) {
        this.job = job;

        if (this.client.algorithm === Algorithm.PASCAL) {
            this.nonceGenerator = new AsciiGenerator(this.client.extraNonce2Size);
        } else {
            this.nonceGenerator = new NonceGenerator(this.client.extraNonce2Size);
        }
    }

    /**
     * Return next header to do hashing on
     */
    generateWork() {
        if(!this.client.difficulty)
            throw 'Client has no difficulty';

        if(!this.client.extraNonce1)
            throw 'Client has no extraNonce1';

        if(!this.job)
            throw 'Client has no job';

        const   nonce2 = this.nonceGenerator.getNext('hex'),
                header = this.job.createBlockHeader(this.client.extraNonce1, nonce2);

        //TODO: if noce2 overflow, change time

        //TODO: algorithm specific work
        const target = this.job.calculateTarget(this.client.difficulty);
        return new Work(this.job, this.client.algorithm, target, this.client.extraNonce1, nonce2, header);
    }


}

exports.WorkGenerator = WorkGenerator;