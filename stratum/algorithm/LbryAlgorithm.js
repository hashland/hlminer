const
    multiHashing = require('multi-hashing'),
    { maximumTarget } = require('./constants'),
    { BitcoinAlgorithm } = require('./BitcoinAlgorithm'),
    bignum = require('bignum');

class LbryAlgorithm extends BitcoinAlgorithm {
    constructor() {
        super();
        this.multiplier = 256;
    }
}

exports.LbryAlgorithm = LbryAlgorithm;
