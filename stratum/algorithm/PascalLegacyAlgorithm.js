const
    multiHashing = require('multi-hashing'),
    { maximumTarget } = require('./constants'),
    { BitcoinAlgorithm } = require('./BitcoinAlgorithm'),
    bignum = require('bignum'),
    { PASCAL_LEGACY } = require('./Algorithm'),
    { AsciiGenerator } = require('../generator/AsciiGenerator'),
    BLOCK_HEADER_SIZE = 200,
    BLOCK_HEADER_NONCE_OFFSET = BLOCK_HEADER_SIZE - 4;


class PascalLegacyAlgorithm extends BitcoinAlgorithm {
    constructor() {
        super();
        this.multiplier = 1;
    }

    getName() {
        return PASCAL_LEGACY;
    }

    createNonceGenerator(nonceSize) {
        return new AsciiGenerator(nonceSize);
    }

    createBlockHeaderFromJob(job, extraNonce1, extraNonce2, nonce) {
        return this.createBlockHeader(job.part1, extraNonce1, extraNonce2, job.part3, job.time, nonce);
    }

    createBlockHeader(part1, extraNonce1, extraNonce2, part3, time, nonce) {
        const blockHeader = Buffer.alloc(BLOCK_HEADER_SIZE, 0);

        let pos = 0;

        const part2Payload = extraNonce1 + extraNonce2;

        pos = Buffer.from(part1 + part2Payload + part3, 'hex').copy(blockHeader, pos);

        //time LE encoded
        Buffer
            .from(time, 'hex')
            .swap32()
            .copy(blockHeader, pos);
        pos += 4;

        //last 4 bytes reserved for nonce (will be initialized with 0)
        if (nonce) {
            Buffer
                .from(nonce, 'hex')
                .copy(blockHeader, pos);
            pos += 4;

        }

        return blockHeader;
    }

    hash(blockHeader) {
        return multiHashing.sha256d(blockHeader);
    }

    hashToBignum(hash) {
        return bignum.fromBuffer(hash, {endian: 'big', size: 32});
    }

}

exports.PascalLegacyAlgorithm = PascalLegacyAlgorithm;
