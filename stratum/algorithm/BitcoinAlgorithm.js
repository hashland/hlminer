const
    multiHashing = require('multi-hashing'),
    { maximumTarget } = require('./constants'),
    bignum = require('bignum'),
    { NonceGenerator } = require('../generator/NonceGenerator');

class BitcoinAlgorithm {
    constructor() {
        this.multiplier = 1;
    }

    createNonceGenerator(nonceSize) {
        return new NonceGenerator(nonceSize);
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


    /**
     * Create Merkle Root for given parameters
     * @param coinb1
     * @param extraNonce1
     * @param extraNonce2
     * @param coinb2
     * @param merkleBranches
     * @returns {*}
     */
    createMerkleRoot(coinb1, extraNonce1, extraNonce2, coinb2, merkleBranches) {
        const coinbase = Buffer.from(coinb1 + extraNonce1 + extraNonce2 + coinb2, 'hex');

        let merkleRoot = multiHashing.sha256d(coinbase);

        if(Array.isArray(merkleBranches)) {
            merkleBranches
                .map(mb => Buffer.from(mb, 'hex'))
                .forEach(mb => merkleRoot = multiHashing.sha256d(Buffer.concat([merkleRoot, mb])));
        }

        return merkleRoot;
    }
}

exports.BitcoinAlgorithm = BitcoinAlgorithm;
