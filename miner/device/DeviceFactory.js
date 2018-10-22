const
    usb                                     = require('usb'),
    { BaikalUsbDevice }                     = require('./baikal/BaikalUsbDevice'),
    { CpuDevice }                           = require('./CpuDevice'),
    {BAIKAL_ID_VENDOR, BAIKAL_ID_PRODUCT}   = require('./baikal/constants');

class DeviceFactory {
    static createAvailableDevices(createCpuDevice) {
        const usbDevices = usb.getDeviceList();

        const devices = [];

        usbDevices.forEach(usbDevice => {
            const deviceDesc = usbDevice.deviceDescriptor;

            if (deviceDesc.idVendor == BAIKAL_ID_VENDOR && deviceDesc.idProduct == BAIKAL_ID_PRODUCT) {
                devices.push(new BaikalUsbDevice(usbDevice));
            }
        });

        if(createCpuDevice) {
            devices.push(new CpuDevice());
        }

        return devices;
    }
}

exports.DeviceFactory = DeviceFactory;