const
    {BitcoinJob} = require('./BitcoinJob');

class LbryJob extends BitcoinJob {


    constructor(id, prevHash, claimtrie, coinb1, coinb2, merkleRoot, version, bits, time) {
        super(id, prevHash, coinb1, coinb2, merkleRoot, version, bits, time);

        /**
         * Claimtrie
         */
        this.claimtrie = claimtrie;
    }

    static fromParamsArray(params) {
        return new LbryJob(
            params[0], params[1], params[2], params[3], params[4], params[5], params[6], params[7], params[8]
        );
    }

    toParamsArray() {
        return [this.id, this.prevHash, this.claimtrie, this.coinb1, this.coinb2, this.merkleBranches, this.version, this.bits, this.time];
    }

    toSubmitArray(nonce, nonce2) {
        return [this.id, nonce2, this.time, nonce];
    }
}

exports.LbryJob = LbryJob;