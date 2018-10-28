const usb = require('usb'),
    {UsbInEndpoint} = require('./UsbInEndpoint'),
    {UsbOutEndpoint} = require('./UsbOutEndpoint');

class UsbInterface {
    constructor(device, id) {
        this.device = device;
        this.id = id;
        this.altSetting = 0;
        this.endpoints = []

        this.__refresh();
    }

    __refresh() {
        this.descriptor = this.device.configDescriptor.interfaces[this.id][this.altSetting]
        this.interfaceNumber = this.descriptor.bInterfaceNumber

        this.endpoints = this.descriptor.endpoints.map(
            desc => (desc.bEndpointAddress & usb.LIBUSB_ENDPOINT_IN) ? new UsbInEndpoint(this.device, desc) : new UsbOutEndpoint(this.device, desc)
        );

    }

    claim() {
        this.device.__claimInterface(this.id)
    }

    isKernelDriverActive() {
        return this.device.__isKernelDriverActive(this.id);
    }

    detachKernelDriver() {
        return this.device.__detachKernelDriver(this.id)
    }

    attachKernelDriver() {
        return this.device.__attachKernelDriver(this.id)
    }

    release(closeEndpoints, cb) {
        var self = this;
        if (typeof closeEndpoints == 'function') {
            cb = closeEndpoints;
            closeEndpoints = null;
        }

        if (!closeEndpoints || this.endpoints.length == 0) {
            next();
        } else {
            var n = self.endpoints.length;
            self.endpoints.forEach((ep, i) => {
                if (ep.pollActive) {
                    ep.once('end', () => {
                        if (--n == 0) next();
                    });
                    ep.stopPoll();
                } else {
                    if (--n == 0) next();
                }
            });
        }

        function next() {
            self.device.__releaseInterface(self.id, function (err) {
                if (!err) {
                    self.altSetting = 0;
                    self.__refresh()
                }
                cb.call(self, err)
            })
        }
    }

    setAltSetting(altSetting, cb) {
        var self = this;
        this.device.__setInterface(this.id, altSetting, err => {
            if (!err) {
                self.altSetting = altSetting;
                self.__refresh();
            }
            cb.call(self, err)
        })

    }

    endpoint(addr) {
        for (var i = 0; i < this.endpoints.length; i++) {
            if (this.endpoints[i].address == addr) {
                return this.endpoints[i]
            }
        }
    }
}

exports.UsbInterface = UsbInterface;