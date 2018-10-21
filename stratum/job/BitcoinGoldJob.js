const
    {ZcashJob} = require('./ZcashJob');

class BitcoinGoldJob extends ZcashJob {

    constructor(id, version, prevHash, merkleRoot, height, time, bits) {
        super(id, version, prevHash, merkleRoot, time, bits);

        /**
         * The block height
         */
        this.height = height;
    }

    static fromParamsArray(params) {
        const height = params[4].substring(0, 8);

        return new BitcoinGoldJob(
            params[0], params[1], params[2], params[3], height, params[5], params[6]
        );
    }

    toParamsArray() {
        return [
            this.id,
            this.version,
            this.prevHash,
            this.merkleRoot,
            this.height + '00000000000000000000000000000000000000000000000000000000',
            this.time,
            this.bits
        ];
    }
}

exports.BitcoinGoldJob = BitcoinGoldJob;