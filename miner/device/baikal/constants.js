const Algorithm = require('../../../stratum/algorithm/Algorithm');

exports.BAIKAL_ID_VENDOR        = 0x0483;
exports.BAIKAL_ID_PRODUCT       = 0x5740;

exports.BAIKAL_RESET            = 0x01;
exports.BAIKAL_GET_INFO         = 0x02;
exports.BAIKAL_SET_OPTION       = 0x03;
exports.BAIKAL_SEND_WORK        = 0x04;
exports.BAIKAL_GET_RESULT       = 0x05;
exports.BAIKAL_SET_ID           = 0x06;
exports.BAIKAL_SET_IDLE         = 0x07;

exports.BAIKAL_ALGO_BLAKECOIN   = 0x30;
exports.BAIKAL_ALGO_DECRED      = 0x32;
exports.BAIKAL_ALGO_SIA         = 0x34;
exports.BAIKAL_ALGO_LBRY        = 0x36;
exports.BAIKAL_ALGO_PASCAL      = 0x37;

exports.BAIKAL_WORK_FIFO        = 200;
exports.BAIKAL_CUTOFF_TEMP      = 55;
exports.BAIKAL_FANSPEED_DEF     = 70;

exports.BAIKAL_STATUS_NONCE_READY = 0x01;
exports.BAIKAL_STATUS_JOB_EMPTY   = 0x02;
exports.BAIKAL_STATUS_NEW_MINER   = 0x04;

// maxTemperature => Speed
exports.BAIKAL_FAN_TEMP_STEPS     = {
    30: 0,
    35: 15,
    40: 30,
    45: 45,
    50: 70
};


exports.toBaikalAlgorithm = (algorithm) => {
    switch(algorithm.name) {
        case Algorithm.LBRY:
            return exports.BAIKAL_ALGO_LBRY;


        case Algorithm.PASCAL_LEGACY:
            return exports.BAIKAL_ALGO_PASCAL;

        default:
            throw 'Algorithm not supported';
    }
};