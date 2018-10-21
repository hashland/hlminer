class ZcashJob {
    constructor(id, version, prevHash, merkleRoot, time, bits) {
        /**
         * The id of this job.
         */
        this.id = id;

        /**
         * The block header version
         *
         * Used as a switch for subsequent parameters. At time of writing, the only defined block header
         * version is 4. Miners SHOULD alert the user upon receiving jobs containing block header versions
         * they do not know about or support, and MUST ignore such jobs.
         */
        this.version = version;

        /**
         * The 32-byte hash of the previous block
         */
        this.prevHash = prevHash;

        /**
         * The 32-byte Merkle root of the transactions in this block
         */
        this.merkleRoot = merkleRoot;

        /**
         * The block time suggested by the server
         */
        this.time = time;

        /**
         * Encoded current network difficulty
         */
        this.bits = bits;
    }

    static fromParamsArray(params) {
        return new ZcashJob(
            params[0], params[1], params[2], params[3], params[5], params[6]
        );
    }

    toParamsArray() {
        return [
            this.id,
            this.version,
            this.prevHash,
            this.merkleRoot,
            '0000000000000000000000000000000000000000000000000000000000000000', //A 32-byte reserved field. Zero by convention.
            this.time,
            this.bits
        ];
    }
}

exports.ZcashJob = ZcashJob;