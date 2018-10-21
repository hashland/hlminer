const
    MSG_PREFIX              = ":".charCodeAt(0),
    CR                      = "\r".charCodeAt(0),
    NL                      = "\n".charCodeAt(0),
    {
        BAIKAL_RESET,
        BAIKAL_GET_INFO,
        BAIKAL_GET_RESULT,
        BAIKAL_STATUS_JOB_EMPTY,
        BAIKAL_STATUS_NONCE_READY,
        BAIKAL_STATUS_NEW_MINER
    }       = require('./constants');

class MessageFactory {
    static createBuffer(cmd, deviceId = 0, param = 0, dest = 0, data = null) {
        let size = 7;

        if(data)
            size += data.length * 2;

        const buf = Buffer.alloc(size);

        let pos = 0;

        buf.writeUInt8(MSG_PREFIX, pos++);
        buf.writeUInt8(deviceId, pos++);
        buf.writeUInt8(cmd, pos++);
        buf.writeUInt8(param, pos++);
        buf.writeUInt8(dest, pos++);

        if (null !== data) {
            //apend data buffer with zero padding
            for (let i = 0; i < data.length; i++, pos += 2) {
                buf.writeUInt8(data.readUInt8(i), pos + 1);
            }
        }

        buf.writeUInt8(CR, pos++);
        buf.writeUInt8(NL, pos++);

        return buf;
    }

    static createMessageFromBuffer(buf) {
        let pos = 0;

        if(buf.length < 7) {
            throw 'Received malformed message: ' + buf.toString('hex');
        }

        const marker   = buf.readUInt8(pos++),
            cr       = buf.readUInt8(buf.length - 2),
            nl       = buf.readUInt8(buf.length - 1);

        if(marker !== MSG_PREFIX || cr !== CR || nl !== NL) {
            throw 'Received malformed message' + buf.toString('hex');
        }

        const message = {
            device_id:   buf.readUInt8(pos++),
            cmd:        buf.readUInt8(pos++),
            param:      buf.readUInt8(pos++),
            dest:       buf.readUInt8(pos++)
        };

        const data = Buffer.alloc((buf.length - 2 - pos) / 2);

        //remove zero padding from data buffer
        for (let i = 0; pos < buf.length - 2; i++, pos += 2) {
            data.writeUInt8(buf.readUInt8(pos+1), i);
        }

        switch(message.cmd) {
            case BAIKAL_RESET:
                message.device_count     = message.param;
                break;

            case BAIKAL_GET_INFO:
                let pos = 0;
                message.fw_ver          = data.readUInt8(pos++);
                message.hw_ver          = data.readUInt8(pos++);

//                +    miner->unit_count   = msg.data[2];

                message.bbg             = data.readUInt8(pos++);
                message.clock           = data.readUInt8(pos++) << 1;
                message.asic_count      = data.readUInt8(pos++);
                message.asic_count_r    = data.readUInt8(pos++);
                message.asic_ver        = data.readUInt8(pos++);

//                +    miner->asic_ver     = msg.data[5] << 8 | msg.data[6];

                break;

            case BAIKAL_GET_RESULT:
                if (message.param & 0x01) {
                    message.status = BAIKAL_STATUS_NONCE_READY;
                    message.nonce = data.slice(0, 4).toString('hex');
                }
                else if (message.param & 0x02) {
                    message.status = BAIKAL_STATUS_JOB_EMPTY;
                }
                else if (message.param & 0x04) {
                    message.status = BAIKAL_STATUS_NEW_MINER;
                }

                message.chip_id       = data.readUInt8(4);
                message.work_idx      = data.readUInt8(5);
                message.temp          = data.readUInt8(6);
                message.unit_id       = data.readUInt8(7);

                break;
        }

        return message;
    }
}

exports.MessageFactory = MessageFactory;