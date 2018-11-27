/**
 * Pascal Coin
 * https://github.com/PascalCoin/PascalCoin/wiki/Create-a-Pool-miner
 */
class PascalLegacyJob  {
    constructor(id, part1, part3,  time) {
        this.id = id;
        this.part1 = part1;
        this.part3 = part3;
        this.time = time;
    }

    static fromParamsArray(params) {
        return new PascalLegacyJob(
            params[0], params[2], params[3], params[7]
        );
    }

    toParamsArray() {
        return [this.id, "", this.part1, this.part3, [], "", "", this.time];
    }

    toSubmitArray(nonce, nonce2) {
        const nonceLittleEndian = Buffer.from(nonce, 'hex').swap32().toString('hex');
        return [this.id, nonce2, this.time, nonceLittleEndian];
    }
}


exports.PascalJob = PascalLegacyJob;