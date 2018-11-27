const
    {LbryAlgorithm} = require('./LbryAlgorithm'),
    Algorithm = require('./Algorithm');

class AlgorithmFactory {
    static createAlgorithm(algorithm) {
        switch (algorithm) {
            case Algorithm.LBRY:
                return new LbryAlgorithm();
        }
    }
}

exports.AlgorithmFactory = AlgorithmFactory;
