const Codes = {
  SUCCESS: '00000000',

  // Config error
  CONFIG_MISSING_APIKEY: '03000000',

  // API error
  INVALID_INPUT_EXCHANGE: '04000000',
  API_NOT_SUPPORTED: '04000001',
  API_UNKNOWN_ERROR: '04999999',

  // Uncaught Exception or Unknown Error 09000000
  UNKNOWN_ERROR: '09000000',
};

module.exports = Codes;
