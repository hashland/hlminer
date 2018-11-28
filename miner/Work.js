class Work {
    constructor(job, extraNonce1, nonce2, blockHeader) {
        this.job = job;
        this.extraNonce1 = extraNonce1;
        this.nonce2 = nonce2;
        this.blockHeader = blockHeader;
    }
}

exports.Work = Work;