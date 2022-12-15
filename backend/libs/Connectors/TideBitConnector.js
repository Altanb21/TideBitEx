const ConnectorBase = require("../ConnectorBase");
const axios = require("axios");
const SafeMath = require("../SafeMath");
const EventBus = require("../EventBus");
const Events = require("../../constants/Events");
const SupportedExchange = require("../../constants/SupportedExchange");
const Utils = require("../Utils");
const ResponseFormat = require("../ResponseFormat");
const Codes = require("../../constants/Codes");
const TideBitLegacyAdapter = require("../TideBitLegacyAdapter");
const WebSocket = require("../WebSocket");
const { getBar, convertExponentialToDecimal } = require("../Utils");
const Database = require("../../constants/Database");

const HEART_BEAT_TIME = 25000;
class TibeBitConnector extends ConnectorBase {
  isStart = false;
  socketId;
  public_pusher = null;
  registerMarkets = [];
  // private_pusher = {};
  sn = {};

  global_channel = null;
  // private_channel = {};
  market_channel = {};

  private_client = {};

  fetchedTrades = {};
  fetchedBook = {};
  fetchedOrders = {};
  fetchedOrdersInterval = 1 * 60 * 1000;

  tickers = {};
  tidebitWsChannels = {};
  // instIds = [];

  constructor({ logger }) {
    super({ logger });
    this.websocket = new WebSocket({ logger });
    this.websocketPrivate = new WebSocket({ logger });
    return this;
  }

  async init({
    app,
    key,
    secret,
    wsProtocol,
    wsHost,
    port,
    wsPort,
    wssPort,
    encrypted,
    peatio,
    database,
    redis,
    tickerBook,
    depthBook,
    tradeBook,
    accountBook,
    orderBook,
    tickersSettings,
    coinsSettings,
    websocketDomain,
  }) {
    await super.init();
    this.app = app;
    this.key = key;
    this.secret = secret;
    this.wsProtocol = wsProtocol;
    this.wsHost = wsHost;
    this.wsPort = wsPort;
    this.wssPort = wssPort;
    this.encrypted = encrypted;
    this.peatio = peatio;
    this.database = database;
    this.redis = redis;
    this.depthBook = depthBook;
    this.tickerBook = tickerBook;
    this.tradeBook = tradeBook;
    this.accountBook = accountBook;
    this.orderBook = orderBook;
    this.tickersSettings = tickersSettings;
    this.coinsSettings = coinsSettings;
    this.websocketDomain = websocketDomain;
    this.websocket.init({
      url: `${this.wsProtocol}://${this.wsHost}:${this.wsPort}/app/${this.key}?protocol=7&client=js&version=2.2.0&flash=false`,
      heartBeat: HEART_BEAT_TIME,
      options: {
        perMessageDeflate: false,
        rejectUnauthorized: false,
      },
      listener: this.tidebitWsEventListener,
    });
    return this;
  }

  tidebitWsEventListener = (event) => {
    const data = JSON.parse(event.data);
    if (data.event === "pusher:connection_established") {
      this.socketId = JSON.parse(data.data)["socket_id"];
    }
    if (data.event !== "pusher:error") {
      // subscribe return
      const channel = data.channel;
      const market = channel?.replace(`market-`, "").replace("-global", "");
      delete data.channel;
      if (data.event === "pusher_internal:subscription_succeeded") {
        this.tidebitWsChannels[channel] = this.tidebitWsChannels[channel] || {};
        this.tidebitWsChannels[channel][market] =
          this.tidebitWsChannels[channel][market] || {};
      } else if (data.event === "unsubscribe") {
        delete this.tidebitWsChannels[channel][market];
        if (!Object.keys(this.tidebitWsChannels[channel]).length) {
          delete this.tidebitWsChannels[channel];
        }
      } else if (data.event === "error") {
        this.logger.error(
          `[${this.constructor.name}] _tidebitWsEventListener data.event === "error"`,
          data
        );
      }
      let memberId;
      switch (data.event) {
        case Events.trades:
          /**
            {
              trades: [
               {
                  tid: 118,
                  type: 'buy',
                  date: 1650532785,
                   price: '95.0',
                   amount: '0.1'
                }
              ]
            }
            */
          const tickerSetting = this.tickersSettings[market];
          const instId = tickerSetting?.instId;
          const trades = JSON.parse(data.data).trades.map((trade) =>
            this._formateTrade(market, trade)
          );
          this._updateTrades(instId, market, trades);
          this._updateCandle(market, trades);
          break;
        case Events.update:
          this._updateBooks(market, JSON.parse(data.data));
          break;
        case Events.tickers:
          this._updateTickers(JSON.parse(data.data));
          break;
        case Events.account:
          memberId = this.sn[channel.replace("private-", "")];
          this._updateAccount(memberId, JSON.parse(data.data));
          break;
        case Events.order:
          memberId = this.sn[channel.replace("private-", "")];
          this._updateOrder(memberId, JSON.parse(data.data));
          break;
        case Events.trade:
          memberId = this.sn[channel.replace("private-", "")];
          this._updateTrade(memberId, JSON.parse(data.data));
          break;
        default:
      }
    }
    this.websocket.heartbeat();
  }

