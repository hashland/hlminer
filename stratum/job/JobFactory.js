const
    {BitcoinJob} = require('./BitcoinJob'),
    {BitcoinGoldJob} = require('./BitcoinGoldJob'),
    {LbryJob} = require('./LbryJob'),
    {ZcashJob} = require('./ZcashJob'),
    {PascalLegacyJob} = require('./PascalLegacyJob'),
    Algorithm = require('../algorithm/Algorithm');

class JobFactory {
    static createJobFromParamsArray(algorithm, params) {
        switch (algorithm) {
            case Algorithm.EQUIHASH:
                if (params.length >= 5 && params[4].substring(0, 8) != '00000000') {
                    return BitcoinGoldJob.fromParamsArray(params);
                } else {
                    return ZcashJob.fromParamsArray(params);
                }

                break;

            case Algorithm.LBRY:
                return LbryJob.fromParamsArray(params);
                break;

            case Algorithm.PASCAL_LEGACY:
                return PascalLegacyJob.fromParamsArray(params);
                break;

            default:
                return BitcoinJob.fromParamsArray(params);
                break;
        }
    }
}

exports.JobFactory = JobFactory;
