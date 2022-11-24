const axios = require("axios");
const crypto = require("crypto");
const Pusher = require("pusher");

const ResponseFormat = require("../ResponseFormat");
const Codes = require("../../constants/Codes");
const ConnectorBase = require("../ConnectorBase");
const WebSocket = require("../WebSocket");
const EventBus = require("../EventBus");
const Events = require("../../constants/Events");
const SafeMath = require("../SafeMath");
const SupportedExchange = require("../../constants/SupportedExchange");
const {
  waterfallPromise,
  getBar,
  parseClOrdId,
  wait,
  // onlyInLeft,
} = require("../Utils");
const Database = require("../../constants/Database");
const HEART_BEAT_TIME = 25000;

class OkexConnector extends ConnectorBase {
  tickers = {};
  ticker_data = {};
  trade_data = {};
  okexWsChannels = {};
  instIds = [];
  slanger = {};
  registerMarkets = [];

  fetchedTrades = {};
  fetchedBook = {};
  fetchedOrders = {};
  fetchedOrdersInterval = 1 * 60 * 1000;

  maxDataLength = 100;
  tradeFillsMaxRequestTimes = 60;
  tradeFillsHistoryMaxRequestTimes = 10;
  restTime = 2 * 1000;

  constructor({ logger, config }) {
    const { pusher } = config;
    const pusherConfig = {
      appId: pusher.app,
      key: pusher.key,
      secret: pusher.secret,
      host: pusher.host,
      port: pusher.port,
    };
    super({ logger });
    this.websocket = new WebSocket({ logger });
    this.websocketPrivate = new WebSocket({ logger });
    this.slanger = new Pusher(pusherConfig);
    return this;
  }

  async init({
    domain,
    apiKey,
    secretKey,
    passPhrase,
    brokerId,
    wssPublic,
    wssPrivate,
    tickerBook,
    depthBook,
    tradeBook,
    accountBook,
    orderBook,
    database,
    tickersSettings,
  }) {
    await super.init();
    this.domain = domain;
    this.apiKey = apiKey;
    this.secretKey = secretKey;
    this.passPhrase = passPhrase;
    this.brokerId = brokerId;
    this.depthBook = depthBook;
    this.tickerBook = tickerBook;
    this.tradeBook = tradeBook;
    this.accountBook = accountBook;
    this.orderBook = orderBook;
    this.database = database;
    this.tickersSettings = tickersSettings;
    await this.websocket.init({ url: wssPublic, heartBeat: HEART_BEAT_TIME });
    await this.websocketPrivate.init({
      url: wssPrivate,
      heartBeat: HEART_BEAT_TIME,
    });
    return this;
  }

  async start() {
    Object.keys(this.tickersSettings).forEach((id) => {
      if (
        this.tickersSettings[id]?.source === SupportedExchange.OKEX &&
        this.tickersSettings[id]?.visible
      ) {
        this.instIds.push(this.tickersSettings[id].instId);
        this.subscribeTicker(this.tickersSettings[id].instId);
      }
    });
    let instruments,
      instrumentsRes = await this.getInstruments({
        query: { instType: Database.INST_TYPE.SPOT },
      });
    if (instrumentsRes.success) {
      instruments = instrumentsRes.payload.reduce((prev, instrument) => {
        const instId = instrument.instId;
        prev[instId] = instrument;
        return prev;
      }, {});
    }
    this.tickerBook.instruments = instruments;
    this._okexWsEventListener();
    this._wsPrivateLogin();
  }

  async okAccessSign({ timeString, method, path, body }) {
    const msg = timeString + method + path + (JSON.stringify(body) || "");
    const cr = crypto.createHmac("sha256", this.secretKey);
    const signMsg = cr.update(msg).digest("base64");
    return signMsg;
  }

  getHeaders(needAuth, params = {}) {
    const headers = {
      "Content-Type": "application/json",
    };

    if (needAuth) {
      const { timeString, okAccessSign } = params;
      headers["OK-ACCESS-KEY"] = this.apiKey;
      headers["OK-ACCESS-SIGN"] = okAccessSign;
      headers["OK-ACCESS-TIMESTAMP"] = timeString;
      headers["OK-ACCESS-PASSPHRASE"] = this.passPhrase;
    }
    return headers;
  }

  collectTrades(data) {
    return data
      .map((trade) => ({
        ...trade,
        status: Database.OUTERTRADE_STATUS.UNPROCESS,
        exchangeCode: Database.EXCHANGE.OKEX,
        createdAt: new Date(parseInt(trade.ts)).toISOString(),
        data: JSON.stringify(trade),
      }))
      .sort((a, b) => a.ts - b.ts);
  }

