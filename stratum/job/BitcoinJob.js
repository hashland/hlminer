const hash = require('multi-hashing');

class BitcoinJob {
    constructor(id, prevHash, coinb1, coinb2, merkleBranches, version, bits, time) {
        /**
         * ID of the job. Use this ID while submitting share generated from this job
         */
        this.id = id;

        /**
         * Hash of previous block
         */
        this.prevHash = prevHash;

        /**
         * Initial part of coinbase transaction
         */
        this.coinb1 = coinb1;

        /**
         * Final part of coinbase transaction
         */
        this.coinb2 = coinb2;

        /**
         * The Merkle branches of all transsactions
         */
        this.merkleBranches = merkleBranches;

        /**
         * Bitcoin block version
         */
        this.version = version;

        /**
         * Encoded current network difficulty
         */
        this.bits = bits;

        /**
         * Current time
         */
        this.time = time;
    }

    static fromParamsArray(params) {
        return new BitcoinJob(
            params[0], params[1], params[2], params[3], params[4], params[5], params[6], params[7]
        );
    }

    toParamsArray() {
        return [this.id, this.prevHash, this.coinb1, this.coinb2, this.merkleBranches, this.version, this.bits, this.time];
    }
}

exports.BitcoinJob = BitcoinJob;