const
    multiHashing = require('multi-hashing'),
    { maximumTarget } = require('./constants'),
    bignum = require('bignum');

class BitcoinAlgorithm {
    constructor() {
        this.multiplier = 1;
    }

    /**
     * Calculate the target for the given difficulty
     * @param difficulty
     * @returns bignum
     */
    getTargetForDifficulty(difficulty) {
        return maximumTarget.mul(this.multiplier).div(difficulty);
    }

    /**
     * Calculate the difficulty for the given hash
     * @param hashBignum
     * @returns bignum
     */
    getHashDifficulty(hashBignum) {
        return maximumTarget.div(hashBignum).mul(this.multiplier);
    }
}

exports.BitcoinAlgorithm = BitcoinAlgorithm;
