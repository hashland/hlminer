const usb = require('usb'),
    EventEmitter = require('events');

class UsbEndpoint extends EventEmitter {
    constructor(device, descriptor) {
        super();
        this.device = device;
        this.descriptor = descriptor;
        this.address = descriptor.bEndpointAddress;
        this.transferType = descriptor.bmAttributes & 0x03;

        this.timeout = 0;
    }

    clearHalt(callback) {
        return this.device.__clearHalt(this.address, callback);
    }

    makeTransfer(timeout, callback) {
        return new usb.Transfer(this.device, this.address, this.transferType, timeout, callback);
    }

    startPoll(nTransfers, transferSize, callback) {
        if (this.pollTransfers) {
            throw new Error("Polling already active");
        }

        nTransfers = nTransfers || 3;
        this.pollTransferSize = transferSize || this.descriptor.wMaxPacketSize;
        this.pollActive = true;
        this.pollPending = 0;

        let transfers = [];
        for (let i = 0; i < nTransfers; i++) {
            transfers[i] = this.makeTransfer(0, callback);
        }
        return transfers;
    }

    stopPoll(cb) {
        const self = this;

        if (!this.pollTransfers) {
            throw new Error('Polling is not active.');
        }

        this.pollTransfers.forEach(t => {
            try {
                t.cancel();

            } catch (err) {
                self.emit('error', err);
            }
        });

        this.pollActive = false;
        if (cb) this.once('end', cb);
    }
}


exports.UsbEndpoint = UsbEndpoint;