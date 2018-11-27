const
    { Work } = require('./Work');

class WorkGenerator {
    constructor(algorithm, client) {
        this.algorithm = algorithm;
        this.client = client;
    }

    setJob(job) {
        this.job = job;
        this.nonceGenerator = this.algorithm.createNonceGenerator(this.client.extraNonce2Size);
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
                header = this.algorithm.createBlockHeaderFromJob(this.job, this.client.extraNonce1, nonce2);

        //TODO: if nonce2 overflow, change time

        return new Work(this.job, this.client.algorithm, this.client.extraNonce1, nonce2, header);
    }


}

exports.WorkGenerator = WorkGenerator;