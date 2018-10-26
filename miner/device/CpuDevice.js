const
    {Device} = require('./Device')
    multiHashing = require('multi-hashing');

class CpuDevice extends Device {
    constructor() {
        super();
        this.type = "cpu";
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