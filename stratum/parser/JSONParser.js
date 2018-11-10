const Transform = require('stream').Transform;

class JSONParser extends Transform {
    constructor() {
        super({objectMode: true})
    }

    _transform(buffer, encoding, cb) {
        try {
            const json = JSON.parse(buffer.toString());
            cb(null, json);
        } catch (e) {
            cb(e);
        }
    }
}

module.exports = JSONParser;
