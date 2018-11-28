```
 _                  _      _                    _ 
| |                | |    | |                  | |
| |__    __ _  ___ | |__  | |  __ _  _ __    __| |
| '_ \  / _` |/ __|| '_ \ | | / _` || '_ \  / _` |
| | | || (_| |\__ \| | | || || (_| || | | || (_| |
|_| |_| \__,_||___/|_| |_||_| \__,_||_| |_| \__,_|
 
                  Hashland's Miner
```

This is a crypto currency miner written in JavaScript.

### Supported Devices
* Baikal Giant B (only lbry at the moment)

### Dependencies for development

Development is only tested with Ubuntu 18.04

```
# install needed packages
sudo apt install build-essential libusb-1.0-0 libusb-1.0-0-dev

# install/compile all needed node packages
GYP_DEFINES="use_udev=0 use_system_libusb=true" npm install
```
