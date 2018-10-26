const EventEmitter = require('events');

class Device extends EventEmitter {

    constructor() {
        super();
        this.type = "";
    }
}

exports.Device = Device;