  async getTicker({ query }) {
    const tBTickerRes = await axios.get(
      `${this.peatio}/api/v2/tickers/${query.id}`
    );
    if (!tBTickerRes || !tBTickerRes.data) {
      return new ResponseFormat({
        message: "Something went wrong",
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
    const tickerObj = tBTickerRes.data;
    const change = SafeMath.minus(tickerObj.ticker.last, tickerObj.ticker.open);
    const changePct = SafeMath.gt(tickerObj.ticker.open, "0")
      ? SafeMath.div(change, tickerObj.ticker.open)
      : SafeMath.eq(change, "0")
      ? "0"
      : "1";

    let formatTBTicker = null;
    const tbTicker = this.tickersSettings[query.id];
    if (tbTicker && tbTicker?.visible) {
      formatTBTicker = {};
      formatTBTicker[query.id] = {
        ...tbTicker,
        ...tickerObj.ticker,
        market: query.id,
        at: tickerObj.at,
        ts: parseInt(SafeMath.mult(tickerObj.at, "1000")),
        change,
        changePct,
        volume: tickerObj.ticker.vol.toString(),
        source: SupportedExchange.TIDEBIT,
        ticker: tickerObj.ticker,
      };
    }
    return new ResponseFormat({
      message: "getTicker",
      payload: formatTBTicker,
    });
  }

  async getTickers({ query }) {
    const tBTickersRes = await axios.get(`${this.peatio}/api/v2/tickers`);
    if (!tBTickersRes || !tBTickersRes.data) {
      return new ResponseFormat({
        message: "Something went wrong",
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
    let tickers = {};
    const tBTickers = tBTickersRes.data;
    Object.keys(tBTickers).forEach((id) => {
      const tickerObj = tBTickers[id];
      let formatedTicker = this.tickerBook.formatTicker(
        {
          ...tickerObj.ticker,
          volume: tickerObj.ticker.vol,
          id: id,
          market: id,
          at: tickerObj.at,
        },
        SupportedExchange.TIDEBIT
      );
      if (formatedTicker) tickers[formatedTicker.id] = formatedTicker;
    });
    return new ResponseFormat({
      message: "getTickers from TideBit",
      payload: tickers,
    });
  }

  _updateTickers(data) {
    /**
   {
   btchkd: {
    name: 'BTC/HKD',
    base_unit: 'btc',
    quote_unit: 'hkd',
    group: 'hkd',
    low: '0.0',
    high: '0.0',
    last: '0.0',
    open: '0.0',
    volume: '0.0',
    sell: '0.0',
    buy: '1000.0',
    at: 1649742406
  },}
    */
    Object.values(data).forEach((d) => {
      const market = d.name.replace("/", "").toLowerCase();
      const tickerSetting = this.tickersSettings[market];
      const instId = tickerSetting?.instId;
      if (
        tickerSetting?.source === SupportedExchange.TIDEBIT &&
        tickerSetting?.visible
      ) {
        const ticker = this.tickerBook.formatTicker(
          { ...d, id: market, market, instId },
          SupportedExchange.TIDEBIT
        );
        const result = this.tickerBook.updateByDifference(
          ticker.instId,
          ticker
        );
        // ++ BUG ethhkd & btchkd OPEN will turn 0
        if (result)
          EventBus.emit(Events.tickers, this.tickerBook.getDifference());
      }
    });
  }

  /** [deprecated] */
  async getDepthBooks({ query }) {
    const { instId, market, lotSz } = query;
    try {
      const tbBooksRes = await axios.get(
        `${this.peatio}/api/v2/order_book?market=${market}`
      );
      if (!tbBooksRes || !tbBooksRes.data) {
        return new ResponseFormat({
          message: "Something went wrong",
          code: Codes.API_UNKNOWN_ERROR,
        });
      }
      const tbBooks = tbBooksRes.data;
      let total,
        sumAskAmount = "0",
        sumBidAmount = "0",
        asks = [],
        bids = [];
      tbBooks.asks.forEach((ask) => {
        if (
          ask.market === market &&
          ask.ord_type === Database.ORD_TYPE.LIMIT &&
          ask.state === Database.ORDER_STATE.WAIT
        ) {
          let index;
          index = asks.findIndex((_ask) => SafeMath.eq(_ask[0], ask.price));
          if (index !== -1) {
            let updateAsk = asks[index];
            updateAsk[1] = SafeMath.plus(updateAsk[1], ask.remaining_volume);
            asks[index] = updateAsk;
          } else {
            let newAsk = [
              convertExponentialToDecimal(ask.price),
              convertExponentialToDecimal(ask.remaining_volume),
            ]; // [價格, volume]
            asks.push(newAsk);
          }
        }
      });
      tbBooks.bids.forEach((bid) => {
        if (
          bid.market === market &&
          bid.ord_type === Database.ORD_TYPE.LIMIT &&
          bid.state === Database.ORDER_STATE.WAIT
        ) {
          let index;
          index = bids.findIndex((_bid) => SafeMath.eq(_bid[0], bid.price));
          if (index !== -1) {
            let updateBid = bids[index];
            updateBid[1] = SafeMath.plus(updateBid[1], bid.remaining_volume);
            bids[index] = updateBid;
          } else {
            let newBid = [
              convertExponentialToDecimal(bid.price),
              convertExponentialToDecimal(bid.remaining_volume),
            ]; // [價格, volume]
            bids.push(newBid);
          }
        }
      });
      asks = asks
        .filter((v) => SafeMath.gte(v[1], lotSz))
        .sort((a, b) => +a[0] - +b[0])
        .slice(0, 50)
        .map((v) => {
          sumAskAmount = SafeMath.plus(v[1], sumAskAmount);
          return [v[0], v[1], sumAskAmount];
        });
      bids = bids
        .filter((v) => SafeMath.gte(v[1], lotSz))
        .sort((a, b) => +b[0] - +a[0])
        .slice(0, 50)
        .map((v) => {
          sumBidAmount = SafeMath.plus(v[1], sumBidAmount);
          return [v[0], v[1], sumBidAmount];
        });
      total = SafeMath.plus(sumAskAmount || "0", sumBidAmount || "0");
      asks = asks.map((v) => [...v, SafeMath.div(v[2], total)]);
      bids = bids.map((v) => [...v, SafeMath.div(v[2], total)]);
      const books = { asks, bids, market: market };
      return new ResponseFormat({
        message: "DepthBook",
        payload: books,
      });
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getDepthBooks`, error);
      const message = error.message;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  _updateBooks(market, updateBooks) {
    const lotSz = this.market_channel[`market-${market}-global`]["lotSz"];
    /**
    {
        asks: [
            ['160.0', '2.0998'],
            ['300.0', '1.0']
        ], 
        bids: [
            ['110.0', '13.4916'],
            ['10.0', '0.118']
        ]
    }
    */
    const tickerSetting = this.tickersSettings[market];
    const instId = tickerSetting?.instId;
    this.depthBook.updateAll(instId, lotSz, updateBooks);
    EventBus.emit(Events.update, market, this.depthBook.getSnapshot(instId));
  }

  async logout({ header, body }) {
    try {
      const headers = {
        "content-type": "application/x-www-form-urlencoded",
        "x-csrf-token": body["X-CSRF-Token"],
        cookie: header.cookie,
      };
      const res = await axios.get(`${this.peatio}/signout`, {
        headers,
      });
      return new ResponseFormat({
        message: "logout",
        payload: res.headers["set-cookie"],
      });
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] logout`, error);
      const message = error.message;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  /**
    [
      {
        "id": 48,
        "price": "110.0",
        "volume": "54.593",
        "funds": "6005.263",
        "market": "ethhkd",
        "created_at": "2022-04-01T09:40:21Z",
        "at": 1648806021,
        "side": "down"
      },
    ]
    */
  // descending
  async getTrades({ query }) {
    const { instId, market, lotSz } = query;
    if (!this.fetchedTrades[instId]) {
      try {
        const tbTradesRes = await axios.get(
          `${this.peatio}/api/v2/trades?market=${market}`
        );
        if (!tbTradesRes || !tbTradesRes.data) {
          return new ResponseFormat({
            message: "Something went wrong",
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
        this.tradeBook.updateAll(
          instId,
          lotSz,
          tbTradesRes.data.map((d) => ({
            ...d,
            ts: parseInt(SafeMath.mult(d.at, "1000")),
          }))
        );
        this.fetchedTrades[instId] = true;
      } catch (error) {
        this.logger.error(error);
        const message = error.message;
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

  _updateTrade(memberId, newTrade) {
    /**  {
       at: 1649675739
       id: 6
       kind: "ask"
       market: "ethhkd"
       price: "105.0"
       volume: "0.1"
      }*/
    const lotSz =
      this.market_channel[`market-${newTrade.market}-global`]["lotSz"];
    const tickerSetting = this.tickersSettings[newTrade.market];
    const instId = tickerSetting?.instId;
    const newTrades = [
      {
        ...newTrade,
        ts: parseInt(SafeMath.mult(newTrade.at, "1000")),
      },
    ];
    this.tradeBook.updateByDifference(instId, lotSz, newTrades);
    EventBus.emit(Events.trade, memberId, newTrade.market, {
      market: newTrade.market,
      difference: this.tradeBook.getDifference(instId),
    });
  }

  _formateTrade(market, trade) {
    return {
      id: trade.tid,
      at: trade.date,
      ts: parseInt(SafeMath.mult(trade.date, "1000")),
      price: trade.price,
      volume: trade.amount,
      market,
    };
  }

  _updateTrades(instId, market, trades) {
    const lotSz = this.market_channel[`market-${market}-global`]
      ? this.market_channel[`market-${market}-global`]["lotSz"]
      : undefined;
    const newTrades = trades.map((trade) => this._formateTrade(market, trade));
    this.tradeBook.updateByDifference(instId, lotSz, newTrades);
    EventBus.emit(Events.trades, market, {
      market,
      trades: this.tradeBook.getSnapshot(instId),
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

  /* 
  {
    'BTC': {
      'sum': '0.0',
      'balance': [
        {
          'currency': 'BTC',
          'balance': '0.0',
          'locked': '0.0',
          'total': '0.0',
        }
      ]
    }
  }
  **/

  /**
   * [deprecated] 2022/10/14
   */
  async getUsersAccounts() {
    try {
      const _accounts = await this.database.getAccounts();
      const accounts = {};
      _accounts.forEach((account) => {
        let currency = this.coinsSettings.find(
          (curr) => curr.id === account.currency
        ).symbol;
        if (!accounts[currency]) {
          accounts[currency] = {};
          accounts[currency]["details"] = [];
          accounts[currency]["balance"] = "0";
          accounts[currency]["locked"] = "0";
          accounts[currency]["total"] = "0";
        }
        let balance = Utils.removeZeroEnd(account.balance);
        let locked = Utils.removeZeroEnd(account.locked);
        let total = SafeMath.plus(balance, locked);
        accounts[currency]["balance"] = SafeMath.plus(
          accounts[currency]["balance"],
          balance
        );
        accounts[currency]["locked"] = SafeMath.plus(
          accounts[currency]["locked"],
          locked
        );
        accounts[currency]["total"] = SafeMath.plus(
          accounts[currency]["total"],
          total
        );
        accounts[currency]["details"].push({
          currency: currency,
          memberId: account.member_id,
          balance,
          locked,
          total,
        });
        accounts[currency]["details"].sort((a, b) => b.total - a.total);
      });
      return new ResponseFormat({
        message: "getUsersAccounts",
        payload: accounts,
      });
    } catch (error) {
      this.logger.error(error);
      const message = error.message;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async getAccounts({ query }) {
    let { memberId, email, token } = query;
    try {
      const _accounts = await this.database.getAccountsByMemberId(memberId, {});
      const accounts = _accounts.map((account) => {
        let coinsSetting = this.coinsSettings.find(
          (curr) => curr.id === account.currency
        );
        if (!coinsSetting) {
          this.logger.error(
            `[${this.constructor.name}] getAccounts coinsSettings[${account?.currency}] is null`
          );
        }
        return {
          currency: coinsSetting?.code.toUpperCase(),
          balance: Utils.removeZeroEnd(account.balance),
          total: SafeMath.plus(account.balance, account.locked),
          locked: Utils.removeZeroEnd(account.locked),
        };
      });

      this.accountBook.updateAll(memberId, accounts);
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] getAccounts error`, error);
      const message = error.message;
      return new ResponseFormat({
        message,
        code: Codes.MEMBER_ID_NOT_FOUND,
        payload: null, // ++ TODO ?
      });
    }
    return new ResponseFormat({
      message: "getAccounts",
      payload: {
        accounts: this.accountBook.getSnapshot(memberId),
        memberId,
        email,
        peatioSession: token,
      },
    });
  }

  _updateAccount(memberId, data) {
    /**
    {
        balance: '386.8739', 
        locked: '436.73', 
        currency: 'hkd'
    }
    */
    const account = {
      ...data,
      currency: data.currency.toUpperCase(),
      total: SafeMath.plus(data.balance, data.locked),
    };
    this.accountBook.updateByDifference(memberId, account);
    EventBus.emit(
      Events.account,
      memberId,
      this.accountBook.getDifference(memberId)
    );
  }

  async tbGetOrderList(query) {
    const { instId, memberId, tickerSetting } = query;
    if (!tickerSetting) {
      throw new Error(`${tickerSetting} is undefined.`);
    }
    const { id: bid } = this.coinsSettings.find(
      (curr) => curr.code === tickerSetting.quoteUnit
    );
    const { id: ask } = this.coinsSettings.find(
      (curr) => curr.code === tickerSetting.baseUnit
    );
    if (!bid) {
      throw new Error(`bid not found${tickerSetting.quoteUnit}`);
    }
    if (!ask) {
      throw new Error(`ask not found${tickerSetting.baseUnit}`);
    }
    let orderList;
    orderList = await this.database.getOrderList({
      quoteCcy: bid,
      baseCcy: ask,
      memberId: memberId,
    });
    const orders = orderList.map((order) => {
      return {
        id: order.id,
        ts: parseInt(new Date(order.updated_at).getTime()),
        at: parseInt(
          SafeMath.div(new Date(order.updated_at).getTime(), "1000")
        ),
        market: tickerSetting?.market,
        kind:
          order.type === Database.TYPE.ORDER_ASK
            ? Database.ORDER_KIND.ASK
            : Database.ORDER_KIND.BID,
        price: Utils.removeZeroEnd(order.price),
        origin_volume: Utils.removeZeroEnd(order.origin_volume),
        volume: Utils.removeZeroEnd(order.volume),
        state: SafeMath.eq(order.state, Database.ORDER_STATE_CODE.CANCEL)
          ? Database.ORDER_STATE.CANCEL
          : SafeMath.eq(order.state, Database.ORDER_STATE_CODE.WAIT)
          ? Database.ORDER_STATE.WAIT
          : SafeMath.eq(order.state, Database.ORDER_STATE_CODE.DONE)
          ? Database.ORDER_STATE.DONE
          : Database.ORDER_STATE.UNKNOWN,
        state_text: SafeMath.eq(order.state, Database.ORDER_STATE_CODE.CANCEL)
          ? Database.ORDER_STATE_TEXT.CANCEL
          : SafeMath.eq(order.state, Database.ORDER_STATE_CODE.WAIT)
          ? Database.ORDER_STATE_TEXT.WAIT
          : SafeMath.eq(order.state, Database.ORDER_STATE_CODE.DONE)
          ? Database.ORDER_STATE_TEXT.DONE
          : Database.ORDER_STATE_TEXT.UNKNOWN,
        clOrdId: order.id,
        instId,
        ordType: order.ord_type,
        filled: order.volume !== order.origin_volume,
      };
    });
    return orders;
  }

  async getOrderList({ query }) {
    const { instId, memberId } = query;
    if (!this.fetchedOrders[memberId]) this.fetchedOrders[memberId] = {};
    let ts = Date.now();
    if (
      !this.fetchedOrders[memberId][instId] ||
      SafeMath.gt(
        SafeMath.minus(ts, this.fetchedOrders[memberId][instId]),
        this.fetchedOrdersInterval
      )
    )
      try {
        const orders = await this.tbGetOrderList(query);
        this.orderBook.updateAll(memberId, instId, orders);
        this.fetchedOrders[memberId][instId] = ts;
      } catch (error) {
        this.logger.error(error);
        const message = error.message;
        return new ResponseFormat({
          message,
          code: Codes.API_UNKNOWN_ERROR,
        });
      }
    return new ResponseFormat({
      message: "getOrderList",
      payload: this.orderBook.getSnapshot(memberId, instId, "pending"),
    });
  }

  async getOrderHistory({ query }) {
    const { instId, memberId } = query;
    if (!this.fetchedOrders[memberId]) this.fetchedOrders[memberId] = {};
    let ts = Date.now();
    if (
      !this.fetchedOrders[memberId][instId] ||
      SafeMath.gt(
        SafeMath.minus(ts, this.fetchedOrders[memberId][instId]),
        this.fetchedOrdersInterval
      )
    ) {
      try {
        const orders = await this.tbGetOrderList(query);
        this.orderBook.updateAll(memberId, instId, orders);
        this.fetchedOrders[memberId][instId] = ts;
      } catch (error) {
        this.logger.error(error);
        const message = error.message;
        return new ResponseFormat({
          message,
          code: Codes.API_UNKNOWN_ERROR,
        });
      }
    }
    return new ResponseFormat({
      message: "getOrderHistory",
      payload: this.orderBook.getSnapshot(memberId, instId, "history"),
    });
  }

  async _updateOrder(memberId, data) {
    /**
    {
        id: 86, 
        at: 1649243638, 
        market: 'ethhkd', 
        kind: 'bid', 
        price: null, // market prcie
        origin_volume: "2.0",
        safe: undefined,
        state: "wait",
        state_text: "Waiting",
        volume: "2.0",
        escape: ƒ (value)
    }
    */
    // ++ TODO
    // formatOrder
    const tickerSetting = this.tickersSettings[data.market];
    const instId = tickerSetting?.instId;
    let price = data.price || "market",
      dbOrder;
    if (!data.price) {
      [dbOrder] = await this.database.getDoneOrders({ orderId: data.id });
      price = dbOrder?.price;
      if (!price) {
        price =
          dbOrder.type === Database.TYPE.ORDER_BID
            ? SafeMath.gt(dbOrder.funds_received, 0)
              ? SafeMath.div(
                  SafeMath.minus(dbOrder.origin_locked, dbOrder.locked),
                  dbOrder.funds_received
                )
              : "market"
            : SafeMath.gt(
                SafeMath.minus(dbOrder.origin_volume, dbOrder.volume),
                0
              )
            ? SafeMath.div(
                dbOrder.funds_received,
                SafeMath.minus(dbOrder.origin_volume, dbOrder.volume)
              )
            : "market";
      }
    }
    const formatOrder = {
      ...data,
      clOrdId: data.id,
      instId,
      ordType:
        data.price === undefined
          ? Database.ORD_TYPE.MARKET
          : Database.ORD_TYPE.LIMIT,
      ts: parseInt(SafeMath.mult(data.at, "1000")),
      at: parseInt(data.at),
      price,
      filled: data.volume !== data.origin_volume,
      state:
        data.state === Database.ORDER_STATE.WAIT
          ? Database.ORDER_STATE.WAIT
          : data.state === Database.ORDER_STATE.DONE
          ? Database.ORDER_STATE.DONE
          : Database.ORDER_STATE.CANCEL,
      state_text:
        data.state === Database.ORDER_STATE.WAIT
          ? Database.ORDER_STATE_TEXT.WAIT
          : data.state === Database.ORDER_STATE.DONE
          ? Database.ORDER_STATE_TEXT.DONE
          : Database.ORDER_STATE_TEXT.CANCEL,
    };
    this.orderBook.updateByDifference(memberId, instId, {
      add: [formatOrder],
    });
    EventBus.emit(Events.order, memberId, data.market, {
      market: data.market,
      difference: this.orderBook.getDifference(memberId, instId),
    });
  }

  async postPlaceOrder({ header, body }) {
    try {
      const url =
        body.kind === Database.ORDER_KIND.BID
          ? `${this.peatio}/markets/${body.market.id}/order_bids`
          : `${this.peatio}/markets/${body.market.id}/order_asks`;
      const headers = {
        "content-type": "application/x-www-form-urlencoded",
        "x-csrf-token": body["X-CSRF-Token"],
        cookie: header.cookie,
      };
      const formbody = TideBitLegacyAdapter.peatioOrderBody({
        header,
        body,
      });
      const tbOrdersRes = await axios.post(url, formbody, {
        headers,
      }); // TODO: payload
      if (tbOrdersRes.data?.result) {
        return new ResponseFormat({
          message: "postPlaceOrder",
          payload: [
            {
              id: "",
              clOrdId: "",
              sCode: "",
              sMsg: tbOrdersRes.data?.message,
              tag: "",
              data: "",
            },
          ],
        });
      } else {
        this.logger.error(`postPlaceOrder result false`, tbOrdersRes.data);
        return new ResponseFormat({
          message: tbOrdersRes.data?.errors
            ? tbOrdersRes.data?.errors
            : "postPlaceOrder error",
          code:
            tbOrdersRes.data?.errors === "市場深度不足"
              ? Codes.MARKET_NOT_DEEP_ENOUGH
              : Codes.USER_IS_LOGOUT,
        });
      }
    } catch (error) {
      this.logger.error(`postPlaceOrder catch Error`, error.response);
      // debug for postman so return error
      return new ResponseFormat({
        message: error.response?.data?.errors
          ? error.response?.data?.errors
          : "postPlaceOrder error",
        code: error.response?.data?.errors //++TODO 2022/11/25 需要找出判讀 peatioSession 過期的方法
          ? Codes.MARKET_NOT_DEEP_ENOUGH
          : Codes.USER_IS_LOGOUT,
      });
    }
  }

  async postCancelOrder({ header, body }) {
    try {
      const url = `${this.peatio}/markets/${body.market.id}/orders/${body.orderId}`;
      const headers = {
        Accept: "*/*",
        "x-csrf-token": body["X-CSRF-Token"],
        cookie: header.cookie,
      };
      const tbCancelOrderRes = await axios({
        method: "DELETE",
        url,
        headers,
      });
      return new ResponseFormat({
        message: "postCancelOrder",
        code: Codes.SUCCESS,
        payload: tbCancelOrderRes.data,
      });
    } catch (error) {
      this.logger.error(error?.response ? error?.response : error);
      // debug for postman so return error
      return new ResponseFormat({
        message: "postCancelOrder error",
        code: Codes.UNKNOWN_ERROR,
      });
    }
  }

  async cancelAllAsks({ header, body }) {
    try {
      const url = `${this.peatio}/markets/${body.market.id}/order_asks/clear`;
      const headers = {
        Accept: "*/*",
        "x-csrf-token": body["X-CSRF-Token"],
        cookie: header.cookie,
      };
      const tbCancelOrderRes = await axios({
        method: "post",
        url,
        headers,
      });
      return new ResponseFormat({
        message: "cancelAllAsks",
        code: Codes.SUCCESS,
        payload: tbCancelOrderRes.data,
      });
    } catch (error) {
      this.logger.error(`cancelAllAsks error`, error);
      return new ResponseFormat({
        message: "cancelAllAsks error",
        code: Codes.UNKNOWN_ERROR,
      });
    }
  }

  async cancelAllBids({ header, body }) {
    try {
      const url = `${this.peatio}/markets/${body.market.id}/order_bids/clear`;
      const headers = {
        Accept: "*/*",
        "x-csrf-token": body["X-CSRF-Token"],
        cookie: header.cookie,
      };
      const tbCancelOrderRes = await axios({
        method: "post",
        url,
        headers,
      });
      return new ResponseFormat({
        message: "cancelAllBids",
        code: Codes.SUCCESS,
        payload: tbCancelOrderRes.data,
      });
    } catch (error) {
      this.logger.error(`cancelAllBids error`, error);
      return new ResponseFormat({
        message: "cancelAllBids error",
        code: Codes.UNKNOWN_ERROR,
      });
    }
  }

  async cancelAllOrders({ header, body }) {
    try {
      const url = `${this.peatio}/markets/${body.market.id}/orders/clear`;
      const headers = {
        Accept: "*/*",
        "x-csrf-token": body["X-CSRF-Token"],
        cookie: header.cookie,
      };
      const tbCancelOrderRes = await axios({
        method: "post",
        url,
        headers,
      });
      return new ResponseFormat({
        message: "cancelAll",
        code: Codes.SUCCESS,
        payload: tbCancelOrderRes.data,
      });
    } catch (error) {
      this.logger.error(`cancelAllOrders error`, error);
      return new ResponseFormat({
        message: "cancelAll error",
        code: Codes.UNKNOWN_ERROR,
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
      pricescale: query.market?.price_group_fixed
        ? 10 ** query.market.price_group_fixed
        : 10000,
      has_intraday: true,
      has_daily: true,
      intraday_multipliers: ["1", "5", "15", "30", "60"],
      has_weekly_and_monthly: true,
    });
  }

  async getTradingViewHistory({ query }) {
    const method = "GET";
    const path = `${this.websocketDomain}/api/v2/tradingview/history`;
    let { instId, resolution, from, to } = query;

    let arr = [];
    if (instId) arr.push(`instId=${instId}`);
    if (resolution) arr.push(`bar=${getBar(resolution)}`);
    // before	String	否	请求此时间戳之后（更新的数据）的分页内容，传的值为对应接口的ts
    // if (from) arr.push(`before=${parseInt(from) * 1000}`); //5/23
    //after	String	否	请求此时间戳之前（更旧的数据）的分页内容，传的值为对应接口的ts
    if (to) arr.push(`after=${parseInt(to) * 1000}`); //6/2
    arr.push(`limit=${300}`);
    let qs = !!arr.length ? `?${arr.join("&")}` : "";

    try {
      const tbTradesRes = await axios.get(`${path}${qs}`);
      if (tbTradesRes.data && tbTradesRes.data.s !== "ok") {
        const [message] = tbTradesRes.data.data;
        return new ResponseFormat({
          message: message.sMsg,
          code: Codes.THIRD_PARTY_API_ERROR,
        });
      }
      let data = tbTradesRes.data;
      let bars = [];
      data.t.forEach((t, i) => {
        if (t >= from && t < to) {
          bars = [
            ...bars,
            {
              time: parseInt(t) * 1000,
              low: data.l[i],
              high: data.h[i],
              open: data.o[i],
              close: data.c[i],
              volume: data.v[i],
            },
          ];
        }
      });
      return new ResponseFormat({
        message: "getTradingViewHistory",
        payload: bars,
      });
    } catch (error) {
      this.logger.error(error);
      let message = error.message;
      if (error.response && error.response.data)
        message = error.response.data.msg;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async _registerPrivateChannel(auth, memberId, sn) {
    let channel;
    try {
      channel = `private-${sn}`;
      this.websocket.send(
        JSON.stringify({
          event: "pusher:subscribe",
          data: {
            auth,
            channel,
          },
        })
      );
    } catch (error) {
      this.logger.error(`private_channel error`, error);
      throw error;
    }
    return channel;
  }

  _unregisterPrivateChannel(client) {
    try {
      this.websocket.send(
        JSON.stringify({
          event: "pusher:unsubscribe",
          data: {
            channel: `private-${client["sn"]}`,
          },
        })
      );
    } catch (error) {
      this.logger.error(`_unregisterPrivateChannel error`, error);
      throw error;
    }
  }

  _registerMarketChannel(market, wsId, lotSz) {
    if (!this.market_channel[`market-${market}-global`]) {
      try {
        this.market_channel[`market-${market}-global`] = {};
        this.websocket.send(
          JSON.stringify({
            event: "pusher:subscribe",
            data: {
              channel: `market-${market}-global`,
            },
          })
        );
        if (wsId)
          this.market_channel[`market-${market}-global`]["listener"] = [wsId];
        if (lotSz)
          this.market_channel[`market-${market}-global`]["lotSz"] = lotSz;
      } catch (error) {
        this.logger.error(`_registerMarketChannel error`, error);
        throw error;
      }
    } else {
      this.market_channel[`market-${market}-global`]["listener"].push(wsId);
    }
  }

  _unregisterMarketChannel(market, wsId) {
    if (!this.isStart || !this.market_channel[`market-${market}-global`] || this.registerMarkets.includes(market))
      return;
    try {
      if (
        this.market_channel[`market-${market}-global`]["listener"]?.length > 0
      ) {
        this.market_channel[`market-${market}-global`]["listener"] =
          this.market_channel[`market-${market}-global`]["listener"].filter(
            (_wsId) => _wsId !== wsId
          );
      }
      if (
        this.market_channel[`market-${market}-global`]["listener"]?.length === 0
      ) {
        this.websocket.send(
          JSON.stringify({
            event: "pusher:unsubscribe",
            data: {
              channel: `market-${market}-global`,
            },
          })
        );
        delete this.market_channel[`market-${market}-global`];
      }
      if (Object.keys(this.market_channel).length === 0) {
        this._unregisterGlobalChannel();
        this.market_channel = {};
        // this.public_pusher = null;
        this.isStart = false;
      }
    } catch (error) {
      this.logger.error(`_unregisterMarketChannel error`, error);
      throw error;
    }
  }

  _registerGlobalChannel() {
    try {
      this.websocket.send(
        JSON.stringify({
          event: "pusher:subscribe",
          data: {
            channel: `market-global`,
          },
        })
      );
    } catch (error) {
      this.logger.error(`_registerGlobalChannel error`, error);
      throw error;
    }
  }

  _unregisterGlobalChannel() {
    if (!this.isStart) return;
    try {
      this.websocket.send(
        JSON.stringify({
          event: "pusher:unsubscribe",
          data: {
            channel: `market-global`,
          },
        })
      );
    } catch (error) {
      this.logger.error(`_unregisterGlobalChannel error`, error);
      throw error;
    }
  }

  _startPusher() {
    this.isStart = true;
    this._registerGlobalChannel();
  }

  /**
   * ++TODO
   * 連續被呼叫兩次，會連續兩次出錯，流程有問題，需要調整
   * */
  async _startPusherWithLoginToken(headers, sn) {
    let auth;
    if (this.socketId) {
      const data = JSON.stringify({
        socket_id: this.socketId,
        channel_name: `private-${sn}`,
      });
      try {
        const authRes = await axios({
          url: `${this.peatio}/pusher/auth`,
          method: "POST",
          headers: {
            ...headers,
            "Content-Length": Buffer.from(data, "utf-8").length,
          },
          data,
        });
        auth = authRes.data.auth;
        if (!auth)
          this.logger.error(
            `[${this.constructor.name}](ln:1263) pusher:auth error did not get auth, sn[${sn}], socketId[${this.socketId}] headers`,
            headers
          );
      } catch (error) {
        this.logger.error(
          `(ln:1268) request url:${this.peatio}/pusher/auth got error status: ${error?.status} statusText: ${error?.status}`,
          `headers`,
          error?.headers,
          `config`,
          error?.config,
          `data`,
          error?.data
        );

        // this.logger.error(error?.response)
      }
    } else {
      this.logger.error(`pusher:auth error without socketId`);
    }
    return auth;
  }

  /**
   *
   * @param {*} credential
   * headers
   * token
   * market
   * wsId
   */
  async _subscribeUser(credential) {
    try {
      if (credential.memberId !== -1) {
        const client = this.private_client[credential.memberId];
        if (!client) {
          const member = await this.database.getMemberByCondition({
            id: credential.memberId,
          });
          const auth = await this._startPusherWithLoginToken(
            credential.headers,
            member.sn
          );
          if (auth) {
            const channel = await this._registerPrivateChannel(
              auth,
              credential.memberId,
              member.sn
            );
            this.sn[member.sn] = credential.memberId;
            this.private_client[credential.memberId] = {
              memberId: credential.memberId,
              sn: member.sn,
              wsIds: [credential.wsId],
              auth,
              channel,
            };
          } else {
            EventBus.emit(Events.userStatusUpdate, credential.memberId, {
              isLogin: false,
            });
          }
        } else {
          this.private_client[credential.memberId].wsIds.push(credential.wsId);
        }
      }
    } catch (error) {
      this.logger.error(
        `_subscribeUser error`,
        error?.response ? error?.response : error
      );
      // throw error;
    }
  }
  /**
   *
   * @param {*} credential
   * wsId
   * market
   */
  async _unsubscribeUser(wsId) {
    let wsIndex;
    const index = Object.values(this.private_client).findIndex((client) =>
      client.wsIds.some((_wsId, _index) => {
        if (_wsId === wsId) {
          wsIndex = _index;
        }
        return _wsId === wsId;
      })
    );
    const client = Object.values(this.private_client)[index];
    if (index !== -1) {
      client.wsIds.splice(wsIndex, 1);
      if (client.wsIds.length === 0) {
        try {
          // this._unregisterPrivateChannel(client);
          delete this.private_client[client.memberId];
        } catch (error) {
          this.logger.error(`_unsubscribeUser error`, error);
          throw error;
        }
      } else {
      }
    }
  }

  _subscribeMarket(market, wsId, lotSz) {
    const tickerSetting = this.tickersSettings[market];
    if (tickerSetting?.source === SupportedExchange.TIDEBIT) {
      if (!this.isStart) this._startPusher();
      this._registerMarketChannel(market, wsId, lotSz);
    }
  }

  _unsubscribeMarket(market, wsId) {
    const tickerSetting = this.tickersSettings[market];
    if (tickerSetting?.source === SupportedExchange.TIDEBIT) {
      this._unregisterMarketChannel(market, wsId);
    }
  }

  _registerMarket(market) {
    let tickerSetting = this.tickersSettings[market];
    if (
      tickerSetting?.source === SupportedExchange.TIDEBIT &&
      !this.registerMarkets.includes(market)
    ) {
      this._registerMarketChannel(market);
      this.registerMarkets = [...this.registerMarkets, market];
    }
  }
}

module.exports = TibeBitConnector;
