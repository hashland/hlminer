const
    usb = require('usb'),
    {BAIKAL_ID_VENDOR, BAIKAL_ID_PRODUCT} = require('./baikal/constants'),
    {BaikalUsbDevice} = require('./baikal/BaikalUsbDevice'),
    {CpuDevice} = require('./CpuDevice');

class DeviceFactory {
    static createAvailableDevices(createCpuDevice) {
        let devices = [];

        const usbDevices = usb.getDeviceList(),
            baikalDevices = usbDevices
                .filter(
                    device => device.deviceDescriptor.idVendor === BAIKAL_ID_VENDOR &&
                        device.deviceDescriptor.idProduct === BAIKAL_ID_PRODUCT
                )
                .map(usbDevice => new BaikalUsbDevice(usbDevice));

        devices = devices.concat(baikalDevices);

        if (createCpuDevice) {
            devices.push(new CpuDevice());
        }

        return devices;
    }
}

exports.DeviceFactory = DeviceFactory;