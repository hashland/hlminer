const
    {Miner} = require('./miner/Miner.js');

const miner = new Miner(
    'lbry',
    'lbry.suprnova.cc',
    6257,
    'hashland.test',
    'x',
    false
);

miner.start();

process.on('SIGINT', () => {
    miner.shutdown().then(() => process.exit());
});

process.on('SIGTERM', () => {
    miner.shutdown().then(() => process.exit());
});