  /**
   * @typedef {Object} Trade
   * @property {string} side "sell"
   * @property {string} fillSz "0.002"
   * @property {string} fillPx "1195.86"
   * @property {string} fee "-0.001913376"
   * @property {string} ordd "467755654093094921"
   * @property {string} insType "SPOT"
   * @property {string} instId "ETH-USDT"
   * @property {string} clOdId "377bd372412fSCDE2m332576077o"
   * @property {string} poside "net"
   * @property {string} bilId "467871903972212805"
   * @property {string} tag "377bd372412fSCDE"
   * @property {string} exeType "M"
   * @property {string} tradeId "225260494"
   * @property {string} feecy "USDT"
   * @property {string} ts "1657821354546
   */
  /**
   * @returns {Promise<Trade>}
   */
  async fetchTradeFillsRecords({
    query,
    results = [],
    requests = this.tradeFillsMaxRequestTimes,
    tryOnce = 1,
  }) {
    const { begin, before, sz } = query;
    let result,
      arr = [],
      newBefore,
      newRequest,
      method = "GET";
    if (!before && begin) arr.push(`begin=${begin}`);
    if (before) arr.push(`before=${before}`);
    if (sz) arr.push(`sz=${sz}`);
    const path = "/api/v5/trade/fills";
    const qs = !!arr.length ? `?${arr.join("&")}` : "";
    const timeString = new Date().toISOString();
    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });
    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      if (res.data && res.data.code == "0") {
        const data = this.collectTrades(res.data.data);
        results = data.concat(results);
        if (data.length === this.maxDataLength || tryOnce > 0) {
          newBefore = data[data.length - 1]?.billId;
          newRequest = requests - 1;
          if (newBefore) {
            if (!requests > 0) await wait(this.restTime);
            return this.fetchTradeFillsRecords({
              query: {
                ...query,
                before: newBefore,
              },
              results,
              requests:
                !requests > 0 ? this.tradeFillsMaxRequestTimes : newRequest,
              tryOnce: 1,
            });
          }
        }
        result = new ResponseFormat({
          message: "tradeFills",
          payload: results,
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        result = new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      result = new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
    return result;
  }

  async fetchTradeFillsHistoryRecords({
    query,
    results = [],
    requests = this.tradeFillsHistoryMaxRequestTimes,
    tryOnce = 1,
  }) {
    const { instType, begin, before, sz } = query;
    let result,
      arr = [],
      newBefore,
      newRequest,
      method = "GET";
    if (sz) arr.push(`sz=${sz}`);
    if (instType) arr.push(`instType=${instType}`);
    if (!before && begin) arr.push(`begin=${begin}`);
    if (before) arr.push(`before=${before}`);
    const path = "/api/v5/trade/fills-history";
    const qs = !!arr.length ? `?${arr.join("&")}` : "";
    const timeString = new Date().toISOString();
    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });
    // this.logger.debug(`fetchTradeFillsHistoryRecords path:[${path}${qs}]`);
    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      if (res.data && res.data.code == "0") {
        const data = this.collectTrades(res.data.data);
        results = results.concat(data);
        if (data.length === this.maxDataLength || tryOnce > 0) {
          newBefore = data[data.length - 1]?.billId; // 請求此 ID 之後（更新的數據）的分頁內容，傳的值為對應的接口的billId
          newRequest = requests - 1;
          if (newBefore) {
            if (!requests > 0) await wait(this.restTime);
            return this.fetchTradeFillsHistoryRecords({
              query: {
                ...query,
                before: newBefore,
              },
              results,
              requests:
                !requests > 0
                  ? this.tradeFillsHistoryMaxRequestTimes
                  : newRequest,
              tryOnce: 1,
            });
          }
        }
        result = new ResponseFormat({
          message: "tradeFillsHistory",
          payload: results,
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        result = new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] tradeFillsHistory`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      result = new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
    return result;
  }

  async getOrderDetails({ query }) {
    const { instId, ordId } = query;
    // this.logger.debug(`[${this.constructor.name}] getOrderDetails`);
    let result,
      arr = [];
    const method = "GET";
    if (instId) arr.push(`instId=${instId}`);
    if (ordId) arr.push(`ordId=${ordId}`);
    const path = "/api/v5/trade/order";
    const qs = !!arr.length ? `?${arr.join("&")}` : "";
    const timeString = new Date().toISOString();
    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });
    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      if (res.data && res.data.code == "0") {
        const [data] = res.data.data;
        result = new ResponseFormat({
          message: "orderDetails",
          payload: data,
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getOrderDetails`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      result = new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
    return result;
  }

  /**
   * [deprecated] 2022/11/17
   */
  async getOrderHistory(options) {
    const { instType, instId, after, limit } = options;
    const method = "GET";
    const path = "/api/v5/trade/orders-history";
    const arr = [];
    if (instType) arr.push(`instType=${instType}`);
    if (instId) arr.push(`instId=${instId}`);
    if (after) arr.push(`after=${after}`);
    if (limit) arr.push(`limit=${limit}`);

    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    const timeString = new Date().toISOString();
    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });
    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      if (res.data && res.data.code == "0") {
        const formatOrders = {};
        const formatOrdersForLib = {};
        res.data.data.forEach((data) => {
          const tmp = data.clOrdId.replace(this.brokerId, "");
          const memberId = tmp.substr(0, tmp.indexOf("m"));
          if (!formatOrders[memberId]) formatOrders[memberId] = [];
          if (!formatOrdersForLib[memberId]) formatOrdersForLib[memberId] = [];
          formatOrders[memberId].push({
            ...data,
            cTime: parseInt(data.cTime),
            fillTime: parseInt(data.fillTime),
            uTime: parseInt(data.uTime),
          });
          formatOrdersForLib.push({
            instId,
            market: instId.replace("-", "").toLowerCase(),
            clOrdId: data.clOrdId,
            id: data.ordId,
            ordType: data.ordType,
            price: data.px,
            kind:
              data.side === Database.ORDER_SIDE.BUY
                ? Database.ORDER_KIND.BID
                : Database.ORDER_KIND.ASK,
            volume: SafeMath.minus(data.sz, data.fillSz),
            origin_volume: data.sz,
            filled: data.state === Database.ORDER_STATE.FILLED,
            state:
              data.state === Database.ORDER_STATE.CANCEL
                ? Database.ORDER_STATE.CANCEL
                : data.state === Database.ORDER_STATE.FILLED
                ? Database.ORDER_STATE.DONE
                : Database.ORDER_STATE.WAIT,
            state_text:
              data.state === Database.ORDER_STATE.CANCEL
                ? Database.ORDER_STATE_TEXT.CANCEL
                : data.state === Database.ORDER_STATE.FILLED
                ? Database.ORDER_STATE_TEXT.DONE
                : Database.ORDER_STATE_TEXT.WAIT,
            at: parseInt(SafeMath.div(data.uTime, "1000")),
            ts: parseInt(data.uTime),
          });
        });
        Object.keys(formatOrdersForLib).forEach((memberId) => {
          this.orderBook.updateAll(
            memberId,
            instId,
            formatOrdersForLib[memberId]
          );
        });
        EventBus.emit(Events.orderDetailUpdate, instType, formatOrders);
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getOrderHistory`, error);
    }
  }

  async getBalance({ query }) {
    const method = "GET";
    const path = "/api/v5/account/balance";
    const { ccy } = query;
    let result;
    let summary = [];
    const arr = [];
    if (ccy) arr.push(`ccy=${ccy}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    const timeString = new Date().toISOString();

    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });

      if (res.data && res.data.code == "0") {
        const subAccounts = res.data.data.map((v) => {
          return v.details.map((dtl) => {
            const ccyData = {
              ccy: dtl.ccy,
              totalBal: dtl.cashBal,
              availBal: dtl.availBal,
              frozenBal: dtl.frozenBal,
              uTime: parseInt(dtl.uTime),
            };

            const summaryIndex = summary.findIndex((v) => v.ccy === dtl.ccy);
            if (summaryIndex > -1) {
              summary[summaryIndex].totalBal += ccyData.cashBal;
              summary[summaryIndex].availBal += ccyData.availBal;
              summary[summaryIndex].frozenBal += ccyData.frozenBal;
              // uTime = Math.max(summary[summaryIndex].uTime, ccyData.uTime);
            } else {
              summary.push(ccyData);
            }
            return ccyData;
          });
        });
        result = new ResponseFormat({
          message: "getBalance",
          payload: {
            summary,
            subAccounts,
          },
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getBalance`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      result = new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }

    return result;
  }

  async getBalances({ query }) {
    const method = "GET";
    const path = "/api/v5/account/balance";
    const { ccy } = query;
    let result;
    const arr = [];
    if (ccy) arr.push(`ccy=${ccy}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";
    const timeString = new Date().toISOString();
    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });
    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      if (res.data && res.data.code == "0") {
        const [data] = res.data.data;
        const balances = data.details.reduce((prev, balance) => {
          prev[balance.ccy.toLowerCase()] = {
            balance: balance.availBal,
            locked: balance.frozenBal,
            sum: SafeMath.plus(balance.availBal, balance.frozenBal),
          };
          return prev;
        }, {});
        result = new ResponseFormat({
          message: "getBalances",
          payload: balances,
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getBalances`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      result = new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }

    return result;
  }

  async getTicker({ query }) {
    const method = "GET";
    const path = "/api/v5/market/ticker";
    const { instId } = query;

    const arr = [];
    if (instId) arr.push(`instId=${instId}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(false),
      });
      if (res.data && res.data.code == "0") {
        const [data] = res.data.data;
        const ticker = this.tickerBook.formatTicker(
          { id: data.instId.replace("-", "").toLowerCase(), ...data },
          SupportedExchange.OKEX
        );
        return new ResponseFormat({
          message: "getTicker",
          payload: ticker,
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getTicker`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }
  // account api end
  // market api
  async getTickers({ query }) {
    const method = "GET";
    const path = "/api/v5/market/tickers";
    const { instType, uly } = query;

    const arr = [];
    if (instType) arr.push(`instType=${instType}`);
    if (uly) arr.push(`uly=${uly}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(false),
      });
      if (res.data && res.data.code == "0") {
        let tickers = {};
        res.data.data.forEach((data) => {
          const formatedTicker = this.tickerBook.formatTicker(
            { id: data.instId.replace("-", "").toLowerCase(), ...data },
            SupportedExchange.OKEX
          );
          if (formatedTicker) tickers[formatedTicker.id] = formatedTicker;
        });
        return new ResponseFormat({
          message: "getTickers from OKEx",
          payload: tickers,
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getTickers`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async getDepthBooks({ query }) {
    const method = "GET";
    const path = "/api/v5/market/books";
    const { instId, sz, lotSz } = query;

    const arr = [];
    if (instId) arr.push(`instId=${instId}`);
    if (sz) arr.push(`sz=${200}`);
    // if (sz) arr.push(`sz=${sz}`); // -- TEST
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    if (!this.fetchedBook[instId]) {
      try {
        this.depthBook.updateAll(instId, lotSz, { asks: [], bids: [] });
      } catch (error) {
        this.logger.error(`[${this.constructor.name}] getDepthBooks`, error);
        let message = error.message;
        if (error.response && error.response.data)
          message = error.response.data.msg;
        return new ResponseFormat({
          message,
          code: Codes.API_UNKNOWN_ERROR,
        });
      }
    }
    return new ResponseFormat({
      message: "getDepthBooks",
      payload: this.depthBook.getSnapshot(instId),
    });
  }

  async getCandlesticks({ query }) {
    const method = "GET";
    const path = "/api/v5/market/candles";
    const { instId, bar, after, before, limit } = query;

    const arr = [];
    if (instId) arr.push(`instId=${instId}`);
    if (bar) arr.push(`bar=${bar}`);
    if (after) arr.push(`after=${after}`);
    if (before) arr.push(`before=${before}`);
    if (limit) arr.push(`limit=${limit}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(false),
      });
      if (res.data && res.data.code == "0") {
        const payload = res.data.data.map((data) => {
          const ts = data.shift();
          return [parseInt(ts), ...data];
        });
        return new ResponseFormat({
          message: "getCandlestick",
          payload,
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getCandlestick`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async getTradingViewSymbol({ query }) {
    return Promise.resolve({
      name: query.symbol,
      timezone: "Asia/Hong_Kong",
      session: "24x7",
      ticker: query.id,
      minmov: 1,
      minmove2: 0,
      volume_precision: 8,
      pricescale: query.market?.pricescale
        ? 10 ** query.market.pricescale
        : 10000,
      has_intraday: true,
      has_daily: true,
      intraday_multipliers: ["1", "5", "15", "30", "60"],
      has_weekly_and_monthly: true,
    });
  }

  async getTradingViewHistory({ query, results = [] }) {
    const method = "GET";
    const path = "/api/v5/market/candles";
    let { instId, resolution, from, to } = query;
    let arr = [],
      qs,
      bars = [];
    if (instId) arr.push(`instId=${instId}`);
    if (resolution) arr.push(`bar=${getBar(resolution)}`);
    if (to) arr.push(`after=${parseInt(to) * 1000}`); //6/2
    arr.push(`limit=${300}`);
    qs = !!arr.length ? `?${arr.join("&")}` : "";
    try {
      let res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(false),
      });
      if (res.data && res.data.code == "0") {
        let resData = res.data.data;
        results = results.concat(resData);
        if (resData[resData.length - 1][0] / 1000 > from) {
          // arr = [];
          // if (instId) arr.push(`instId=${instId}`);
          // if (resolution) arr.push(`bar=${getBar(resolution)}`);
          // if (to) arr.push(`after=${resData[resData.length - 1][0]}`); //6/2
          // arr.push(`limit=${300}`);
          // qs = !!arr.length ? `?${arr.join("&")}` : "";
          // res = await axios({
          //   method: method.toLocaleLowerCase(),
          //   url: `${this.domain}${path}${qs}`,
          //   headers: this.getHeaders(false),
          // });
          // resData = resData.concat(res.data.data);
          return this.getTradingViewHistory({
            query: {
              ...query,
              to: resData[resData.length - 1][0] / 1000,
            },
            results,
          });
        }
        results
          .sort((a, b) => a[0] - b[0])
          .forEach((d) => {
            if (d[0] / 1000 >= from && d[0] / 1000 < to) {
              bars = [
                ...bars,
                {
                  time: parseInt(d[0]),
                  open: parseFloat(d[1]),
                  high: parseFloat(d[2]),
                  low: parseFloat(d[3]),
                  close: parseFloat(d[4]),
                  volume: parseFloat(d[5]),
                },
              ];
            }
          });
        return new ResponseFormat({
          message: "getTradingViewHistory",
          payload: bars,
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(
        `[${this.constructor.name}] getTradingViewHistory`,
        error
      );
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  // descending
  async getTrades({ query }) {
    const { instId, limit, lotSz } = query;
    if (!this.fetchedTrades[instId]) {
      const method = "GET";
      const path = "/api/v5/market/trades";

      const arr = [];
      if (instId) arr.push(`instId=${instId}`);
      if (limit) arr.push(`limit=${limit}`);
      const qs = !!arr.length ? `?${arr.join("&")}` : "";

      try {
        const res = await axios({
          method: method.toLocaleLowerCase(),
          url: `${this.domain}${path}${qs}`,
          headers: this.getHeaders(false),
        });
        if (res.data && res.data.code == "0") {
          const market = instId.replace("-", "").toLowerCase();
          const trades = this._formateTrades(market, res.data.data);
          this.tradeBook.updateAll(instId, lotSz, trades);
          this.fetchedTrades[instId] = true;
        } else {
          let message;
          if (res.data) {
            const [response] = res.data.data;
            message = response;
          } else message = `Request failed`;

          return new ResponseFormat({
            message,
            code: Codes.THIRD_PARTY_API_ERROR,
          });
        }
      } catch (error) {
        this.logger.error(`[${this.constructor.name}] getTrades`, error);
        let message = error.message;
        if (error.response && error.response.data)
          message = error.response.data.msg;
        return new ResponseFormat({
          message,
          code: Codes.API_UNKNOWN_ERROR,
        });
      }
    }
    return new ResponseFormat({
      message: "getTrades",
      payload: this.tradeBook.getSnapshot(instId),
    });
  }

  formateExAccts(subAcctsBals) {
    const exAccounts = {};
    return subAcctsBals.reduce((prev, subAcctsBal) => {
      if (!prev[subAcctsBal.currency]) {
        prev[subAcctsBal.currency] = {};
        prev[subAcctsBal.currency]["details"] = [];
        prev[subAcctsBal.currency]["balance"] = "0";
        prev[subAcctsBal.currency]["locked"] = "0";
        prev[subAcctsBal.currency]["total"] = "0";
      }
      prev[subAcctsBal.currency]["balance"] = SafeMath.plus(
        prev[subAcctsBal.currency]["balance"],
        subAcctsBal?.balance
      );
      prev[subAcctsBal.currency]["locked"] = SafeMath.plus(
        prev[subAcctsBal.currency]["locked"],
        subAcctsBal?.locked
      );
      prev[subAcctsBal.currency]["total"] = SafeMath.plus(
        prev[subAcctsBal.currency]["total"],
        subAcctsBal?.total
      );
      prev[subAcctsBal.currency]["details"].push(subAcctsBal);
      prev[subAcctsBal.currency]["details"].sort((a, b) => b?.total - a?.total);
      return prev;
    }, exAccounts);
  }

  fetchSubAcctsBalsJob(subAccount) {
    return () => {
      return new Promise(async (resolve, reject) => {
        const subAccBalRes = await this.getSubAccount({
          query: {
            subAcct: subAccount.subAcct,
          },
        });
        if (subAccBalRes.success) {
          const subAccBals = subAccBalRes.payload;
          resolve(subAccBals);
        } else {
          this.logger.error(
            `[${this.constructor.name}] fetchSubAcctsBalsJob`,
            subAccBalRes
          );
          reject(subAccBalRes);
        }
      });
    };
  }

  async getExAccounts({ query }) {
    return new Promise(async (resolve, reject) => {
      const subAccountsRes = await this.getSubAccounts({ query });
      if (subAccountsRes.success) {
        const subAccounts = subAccountsRes.payload;
        const jobs = subAccounts.map((subAccount) =>
          this.fetchSubAcctsBalsJob(subAccount)
        );
        waterfallPromise(jobs, 1000).then((subAcctsBals) => {
          const _subAcctsBals = subAcctsBals.reduce((prev, curr) => {
            prev = prev.concat(curr);
            return prev;
          }, []);
          const exAccounts = this.formateExAccts(_subAcctsBals);
          resolve(
            new ResponseFormat({
              message: "getExAccounts",
              payload: exAccounts,
            })
          );
        });
      } else {
        reject(subAccountsRes);
      }
    });
  }

  async getSubAccounts({ query }) {
    const method = "GET";
    const path = "/api/v5/users/subaccount/list";
    const { subAcct, enable } = query;
    const arr = [];
    if (subAcct) arr.push(`subAcct=${subAcct}`);
    if (enable) arr.push(`enable=${enable}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    const timeString = new Date().toISOString();
    // const timeString = new Date(new Date().getTime() + 3000).toISOString();
    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });
    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      if (res.data && res.data.code == "0") {
        const payload = res.data.data;
        return new ResponseFormat({
          message: "getSubAccounts",
          payload,
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getSubAccounts`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async getSubAccount({ query }) {
    const method = "GET";
    const path = "/api/v5/account/subaccount/balances";
    const { subAcct, enable } = query;

    const arr = [];
    if (subAcct) arr.push(`subAcct=${subAcct}`);
    if (enable) arr.push(`enable=${enable}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    const timeString = new Date().toISOString();
    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      if (res.data && res.data.code == "0") {
        const [data] = res.data.data;
        const balances = data.details.map((detail) => ({
          subAcct,
          currency: detail.ccy,
          balance: detail.availBal,
          locked: detail.frozenBal,
          total: SafeMath.plus(detail.availBal, detail.frozenBal),
        }));
        return new ResponseFormat({
          message: "getSubAccount",
          payload: balances,
        });
      } else {
        const message = JSON.stringify(res.data);
        this.logger.debug(`[${this.constructor.name}] getSubAccount`, res.data);
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getSubAccount`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  // market api end
  // trade api
  async postPlaceOrder({ body }) {
    const method = "POST";
    const path = "/api/v5/trade/order";
    const timeString = new Date().toISOString();
    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: path,
      body: body,
    });

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
        data: body,
      });
      const [payload] = res.data.data;
      if (res.data && res.data.code == "0") {
        return new ResponseFormat({
          message: "postPlaceOrder",
          payload,
        });
      } else {
        this.logger.debug("postPlaceOrder body:", body);
        this.logger.debug(
          `[${this.constructor.name}] postPlaceOrder`,
          res.data
        );
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.debug("postPlaceOrder body:", body);
      this.logger.error(`[${this.constructor.name}] postPlaceOrder`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.POST_ORDER_FAIL,
      });
    }
  }

  async getAllOrders({ query }) {
    const method = "GET";
    const path = "/api/v5/trade/orders-pending";
    const arr = [];
    if (query.instType) arr.push(`instType=${query.instType}`);
    if (query.instId) arr.push(`instId=${query.instId}`);
    if (query.before) arr.push(`before=${query.before}`);
    if (query.after) arr.push(`after=${query.after}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";
    const timeString = new Date().toISOString();
    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });
    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      if (res.data && res.data.code == "0") {
        return new ResponseFormat({
          message: "getAllOrders",
          payload: res.data.data,
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getAllOrders`, error);
      return [];
    }
  }

  async getOrderList({ query } = {}) {
    const {
      instType,
      uly,
      instId,
      ordType,
      state,
      after,
      before,
      limit,
      memberId,
    } = query;

    const method = "GET";
    const path = "/api/v5/trade/orders-pending";
    const arr = [];
    if (instType) arr.push(`instType=${instType}`);
    if (uly) arr.push(`uly=${uly}`);
    if (instId) arr.push(`instId=${instId}`);
    if (ordType) arr.push(`ordType=${ordType}`);
    if (state) arr.push(`state=${state}`);
    if (after) arr.push(`after=${after}`);
    if (before) arr.push(`before=${before}`);
    if (limit) arr.push(`limit=${limit}`);

    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    const timeString = new Date().toISOString();

    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: `${path}${qs}`,
    });
    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
      });
      if (res.data && res.data.code == "0") {
        let orders = res.data.data
          .filter((data) => data.clOrdId.includes(`${memberId}m`)) // 可能發生與brokerId, randomId碰撞
          .map((data) => {
            return {
              instId,
              market: instId.replace("-", "").toLowerCase(),
              id: parseClOrdId(data.clOrdId)?.orderId,
              clOrdId: data.clOrdId,
              ordId: data.ordId,
              ordType: data.ordType,
              price: data.px,
              kind:
                data.side === Database.ORDER_SIDE.BUY
                  ? Database.ORDER_KIND.BID
                  : Database.ORDER_KIND.ASK,
              volume: SafeMath.minus(data.sz, data.fillSz),
              origin_volume: data.sz,
              filled: data.state === Database.ORDER_STATE.FILLED,
              state:
                data.state === Database.ORDER_STATE.CANCEL
                  ? Database.ORDER_STATE.CANCEL
                  : state === Database.ORDER_STATE.FILLED
                  ? Database.ORDER_STATE.DONE
                  : Database.ORDER_STATE.WAIT,
              state_text:
                data.state === Database.ORDER_STATE.CANCEL
                  ? Database.ORDER_STATE_TEXT.CANCEL
                  : state === Database.ORDER_STATE.FILLED
                  ? Database.ORDER_STATE_TEXT.DONE
                  : Database.ORDER_STATE_TEXT.WAIT,
              at: parseInt(SafeMath.div(data.uTime, "1000")),
              ts: parseInt(data.uTime),
            };
          });
        return new ResponseFormat({
          message: "getOrderList",
          payload: orders,
        });
        // this.orderBook.updateAll(memberId, instId, orders);
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getOrderList`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async postCancelOrder({ body }) {
    const method = "POST";
    const path = "/api/v5/trade/cancel-order";
    const timeString = new Date().toISOString();
    const filterBody = {
      instId: body.instId,
      // ordId: body.ordId,
      clOrdId: body.clOrdId,
    };
    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path: path,
      body: filterBody,
    });
    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
        data: filterBody,
      });
      if (res.data && res.data.code == "0") {
        return new ResponseFormat({
          message: "postCancelOrder",
          payload: res.data.data,
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] postCancelOrder`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }
  // trade api end

  async cancelOrders({ body }) {
    const method = "POST";
    const path = "/api/v5/trade/cancel-batch-orders";
    const timeString = new Date().toISOString();
    const okAccessSign = await this.okAccessSign({
      timeString,
      method,
      path,
      body,
    });
    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}`,
        headers: this.getHeaders(true, { timeString, okAccessSign }),
        data: body,
      });
      if (res.data && res.data.code == "0") {
        return new ResponseFormat({
          message: "cancelOrders",
          payload: res.data.data,
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] cancelOrders`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  // public data api
  async getInstruments({ query }) {
    const method = "GET";
    const path = "/api/v5/public/instruments";
    const { instType, uly } = query;

    const arr = [];
    if (instType) arr.push(`instType=${instType}`);
    if (uly) arr.push(`uly=${uly}`);
    const qs = !!arr.length ? `?${arr.join("&")}` : "";

    try {
      const res = await axios({
        method: method.toLocaleLowerCase(),
        url: `${this.domain}${path}${qs}`,
        headers: this.getHeaders(false),
      });
      if (res.data && res.data.code == "0") {
        const payload = res.data.data.map((data) => {
          return {
            ...data,
            ts: parseInt(data.ts),
          };
        });
        return new ResponseFormat({
          message: "getInstruments",
          payload,
        });
      } else {
        let message;
        if (res.data) {
          const [response] = res.data.data;
          message = response;
        } else message = `Request failed`;
        return new ResponseFormat({
          message,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getInstruments`, error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }
  // public data api end

  // okex ws
  _okexWsEventListener() {
    this.websocket.onmessage = (event) => {
      let instId, arg, channel, values, data;
      data = JSON.parse(event.data);
      if (data.event) {
        // subscribe return
        arg = { ...data.arg };
        channel = arg.channel;
        delete arg.channel;
        values = Object.values(arg);
        instId = values[0];
        if (data.event === Events.subscribe) {
          this.okexWsChannels[channel] = this.okexWsChannels[channel] || {};
          this.okexWsChannels[channel][instId] =
            this.okexWsChannels[channel][instId] || {};
        } else if (data.event === Events.unsubscribe) {
          delete this.okexWsChannels[channel][instId];
          // ++ TODO ws onClose clean channel
          if (!Object.keys(this.okexWsChannels[channel]).length) {
            delete this.okexWsChannels[channel];
          }
        } else if (data.event === Events.error) {
          this.logger.error(
            `[${this.constructor.name}] _okexWsEventListener data.event === Events.error`,
            data
          );
        }
      } else if (data.data) {
        // okex server push data
        arg = { ...data.arg };
        channel = arg.channel;
        delete arg.channel;
        values = Object.values(arg);
        instId = values[0];
        switch (channel) {
          case Events.instruments:
            // this._updateInstruments(instId, data.data);
            break;
          case Events.trades:
            const market = instId.replace("-", "").toLowerCase();
            const trades = this._formateTrades(market, data.data);
            this._updateTrades(instId, market, trades);
            this._updateCandle(market, trades);
            break;
          case Events.books:
            this._updateBooks(instId, data.data, data.action);
            break;
          case this.candleChannel:
            // this._updateCandle(data.arg.instId, data.arg.channel, data.data);
            break;
          case Events.tickers:
            this._updateTickers(data.data);
            break;
          default:
        }
      }
      this.websocket.heartbeat();
    };
    this.websocketPrivate.onmessage = (event) => {
      let instId, arg, channel, values, data;
      data = JSON.parse(event.data);
      if (data.event) {
        // subscribe return
        if (data.event === Events.login) {
          if (data.code === "0") {
            this._subscribeOrders();
          }
        } else if (data.event === Events.subscribe) {
          // temp do nothing
        } else if (data.event === Events.error) {
          this.logger.error(
            `[${this.constructor.name}] _okexWsPrivateEventListener data.event === Events.error`,
            data
          );
        }
      } else if (data.data) {
        // okex server push data
        arg = { ...data.arg };
        channel = arg.channel;
        delete arg.channel;
        values = Object.values(arg);
        instId = values[0];
        switch (channel) {
          case Events.orders:
            this._updateOrderDetails(instId, data.data);
            break;
          default:
        }
      }
    };
  }

  _updateInstruments(instType, instData) {
    const channel = Events.instruments;
    if (
      !this.okexWsChannels[channel][instType] ||
      Object.keys(this.okexWsChannels[channel][instType]).length === 0
    ) {
      const instIds = [];
      // subscribe trades of BTC, ETH, USDT
      instData.forEach((inst) => {
        if (
          (inst.instId.includes("BTC") ||
            inst.instId.includes("ETH") ||
            inst.instId.includes("USDT")) &&
          (!this.okexWsChannels[Events.tickers] ||
            !this.okexWsChannels[Events.tickers][inst.instId])
        ) {
          instIds.push(inst.instId);
        }
      });
    }
    this.okexWsChannels[channel][instType] = instData;
  }

  /**
   * _updateOrderDetails
   * @param {*} instType
   * @param {*} orderData
   */
  _updateOrderDetails(instType, orderData) {
    const formatOrders = [];
    orderData.forEach((data) => {
      if (data.clOrdId.startsWith(this.brokerId)) {
        // this.logger.debug(
        //   `_updateOrderDetails data.cTime[${data.cTime}] data.uTime[${data.uTime}] data.fillTime[${data.fillTime}] `
        // );
        const formatOrder = {
          ...data,
          exchangeCode: Database.EXCHANGE.OKEX,
          status: Database.OUTERTRADE_STATUS.UNPROCESS,
          createdAt: new Date(parseInt(data.uTime)).toISOString(),
          data: JSON.stringify(data),
        };
        formatOrders.push(formatOrder);
      }
    });
    EventBus.emit(Events.orderDetailUpdate, instType, formatOrders);
  }

  // ++ TODO: verify function works properly
  _formateTrades(market, trades) {
    return trades.map((data) => {
      const trade = {
        tid: data.tradeId, // [about to decrepted]
        type: data.side, // [about to decrepted]
        date: data.ts, // [about to decrepted]
        amount: data.sz, // [about to decrepted]
        id: data.tradeId,
        price: data.px,
        volume: data.sz,
        market,
        at: parseInt(SafeMath.div(data.ts, "1000")),
        ts: data.ts,
      };
      return trade;
    });
  }

  // ++ TODO: verify function works properly
  async _updateTrades(instId, market, trades) {
    try {
      const lotSz = this.okexWsChannels[Events.tickers][instId]["lotSz"];
      this.tradeBook.updateByDifference(instId, lotSz, trades);
      EventBus.emit(Events.trades, market, {
        market,
        trades: this.tradeBook.getSnapshot(instId),
      });
      // this.loggers.debug(`_updateTrades[${market}] ${this.registerMarkets.includes(market)}`, this.registerMarkets);
      if (this.registerMarkets.includes(market)) {
        EventBus.emit(Events.publicTrades, {
          market,
          trades: this.tradeBook.getSnapshot(instId),
        });
      }

      // ++ workaround, to be optimized: broadcast to slanger
      trade_data[market] = trade_data[market] || [];
      trade_data[market] = trade_data[market].concat(trades);
    } catch (error) {}
  }

  // ++ workaround, to be optimized
  _broadcast_to_slanger() {
    // broadcast ticker
    const ticker_data_string = JSON.stringify(this.ticker_data);
    this.slanger
      .trigger("market-global", "tickers", ticker_data_string)
      .catch(() => {});

    // broadcast trades
    Object.keys(this.trade_data).map((k) => {
      const d = this.trade_data[k].pop();
      if (d !== undefined) {
        const trade_data_string = JSON.stringify(d);
        const channel = `market-${k}-global`;
        pusher.trigger(channel, "trades", trade_data_string).catch(() => {});
      }
    });
  }

  _updateCandle(market, trades) {
    trades.reverse().forEach((trade) => {
      EventBus.emit(Events.candleOnUpdate, market, {
        market,
        trade,
      });
    });
  }

  // there has 2 action, snapshot: full data; update: incremental data.
  _updateBooks(instId, data, action) {
    const [updateBooks] = data;
    const market = instId.replace("-", "").toLowerCase();
    const lotSz = this.okexWsChannels[Events.tickers][instId]["lotSz"];
    if (action === Events.booksActions.snapshot) {
      try {
        this.depthBook.updateAll(instId, lotSz, updateBooks);
      } catch (error) {
        this.logger.error(
          `[${this.constructor.name}]_updateBooks depthBook.updateAll error`,
          error
        );
      }
    }
    if (action === Events.booksActions.update) {
      try {
        this.depthBook.updateByDifference(instId, lotSz, updateBooks);
      } catch (error) {
        this.logger.error(
          `[${this.constructor.name}]_updateBooks depthBook.updateByDifference error`,
          error
        );
      }
    }
    EventBus.emit(Events.update, market, this.depthBook.getSnapshot(instId));
  }

  _updateTickers(data) {
    // broadcast to slanger (1/3)

    data.forEach((d) => {
      const tickerSetting =
        this.tickersSettings[d.instId.replace("-", "").toLowerCase()];
      if (
        tickerSetting?.source === SupportedExchange.OKEX &&
        tickerSetting?.visible
      ) {
        const ticker = this.tickerBook.formatTicker(
          { id: d.instId.replace("-", "").toLowerCase(), ...d },
          SupportedExchange.OKEX
        );

        // broadcast to slanger (2/3)
        this.ticker_data[ticker.id] = {
          name: ticker.name,
          base_unit: ticker.baseUnit,
          quote_unit: ticker.quoteUnit,
          group: ticker.group,
          low: ticker.low,
          high: ticker.high,
          last: ticker.last,
          open: ticker.open,
          volume: ticker.volume,
          sell: ticker.sell,
          buy: ticker.buy,
          at: ticker.at,
        };

        const result = this.tickerBook.updateByDifference(d.instId, ticker);
        if (result)
          EventBus.emit(Events.tickers, this.tickerBook.getDifference());
      }
    });

    // broadcast to slanger (3/3)
    this._broadcast_to_slanger();
  }

  _subscribeInstruments() {
    const instruments = {
      op: Events.subscribe,
      args: [
        {
          channel: Events.instruments,
          instType: Database.INST_TYPE.SPOT,
        },
      ],
    };
    this.websocket.ws.send(JSON.stringify(instruments));
  }

  _subscribeTrades(instId) {
    const args = [
      {
        channel: Events.trades,
        instId,
      },
    ];
    this.logger.debug(`_subscribeTrades instId[${instId}]`, args);
    this.websocket.ws.send(
      JSON.stringify({
        op: Events.subscribe,
        args,
      })
    );
  }

  _subscribeBook(instId) {
    // books: 400 depth levels will be pushed in the initial full snapshot. Incremental data will be pushed every 100 ms when there is change in order book.
    const args = [
      {
        channel: Events.books,
        instId,
      },
    ];
    this.websocket.ws.send(
      JSON.stringify({
        op: Events.subscribe,
        args,
      })
    );
  }

  _subscribeCandle1m(instId) {
    this.candleChannel = Events.candle1m;
    const args = [
      {
        channel: this.candleChannel,
        instId,
      },
    ];
    this.websocket.ws.send(
      JSON.stringify({
        op: Events.subscribe,
        args,
      })
    );
  }

  subscribeTicker(instId) {
    const channel = Events.tickers;
    if (!this.okexWsChannels[channel]) this.okexWsChannels[channel] = {};
    if (!this.okexWsChannels[channel][instId])
      this.okexWsChannels[channel][instId] = {};
    this.websocket.ws.send(
      JSON.stringify({
        op: Events.subscribe,
        args: [
          {
            channel,
            instId,
          },
        ],
      })
    );
  }

  unsubscribeTicker(instId) {
    const channel = Events.tickers;
    this.websocket.ws.send(
      JSON.stringify({
        op: Events.unsubscribe,
        args: [
          {
            channel,
            instId,
          },
        ],
      })
    );
    delete this.okexWsChannels[channel][instId];
  }

  _unsubscribeTrades(instId) {
    const args = [
      {
        channel: Events.trades,
        instId,
      },
    ];
    this.websocket.ws.send(
      JSON.stringify({
        op: Events.unsubscribe,
        args,
      })
    );
  }

  _unsubscribeBook(instId) {
    // books: 400 depth levels will be pushed in the initial full snapshot. Incremental data will be pushed every 100 ms when there is change in order book.
    const args = [
      {
        channel: Events.books,
        instId,
      },
    ];
    this.websocket.ws.send(
      JSON.stringify({
        op: Events.unsubscribe,
        args,
      })
    );
  }

  _unsubscribeCandle1m(instId) {
    const args = [
      {
        channel: Events.candle1m,
        instId,
      },
    ];
    this.websocket.ws.send(
      JSON.stringify({
        op: Events.unsubscribe,
        args,
      })
    );
  }

  async _wsPrivateLogin() {
    const method = "GET";
    const path = "/users/self/verify";

    const timestamp = Math.floor(Date.now() / 1000);

    const okAccessSign = await this.okAccessSign({
      timeString: timestamp,
      method,
      path: `${path}`,
    });
    const login = {
      op: Events.login,
      args: [
        {
          apiKey: this.apiKey,
          passphrase: this.passPhrase,
          timestamp,
          sign: okAccessSign,
        },
      ],
    };
    this.websocketPrivate.ws.send(JSON.stringify(login));
  }

  _subscribeOrders() {
    const orders = {
      op: Events.subscribe,
      args: [
        {
          channel: Events.orders,
          instType: Database.INST_TYPE.SPOT,
        },
      ],
    };
    this.websocketPrivate.ws.send(JSON.stringify(orders));
  }
  // okex ws end

  // TideBitEx ws
  _subscribeMarket(market, wsId, lotSz) {
    const tickerSetting = this.tickersSettings[market];
    if (tickerSetting?.source === SupportedExchange.OKEX) {
      this._subscribeTrades(tickerSetting?.instId);
      this._subscribeBook(tickerSetting?.instId);
      this.okexWsChannels[Events.tickers][tickerSetting?.instId]["lotSz"] =
        lotSz;
    }
  }

  _unsubscribeMarket(market) {
    const tickerSetting = this.tickersSettings[market];
    if (tickerSetting?.source === SupportedExchange.OKEX) {
      this._unsubscribeTrades(tickerSetting?.instId);
      this._unsubscribeBook(tickerSetting?.instId);
    }
  }

  _registerMarket(market) {
    let tickerSetting = this.tickersSettings[market];
    if (
      tickerSetting?.source === SupportedExchange.OKEX &&
      !this.registerMarkets.includes(market)
    ) {
      this._subscribeTrades(tickerSetting?.instId);
      this.registerMarkets = [...this.registerMarkets, market];
    }
  }
  _subscribeUser() {}

  _unsubscribeUser() {}
}
module.exports = OkexConnector;
