const { NonceGenerator } = require('./util/NonceGenerator'),
    { Work } = require('./Work');

class WorkGenerator {
    constructor(client) {
        this.client = client;
    }

    setJob(job) {
        this.job = job;
        this.nonceGenerator = new NonceGenerator(this.client.extraNonce2Size);
    }


    /**
     * Return next header to do hashing on
     */
    generateWork() {
        if(!this.client.difficulty)
            throw 'Client has no difficulty';

        if(!this.client.extraNonce1)
            throw 'Client has no extraNonce1';

        const   nonce2 = this.nonceGenerator.getNext('hex'),
                target = ~( (this.client.difficulty-1) | 0xf0000000),
                header = this.job.createBlockHeader(this.client.extraNonce1, nonce2);

        //TODO: if noce2 overflow, change time

        //TODO: algorithm specific work
        return new Work(this.job, this.client.algorithm, target, this.client.extraNonce1, nonce2, header);
    }


}

exports.WorkGenerator = WorkGenerator;