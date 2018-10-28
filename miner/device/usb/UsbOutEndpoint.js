const {UsbEndpoint} = require('./UsbEndpoint');

class UsbOutEndpoint extends UsbEndpoint {
    constructor(device, descriptor) {
        super(device, descriptor);
        this.direction = "out";
    }

    transfer(buffer, cb) {
        const self = this;
        if (!buffer) {
            buffer = Buffer.alloc(0);
        } else if (!Buffer.isBuffer(buffer)) {
            buffer = Buffer.from(buffer);
        }

        function callback(error, buf, actual) {
            if (cb) cb.call(self, error)
        }

        try {
            this.makeTransfer(this.timeout, callback).submit(buffer);
        } catch (e) {
            process.nextTick(() => {
                callback(e);
            });
        }

        return this;
    }

    transferWithZLP(buf, cb) {
        if (buf.length % this.descriptor.wMaxPacketSize == 0) {
            this.transfer(buf);
            this.transfer(Buffer.alloc(0), cb);
        } else {
            this.transfer(buf, cb);
        }
    }

}

exports.UsbOutEndpoint = UsbOutEndpoint;