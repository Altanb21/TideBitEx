const ConnectorBase = require("../ConnectorBase");
const Pusher = require("pusher-js");
const axios = require("axios");
const SafeMath = require("../SafeMath");
const EventBus = require("../EventBus");
const Events = require("../../constants/Events");
const SupportedExchange = require("../../constants/SupportedExchange");
const Utils = require("../Utils");
const ResponseFormat = require("../ResponseFormat");
const Codes = require("../../constants/Codes");
const TideBitLegacyAdapter = require("../TideBitLegacyAdapter");

class TibeBitConnector extends ConnectorBase {
  isStart = false;

  public_pusher = null;
  // private_pusher = {};

  global_channel = null;
  // private_channel = {};
  market_channel = {};

  private_client = {};

  fetchedTrades = {};
  fetchedBook = {};
  fetchedOrders = {};
  fetchedOrdersInterval = 1 * 60 * 1000;

  constructor({ logger }) {
    super({ logger });
    return this;
  }

  async init({
    app,
    key,
    secret,
    wsHost,
    port,
    wsPort,
    wssPort,
    encrypted,
    peatio,
    markets,
    database,
    redis,
    tickerBook,
    depthBook,
    tradeBook,
    accountBook,
    orderBook,
  }) {
    await super.init();
    this.app = app;
    this.key = key;
    this.secret = secret;
    this.wsHost = wsHost;
    this.wsPort = wsPort;
    this.wssPort = wssPort;
    this.encrypted = encrypted;
    this.peatio = peatio;
    this.markets = markets;
    this.database = database;
    this.redis = redis;
    this.currencies = await this.database.getCurrencies();
    this.depthBook = depthBook;
    this.tickerBook = tickerBook;
    this.tradeBook = tradeBook;
    this.accountBook = accountBook;
    this.orderBook = orderBook;
    return this;
  }

