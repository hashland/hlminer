const
    {UsbInterface} = require('./UsbInterface'),
    usb = require('usb');

class UsbDevice extends usb.Device {
    constructor(test) {
        super(test);

        this.interfaces = [];
        this.timeout = 1000;
    }

    open() {
        this.__open()

        let id = 0;
        this.interfaces = this.configDescriptor.interfaces.map(
            i => new UsbInterface(this, id++)
        );
    }

    close() {
        this.__close()
        this.interfaces = [];
    }

    getStringDescriptor(descIndex, callback) {
        const langid = 0x0409,
            length = 255;
        this.controlTransfer(
            usb.LIBUSB_ENDPOINT_IN,
            usb.LIBUSB_REQUEST_GET_DESCRIPTOR,
            ((usb.LIBUSB_DT_STRING << 8) | descIndex),
            langid,
            length,
            function (error, buf) {
                if (error) return callback(error);
                callback(undefined, buf.toString('utf16le', 2));
            }
        );
    }

    setConfiguration(desired, cb) {
        const self = this;
        this.__setConfiguration(desired, function (err) {
            if (!err) {
                this.interfaces = [];
                const len = this.configDescriptor.interfaces.length;
                for (let i = 0; i < len; i++) {
                    this.interfaces[i] = new Interface(this, i)
                }
            }
            cb.call(self, err)
        });
    }

    controlTransfer(bmRequestType, bRequest, wValue, wIndex, data_or_length, callback) {
        const self = this,
            isIn = !!(bmRequestType & usb.LIBUSB_ENDPOINT_IN);
        let wLength;

        if (isIn) {
            if (!(data_or_length >= 0)) {
                throw new TypeError("Expected size number for IN transfer (based on bmRequestType)")
            }
            wLength = data_or_length
        } else {
            if (!Buffer.isBuffer(data_or_length)) {
                throw new TypeError("Expected buffer for OUT transfer (based on bmRequestType)")
            }
            wLength = data_or_length.length
        }

        // Buffer for the setup packet
        // http://libusbx.sourceforge.net/api-1.0/structlibusb__control__setup.html
        var buf = Buffer.alloc(wLength + usb.LIBUSB_CONTROL_SETUP_SIZE)
        buf.writeUInt8(bmRequestType, 0);
        buf.writeUInt8(bRequest, 1);
        buf.writeUInt16LE(wValue, 2);
        buf.writeUInt16LE(wIndex, 4);
        buf.writeUInt16LE(wLength, 6);

        if (!isIn) {
            data_or_length.copy(buf, usb.LIBUSB_CONTROL_SETUP_SIZE)
        }

        const transfer = new usb.Transfer(this, 0, usb.LIBUSB_TRANSFER_TYPE_CONTROL, this.timeout,
            function (error, buf, actual) {
                if (callback) {
                    if (isIn) {
                        callback.call(self, error, buf.slice(usb.LIBUSB_CONTROL_SETUP_SIZE, usb.LIBUSB_CONTROL_SETUP_SIZE + actual))
                    } else {
                        callback.call(self, error)
                    }
                }
            }
        )

        try {
            transfer.submit(buf)
        } catch (e) {
            if (callback) {
                process.nextTick(function () {
                    callback.call(self, e);
                });
            }
        }
        return this;
    }

    interface(addr) {
        if (!this.interfaces) {
            throw new Error("Device must be open before searching for interfaces")
        }
        addr = addr || 0
        for (var i = 0; i < this.interfaces.length; i++) {
            if (this.interfaces[i].interfaceNumber == addr) {
                return this.interfaces[i]
            }
        }
    }

    get configDescriptor() {
        return this._configDescriptor || (this._configDescriptor = this.__getConfigDescriptor())
    }

    get parent() {
        return this._parent || (this._parent = this.__getParent())
    }

    get allConfigDescriptors() {
        return this._allConfigDescriptors || (this._allConfigDescriptors = this.__getAllConfigDescriptors())
    }
}

exports.UsbDevice = UsbDevice;