const
    {BitcoinJob} = require('./BitcoinJob'),
    multiHashing = require('multi-hashing'),
    bignum = require('bignum'),
    maximumTarget = bignum("26959535291011309493156476344723991336010898738574164086137773096960");

class LbryJob extends BitcoinJob {


    constructor(id, prevHash, claimtrie, coinb1, coinb2, merkleRoot, version, bits, time) {
        super(id, prevHash, coinb1, coinb2, merkleRoot, version, bits, time);

        /**
         * Claimtrie
         */
        this.claimtrie = claimtrie;
        this.maximumTarget = maximumTarget;
        this.multiplier = Math.pow(2, 8);
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

    calculateTarget(difficulty) {
        const truediffone   = bignum("26959535291011309493156476344723991336010898738574164086137773096960")
        const bits64        = bignum("18446744073709551616");
        const bits128       = bignum("340282366920938463463374607431768211456");
        const bits192       = bignum("6277101735386680763835789423207666416102355444464034512896");
        const diff_multiplier2 = 256;

        const d64 = truediffone.mul(diff_multiplier2).div(difficulty).div(bits192);

      //  console.log(d64.toBuffer().toString('hex'));

        return d64;
    }

    hash(blockHeader) {
        return multiHashing.lbry(blockHeader);
    }


    hashBignum(blockheader) {
        const hash = this.hash(blockheader);
        return bignum.fromBuffer(hash, {endian: 'little', size: 32});
    }


    createBlockHeader(extraNonce1, extraNonce2, nonce) {
        const blockHeader = Buffer.alloc(LbryJob.BLOCK_HEADER_SIZE, 0);

        let pos = 0;

        //version
        blockHeader
            .writeUInt32LE(
                Buffer.from(this.version, 'hex').readUInt32BE(0), pos
            );
        pos += 4;

        //previous hash
        Buffer
            .from(this.prevHash, 'hex')
            .swap32().copy(blockHeader, pos);
        pos += 32;

        //merkle root
        this
            .createMerkleRoot(extraNonce1, extraNonce2)
            .copy(blockHeader, pos);
        pos += 32;

        //claimtree
        Buffer
            .from(this.claimtrie, 'hex')
            .swap32()
            .copy(blockHeader, pos);
        pos += 32;

        //time
        Buffer
            .from(this.time, 'hex')
            .swap32()
            .copy(blockHeader, pos);
        pos += 4;

        //bits
        Buffer
            .from(this.bits, 'hex')
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
}

LbryJob.BLOCK_HEADER_SIZE = 112;
LbryJob.BLOCK_HEADER_NONCE_OFFSET = LbryJob.BLOCK_HEADER_SIZE - 4;

exports.LbryJob = LbryJob;