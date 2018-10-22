const EventEmitter = require('events'),
    multiHashing = require('multi-hashing');

class CpuDevice extends EventEmitter {
    constructor() {
        super();
    }

    async start() {
    }

    async stop() {

    }

    async reset() {

    }

    needsWork() {

    }

    async addToWorkQueue(work) {
    }

    async clearWorkQueue() {

    }
}

exports.CpuDevice = CpuDevice;