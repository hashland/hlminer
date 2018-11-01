class AsciiGenerator {
    /**
     * Generates ASCII string with characters in the range from min to max
     * @param sizeInBytes
     * @param min
     * @param max
     */
    constructor(sizeInBytes, min = 32, max = 254) {
        this.size = sizeInBytes;
        this.min = min;
        this.max = max;

        this.counters = [];
        this.buffer = Buffer.alloc(sizeInBytes, 0);

        this.reset();
    }

    getNext(format) {
        for(let i=0; i<this.size; i++) {
            const counter = this.counters[i];

            if(counter > this.max)
                continue;

            this.buffer.writeUInt8(counter, i);

            this.counters[i]++;

            return (format === 'hex') ? this.buffer.toString('hex') : this.buffer;
        }

        throw 'Counter reached max value';
    }

    reset() {
        for(let i=0; i<this.size; i++) {
            this.counters[i] = this.min;
            this.buffer.writeUInt8(this.counters[i], i);
        }
    }
}

exports.AsciiGenerator = AsciiGenerator;