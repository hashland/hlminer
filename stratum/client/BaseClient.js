const EventEmitter = require('events'),
    net = require('net'),
    socks5 = require('socks5-client'),
    Algorithm = require('../Algorithm'),
    {JobFactory} = require('../job/JobFactory'),
    ReadlineParser = require('@serialport/parser-readline'),
    JSONParser = require('../parser/JSONParser'),
    PassThrough = require('stream').PassThrough,
    _ = require('underscore');


class BaseClient extends EventEmitter {
    constructor(options) {
        super();

        this.algorithm = options.algorithm;

        this.agent = options.agent;

        this.host = options.host;
        this.port = options.port;

        this.socksHost = options.socksHost;
        this.socksPort = options.socksPort;

        this.flags = (options.flags) ? options.flags : [];

        this.debug = (options.debug);

        this.autoReconnect          = true;
        this.connectRetryCounter    = 0;

        /**
         * Close connection if we cannot connect after this period (in ms)
         * @type {number}
         */
        this.socketConnectTimeout =   5 * 1000;

        /**
         * Close socket after this amount in inactivity (in ms)
         * @type {number}
         */
        this.socketTimeout  =  300 * 1000;

        /**
         * Close connection if a function call does not return after this period (in ms)
         * @type {number}
         */
        this.callTimeout    =  30 * 1000;

        /**
         * User used for authorization
         * @type {string}
         */
        this.user = options.user;

        /**
         * Password used for authorization
         * @type {string}
         */
        this.password = options.password;

        /**
         * Indicates whether this client is successfuly connected
         * @type {boolean}
         */
        this.connected = false;

        /**
         * Socket handle
         * @type {object}
         */
        this.socket = null;

        /**
         * Counter which we increment on each message sent
         * @type {number}
         */
        this.messageCounter = 0;

        /**
         * Array holding result callbacks (Format messageId => CallbackFn)
         * @type {Array}
         */
        this.callCallbacks = [];

        /**
         * Indicates if this client could successfully authorize itself
         * @type {boolean}
         */
        this.authorized = false;

        /**
         * Array oof MiningJobs which are currently valid
         * @type {Array}
         */
        this.jobs = [];

        /**
         * Number of shares accepted in the current connection
         * @type {number}
         */
        this.acceptedSharesCounter = 0;

        /**
         * Number of shares rejected in the current connection
         * @type {number}
         */
        this.rejectedSharesCounter = 0;

        this.registerEventHandler();

        this.callTimeoutCb = null;
    }

    resetParameters() {
        this.callCallbacks = [];
        this.authorized = false;
        this.jobs = [];
        this.acceptedSharesCounter = 0;
        this.rejectedSharesCounter = 0;
    }

    registerEventHandler() {
        this.on('connect', this._handleConnect.bind(this));
        this.on('disconnect', this._handleDisconnect.bind(this));

        this.on('mining.notify', (params) => {
            this.handleMiningNotify(params);
        });
    }

    /**
     * Creates a new socket and auto connects to it
     * @private
     */
    _createSocket() {
        if (!_.isEmpty(this.socksHost)) {
            this.socket = socks5.createConnection({
                host: this.host,
                port: this.port,
                socksHost: this.socksHost,
                socksPort: this.socksPort,
                timeout: this.socketConnectTimeout
            })

        } else {
            this.socket = net.createConnection({
                host: this.host,
                port: this.port,
                timeout: this.socketConnectTimeout
            })
        }

        this.socket.on('timeout', () => {
            this._destroySocket(this.connected ? 'Timeout' : 'Connect timeout');
        });

        this.socket.on('connect', () => {
            this.connected = true;
            this.messageCounter = 0;
            this.connectRetryCounter = 0;
            this.socket.setTimeout(this.socketTimeout);
            this.emit('connect');
        });

        this.socket.on('error', (e) => {
            this._destroySocket(e.message);
        });

        this.socket.on('end', () => {
            this._destroySocket('Socket ended');
        });

        this.socket.on('close', hadError => {
            this._destroySocket(hadError ? 'Socket closed with error' : 'Socket closed');
        });

        this.socket.on('drain', () => {
            console.log('Write buffer drained');
        });

        this.socketOutputPassTrough = new PassThrough();
        this.socketInputPassTrough = new PassThrough();

        if(this.debug) {
            this.socketOutputPassTrough.on('data', data => console.log(`>>> ${data.toString()}`));
            this.socketInputPassTrough.on('data', data => console.log(`<<< ${data.toString()}`));
        }
        
        const jsonParser = new JSONParser();
        jsonParser.on('data', this._handleMessage.bind(this));

        this.socket
            .pipe(this.socketInputPassTrough)
            .pipe(new ReadlineParser())
            .pipe(jsonParser);
    }

    _destroySocket(err) {
        this.connected = false;

        if(!this.socket || this.socket.destroyed)
            return;

        this.socket.end();
        this.socket.destroy();
        this.socket = null;

        this.emit('disconnect', err)
    }