  async getTicker({ query, optional }) {
    const tBTickerRes = await axios.get(
      `${this.peatio}/api/v2/tickers/${query.id}`
    );
    if (!tBTickerRes || !tBTickerRes.data) {
      return new ResponseFormat({
        message: "Something went wrong",
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
    const tBTicker = tBTickerRes.data;
    const change = SafeMath.minus(tBTicker.ticker.last, tBTicker.ticker.open);
    const changePct = SafeMath.gt(tBTicker.ticker.open, "0")
      ? SafeMath.div(change, tBTicker.ticker.open)
      : SafeMath.eq(change, "0")
      ? "0"
      : "1";

    const formatTBTicker = {};
    formatTBTicker[query.id] = {
      market: query.id,
      instId: query.instId,
      name: optional.market.name,
      base_unit: optional.market.base_unit,
      quote_unit: optional.market.quote_unit,
      ...tBTicker.ticker,
      at: tBTicker.at,
      ts: parseInt(SafeMath.mult(tBTicker.at, "1000")),
      change,
      changePct,
      volume: tBTicker.ticker.vol.toString(),
      source: SupportedExchange.TIDEBIT,
      group: optional.market.group,
      pricescale: optional.market.price_group_fixed,
      ticker: tBTicker.ticker,
    };
    return new ResponseFormat({
      message: "getTicker",
      payload: formatTBTicker,
    });
  }

  async getTickers({ optional }) {
    const tBTickersRes = await axios.get(`${this.peatio}/api/v2/tickers`);
    if (!tBTickersRes || !tBTickersRes.data) {
      return new ResponseFormat({
        message: "Something went wrong",
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
    const tBTickers = tBTickersRes.data;
    const formatTickers = Object.keys(tBTickers).reduce((prev, currId) => {
      const instId = this._findInstId(currId);
      const tickerObj = tBTickers[currId];
      const change = SafeMath.minus(
        tickerObj.ticker.last,
        tickerObj.ticker.open
      );
      const changePct = SafeMath.gt(tickerObj.ticker.open, "0")
        ? SafeMath.div(change, tickerObj.ticker.open)
        : SafeMath.eq(change, "0")
        ? "0"
        : "1";
      prev[currId] = {
        market: currId,
        instId,
        buy: tickerObj.ticker.buy,
        sell: tickerObj.ticker.sell,
        low: tickerObj.ticker.low,
        high: tickerObj.ticker.high,
        last: tickerObj.ticker.last,
        open: tickerObj.ticker.open,
        volume: tickerObj.ticker.vol,
        change,
        changePct,
        at: parseInt(tickerObj.at),
        ts: parseInt(SafeMath.mult(tickerObj.at, "1000")),
        source: SupportedExchange.TIDEBIT,
        ticker: tickerObj.ticker,
      };
      return prev;
    }, {});
    const tickers = {};
    optional.mask.forEach((market) => {
      let ticker = formatTickers[market.id];
      if (ticker)
        tickers[market.id] = {
          ...ticker,
          group: market.group,
          market: market.id,
          pricescale: market.price_group_fixed,
          name: market.name,
          base_unit: market.base_unit,
          quote_unit: market.quote_unit,
        };
      else {
        const instId = this._findInstId(market.id);
        tickers[market.id] = {
          market: market.id,
          instId,
          name: market.name,
          base_unit: market.base_unit,
          quote_unit: market.quote_unit,
          group: market.group,
          pricescale: market.price_group_fixed,
          buy: "0.0",
          sell: "0.0",
          low: "0.0",
          high: "0.0",
          last: "0.0",
          open: "0.0",
          volume: "0.0",
          change: "0.0",
          changePct: "0.0",
          at: "0.0",
          source: SupportedExchange.TIDEBIT,
        };
      }
    });
    // ++ TODO !!! Ticker dataFormate is different
    // this.tickerBook.updateAll(tickers);
    return new ResponseFormat({
      message: "getTickers from TideBit",
      payload: tickers,
    });
  }
  // ++ TODO: verify function works properly
  _formateTicker(data) {
    // return tickerData.map((data) => {
    const id = data.name.replace("/", "").toLowerCase();
    const change = SafeMath.minus(data.last, data.open);
    const changePct = SafeMath.gt(data.open, "0")
      ? SafeMath.div(change, data.open)
      : SafeMath.eq(change, "0")
      ? "0"
      : "1";
    const updateTicker = {
      ...data,
      id,
      ts: parseInt(SafeMath.mult(data.at, "1000")),
      at: parseInt(data.at),
      instId: this._findInstId(id),
      market: id,
      change,
      changePct,
      source: SupportedExchange.TIDEBIT,
      ticker: {
        // [about to decrepted]
        buy: data.buy,
        sell: data.sell,
        low: data.low,
        high: data.high,
        last: data.last,
        open: data.open,
        vol: data.volume,
      },
    };
    return updateTicker;
    // });
  }

  // ++ TODO: verify function works properly
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
    // this.logger.log(`[${this.constructor.name}]_updateTickers data`, data);
    Object.values(data).forEach((d) => {
      const ticker = this._formateTicker(d);
      if (this._findSource(ticker.instId)===SupportedExchange.TIDEBIT) {
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

  // ++ TODO: verify function works properly
  async getDepthBooks({ query }) {
    const { instId, id: market } = query;
    if (!this.fetchedBook[instId]) {
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
        const asks = [];
        const bids = [];
        // this.logger.log(`tbBooks market`, market);
        tbBooks.asks.forEach((ask) => {
          if (
            ask.market === market &&
            ask.ord_type === "limit" &&
            ask.state === "wait"
          ) {
            let index;
            index = asks.findIndex((_ask) =>
              SafeMath.eq(_ask[0], ask.price.toString())
            );
            if (index !== -1) {
              let updateAsk = asks[index];
              updateAsk[1] = SafeMath.plus(updateAsk[1], ask.remaining_volume);
              asks[index] = updateAsk;
            } else {
              let newAsk = [ask.price.toString(), ask.remaining_volume]; // [價格, volume]
              asks.push(newAsk);
            }
          }
        });
        tbBooks.bids.forEach((bid) => {
          if (
            bid.market === market &&
            bid.ord_type === "limit" &&
            bid.state === "wait"
          ) {
            let index;
            index = bids.findIndex((_bid) =>
              SafeMath.eq(_bid[0], bid.price.toString())
            );
            if (index !== -1) {
              let updateBid = bids[index];
              updateBid[1] = SafeMath.plus(updateBid[1], bid.remaining_volume);
              bids[index] = updateBid;
            } else {
              let newBid = [bid.price.toString(), bid.remaining_volume]; // [價格, volume]
              bids.push(newBid);
            }
          }
        });
        const books = { asks, bids, market: market };

        // this.logger.log(`[FROM TideBit] Response books`, books);
        // this.logger.log(
        //   `---------- [${this.constructor.name}]  DepthBook market: ${market} [END] ----------`
        // );
        this.depthBook.updateAll(instId, books);
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
      message: "DepthBook",
      payload: this.depthBook.getSnapshot(instId),
    });
  }

  // ++ TODO: verify function works properly
  _updateBooks(market, updateBooks) {
    // WORKAROUND
    if (!updateBooks.asks.length > 0 && !updateBooks.bids.length > 0) return;
    // WORKAROUND
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
    // this.logger.log(
    //   `---------- [${this.constructor.name}]  _updateBooks [START] ----------`
    // );
    // this.logger.log(
    //   `[FROM TideBit] market[${market}] updateBooks`,
    //   updateBooks
    // );
    const instId = this._findInstId(market);
    // const difference = {
    //   updates: [],
    //   add: [],
    //   remove: [],
    // };
    // updateBooks.asks.forEach((ask) => {
    //   if (SafeMath.eq(ask[1], 0)) {
    //     difference.remove.push({
    //       id: ask[0],
    //       price: ask[0],
    //       amount: ask[1],
    //       side: "asks",
    //     });
    //   } else {
    //     difference.add.push({
    //       id: ask[0],
    //       price: ask[0],
    //       amount: ask[1],
    //       side: "asks",
    //     });
    //   }
    // });
    // updateBooks.bids.forEach((bid) => {
    //   if (SafeMath.eq(bid[1], 0)) {
    //     difference.remove.push({
    //       id: bid[0],
    //       price: bid[0],
    //       amount: bid[1],
    //       side: "bids",
    //     });
    //   } else {
    //     difference.add.push({
    //       id: bid[0],
    //       price: bid[0],
    //       amount: bid[1],
    //       side: "bids",
    //     });
    //   }
    // });
    this.depthBook.updateAll(instId, updateBooks);
    // this.logger.log(
    //   `[FROM TideBit] market[${market}] difference`,
    //   this.depthBook.getDifference(instId)
    // );
    EventBus.emit(Events.update, market, this.depthBook.getSnapshot(instId));
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
  async getTrades({ query }) {
    this.logger.log(`getTrades query`, query);
    const { instId, id: market } = query;
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

  // ++ TODO: verify function works properly
  _updateTrade(memberId, newTrade) {
    this.logger.log(
      `---------- [${this.constructor.name}]  _updateTrade [START] ----------`
    );
    this.logger.log(`[FROM TideBit: ${memberId}] newTrade`, newTrade);
    /**  {
    at: 1649675739
    id: 6
    kind: "ask"
    market: "ethhkd"
    price: "105.0"
    volume: "0.1"
    }*/
    const instId = this._findInstId(newTrade.market);
    this.tradeBook.updateByDifference(instId, {
      add: [{ ...newTrade, ts: parseInt(SafeMath.mult(newTrade.at, "1000")) }],
    });
    EventBus.emit(Events.trade, memberId, newTrade.market, {
      market: newTrade.market,
      difference: this.tradeBook.getDifference(instId),
    });

    this.logger.log(
      `---------- [${this.constructor.name}]  _updateTrade [END] ----------`
    );
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

  // ++ TODO: verify function works properly
  _updateTrades(market, data) {
    this.logger.log(
      `---------- [${this.constructor.name}]  _updateTrades [START] ----------`
    );
    this.logger.log(`[FROM TideBit market:${market}] data`, data);
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
    const instId = this._findInstId(market);
    this.tradeBook.updateByDifference(instId, {
      add: data.trades.map((trade) => this._formateTrade(market, trade)),
    });
    // const timestamp = Date.now();
    // if (timestamp - this._tradesTimestamp > this._tradesUpdateInterval) {
    //   this._tradesTimestamp = timestamp;
    EventBus.emit(Events.trades, market, {
      market,
      trades: this.tradeBook.getSnapshot(instId),
    });
    this.logger.log(
      `---------- [${this.constructor.name}]  _updateTrades [END] ----------`
    );
    // }
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

  async getUsersAccounts() {
    try {
      const _accounts = await this.database.getAccounts();
      const accounts = {};
      _accounts.forEach((account) => {
        let currency = this.currencies.find(
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
      // this.logger.debug(`[${this.constructor.name} getUsersAccounts]`, accounts)
      return new ResponseFormat({
        message: "getAccounts",
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

  async getAccounts({ memberId }) {
    this.logger.log(
      `[${this.constructor.name}] getAccounts memberId`,
      memberId
    );
    try {
      const _accounts = await this.database.getAccountsByMemberId(memberId);
      const accounts = _accounts.map((account) => ({
        currency: this.currencies.find((curr) => curr.id === account.currency)
          .symbol,
        balance: Utils.removeZeroEnd(account.balance),
        total: SafeMath.plus(account.balance, account.locked),
        locked: Utils.removeZeroEnd(account.locked),
      }));
      // this.logger.log(
      //   `[${this.constructor.name}] getAccounts accounts`,
      //   accounts
      // );
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
    // this.logger.log(
    //   `[${this.constructor.name}] getAccounts getSnapshot`,
    //   this.accountBook.getSnapshot(memberId)
    // );
    return new ResponseFormat({
      message: "getAccounts",
      payload: this.accountBook.getSnapshot(memberId),
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
    this.logger.log(
      `[${this.constructor.name}] _updateAccount this.private_channel`,
      this.private_channel
    );
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
    if (!query.market) {
      throw new Error(`this.tidebitMarkets.market ${query.market} not found.`);
    }
    const { id: bid } = this.currencies.find(
      (curr) => curr.key === query.market.quote_unit
    );
    const { id: ask } = this.currencies.find(
      (curr) => curr.key === query.market.base_unit
    );
    if (!bid) {
      throw new Error(`bid not found${query.market.quote_unit}`);
    }
    if (!ask) {
      throw new Error(`ask not found${query.market.base_unit}`);
    }
    let orderList;
    // if (query.memberId) {
    orderList = await this.database.getOrderList({
      quoteCcy: bid,
      baseCcy: ask,
      // state: query.state,
      memberId: query.memberId,
      // orderType: query.orderType,
    });
    /*
    const vouchers = await this.database.getVouchers({
      memberId: query.memberId,
      ask: query.market.base_unit,
      bid: query.market.quote_unit,
    });
    */
    // } else {
    //   orderList = await this.database.getOrderList({
    //     quoteCcy: bid,
    //     baseCcy: ask,
    //     state: query.state,
    //     orderType: query.orderType,
    //   });
    // }
    // this.logger.log(`tbGetOrderList orderList`, orderList);
    const orders = orderList.map((order) => {
      /*
      if (order.state === this.database.ORDER_STATE.DONE) {
        return {
          id: order.id,
          at: parseInt(
            SafeMath.div(new Date(order.updated_at).getTime(), "1000")
          ),
          market: query.instId.replace("-", "").toLowerCase(),
          kind: order.type === "OrderAsk" ? "ask" : "bid",
          price:
            order.ordType === "market"
              ? Utils.removeZeroEnd(
                  vouchers?.find((voucher) => voucher.order_id === order.id)
                    ?.price
                )
              : Utils.removeZeroEnd(order.price),
          origin_volume: Utils.removeZeroEnd(order.origin_volume),
          volume: Utils.removeZeroEnd(order.volume),
          state: "done",
          state_text: "Done",
          clOrdId: order.id,
          instId: query.instId,
          ordType: order.ord_type,
          filled: order.volume !== order.origin_volume,
        };
      } else {
        */
      return {
        id: order.id,
        ts: parseInt(new Date(order.updated_at).getTime()),
        at: parseInt(
          SafeMath.div(new Date(order.updated_at).getTime(), "1000")
        ),
        market: query.instId.replace("-", "").toLowerCase(),
        kind: order.type === "OrderAsk" ? "ask" : "bid",
        price: Utils.removeZeroEnd(order.price),
        origin_volume: Utils.removeZeroEnd(order.origin_volume),
        volume: Utils.removeZeroEnd(order.volume),
        state: SafeMath.eq(order.state, this.database.ORDER_STATE.CANCEL)
          ? "canceled"
          : SafeMath.eq(order.state, this.database.ORDER_STATE.WAIT)
          ? "wait"
          : SafeMath.eq(order.state, this.database.ORDER_STATE.DONE)
          ? "done"
          : "unkwon",
        state_text: SafeMath.eq(order.state, this.database.ORDER_STATE.CANCEL)
          ? "Canceled"
          : SafeMath.eq(order.state, this.database.ORDER_STATE.WAIT)
          ? "Waiting"
          : SafeMath.eq(order.state, this.database.ORDER_STATE.DONE)
          ? "Done"
          : "Unkwon",
        clOrdId: order.id,
        instId: query.instId,
        ordType: order.ord_type,
        filled: order.volume !== order.origin_volume,
      };
      /*
      }
      */
    });
    // this.logger.log(`tbGetOrderList orders`, orders);
    return orders;
  }

  async getOrderList({ query }) {
    const { instId, memberId } = query;
    this.logger.log(
      `[${this.constructor.name} getOrderList${instId}] memberId ${memberId}:`
    );
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
    this.logger.log(
      `[${this.constructor.name} getOrderHistory${instId}] memberId ${memberId}[${this.fetchedOrders[memberId]}:`
    );
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

  _updateOrder(memberId, data) {
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
    this.logger.log(
      `---------- [${this.constructor.name}]  _updateOrder [START] ----------`
    );
    this.logger.log(`[FROM TideBit: ${memberId}] orderData`, data);
    let instId = this._findInstId(data.market);

    const formatOrder = {
      ...data,
      // ordId: data.id,
      clOrdId: data.id,
      instId,
      ordType: data.price === undefined ? "market" : "limit",
      ts: parseInt(SafeMath.mult(data.at, "1000")),
      at: parseInt(data.at),
      // px: data.price,
      // side: data.kind === "bid" ? "buy" : "sell",
      // sz: Utils.removeZeroEnd(
      //   SafeMath.eq(data.volume, "0") ? data.origin_volume : data.volume
      // ),
      filled: data.volume !== data.origin_volume,
      // state:
      //   data.state === "wait"
      //     ? "wait"
      //     : SafeMath.eq(data.volume, "0")
      //     ? "done"
      //     : "canceled",
    };
    this.logger.log(
      `[TO FRONTEND][OnEvent: ${Events.order}] updateOrder`,
      formatOrder
    );
    this.orderBook.updateByDifference(memberId, instId, {
      add: [formatOrder],
    });
    EventBus.emit(Events.order, memberId, data.market, {
      market: data.market,
      difference: this.orderBook.getDifference(memberId, instId),
    });
    this.logger.log(
      `---------- [${this.constructor.name}]  _updateOrder [END] ----------`
    );
  }

  async postPlaceOrder({ header, body }) {
    try {
      const url =
        body.kind === "bid"
          ? `${this.peatio}/markets/${body.market.id}/order_bids`
          : `${this.peatio}/markets/${body.market.id}/order_asks`;
      this.logger.debug("postPlaceOrder", url);

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
      return new ResponseFormat({
        message: "postPlaceOrder",
        payload: [
          {
            id: "",
            clOrdId: "",
            sCode: "",
            sMsg: "",
            tag: "",
            data: tbOrdersRes.data,
          },
        ],
      });
    } catch (error) {
      this.logger.error(error);
      // debug for postman so return error
      return new ResponseFormat({
        message: "postPlaceOrder error",
        code: Codes.UNKNOWN_ERROR,
      });
    }
  }

  async postCancelOrder({ header, body }) {
    try {
      const url = `${this.peatio}/markets/${body.market.id}/orders/${body.orderId}`;
      this.logger.debug("postCancelOrder", url);
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
      this.logger.error(error);
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
      this.logger.debug("cancelAllAsks", url);
      const headers = {
        Accept: "*/*",
        "x-csrf-token": body["X-CSRF-Token"],
        cookie: header.cookie,
      };
      this.logger.log(`cancelAllAsks headers`, headers);
      const tbCancelOrderRes = await axios({
        method: "post",
        url,
        headers,
      });
      this.logger.log(`cancelAllAsks tbCancelOrderRes`, tbCancelOrderRes);
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
      this.logger.debug("cancelAllBids", url);
      const headers = {
        Accept: "*/*",
        "x-csrf-token": body["X-CSRF-Token"],
        cookie: header.cookie,
      };
      this.logger.log(`cancelAllBids headers`, headers);
      const tbCancelOrderRes = await axios({
        method: "post",
        url,
        headers,
      });
      this.logger.log(`cancelAllBids tbCancelOrderRes`, tbCancelOrderRes);
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
      this.logger.debug("cancelAll", url);
      const headers = {
        Accept: "*/*",
        "x-csrf-token": body["X-CSRF-Token"],
        cookie: header.cookie,
      };
      this.logger.log(`cancelAllOrders headers`, headers);
      const tbCancelOrderRes = await axios({
        method: "post",
        url,
        headers,
      });
      this.logger.log(`cancelAllOrders tbCancelOrderRes`, tbCancelOrderRes);
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

  async _registerPrivateChannel(pusher, memberId, sn) {
    this.logger.log(
      `[${this.constructor.name}]_registerPrivateChannel`,
      `memberId`,
      memberId,
      `sn`,
      sn
    );
    let channel;
    try {
      channel = pusher.subscribe(`private-${sn}`);
      channel.bind("account", (data) => this._updateAccount(memberId, data));
      channel.bind("order", (data) => this._updateOrder(memberId, data));
      channel.bind("trade", (data) => {
        this._updateTrade(memberId, data);
      });
    } catch (error) {
      this.logger.error(`private_channel error`, error);
      throw error;
    }
    this.logger.log(
      `[${this.constructor.name}] _registerPrivateChannel channel`,
      channel
    );
    return channel;
  }

  _unregisterPrivateChannel(client) {
    this.logger.log(`_unregisterPrivateChannel  client`, client);
    try {
      client["channel"]?.unbind();
      client["pusher"]?.unsubscribe(`private-${client["sn"]}`);
    } catch (error) {
      this.logger.error(`_unregisterPrivateChannel error`, error);
      throw error;
    }
  }

  _registerMarketChannel(market, wsId) {
    if (!this.market_channel[`market-${market}-global`]) {
      try {
        this.market_channel[`market-${market}-global`] = {};
        this.logger.log(`_registerMarketChannel market`, market);
        this.market_channel[`market-${market}-global`]["channel"] =
          this.public_pusher.subscribe(`market-${market}-global`);
        this.market_channel[`market-${market}-global`]["channel"].bind(
          "update",
          (data) => this._updateBooks(market, data)
        );
        this.market_channel[`market-${market}-global`]["channel"].bind(
          "trades",
          (data) => {
            this._updateTrades(market, data);
          }
        );
        this.market_channel[`market-${market}-global`]["listener"] = [wsId];
      } catch (error) {
        this.logger.error(`_registerMarketChannel error`, error);
        throw error;
      }
    } else {
      this.market_channel[`market-${market}-global`]["listener"].push(wsId);
    }
    this.logger.log(
      `[${this.constructor.name}] this.market_channel`,
      this.market_channel
    );
  }

  _unregisterMarketChannel(market, wsId) {
    if (!this.isStart || !this.market_channel[`market-${market}-global`])
      return;
    this.logger.log(
      `_unregisterMarketChannel this.market_channel[market-${market}-global]`,
      this.market_channel[`market-${market}-global`]
    );
    try {
      if (
        this.market_channel[`market-${market}-global`]["listener"]?.length > 0
      ) {
        const index = this.market_channel[`market-${market}-global`][
          "listener"
        ].findIndex((_wsId) => _wsId === wsId);
        this.market_channel[`market-${market}-global`]["listener"] =
          this.market_channel[`market-${market}-global`]["listener"].splice(
            index,
            1
          );
      }
      if (
        this.market_channel[`market-${market}-global`]["listener"]?.length === 0
      ) {
        this.market_channel[`market-${market}-global`]["channel"]?.unbind();
        this.public_pusher?.unsubscribe(`market-${market}-global`);
        delete this.market_channel[`market-${market}-global`];
      }
      this.logger.log(
        `_unregisterMarketChannel this.market_channel`,
        this.market_channel
      );
      if (Object.keys(this.market_channel).length === 0) {
        this._unregisterGlobalChannel();
        this.market_channel = {};
        this.public_pusher = null;
        this.isStart = false;
      }
    } catch (error) {
      this.logger.error(`_unregisterMarketChannel error`, error);
      throw error;
    }
  }

  _registerGlobalChannel() {
    try {
      this.global_channel = this.public_pusher.subscribe("market-global");
      this.global_channel.bind("tickers", (data) => this._updateTickers(data));
    } catch (error) {
      this.logger.error(`_registerGlobalChannel error`, error);
      throw error;
    }
  }

  _unregisterGlobalChannel() {
    if (!this.isStart) return;
    try {
      this.global_channel?.unbind();
      this.public_pusher?.unsubscribe("market-global");
      this.global_channel = null;
    } catch (error) {
      this.logger.error(`_unregisterGlobalChannel error`, error);
      throw error;
    }
  }

  _startPusher() {
    this.public_pusher = new Pusher(this.key, {
      encrypted: this.encrypted,
      wsHost: this.wsHost,
      wsPort: this.wsPort,
      wssPort: this.wssPort,
      disableFlash: true,
      disableStats: true,
      disabledTransports: ["flash", "sockjs"],
      forceTLS: false,
    });
    this.isStart = true;
    this._registerGlobalChannel();
    // this.public_pusher.bind_global((data) =>
    //   this.logger.log(`[_startPusher][bind_global] data`, data)
    // );
  }

  _startPusherWithLoginToken(headers) {
    const pusher = new Pusher(this.key, {
      encrypted: this.encrypted,
      wsHost: this.wsHost,
      wsPort: this.wsPort,
      wssPort: this.wssPort,
      disableFlash: true,
      disableStats: true,
      disabledTransports: ["flash", "sockjs"],
      forceTLS: false,
      authorizer: (channel, options) => {
        return {
          authorize: headers
            ? (socketId, callback) => {
                const data = JSON.stringify({
                  socket_id: socketId,
                  channel_name: channel.name,
                });
                axios({
                  url: `${this.peatio}/pusher/auth`,
                  method: "POST",
                  headers: {
                    ...headers,
                    "Content-Length": Buffer.from(data, "utf-8").length,
                  },
                  data,
                })
                  .then((res) => {
                    if (res.status !== 200) {
                      throw new Error(
                        `Received ${res.statusCode} from /pusher/auth`
                      );
                    }
                    return res.data;
                  })
                  .then((data) => {
                    callback(null, data);
                  })
                  .catch((err) => {
                    this.logger.error(`authorize err`, err);
                    callback(new Error(`Error calling auth endpoint: ${err}`), {
                      auth: "",
                    });
                  });
              }
            : null,
        };
      },
    });
    return pusher;
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
      this.logger.log(
        `++++++++ [${this.constructor.name}]  _subscribeUser [START] ++++++`
      );
      if (credential.memberId !== -1) {
        const client = this.private_client[credential.memberId];
        if (!client) {
          const member = await this.database.getMemberById(credential.memberId);
          const pusher = this._startPusherWithLoginToken(credential.headers);
          const channel = await this._registerPrivateChannel(
            pusher,
            credential.memberId,
            member.sn
          );
          this.private_client[credential.memberId] = {
            memberId: credential.memberId,
            sn: member.sn,
            wsIds: [credential.wsId],
            pusher,
            channel,
          };
        } else {
          this.private_client[credential.memberId].wsIds.push(credential.wsId);
        }
        this.logger.log(
          `_subscribeUser this.private_client`,
          this.private_client
        );
      }
      this.logger.log(
        `++++++++ [${this.constructor.name}]  _subscribeUser [END] ++++++`
      );
    } catch (error) {
      this.logger.error(`_subscribeUser error`, error);
      throw error;
    }
  }
  /**
   *
   * @param {*} credential
   * wsId
   * market
   */
  async _unsubscribeUser(wsId) {
    this.logger.log(
      `---------- [${this.constructor.name}]  _unsubscribeUser [START] ----------`
    );
    this.logger.log(
      ` _unsubscribeUser this.private_client[${wsId}]`,
      this.private_client
    );

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
    this.logger.log(
      ` _unsubscribeUser Object.values(this.private_client)[${index}]`,
      client,
      `wsIndex`,
      wsIndex
    );
    if (index !== -1) {
      client.wsIds.splice(wsIndex, 1);
      if (client.wsIds.length === 0) {
        try {
          this._unregisterPrivateChannel(client);
          delete this.private_client[client.memberId];
        } catch (error) {
          this.logger.error(`_unsubscribeUser error`, error);
          throw error;
        }
      } else {
      }
    }
    this.logger.log(
      ` _unsubscribeUser this.private_client[${wsId}]`,
      this.private_client
    );
    this.logger.log(
      `---------- [${this.constructor.name}]  _unsubscribeUser [END] ----------`
    );
  }

  _subscribeMarket(market, wsId) {
    if (
      this._findSource(this._findInstId(market)) === SupportedExchange.TIDEBIT
    ) {
      // this.books = null;
      // this._booksTimestamp = 0;
      // this._tradesTimestamp = 0;

      this.logger.log(
        `++++++++ [${this.constructor.name}]  _subscribeMarket [START] ++++++`
      );
      this.logger.log(`_subscribeMarket market, wsId`, market, wsId);
      if (!this.isStart) this._startPusher();
      this._registerMarketChannel(market, wsId);
      this.logger.log(
        `++++++++ [${this.constructor.name}]  _subscribeMarket [END] ++++++`
      );
    }
  }

  _unsubscribeMarket(market, wsId) {
    if (
      this._findSource(this._findInstId(market)) === SupportedExchange.TIDEBIT
    ) {
      this.logger.log(
        `---------- [${this.constructor.name}]  _unsubscribeMarket [START] ----------`
      );
      this.logger.log(`_unsubscribeMarket market, wsId`, market, wsId);
      this._unregisterMarketChannel(market, wsId);
      this.logger.log(
        `---------- [${this.constructor.name}]  _unsubscribeMarket [END] ----------`
      );
    }
  }

  _findInstId(id) {
    return this.markets[id.toUpperCase()];
  }

  _findSource(instId) {
    return this.markets[`tb${instId}`];
  }
}

module.exports = TibeBitConnector;
