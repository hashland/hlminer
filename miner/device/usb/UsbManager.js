const usb = require('usb'),
    EventEmitter = require('events'),
    {UsbDevice} = require('./UsbDevice')

if (usb.INIT_ERROR) {
    console.warn("Failed to initialize libusb.")
    usb.Device = function () {
        throw new Error("Device cannot be instantiated directly.")
    };
    usb.Transfer = function () {
        throw new Error("Transfer cannot be instantiated directly.")
    };
    usb.setDebugLevel = function () {
    };
    usb.getDeviceList = function () {
        return [];
    };
    usb._enableHotplugEvents = function () {
    };
    usb._disableHotplugEvents = function () {
    };
}

usb.Device.prototype = UsbDevice.prototype;

class UsbManager extends EventEmitter {
    constructor() {
        super();
        this.hotplugListeners = 0;

        this.on('newListener', name => {
            if (name !== 'attach' && name !== 'detach') return;

            if (++this.hotplugListeners === 1) {
                usb._enableHotplugEvents();
            }
        });

        this.on('removeListener', name => {
            if (name !== 'attach' && name !== 'detach') return;

            if (--this.hotplugListeners === 0) {
                usb._disableHotplugEvents();
            }
        });
    }

    static findAllByIds(vid, pid) {
        return usb.getDeviceList().filter(
            device => device.deviceDescriptor.idVendor === vid && device.deviceDescriptor.idProduct == pid
        );
    }

    static findByIds(vid, pid) {
        return usb.getDeviceList().find(
            device => device.deviceDescriptor.idVendor === vid && device.deviceDescriptor.idProduct == pid
        );
    }

    static getDeviceList() {
        return usb.getDeviceList();
    }
}

exports.UsbManager = UsbManager;