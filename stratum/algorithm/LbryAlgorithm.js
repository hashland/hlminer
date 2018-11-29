const
    multiHashing = require('multi-hashing'),
    { maximumTarget } = require('./constants'),
    { LBRY } = require('./Algorithm'),
    { BitcoinAlgorithm } = require('./BitcoinAlgorithm'),
    bignum = require('bignum'),
    BLOCK_HEADER_SIZE = 112,
    BLOCK_HEADER_NONCE_OFFSET = BLOCK_HEADER_SIZE - 4;


class LbryAlgorithm extends BitcoinAlgorithm {
    constructor() {
        super();
        this.multiplier = 256;
    }

    getName() {
        return LBRY;
    }

    createBlockHeaderFromJob(job, extraNonce1, extraNonce2, nonce) {
        return this.createBlockHeader(job.version, job.prevHash, job.coinb1, extraNonce1, extraNonce2, job.coinb2, job.merkleBranches, job.claimtrie, job.time, job.bits, nonce);
    }

    createBlockHeader(version, prevHash, coinb1, extraNonce1, extraNonce2, coinb2, merkleBranches, claimtrie, time, bits, nonce) {
        const blockHeader = Buffer.alloc(BLOCK_HEADER_SIZE, 0);

        let pos = 0;

        //version
        blockHeader
            .writeUInt32LE(
                Buffer.from(version, 'hex').readUInt32BE(0), pos
            );
        pos += 4;

        //previous hash
        Buffer
            .from(prevHash, 'hex')
            .swap32().copy(blockHeader, pos);
        pos += 32;

        //merkle root
        this
            .createMerkleRoot(coinb1, extraNonce1, extraNonce2, coinb2, merkleBranches)
            .copy(blockHeader, pos);
        pos += 32;

        //claimtree
        Buffer
            .from(claimtrie, 'hex')
            .swap32()
            .copy(blockHeader, pos);
        pos += 32;

        //time
        Buffer
            .from(time, 'hex')
            .swap32()
            .copy(blockHeader, pos);
        pos += 4;

        //bits
        Buffer
            .from(bits, 'hex')
            .swap32()
            .copy(blockHeader, pos);
        pos += 4;

        //last 4 bytes reserved for nonce (will be initialized with 0)
        if(nonce) {
            Buffer
                .from(nonce, 'hex')
                .swap32()
                .copy(blockHeader, pos);
            pos += 4;
        }

        return blockHeader;
    }

    hash(blockHeader) {
        return multiHashing.lbry(blockHeader);
    }
}

exports.LbryAlgorithm = LbryAlgorithm;
