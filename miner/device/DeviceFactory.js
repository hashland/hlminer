const
    usb                                     = require('usb'),
    { BaikalUsbDevice }                     = require('./baikal/BaikalUsbDevice'),
    { CpuDevice }                           = require('./CpuDevice');

class DeviceFactory {
    static createAvailableDevices(createCpuDevice) {
        const usbDevices = usb.getDeviceList();

        const devices = [];

        devices.push(new BaikalUsbDevice());

        if(createCpuDevice) {
            devices.push(new CpuDevice());
        }

        return devices;
    }
}

exports.DeviceFactory = DeviceFactory;