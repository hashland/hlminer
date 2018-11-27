const
    {BitcoinClient} = require('./BitcoinClient'),
    {ZcashClient} = require('./ZcashClient'),
    Algorithm = require('../algorithm/Algorithm');

class ClientFactory {
    static createClient(algorithm, options) {
        switch (algorithm) {
            case Algorithm.EQUIHASH:
                return new ZcashClient(options);
                break;

            default:
                return new BitcoinClient(options);
                break;
        }
    }
}

exports.ClientFactory = ClientFactory;
