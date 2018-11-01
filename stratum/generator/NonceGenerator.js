class NonceGenerator {
    /**
     * Generates a nonce for the given size
     * @param sizeInBytes
     */
    constructor(sizeInBytes) {
        this.size = sizeInBytes;
        this.counter = 0;
        this.max = Math.pow(2, sizeInBytes * 8);
        this.buffer = Buffer.alloc(sizeInBytes, 0);
    }

    getNext(format) {
        if(this.counter === this.max)
            throw 'Counter reached max value';

        this.buffer.writeUIntLE(this.counter, 0, this.size);

        this.counter++;

        return (format === 'hex') ? this.buffer.toString('hex') : this.buffer;
    }

    reset() {
        this.counter = 0;
    }
}

exports.NonceGenerator = NonceGenerator;