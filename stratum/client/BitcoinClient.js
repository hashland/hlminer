const {BaseClient} = require('./BaseClient'),
    _ = require('underscore');

class BitcoinClient extends BaseClient {

    constructor(options) {
        super(options);

        /**
         * subscribed channels (channel => subscriptionId)
         * @type {Array}
         */
        this.subscriptions = {};

        //
        /**
         * hex value of nonce1 which will be included in the coinbase transaction
         * @type string
         */
        this.extraNonce1 = null;

        /**
         * size if the second extraNonce which will be integrated in the coinbase transaction
         * @type int
         */
        this.extraNonce2Size = 0;

        /**
         * current set difficulty
         * @type {null}
         */
        this.difficulty = null;
    }

    registerEventHandler() {
        super.registerEventHandler();

        this.on('mining.set_difficulty', (params) => {
            this.difficulty = params[0];
        });
    }

    _handleSubscription(params) {
        const
            subscriptions = params[0],
            extraNonce1 =  params[1],
            extraNonce2Size = params[2];

        this.subscriptions = {};

        subscriptions.forEach((subscriptionTuple) => {
            this.subscriptions[subscriptionTuple[0]] = subscriptionTuple[1];
        });

        this.extraNonce1 = extraNonce1;
        this.extraNonce2Size = extraNonce2Size;

        this.emit('subscribed');
    }

    generateSubscriptionParameters() {
        return [this.agent, this.extraNonce1];
    }

    resetParameters() {
        super.resetParameters();

        this.difficulty = null;
        this.subscriptions = {};
        this.extraNonce1 = null;
        this.extraNonce2Size = 0;
    }

}

exports.BitcoinClient = BitcoinClient;

