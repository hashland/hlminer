const { BaikalUsbDevice } = require('./miner/device/baikal/BaikalUsbDevice'),
    baikal = new BaikalUsbDevice(),
    {Miner} = require('./miner/Miner.js');

const miner = new Miner(
    [baikal],
    'lbry',
    'lbry.eu.nicehash.com',
    3356,
    'xxx',
    'x'
);

miner.start();

process.on('SIGINT', () => {
    miner.shutdown().then(() => process.exit());
});

process.on('SIGTERM', () => {
    miner.shutdown().then(() => process.exit());
});
