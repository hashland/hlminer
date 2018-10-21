class NonceGenerator {
    constructor(nonceSizeInBytes) {
        this.nonceSizeInBytes = nonceSizeInBytes;
        this.counter = 0;
        this.max = Math.pow(2, nonceSizeInBytes * 8);
        this.buffer = Buffer.alloc(nonceSizeInBytes, 0);
    }

    getNext(format) {
        if(this.counter === this.max)
            throw 'Counter reached max value';

        this.buffer.writeUIntLE(this.counter, 0, this.nonceSizeInBytes);

        this.counter++;

        return (format === 'hex') ? this.buffer.toString('hex') : this.buffer;
    }

    reset() {
        this.counter = 0;
    }
}

exports.NonceGenerator = NonceGenerator;