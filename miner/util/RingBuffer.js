class RingBuffer {
    constructor(size) {
        this.index = 0;
        this.size = size;
        this.buffer = [];
    }

    get(index) {
        if(!this.buffer[index])
            throw `Could not access index ${index}`;

        return this.buffer[index];
   }

    /**
     * Pushes item to the ring buffer and returns the index used in the buffer
     * @param item
     * @returns {number}
     */
   push(item) {
       const index = this.index;

       this.buffer[index] = item;

       this.index = (this.index + 1) % this.size;

       return index;
   }


    /**
     * Get previous element of the buffer and decrement internal index
     * @returns {*}
     */
    prev() {
        const prevIndex = (this.index - 1) % this.size;

        if (this.buffer[prevIndex]) {
            this.index = prevIndex;
            return this.buffer[prevIndex];
        }

        return null;
    }

    /**
     * Get next element of the buffer and increment internal index
     * @returns {*}
     */
    next() {
        const nextIndex = (this.index + 1) % this.size;

        if (this.buffer[nextIndex]) {
            this.index = nextIndex;
            return this.buffer[nextIndex];
        }
    }
};

exports.RingBuffer = RingBuffer;