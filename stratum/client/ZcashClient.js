const {BaseClient} = require('./BaseClient'),
    _ = require('underscore');

/**
 * Zcash pool client
 * see https://github.com/str4d/zips/blob/77-zip-stratum/drafts/str4d-stratum/draft1.rst
 */
class ZcashClient extends BaseClient {

    constructor(options) {
        super(options);

        /**
         * The session id, for use when resuming
         * @type string
         */
        this.sessionId = options.sessionId ? options.sessionId : null;

        /**
         * The first part of the block header nonce
         * @type int
         */
        this.nonce1 = null;

        /**
         * The server target for the next received job and all subsequent jobs (until the next time this message is sent).
         * The miner compares proposed block hashes with this target as a 256-bit big-endian integer, and valid blocks MUST NOT
         * have hashes larger than (above) the current target
         * @type {null}
         */
        this.target = null;
    }

    registerEventHandler() {
        super.registerEventHandler();

        this.on('mining.set_target', (params) => {
            this.target = params[0];
        });
    }

    _handleSubscription(params) {
        this.sessionId = params[0];
        this.nonce1 = params[1];

        this.emit('subscribed');
    }



    generateSubscriptionParameters() {
        return [this.agent, this.sessionId, this.host, this.port];
    }


    resetParameters() {
        super.resetParameters();
        this.sessionId = null;
        this.nonce1 = null;
    }
}

exports.ZcashClient = ZcashClient;

