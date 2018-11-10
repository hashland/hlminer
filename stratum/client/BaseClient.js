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

        this.connectTimeout = 5000;

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
         * Indicates whether this client is successfuly connected & authorized & subscribed
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
        this.resultCallbacks = [];

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
    }

    resetParameters() {
        this.connected = false;
        this.socket = null;
        this.messageCounter = 0;
        this.resultCallbacks = [];
        this.authorized = false;
        this.jobs = [];
        this.acceptedSharesCounter = 0;
        this.rejectedSharesCounter = 0;
    }

    registerEventHandler() {
        this.on('mining.notify', (params) => {
            this.handleMiningNotify(params);
        });
    }

    _createSocket() {
        if (!_.isEmpty(this.socksHost)) {
            this.socket = socks5.createConnection({
                host: this.host,
                port: this.port,
                socksHost: this.socksHost,
                socksPort: this.socksPort,
                timeout: this.connectTimeout
            })

        } else {
            this.socket = net.createConnection({
                host: this.host,
                port: this.port,
                timeout: this.connectTimeout
            })
        }

        this.socket.on('timeout', () => {
            if(!this.connected) {
                this._destroySocket('Connect timeout');
            }
        });

        this.socket.on('connect', () => {
            this.connected = true;
            this.onSocketConnect();
        });

        this.socket.on('error', (e) => {
            this._destroySocket(e.message);
        });

        this.socket.on('end', () => {
            this._destroySocket('Socket ended');
        });

        this.socket.on('close', hadError => {
            this._destroySocket('Socket closed');
        });

        if(this.debug) {
            const passtrough = new PassThrough();
            this.socket.on('data', data => console.log(`Client <<< ${data}`));
            this.socket.pipe(passtrough);
        }
        
        const jsonParser = new JSONParser();
        jsonParser.on('data', this.handleMessage.bind(this));

        this.socket
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

    connect() {
        if(this.connected)
            return;

        if(!this.socket)
            this._createSocket();
    }

    /**
     * Force disconnect
     */
    disconnect(err = null) {
        this.connected = false;

        if (null === this.socket) {
            return;
        }

        this._destroySocket(err);
        this.resetParameters();
    }

    /**
     * Hook that gets called right after the client socket connected.
     * Automatically subcribe for mining
     */
    async onSocketConnect() {
        this.connected = true;

        try {
            const subscriptionParams = await this.subscribe();

            if (_.isString(this.user) && _.isString(this.password)) {
                this.authorized = await this.authorize();
            } else {
                this.authorized = true;
            }

            if (this.authorized) {
                this.emit('connect');

            } else {
                this.disconnect('Could not authorize');
            }


        } catch (e) {

            this.disconnect(e.message);
        }
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

            this.resultCallbacks[this.messageCounter + 1] = callback;
            this.sendMessage('mining.authorize', [this.user, this.password]);
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

            this.resultCallbacks[this.messageCounter + 1] = callback;
            this.sendMessage('mining.subscribe', this.generateSubscriptionParameters());
        });

        return promise;
    }


    /**
     * Send a message
     * @param method
     * @param params
     */
    sendMessage(method, params) {
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

        if(this.debug) {
            console.log("Client >>> " + data);
        }

        this.socket.write(data);
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

            this.resultCallbacks[this.messageCounter + 1] = callback;
            this.sendMessage('mining.submit', params);
        });

        return promise;
    }


    handleMessage(message) {
        if (!_.isUndefined(message.result) && _.isFunction(this.resultCallbacks[message.id])) {
            this.resultCallbacks[message.id](message);
            delete this.resultCallbacks[message.id];
            return;
        }

        const method = message.method,
            params = message.params;

        if (!_.isArray(params)) {
            throw 'params is malformed';
        }

        this.emit(method, params);
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