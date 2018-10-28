const
    { UsbManager }                          = require('./usb/UsbManager'),
    { BAIKAL_ID_VENDOR, BAIKAL_ID_PRODUCT } = require('./baikal/constants'),
    { BaikalUsbDevice }                     = require('./baikal/BaikalUsbDevice'),
    { CpuDevice }                           = require('./CpuDevice');

class DeviceFactory {
    static createAvailableDevices(createCpuDevice) {
        let devices = [];

        const baikalDevices = UsbManager.findAllByIds(BAIKAL_ID_VENDOR, BAIKAL_ID_PRODUCT);
        devices = devices.concat(baikalDevices.map(usbDevice => new BaikalUsbDevice(usbDevice)));

        if(createCpuDevice) {
            devices.push(new CpuDevice());
        }


        return devices;
    }
}

exports.DeviceFactory = DeviceFactory;