const
    {BitcoinJob} = require('./BitcoinJob'),
    multiHashing = require('multi-hashing'),
    bignum = require('bignum'),
    maximumTarget = bignum("26959535291011309493156476344723991336010898738574164086137773096960");

class PascalJob extends BitcoinJob {


    constructor(id, prevHash, coinb1, coinb2, merkleRoot, version, bits, time) {
        super(id, prevHash, coinb1, coinb2, merkleRoot, version, bits, time);
        this.multiplier = 1;
        this.maximumTarget = maximumTarget;
    }

    static fromParamsArray(params) {
        return new PascalJob(
            params[0], params[1], params[2], params[3], params[4], params[5], params[6], params[7]
        );
    }

    toParamsArray() {
        return [this.id, this.prevHash, this.coinb1, this.coinb2, this.merkleBranches, this.version, this.bits, this.time];
    }

    toSubmitArray(nonce, nonce2) {
        const nonceLittleEndian = Buffer.from(nonce, 'hex').swap32().toString('hex');
        return [this.id, nonce2, this.time, nonceLittleEndian];
    }

    calculateTarget(difficulty) {

        const truediffone   = bignum("26959535291011309493156476344723991336010898738574164086137773096960")
        const bits64        = bignum("18446744073709551616");
        const bits128       = bignum("340282366920938463463374607431768211456");
        const bits192       = bignum("6277101735386680763835789423207666416102355444464034512896");
        const diff_multiplier2 = 1;

        const d64 = truediffone.mul(diff_multiplier2).div(difficulty);

        return d64;
    }

    hash(blockHeader) {
        return multiHashing.sha256d(blockHeader);
    }

    hashBignum(blockheader) {
        const hash = this.hash(blockheader);
        return bignum.fromBuffer(hash, {endian: 'big', size: 32});
    }


    createBlockHeader(extraNonce1, extraNonce2, nonce) {
        const blockHeader = Buffer.alloc(PascalJob.BLOCK_HEADER_SIZE, 0);

        let pos = 0;

        const payload = Buffer.from(this.coinb1 + extraNonce1 + extraNonce2 + this.coinb2, 'hex');
        pos = payload.copy(blockHeader, pos);

        //time LE encoded
        Buffer
            .from(this.time, 'hex')
            .swap32()
            .copy(blockHeader, pos);
        pos += 4;

        //last 4 bytes reserved for nonce (will be initialized with 0)
        if(nonce) {
            Buffer
                .from(nonce, 'hex')
                .copy(blockHeader, pos);
            pos += 4;

        }

        return blockHeader;
    }
}

PascalJob.BLOCK_HEADER_SIZE = 200;
PascalJob.BLOCK_HEADER_NONCE_OFFSET = PascalJob.BLOCK_HEADER_SIZE - 4;

exports.PascalJob = PascalJob;