    /**
     * Hook that gets called right after the client socket connected.
     * Automatically subcribe for mining
     */
    async _handleConnect() {
        try {
            const subscriptionParams = await this.subscribe();

            if (_.isString(this.user) && _.isString(this.password)) {
                this.authorized = await this.authorize();
            } else {
                this.authorized = true;
            }

            if (this.authorized) {
                this.emit('authorized');

            } else {
                this._destroySocket('Could not authorize');
            }


        } catch (e) {

            this._destroySocket(e.message);
        }
    }

    _handleDisconnect(err) {
        if(this.autoReconnect) {
            // exponential backoff 2^0 - 2^7 with random factor (0-192 secs)
            let delay = Math.pow(2, Math.min(7, this.connectRetryCounter));
            delay = ((delay + (Math.random() * delay/2)) | 0) * 1000;

            this.connectRetryCounter++;

            console.log(`Auto reconnect in ${delay/1000} seconds`);

            setTimeout(() => {
                this.connect();
            }, delay);
        }
    }

    /**
     *
     * @param message object cotaining the decoded
     * @private
     */
    _handleMessage(message) {
        if (!_.isUndefined(message.result) && _.isFunction(this.callCallbacks[message.id])) {
            this.callCallbacks[message.id](message);
            delete this.callCallbacks[message.id];
            clearTimeout(this.callTimeoutCb);
            return;
        }

        const method = message.method,
            params = message.params;

        if (!_.isArray(params)) {
            throw 'params is malformed';
        }

        this.emit(method, params);
    }

    /**
     * Call a remote method
     * @param method
     * @param params
     */
    call(method, params) {
        if (null === this.socket) {
            return;
        }

        if (!this.connected) {
            throw "Client is not connected";
        }

        let message = {
            'id': ++this.messageCounter,
            'method': method,
            'params': params
        };

        const data = JSON.stringify(message) + "\n";

        this.socketOutputPassTrough
            .pipe(this.socket)
            .write(data);

        this.callTimeoutCb = setTimeout(() => {
            this._destroySocket('Call timeout')
        }, this.callTimeout);
    }



    connect() {
        if(this.connected)
            return;

        this.autoReconnect = true;

        if(!this.socket)
            this._createSocket();
    }

    disconnect() {
        if(!this.connected)
            return;

        this.autoReconnect = false;
        this._destroySocket();
        this.resetParameters();
    }

    /**
     * Tries to authorize on the upstream server
     * @returns {Promise}
     */
    async authorize() {
        const promise = new Promise((resolve, reject) => {
            const callback = (message) => {
                if (message.error) {
                    reject(message.error);
                    return;
                }

                if (!_.isBoolean(message.result)) {
                    reject(`result is malformed: ${JSON.stringify(message.result)}`);
                    return;
                }

                resolve(message.result);
            };

            this.callCallbacks[this.messageCounter + 1] = callback;
            this.call('mining.authorize', [this.user, this.password]);
        });

        return promise;
    }

    /**
     * Subscribe for mining messages
     * @returns {Promise}
     */
    async subscribe() {
        const promise = new Promise((resolve, reject) => {
            const callback = (message) => {
                if (message.error) {
                    reject(message.error);
                    return;
                }

                if (!_.isArray(message.result)) {
                    reject(`result is malformed: ${JSON.stringify(message.result)}`);
                    return;
                }

                this._handleSubscription(message.result);
                resolve(message.result);
            };

            this.callCallbacks[this.messageCounter + 1] = callback;
            this.call('mining.subscribe', this.generateSubscriptionParameters());
        });

        return promise;
    }

    /**
     * Submit new found share
     * @returns {Promise}
     */
    async submit(params) {
        // add username as first parameter in array
        params.unshift(this.user);

        const promise = new Promise((resolve, reject) => {
            const callback = (message) => {
                if(message.result === true) {
                    this.acceptedSharesCounter++;
                    resolve();

                } else {
                    this.rejectedSharesCounter++;
                    reject(message.error);
                }
            };

            this.callCallbacks[this.messageCounter + 1] = callback;
            this.call('mining.submit', params);
        });

        return promise;
    }


    handleMiningNotify(params) {
        const cleanJobs = params[params.length - 1], //If true, a new block has arrived. The miner SHOULD abandon all previous jobs.
            job = JobFactory.createJobFromParamsArray(this.algorithm, params);

        if (true === cleanJobs) {
            this.jobs = [job];
        } else {
            this.jobs.push(job);
        }

        this.emit('notify', job, cleanJobs);
    }

    getJob(id) {
        return _.first(
            _.filter(this.jobs, (job) => job.id == id)
        );
    }

    _handleSubscription() {
        throw 'Must be implemented by implementing class';
    }

    removeFlag(flag) {
        this.flags = _.without(this.flags, flag);
    }

    addFlag(flag) {
        this.flags.push(flag);
    }

    hasFlag(flag) {
        return _.indexOf(this.flags, flag) !== -1;
    }
}

exports.BaseClient = BaseClient;