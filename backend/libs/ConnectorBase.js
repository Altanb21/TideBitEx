const ResponseFormat = require("./ResponseFormat");
const Codes = require("../constants/Codes");
const EventBus = require("./EventBus");
const Events = require("../constants/Events");

class ConnectorBase {
  constructor({ logger }) {
    this.logger = logger;
    return this;
  }

  async init() {
    this._tideBitExEventListener();
    return this;
  }

  async router(
    functionName,
    { header, params, query, body, memberId, orderId, optional }
  ) {
    if (!this[functionName]) {
      return new ResponseFormat({
        message: "API_NOT_SUPPORTED",
        code: Codes.API_NOT_SUPPORTED,
      });
    }

    return this[functionName]({
      header,
      params,
      query,
      body,
      memberId,
      orderId,
      optional,
    });
  }

  async _tideBitExEventListener() {
    EventBus.on(Events.tickerOnSibscribe, (market) => {
      this._subscribeMarket(market);
    });
    EventBus.on(Events.tickerOnUnsubscribe, (market) => {
      this._unsubscribeMarket(market);
    });
    EventBus.on(Events.userOnSubscribe, (data) => {
      this._subscribeUser(data);
    });
    EventBus.on(Events.userOnUnsubscribe, (data) => {
      this._unsubscribeUser(data);
    });
  }

  _subscribeGlobal() {
    throw new Error("need override _subscribeGlobal");
  }

  _unsubscribeGlobal() {
    throw new Error("need override _unsubscribeGlobal");
  }

  _subscribeUser() {
    throw new Error("need override _subscribeUser");
  }

  _unsubscribeUser() {
    throw new Error("need override _unsubscribeUser");
  }

  _subscribeMarket() {
    throw new Error("need override _subscribeMarket");
  }

  _unsubscribeMarket() {
    throw new Error("need override _unsubscribeMarket");
  }
}
module.exports = ConnectorBase;
