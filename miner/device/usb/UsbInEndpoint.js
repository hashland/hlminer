const usb = require('usb'),
    {UsbEndpoint} = require('./UsbEndpoint');

class UsbInEndpoint extends UsbEndpoint {
    constructor(device, descriptor) {
        super(device, descriptor);
        this.direction = "in";
    }

    transfer(length, cb) {
        const self = this,
            buffer = Buffer.alloc(length);

        function callback(error, buf, actual) {
            cb.call(self, error, buffer.slice(0, actual))
        }

        try {
            this.makeTransfer(this.timeout, callback).submit(buffer);
        } catch (e) {
            process.nextTick(() => {
                cb.call(self, e);
            });
        }
        return this;
    }

    startPoll(nTransfers, transferSize) {
        const self = this;
        this.pollTransfers = super.startPoll.call(this, nTransfers, transferSize, transferDone);

        function transferDone(error, buf, actual) {
            if (!error) {
                self.emit("data", buf.slice(0, actual))
            } else if (error.errno != usb.LIBUSB_TRANSFER_CANCELLED) {
                self.emit("error", error);
                self.stopPoll();
            }

            if (self.pollActive) {
                startTransfer(this);
            } else {
                self.pollPending--;

                if (self.pollPending == 0) {
                    self.emit('end');
                }
            }
        }

        function startTransfer(t) {
            try {
                t.submit(Buffer.alloc(self.pollTransferSize), transferDone);
            } catch (e) {
                self.emit("error", e);
                self.stopPoll();
            }
        }

        this.pollTransfers.forEach(startTransfer);
        self.pollPending = this.pollTransfers.length;
    }
}

exports.UsbInEndpoint = UsbInEndpoint;