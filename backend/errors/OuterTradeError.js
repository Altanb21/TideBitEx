class OuterTradeError extends Error {
  constructor({ message, code, data }) {
    super(message);
    this.code = code;
    this.data = data;
  }
  
}

module.exports = OuterTradeError;
