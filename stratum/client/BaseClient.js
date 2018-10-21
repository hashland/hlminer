const EventEmitter = require('events'),
    net = require('net'),
    socks5 = require('socks5-client'),
    Algorithm = require('../Algorithm'),
    {JobFactory} = require('../job/JobFactory'),
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
         * Input Buffer used for input processing
         * @type {string}
         */
        this.inputBuffer = '';

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
        this.inputBuffer = '';
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

    connect() {
        if (!_.isEmpty(this.socksHost)) {
            this.socket = socks5.createConnection({
                host: this.host,
                port: this.port,
                socksHost: this.socksHost,
                socksPort: this.socksPort
            })

        } else {
            this.socket = net.createConnection({
                host: this.host,
                port: this.port
            })
        }

        this.socket.on('data', (data) => this.handleData(data));

        this.socket.on('error', (e) => {
            console.log(`StratumClient> Received error on socket for ${this.host}:${this.port}: ${e.message}`);
            this.disconnect();
        });


        this.socket.on('end', () => this.disconnect());
        this.socket.on('close', () => this.disconnect());

        this.socket.on('connect', () => this.onSocketConnect());
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

            if (!this.authorized) {
                this.disconnect('Could not authorize');
            }


        } catch (e) {

            this.disconnect(e.message);
        }
    }

    /**
     * Force disconnect
     */
    disconnect(err = null) {
        this.connected = false;

        if (null === this.socket) {
            return;
        }

        this.socket.destroy();
        this.socket = null;

        this.resetParameters();

        this.emit('disconnect', err)
    }



    /**
     * Handle new incoming data
     * @param data
     */
    handleData(data) {
        if(this.debug) {
            console.log("Client <<< " + data);
        }

        this.inputBuffer += data;

        let index;
        while ((index = this.inputBuffer.indexOf('\n')) !== -1) {
            const message = this.inputBuffer.substr(0, index);
            this.inputBuffer = this.inputBuffer.substr(index+1);

            if(message === '') {
                continue;
            }

            try {
                const json = JSON.parse(message);
                this.handleMessage(json);

            } catch (e) {
                console.log(`StratumClient> Could not process message from ${this.host}:${this.port}: ${e.message}`);
                console.log(message);
                return;
            }
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
                    reject(`result is malformed: ${JSON.stringify(message.result)}`)
                    return;
                }

                resolve(message.result);
            }

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
                    reject(`result is malformed: ${JSON.stringify(message.result)}`)
                    return;
                }

                this._handleSubscription(message.result);
                resolve(message.result);
            }

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
                if (message.error) {
                    this.rejectedSharesCounter++;

                    reject(message.error);
                    return;
                }

                if (true === message.result) {
                    this.acceptedSharesCounter++;
                } else {
                    this.rejectedSharesCounter++;
                }


                resolve(message.result === true);
            }

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