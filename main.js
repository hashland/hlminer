const
    {Miner} = require('./miner/Miner.js');

const miner = new Miner(
    'lbry',
    'lbry.eu.nicehash.com',
    3356,
    'xxx',
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
