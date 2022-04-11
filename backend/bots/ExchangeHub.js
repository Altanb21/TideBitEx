const path = require("path");
const redis = require("redis");
const { default: axios } = require("axios");
const URL = require("url");

const Bot = require(path.resolve(__dirname, "Bot.js"));
const OkexConnector = require("../libs/Connectors/OkexConnector");
const TideBitConnector = require("../libs/Connectors/TideBitConnector");
const ResponseFormat = require("../libs/ResponseFormat");
const Codes = require("../constants/Codes");
const EventBus = require("../libs/EventBus");
const Events = require("../constants/Events");
const SafeMath = require("../libs/SafeMath");
const Utils = require("../libs/Utils");
const SupportedExchange = require("../constants/SupportedExchange");
const TideBitLegacyAdapter = require("../libs/TideBitLegacyAdapter");

class ExchangeHub extends Bot {
  constructor() {
    super();
    this.name = "ExchangeHub";
  }

  init({ config, database, logger, i18n }) {
    return super
      .init({ config, database, logger, i18n })
      .then(async () => {
        this.okexConnector = new OkexConnector({ logger });
        await this.okexConnector.init({
          domain: this.config.okex.domain,
          apiKey: this.config.okex.apiKey,
          secretKey: this.config.okex.secretKey,
          passPhrase: this.config.okex.passPhrase,
          brokerId: this.config.okex.brokerId,
          wssPublic: this.config.okex.wssPublic,
          wssPrivate: this.config.okex.wssPrivate,
        });
        this.tideBitConnector = new TideBitConnector({ logger });
        this.tideBitConnector.init({
          app: this.config.pusher.app,
          key: this.config.pusher.key,
          secret: this.config.pusher.secret,
          wsHost: this.config.pusher.host,
          port: this.config.pusher.port,
          wsPort: this.config.pusher.wsPort,
          wssPort: this.config.pusher.wssPort,
          encrypted: this.config.pusher.encrypted,
          peatioDomain: this.config.peatio.domain,
        });
      })
      .then(() => {
        this.tidebitMarkets = this.getTidebitMarkets();
        return this;
      });
  }

  async start() {
    await super.start();
    await this.okexConnector.start();
    this._eventListener();
    return this;
  }

  getTidebitMarkets() {
    try {
      const p = path.join(
        this.config.base.TideBitLegacyPath,
        "config/markets/markets.yml"
      );
      const markets = Utils.marketParser(p);
      const formatMarket = markets.map((market) => {
        const instId = market.name.split("/").join("-").toUpperCase();
        return {
          ...market,
          // alias: "",
          // baseCcy: market.base_unit.toUpperCase(),
          // quoteCcy: market.quote_unit,
          // category: "",
          // ctMult: "",
          // ctType: "",
          // ctVal: "",
          // ctValCcy: "",
          // expTime: "",
          instId,
          instType: "",
          // lever: "",
          // listTime: Math.floor(Date.now() / 1000) * 1000,
          // lotSz: "",
          // minSz: "",
          // optType: "",
          // settleCcy: "",
          state: market.visible,
          group: market.tab_category,
          // stk: "",
          // tickSz: "",
          // uly: "",
          // at: null,
          source: SupportedExchange.TIDEBIT,
        };
      });
      return formatMarket;
    } catch (error) {
      this.logger.error(error);
      process.exit(1);
    }
  }

  async getMemberIdFromRedis(peatioSession) {
    const client = redis.createClient({
      url: this.config.redis.domain,
    });

    client.on("error", (err) => this.logger.error("Redis Client Error", err));

    try {
      await client.connect(); // 會因為連線不到卡住
      const value = await client.get(
        redis.commandOptions({ returnBuffers: true }),
        peatioSession
      );
      await client.quit();
      // ++ TODO: 下面補error handle
      const split1 = value
        .toString("latin1")
        .split("member_id\x06:\x06EFi\x02");
      const memberIdLatin1 = split1[1].split('I"')[0];
      const memberIdString = Buffer.from(memberIdLatin1, "latin1")
        .reverse()
        .toString("hex");
      const memberId = parseInt(memberIdString, 16);
      return memberId;
    } catch (error) {
      this.logger.error(error);
      await client.quit();
      return -1;
    }
  }

  // account api
  async getBalance({ token, params, query }) {
    try {
      this.logger.debug(`getBalance token`, token);
      const memberId = await this.getMemberIdFromRedis(token);
      // if (memberId === -1) throw new Error("get member_id fail");
      this.logger.error(`[${this.name} getBalance] error: "get member_id fail`);
      if (memberId === -1) return null;
      const accounts = await this.database.getBalance(memberId);
      const jobs = accounts.map((acc) =>
        this.database.getCurrency(acc.currency)
      );
      const currencies = await Promise.all(jobs);

      const details = accounts.map((account, i) => ({
        ccy: currencies[i].key.toUpperCase(),
        availBal: Utils.removeZeroEnd(account.balance),
        totalBal: SafeMath.plus(account.balance, account.locked),
        frozenBal: Utils.removeZeroEnd(account.locked),
        uTime: new Date(account.updated_at).getTime(),
      }));

      const payload = details;

      return new ResponseFormat({
        message: "getBalance",
        payload,
      });
    } catch (error) {
      this.logger.error(error);
      const message = error.message;
      return new ResponseFormat({
        message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
    // return this.okexConnector.router('getBalance', { memberId: null, params, query });
  }

  async _tbOrderBooks(instId) {
    const tbBooksRes = await axios.get(
      `${this.config.peatio.domain}/api/v2/order_book?market=${instId
        .replace("-", "")
        .toLowerCase()}`
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
    this.logger.log(`tbBooks instId`, instId.replace("-", "").toLowerCase());

    tbBooks.asks.forEach((ask) => {
      if (
        ask.market === instId.replace("-", "").toLowerCase() &&
        ask.ord_type === "limit" &&
        ask.state === "wait"
      ) {
        this.logger.log(`tbBooks ask`, ask, ask.price, ask['price']);
        let index;
        index = asks.findIndex((ask) =>
          SafeMath.eq(ask[0], ask['price'].toString())
        );
        if (index !== -1) {
          let updateAsk = asks[index];
          updateAsk[1] = SafeMath.plus(updateAsk[1], ask.remaining_volume);
          asks[index] = updateAsk;
        } else {
          let newAsk = [ask['price'].toString(), ask.remaining_volume]; // [價格, volume]
          asks.push(newAsk);
        }
      }
    });
    tbBooks.bids.forEach((bid) => {
      if (
        bid.market === instId.replace("-", "").toLowerCase() &&
        bid.ord_type === "limit" &&
        bid.state === "wait"
      ) {
        this.logger.log(`tbBooks bid`, bid);
        let index;
        index = bids.findIndex((bid) =>
          SafeMath.eq(bid[0], bid['price'].toString())
        );
        if (index !== -1) {
          let updateBid = bids[index];
          updateBid[1] = SafeMath.plus(updateBid[1], bid.remaining_volume);
          bids[index] = updateBid;
        } else {
          let newBid = [bid['price'].toString(), bid.remaining_volume]; // [價格, volume]
          bids.push(newBid);
        }
      }
    });
    const books = { asks, bids, ts: new Date().toISOString() };
    return books;
  }

  async _tbGetTickers({ list }) {
    const tideBitOnlyMarkets = Utils.marketFilterExclude(
      list,
      this.tidebitMarkets
    );
    const isVisibles = tideBitOnlyMarkets.filter(
      (m) => m.visible === true || m.visible === undefined
    ); // default visible is true, so if visible is undefined still need to show on list.
    const tBTickersRes = await axios.get(
      `${this.config.peatio.domain}/api/v2/tickers`
    );
    if (!tBTickersRes || !tBTickersRes.data) {
      return new ResponseFormat({
        message: "Something went wrong",
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
    const tBTickers = tBTickersRes.data;
    const formatTBTickers = isVisibles.map((market) => {
      const tBTicker = tBTickers[market.id];
      const change = SafeMath.minus(tBTicker.ticker.last, tBTicker.ticker.open);
      const changePct = SafeMath.gt(tBTicker.ticker.open, "0")
        ? SafeMath.mult(SafeMath.div(change, tBTicker.ticker.open), "100")
        : SafeMath.eq(change, "0")
        ? "0"
        : "100";
      let formatTBTicker = {
        ...market,
        instType: "",
        last: "0.0",
        sell: "0.0",
        buy: "0.0",
        open: "0.0",
        high: "0.0",
        low: "0.0",
        volume: "0.0",
        at: "0.0",
        change: "0.0",
        changePct: "0.0",
        group: market?.tab_category || market?.group,
      };
      if (tBTicker) {
        formatTBTicker = {
          ...tBTicker.ticker,
          ...market,
          at: tBTicker.at,
          volume: tBTicker.ticker.vol,
          change,
          changePct,
        };
      }
      return formatTBTicker;
    });
    // this.logger.debug(`formatTBTickers`, formatTBTickers);
    return formatTBTickers;
  }

  async unregiterAll() {
    try {
      this.tideBitConnector.unregiterAll();
      this.logger.debug(`++++++++++++++`);
      this.logger.debug(`unregiterAll`);
      this.logger.debug(`++++++++++++++`);
      return new ResponseFormat({
        message: `unregiterAll`,
        code: Codes.SUCCESS,
      });
    } catch (error) {
      return new ResponseFormat({
        message: error.message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async registerGlobalChannel({ header }) {
    try {
      this.tideBitConnector.registerGlobalChannel({
        header: {
          "content-type": "application/json",
          cookie: header.cookie,
        },
      });
      this.logger.debug(`++++++++++++++`);
      this.logger.debug(`registerGlobalChannel`);
      this.logger.debug(`++++++++++++++`);
      return new ResponseFormat({
        message: `registerGlobalChannel`,
        code: Codes.SUCCESS,
      });
    } catch (error) {
      return new ResponseFormat({
        message: error.message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async registerMarketChannel({ header, query }) {
    try {
      this.tideBitConnector.registerMarketChannel({
        header: {
          "content-type": "application/json",
          cookie: header.cookie,
        },
        instId: query.instId,
      });
      this.logger.debug(`++++++++++++++`);
      this.logger.debug(`registerMarketChannel instId`, query.instId);
      this.logger.debug(`++++++++++++++`);
      return new ResponseFormat({
        message: `registerMarketChannel`,
        code: Codes.SUCCESS,
      });
    } catch (error) {
      return new ResponseFormat({
        message: error.message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async registerPrivateChannel({ header, body, token }) {
    if (!body.token) return;
    const memberId = await this.getMemberIdFromRedis(token);
    if (memberId === -1) {
      return new ResponseFormat({
        message: "member_id not found",
        code: Codes.MEMBER_ID_NOT_FOUND,
      });
    }
    const member = await this.database.getMemberById(memberId);
    this.logger.debug(`++++++++++++++`);
    this.logger.debug(`registerPrivateChannel member.sn`, member.sn);
    this.logger.debug(`++++++++++++++`);
    try {
      this.tideBitConnector.registerPrivateChannel({
        header: {
          "content-type": "application/json",
          "x-csrf-token": body.token,
          cookie: header.cookie,
        },
        sn: member.sn,
      });
      this.logger.debug(`++++++++++++++`);
      this.logger.debug(`registerPrivateChannel SUCCESS`);
      this.logger.debug(`++++++++++++++`);
      return new ResponseFormat({
        message: `registerPrivateChannel`,
        code: Codes.SUCCESS,
      });
    } catch (error) {
      return new ResponseFormat({
        message: error.message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  async getTicker({ params, query }) {
    const index = this.tidebitMarkets.findIndex(
      (market) => query.instId === market.instId
    );
    if (index !== -1) {
      const url = `${this.config.peatio.domain}/api/v2/tickers/${query.instId
        .replace("-", "")
        .toLowerCase()}`;
      // this.logger.debug(`getTicker url:`, url);
      const tBTickerRes = await axios.get(url);
      // this.logger.debug(`getTicker tBTickerRes.data:`, tBTickerRes.data);
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
        : "100";
      const formatTBTicker = {
        ...tBTicker.ticker,
        at: tBTicker.at,
        change,
        changePct,
        volume: tBTicker.ticker.vol.toString(),
      };
      return new ResponseFormat({
        message: "getTicker",
        payload: formatTBTicker,
      });
    }
  }
  // account api end
  // market api
  async getTickers({ params, query }) {
    const list = [];
    try {
      const okexRes = await this.okexConnector.router("getTickers", {
        params,
        query,
      });
      if (okexRes.success) {
        const okexInstruments = okexRes.payload;
        const includeTidebitMarket = Utils.marketFilterInclude(
          this.tidebitMarkets,
          okexInstruments
        );
        includeTidebitMarket.forEach((market) => {
          market.source = SupportedExchange.OKEX;
          market.group =
            market.instId.split("-")[1].toLowerCase() === "usdt" ||
            market.instId.split("-")[1].toLowerCase() === "usdc" ||
            market.instId.split("-")[1].toLowerCase() === "usdk"
              ? "usdx"
              : market.instId.split("-")[1].toLowerCase();
        });
        list.push(...includeTidebitMarket);
        // this.logger.debug(`getTickers list[${list.length}]`, list);
      } else {
        return okexRes;
      }
    } catch (error) {
      this.logger.error(error);
      return new ResponseFormat({
        message: error.stack,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
    try {
      const formatTBTickers = await this._tbGetTickers({ list });
      list.push(...formatTBTickers);
    } catch (error) {
      this.logger.error(error);
      return new ResponseFormat({
        message: error.stack,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }

    return new ResponseFormat({
      message: "getTickers",
      payload: list,
    });
  }

  async getOrderBooks({ header, params, query }) {
    switch (this._findSource(query.instId)) {
      case SupportedExchange.OKEX:
        return this.okexConnector.router("getOrderBooks", { params, query });
      case SupportedExchange.TIDEBIT:
        // try {
        //   const orders = await this._tbGetOrderList({
        //     instId: query.instId,
        //     state: this.database.ORDER_STATE.WAIT,
        //     orderType: "limit",
        //   });
        //   const asks = [];
        //   const bids = [];
        //   orders.forEach((order) => {
        //     let index;
        //     if (order.side === "sell") {
        //       index = asks.findIndex((ask) => ask[0] === order.px);
        //       if (index !== -1) {
        //         let updateAsk = asks[index];
        //         updateAsk[1] = SafeMath.plus(updateAsk[1], order.sz);
        //         asks[index] = updateAsk;
        //       } else {
        //         let newAsk = [order.px, order.sz]; // [價格, 價格訂單張數, ?, volume]
        //         asks.push(newAsk);
        //       }
        //     }
        //     if (order.side === "buy") {
        //       index = bids.findIndex((bid) => bid[0] === order.px);
        //       if (index !== -1) {
        //         let updateBid = bids[index];
        //         updateBid[1] = SafeMath.plus(updateBid[1], order.sz);
        //         bids[index] = updateBid;
        //       } else {
        //         let newBid = [order.px, order.sz];
        //         bids.push(newBid);
        //       }
        //     }
        //   });
        //   const books = { asks, bids, ts: new Date().toISOString() };
        //   return new ResponseFormat({
        //     message: "getOrderList",
        //     // payload: books,
        //     payload: [], // ++ TODO WORKAROUND
        //   });
        // } catch (error) {
        //   this.logger.error(error);
        //   const message = error.message;
        //   return new ResponseFormat({
        //     message,
        //     code: Codes.API_UNKNOWN_ERROR,
        //   });
        // }
        try {
          const books = await this._tbOrderBooks(query.instId);
          this.logger.log(`getOrderBooks books`, books);
          return new ResponseFormat({
            message: "getOrderBooks",
            payload: books,
          });
        } catch (error) {
          this.logger.error(error);
          const message = error.message;
          return new ResponseFormat({
            message,
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
      default:
        return new ResponseFormat({
          message: "getOrderBooks",
          payload: {},
        });
    }
  }

  async getCandlesticks({ params, query }) {
    switch (this._findSource(query.instId)) {
      case SupportedExchange.OKEX:
        return this.okexConnector.router("getCandlesticks", { params, query });
      case SupportedExchange.TIDEBIT:
        try {
          const trades = await this._tbGetTradeHistory({
            instId: query.instId,
            increase: true,
          });
          // ++ TODO
          // let time = new Date().getTime();
          let interval;
          switch (query.bar) {
            case "1m":
              interval = 1 * 60 * 1000;
              break;
            case "30m":
              interval = 30 * 60 * 1000;
              break;
            case "1H":
              interval = 60 * 60 * 1000;
              break;
            case "1W":
              interval = 7 * 24 * 60 * 60 * 1000;
              break;
            case "M":
              interval = 30 * 24 * 60 * 60 * 1000;
              break;
            case "1D":
            default:
              interval = 24 * 60 * 60 * 1000;
          }
          let candles;
          const now = Math.floor(new Date().getTime() / interval);
          const defaultObj = {};
          defaultObj[now] = [now * interval, 0, 0, 0, 0, 0, 0];
          for (let i = 0; i < 100; i++) {
            defaultObj[now - i] = [(now - i) * interval, 0, 0, 0, 0, 0, 0];
          }
          candles = trades.reduce((prev, curr) => {
            const index = Math.floor(curr.ts / interval);
            let point = prev[index];
            if (point) {
              point[2] = Math.max(point[2], +curr.px);
              point[3] = Math.min(point[3], +curr.px);
              point[4] = +curr.px;
              point[5] += +curr.sz;
              point[6] += +curr.sz * +curr.px;
            } else {
              point = [
                index * interval,
                +curr.px,
                +curr.px,
                +curr.px,
                +curr.px,
                +curr.sz,
                +curr.sz * +curr.px,
              ];
            }
            prev[index] = point;
            return prev;
          }, defaultObj);
          return new ResponseFormat({
            message: "getCandlesticks",
            payload: Object.values(candles),
          });
        } catch (error) {
          this.logger.error(error);
          const message = error.message;
          return new ResponseFormat({
            message,
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
      default:
        return new ResponseFormat({
          message: "getCandlesticks",
          payload: [],
        });
    }
  }

  async getTrades({ params, query }) {
    switch (this._findSource(query.instId)) {
      case SupportedExchange.OKEX:
        return this.okexConnector.router("getTrades", { params, query });
      case SupportedExchange.TIDEBIT:
        try {
          const trades = await this._tbGetTradeHistory({
            instId: query.instId,
          });
          return new ResponseFormat({
            message: "getTrades",
            payload: trades,
          });
        } catch (error) {
          this.logger.error(error);
          const message = error.message;
          return new ResponseFormat({
            message,
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
      default:
        return new ResponseFormat({
          message: "getTrades",
          payload: [],
        });
    }
  }
  // market api end
  // trade api
  async postPlaceOrder({ header, params, query, body, token }) {
    const memberId = await this.getMemberIdFromRedis(token);
    if (memberId === -1) {
      return new ResponseFormat({
        message: "member_id not found",
        code: Codes.MEMBER_ID_NOT_FOUND,
      });
    }
    /* !!! HIGH RISK (start) !!! */
    // 1. find and lock account
    // 2. get orderData from body
    // 3. calculate balance value, locked value
    // 4. new order
    // 5. add account_version
    // 6. update account balance and locked
    // 7. post okex placeOrder
    const t = await this.database.transaction();

    switch (this._findSource(body.instId)) {
      case SupportedExchange.OKEX:
        try {
          /*******************************************
           * body.side: order is 'buy' or 'sell'
           * orderData.price: body.px, price value
           * orderData.volume: body.sz, volume value
           * orderData.locked:
           *   if body.side === 'buy', locked = body.px * body.sz
           *   if body.side === 'sell', locked = body.sz
           *
           * orderData.balance: locked value * -1
           *******************************************/

          const orderData = await this._getPlaceOrderData(body);
          const account = await this.database.getAccountByMemberIdCurrency(
            memberId,
            orderData.currencyId,
            { dbTransaction: t }
          );
          const price = orderData.price;
          const volume = orderData.volume;
          const locked = orderData.locked;
          const balance = orderData.balance;
          const fee = "0";

          const created_at = new Date().toISOString();
          const updated_at = created_at;

          const order = await this.database.insertOrder(
            orderData.bid,
            orderData.ask,
            orderData.currency,
            price,
            volume,
            volume,
            this.database.ORDER_STATE.WAIT,
            null,
            orderData.type,
            memberId,
            created_at,
            updated_at,
            null,
            "Web",
            orderData.ordType,
            locked,
            locked,
            "0",
            0,
            { dbTransaction: t }
          );
          const orderId = order[0];

          await this._updateAccount(
            account,
            t,
            balance,
            locked,
            fee,
            this.database.MODIFIABLE_TYPE.ORDER,
            orderId,
            created_at,
            this.database.FUNC.LOCK_FUNDS
          );

          const okexOrderRes = await this.okexConnector.router(
            "postPlaceOrder",
            { memberId, orderId, params, query, body }
          );
          if (!okexOrderRes.success) {
            await t.rollback();
            return okexOrderRes;
          }
          await t.commit();
          return okexOrderRes;
        } catch (error) {
          this.logger.error(error);
          await t.rollback();
          return new ResponseFormat({
            message: error.message,
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
      /* !!! HIGH RISK (end) !!! */
      case SupportedExchange.TIDEBIT: // ++ TODO 待驗證
        try {
          const market = this._findMarket(body.instId);
          const url =
            body.side === "buy"
              ? `${this.config.peatio.domain}/markets/${market.id}/order_bids`
              : `${this.config.peatio.domain}/markets/${market.id}/order_asks`;
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
                clOrdId: "",
                ordId: "",
                sCode: "",
                sMsg: "",
                tag: "",
                data: tbOrdersRes.data,
              },
            ],
          });
        } catch (error) {
          this.logger.error(error.stack);
          // debug for postman so return error
          return error;
        }
      default:
        return new ResponseFormat({
          message: "instId not Support now",
          code: Codes.API_NOT_SUPPORTED,
        });
    }
  }
  async _tbGetTradeHistory({ instId, increase }) {
    const market = this._findMarket(instId);
    if (!market) {
      throw new Error(`this.tidebitMarkets.instId ${instId} not found.`);
    }
    const { id: quoteCcy } = await this.database.getCurrencyByKey(
      market.quote_unit
    );
    const { id: baseCcy } = await this.database.getCurrencyByKey(
      market.base_unit
    );
    if (!quoteCcy) {
      throw new Error(`quoteCcy not found`);
    }
    if (!baseCcy) {
      throw new Error(`baseCcy not found`);
    }
    let trades;
    trades = await this.database.getTrades(quoteCcy, baseCcy);
    const tradeHistory = trades
      .map((trade) => ({
        ordId: trade.order_id,
        instId: instId,
        side: "",
        amount: trade.volume,
        price: trade.price,
        tid: trade.id,
        trend: trade.trend,
        date: new Date(trade.created_at).getTime(),
      }))
      .sort((a, b) => (increase ? a.ts - b.ts : b.ts - a.ts));
    return tradeHistory;
  }

  async _tbGetOrderList({ memberId, instId, state, orderType }) {
    const market = this._findMarket(instId);
    if (!market) {
      throw new Error(`this.tidebitMarkets.instId ${instId} not found.`);
    }
    const { id: bid } = await this.database.getCurrencyByKey(market.quote_unit);
    const { id: ask } = await this.database.getCurrencyByKey(market.base_unit);
    if (!bid) {
      throw new Error(`bid not found`);
    }
    if (!ask) {
      throw new Error(`ask not found`);
    }
    let orderList;
    if (memberId) {
      orderList = await this.database.getOrderList({
        quoteCcy: bid,
        baseCcy: ask,
        state,
        memberId,
      });
    } else {
      orderList = await this.database.getOrderList({
        quoteCcy: bid,
        baseCcy: ask,
        state,
        orderType,
      });
    }
    const orders = orderList.map((order) => ({
      cTime: new Date(order.created_at).getTime(),
      clOrdId: order.id,
      instId: instId,
      ordId: order.id,
      ordType: order.ord_type,
      px: Utils.removeZeroEnd(order.price),
      side: order.type === "OrderAsk" ? "sell" : "buy",
      sz: Utils.removeZeroEnd(
        state === this.database.ORDER_STATE.DONE
          ? order.origin_volume
          : order.volume
      ),
      filled: order.volume !== order.origin_volume,
      uTime: new Date(order.updated_at).getTime(),
      state:
        state === this.database.ORDER_STATE.CANCEL
          ? "canceled"
          : state === this.database.ORDER_STATE.DONE
          ? "done"
          : "waiting",
    }));
    return orders;
  }

  async getOrderList({ params, query, token }) {
    const memberId = await this.getMemberIdFromRedis(token);
    if (memberId === -1) {
      return new ResponseFormat({
        message: "member_id not found",
        code: Codes.MEMBER_ID_NOT_FOUND,
      });
    }
    switch (this._findSource(query.instId)) {
      case SupportedExchange.OKEX:
        const res = await this.okexConnector.router("getOrderList", {
          params,
          query,
        });
        const list = res.payload;
        if (Array.isArray(list)) {
          const newList = list.filter((order) =>
            order.clOrdId.includes(`${memberId}m`)
          ); // 可能發生與brokerId, randomId碰撞
          res.payload = newList;
        }
        return res;
      case SupportedExchange.TIDEBIT:
        try {
          const orders = await this._tbGetOrderList({
            instId: query.instId,
            memberId,
            state: this.database.ORDER_STATE.WAIT,
          });
          return new ResponseFormat({
            message: "getOrderList",
            payload: orders.sort((a, b) => b.cTime - a.cTime),
          });
        } catch (error) {
          this.logger.error(error);
          const message = error.message;
          return new ResponseFormat({
            message,
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
      default:
        return new ResponseFormat({
          message: "getOrderList",
          payload: [],
        });
    }
  }
  async getOrderHistory({ params, query, token }) {
    const memberId = await this.getMemberIdFromRedis(token);
    if (memberId === -1) {
      return new ResponseFormat({
        message: "member_id not found",
        code: Codes.MEMBER_ID_NOT_FOUND,
      });
    }
    switch (this._findSource(query.instId)) {
      case SupportedExchange.OKEX:
        const res = await this.okexConnector.router("getOrderHistory", {
          params,
          query,
        });
        const list = res.payload;
        if (Array.isArray(list)) {
          const newList = list.filter((order) =>
            order.clOrdId.includes(`${memberId}m`)
          ); // 可能發生與brokerId, randomId碰撞
          res.payload = newList;
        }
        return res;
      case SupportedExchange.TIDEBIT:
        try {
          const cancelOrders = await this._tbGetOrderList({
            instId: query.instId,
            memberId,
            state: this.database.ORDER_STATE.CANCEL,
          });
          const doneOrders = await this._tbGetOrderList({
            instId: query.instId,
            memberId,
            state: this.database.ORDER_STATE.DONE,
          });
          const vouchers = await this.database.getVouchers({
            memberId,
            ask: query.instId.split("-")[0],
            bid: query.instId.split("-")[1],
          });
          const orders = doneOrders
            .map((order) => {
              if (order.ordType === "market") {
                return {
                  ...order,
                  px: Utils.removeZeroEnd(
                    vouchers?.find(
                      (voucher) => voucher.order_id === order.ordId
                    )?.price
                  ),
                };
              } else {
                return order;
              }
            })
            .concat(cancelOrders)
            .sort((a, b) => b.cTime - a.cTime);
          return new ResponseFormat({
            message: "getOrderHistory",
            payload: orders,
          });
        } catch (error) {
          this.logger.error(error);
          const message = error.message;
          return new ResponseFormat({
            message,
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
      default:
        return new ResponseFormat({
          message: "getOrderHistory",
          payload: [],
        });
    }
  }
  async postCancelOrder({ header, params, query, body, token }) {
    const source = this._findSource(body.instId);
    const memberId = await this.getMemberIdFromRedis(token);
    /* !!! HIGH RISK (start) !!! */
    // 1. get orderId from body
    // 2. get order data from table
    // 3. find and lock account
    // 4. update order state
    // 5. get balance and locked value from order
    // 6. add account_version
    // 7. update account balance and locked
    // 8. post okex cancel order
    const t = await this.database.transaction();
    // get orderId from body.clOrdId
    try {
      let { orderId } =
        source === SupportedExchange.OKEX
          ? Utils.parseClOrdId(body.clOrdId)
          : { orderId: body.ordId };
      switch (source) {
        case SupportedExchange.OKEX:
          const order = await this.database.getOrder(orderId, {
            dbTransaction: t,
          });
          if (order.state !== this.database.ORDER_STATE.WAIT) {
            await t.rollback();
            return new ResponseFormat({
              code: Codes.ORDER_HAS_BEEN_CLOSED,
              message: "order has been close",
            });
          }
          const currencyId =
            order.type === this.database.TYPE.ORDER_ASK ? order.ask : order.bid;
          const account = await this.database.getAccountByMemberIdCurrency(
            memberId,
            currencyId,
            { dbTransaction: t }
          );

          /*******************************************
           * body.clOrdId: custom orderId for okex
           * locked: value from order.locked, used for unlock balance, negative in account_version
           * balance: order.locked
           *******************************************/
          const newOrder = {
            id: orderId,
            state: this.database.ORDER_STATE.CANCEL,
          };
          const locked = SafeMath.mult(order.locked, "-1");
          const balance = order.locked;
          const fee = "0";

          const created_at = new Date().toISOString();

          await this.database.updateOrder(newOrder, { dbTransaction: t });

          await this._updateAccount(
            account,
            t,
            balance,
            locked,
            fee,
            this.database.MODIFIABLE_TYPE.ORDER,
            orderId,
            created_at,
            this.database.FUNC.UNLOCK_FUNDS
          );
          const okexCancelOrderRes = await this.okexConnector.router(
            "postCancelOrder",
            { params, query, body }
          );
          if (!okexCancelOrderRes.success) {
            await t.rollback();
            return okexCancelOrderRes;
          }
          await t.commit();
          return okexCancelOrderRes;

        /* !!! HIGH RISK (end) !!! */
        case SupportedExchange.TIDEBIT:
          const market = this._findMarket(body.instId);
          const url = `${this.config.peatio.domain}/markets/${market.id}/orders/${orderId}`;
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
          this.logger.debug(tbCancelOrderRes);
          return new ResponseFormat({
            message: "postCancelOrder",
            code: Codes.SUCCESS,
          });

        default:
          await t.rollback();
          return new ResponseFormat({
            message: "instId not Support now",
            code: Codes.API_NOT_SUPPORTED,
          });
      }
    } catch (error) {
      this.logger.error(error);
      await t.rollback();
      return new ResponseFormat({
        message: error.message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }
  // trade api end

  // public api
  async getInstruments({ params, query }) {
    const list = [];
    try {
      const okexRes = await this.okexConnector.router("getInstruments", {
        params,
        query,
      });
      if (okexRes.success) {
        const okexInstruments = okexRes.payload;
        const includeTidebitMarket = Utils.marketFilterInclude(
          this.tidebitMarkets,
          okexInstruments
        );
        includeTidebitMarket.forEach((market) => {
          market.source = SupportedExchange.OKEX;
        });
        list.push(...includeTidebitMarket);
      } else {
        return okexRes;
      }
    } catch (error) {
      this.logger.error(error);
      return new ResponseFormat({
        message: error.stack,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }

    try {
      const tideBitOnlyMarkets = Utils.marketFilterExclude(
        list,
        this.tidebitMarkets
      );
      const isVisibles = tideBitOnlyMarkets.filter(
        (m) => m.visible === true || m.visible === undefined
      ); // default visible is true, so if visible is undefined still need to show on list.
      list.push(...isVisibles);
    } catch (error) {
      this.logger.error(error);
      return new ResponseFormat({
        message: error.stack,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }

    return new ResponseFormat({
      message: "getInstruments",
      payload: list,
    });
  }
  // public api end

  async _eventListener() {
    // EventBus.on(Events.tideBitTickersOnUpdate, (formatPair) => {
    //   this.broadcastAllClient({
    //     type: Events.tideBitTickersOnUpdate,
    //     data: formatPair,
    //   });
    // });

    // EventBus.on(Events.tideBitBooksOnUpdate, (instId, formatBooks) => {
    //   if (this._isIncludeTideBitMarket(instId)) {
    //     this.broadcast(instId, {
    //       type: Events.tideBitBooksOnUpdate,
    //       data: formatBooks,
    //     });
    //   }
    // });

    // EventBus.on(Events.tideBitTradesOnUpdate, (instId, formatTrades) => {
    //   if (this._isIncludeTideBitMarket(instId)) {
    //     this.broadcast(instId, {
    //       type: Events.tideBitTradesOnUpdate,
    //       data: formatTrades,
    //     });
    //   }
    // });

    EventBus.on(Events.accountOnUpdate, (account) => {
      this.broadcastAllClient({
        type: Events.accountOnUpdate,
        data: account,
      });
    });
    EventBus.on(Events.orderOnUpdate, (order) => {
      this.broadcastAllClient({
        type: Events.orderOnUpdate,
        data: order,
      });
    });
    EventBus.on(Events.tradeOnUpdate, (trade) => {
      this.broadcastAllClient({
        type: Events.tradeOnUpdate,
        data: trade,
      });
    });

    EventBus.on(Events.tradesOnUpdate, (instId, tradeData) => {
      if (this._isIncludeTideBitMarket(instId)) {
        this.broadcast(instId, {
          type: Events.tradesOnUpdate,
          data: tradeData,
        });
      }
    });

    EventBus.on(Events.orderBooksOnUpdate, (instId, booksData) => {
      if (this._isIncludeTideBitMarket(instId)) {
        this.broadcast(instId, {
          type: Events.orderBooksOnUpdate,
          data: booksData,
        });
      }
    });

    EventBus.on(Events.candleOnUpdate, (instId, formatCandle) => {
      if (this._isIncludeTideBitMarket(instId)) {
        this.broadcast(instId, {
          type: Events.candleOnUpdate,
          data: formatCandle,
        });
      }
    });

    EventBus.on(Events.tickersOnUpdate, (formatPair) => {
      if (this._isIncludeTideBitMarket(formatPair.instId)) {
        this.broadcastAllClient({
          type: Events.tickersOnUpdate,
          data: formatPair,
        });
      }
    });

    EventBus.on(Events.orderDetailUpdate, async (instType, formatOrders) => {
      if (instType === "SPOT") {
        // TODO: using message queue
        for (const formatOrder of formatOrders) {
          if (
            formatOrder.state !== "canceled" /* cancel order */ &&
            formatOrder.accFillSz !== "0" /* create order */
          ) {
            await this._updateOrderDetail(formatOrder);
          }
        }
      }
    });
  }

  async _updateOrderDetail(formatOrder) {
    const t = await this.database.transaction();
    /* !!! HIGH RISK (start) !!! */
    // 1. get orderId from body
    // 2. get order data from table
    // 3. find and lock account
    // 4. update order state
    // 5. get balance and locked value from order
    // 6. add trade // -- CAUTION!!! skip now, tradeId use okex tradeId
    // 7. add vouchers
    // 8. add account_version
    // 9. update account balance and locked
    try {
      const {
        accFillSz,
        clOrdId,
        tradeId,
        state,
        side,
        fillPx,
        fillSz,
        fee,
        uTime,
      } = formatOrder;
      // get orderId from formatOrder.clOrdId
      const { memberId, orderId } = Utils.parseClOrdId(clOrdId);
      const order = await this.database.getOrder(orderId, { dbTransaction: t });
      if (order.state !== this.database.ORDER_STATE.WAIT) {
        await t.rollback();
        this.logger.error("order has been closed");
      }
      const currencyId =
        order.type === this.database.TYPE.ORDER_ASK ? order.ask : order.bid;
      const accountAsk = await this.database.getAccountByMemberIdCurrency(
        memberId,
        order.ask,
        { dbTransaction: t }
      );
      const accountBid = await this.database.getAccountByMemberIdCurrency(
        memberId,
        order.bid,
        { dbTransaction: t }
      );

      /*******************************************
       * formatOrder.clOrdId: custom orderId for okex
       * formatOrder.accFillSz: valume which already matched
       * formatOrder.state: 'live', 'canceled', 'filled', 'partially_filled', but 'cancel' may not enter this function
       * lockedA: Ask locked value, this value would be negative
       *   if formatOrder.side === 'sell', formatOrder.fillSz || '0'
       * feeA: Ask fee value
       *   if formatOrder.side === 'buy', formatOrder.fee - all this order ask vouchers.fee || 0
       * balanceA: Ask Balance, this value would be positive;
       *   if formatOrder.side === 'buy', formatOrder.fillSz - feeA || '0'
       * lockedB: Bid locked value, this value would be negative
       *   if formatOrder.side === 'buy',value = formatOrder.fillSz * formatOrder.fillPx - feeA, else value = '0'
       * feeB: Bid fee value
       *   if formatOrder.side === 'sell', formatOrder.fee - all this order bid vouchers.fee || 0
       * balanceB: Bid Blance, this value would be positive;
       *   if formatOrder.side === 'sell',value = formatOrder.fillSz * formatOrder.fillPx - feeB, else value = '0'
       * newOrderVolume: remain volume to be matched
       * newOrderLocked: remain locked to be matched
       * newFundReceive:
       *   if formatOrder.side === 'sell': formatOrder.fillSz * formatOrder.fillPx
       *   if formatOrder.side === 'buy': formatOrder.fillSz
       * changeBalance: if order is done, euqal to newOrderLocked
       * changeLocked: if order is done, euqal to newOrderLocked * -1
       *******************************************/

      let orderState = this.database.ORDER_STATE.WAIT;
      if (state === "filled") {
        orderState = this.database.ORDER_STATE.DONE;
      }

      const lockedA = side === "sell" ? SafeMath.mult(fillSz, "-1") : "0";
      const totalFee = SafeMath.abs(fee);
      const feeA =
        side === "buy"
          ? await this._calculateFee(orderId, "ask", totalFee, t)
          : "0";
      const balanceA = side === "buy" ? SafeMath.minus(fillSz, feeA) : "0";

      const value = SafeMath.mult(fillPx, fillSz);
      const lockedB = side === "buy" ? SafeMath.mult(value, "-1") : "0";
      const feeB =
        side === "sell"
          ? await this._calculateFee(orderId, "bid", totalFee, t)
          : "0";
      const balanceB = side === "sell" ? SafeMath.minus(value, feeB) : "0";

      const newOrderVolume = SafeMath.minus(order.origin_volume, accFillSz);
      const newOrderLocked = SafeMath.plus(
        order.locked,
        side === "buy" ? lockedB : lockedA
      );
      const newFundReceive = side === "buy" ? fillSz : value;

      const changeBalance = newOrderLocked;
      const changeLocked = SafeMath.mult(newOrderLocked, "-1");

      const created_at = new Date().toISOString();
      const updated_at = created_at;

      const newOrder = {
        id: orderId,
        volume: newOrderVolume,
        state: orderState,
        locked: newOrderLocked,
        funds_received: newFundReceive,
        trades_count: order.trades_count + 1,
      };

      // TODO: ++ 6. add trade
      // -- CAUTION!!! skip now, tradeId use okex tradeId,
      // because it need columns 'ask_member_id' and 'bid_member_id' with foreign key

      await this.database.insertVouchers(
        memberId,
        orderId,
        tradeId, // ++ TODO reference step6 trade.id
        null,
        "eth", // -- need change
        "usdt", // -- need change
        fillPx,
        fillSz,
        value,
        order.type === this.database.TYPE.ORDER_ASK ? "ask" : "bid",
        order.type === this.database.TYPE.ORDER_ASK ? feeB : "0", // get bid, so fee is bid
        order.type === this.database.TYPE.ORDER_ASK ? "0" : feeA, // get ask, so fee is ask
        created_at,
        { dbTransaction: t }
      );

      await this.database.updateOrder(newOrder, { dbTransaction: t });

      await this._updateAccount(
        accountAsk,
        t,
        balanceA,
        lockedA,
        feeA,
        this.database.MODIFIABLE_TYPE.TRADE,
        tradeId, // ++ TODO reference step6 trade.id
        created_at,
        order.type === this.database.TYPE.ORDER_ASK
          ? this.database.FUNC.UNLOCK_AND_SUB_FUNDS
          : this.database.FUNC.PLUS_FUNDS
      );
      await this._updateAccount(
        accountBid,
        t,
        balanceB,
        lockedB,
        feeB,
        this.database.MODIFIABLE_TYPE.TRADE,
        tradeId, // ++ TODO reference step6 trade.id
        created_at,
        order.type === this.database.TYPE.ORDER_ASK
          ? this.database.FUNC.PLUS_FUNDS
          : this.database.FUNC.UNLOCK_AND_SUB_FUNDS
      );

      // order 完成，解鎖剩餘沒用完的
      if (
        orderState === this.database.ORDER_STATE.DONE &&
        SafeMath.gt(newOrderLocked, "0")
      ) {
        if (order.type === this.database.TYPE.ORDER_ASK) {
          // ++ TODO reference step6 trade.id
          await this._updateAccount(
            accountAsk,
            t,
            changeLocked,
            changeBalance,
            "0",
            this.database.MODIFIABLE_TYPE.TRADE,
            tradeId,
            created_at,
            this.database.FUNC.UNLOCK_FUNDS
          );
        } else if (order.type === this.database.TYPE.ORDER_BID) {
          // ++ TODO reference step6 trade.id
          await this._updateAccount(
            accountBid,
            t,
            changeLocked,
            changeBalance,
            "0",
            this.database.MODIFIABLE_TYPE.TRADE,
            tradeId,
            created_at,
            this.database.FUNC.UNLOCK_FUNDS
          );
        }
      }

      await t.commit();
    } catch (error) {
      this.logger.error(error);
      await t.rollback();
    }
    /* !!! HIGH RISK (end) !!! */
  }

  async _getPlaceOrderData(body) {
    const market = this._findMarket(body.instId);
    if (!market) {
      throw new Error(`this.tidebitMarkets.instId ${body.instId} not found.`);
    }
    const { id: bid } = await this.database.getCurrencyByKey(market.quote_unit);
    const { id: ask } = await this.database.getCurrencyByKey(market.base_unit);
    if (!bid) {
      throw new Error(`bid not found`);
    }
    if (!ask) {
      throw new Error(`ask not found`);
    }
    const currency = market.code;
    const locked =
      body.side === "buy" ? SafeMath.mult(body.px, body.sz) : body.sz;
    const balance = SafeMath.mult(locked, "-1");

    const orderData = {
      bid,
      ask,
      currency,
      price: body.px || null,
      volume: body.sz,
      type:
        body.side === "buy"
          ? this.database.TYPE.ORDER_BID
          : this.database.TYPE.ORDER_ASK,
      ordType: body.ordType,
      locked,
      balance,
      currencyId: body.side === "buy" ? bid : ask,
    };
    return orderData;
  }

  async _updateAccount(
    account,
    dbTransaction,
    balance,
    locked,
    fee,
    modifiable_type,
    modifiable_id,
    created_at,
    fun
  ) {
    /* !!! HIGH RISK (start) !!! */
    const updated_at = created_at;
    const oriAccBal = account.balance;
    const oriAccLoc = account.locked;
    const newAccBal = SafeMath.plus(oriAccBal, balance);
    const newAccLoc = SafeMath.plus(oriAccLoc, locked);
    const amount = SafeMath.plus(newAccBal, newAccLoc);
    const newAccount = {
      id: account.id,
      balance: newAccBal,
      locked: newAccLoc,
    };

    await this.database.insertAccountVersion(
      account.member_id,
      account.id,
      this.database.REASON.ORDER_CANCEL,
      balance,
      locked,
      fee,
      amount,
      modifiable_id,
      modifiable_type,
      created_at,
      updated_at,
      account.currency,
      fun,
      { dbTransaction }
    );

    await this.database.updateAccount(newAccount, { dbTransaction });
    /* !!! HIGH RISK (end) !!! */
  }

  async _calculateFee(orderId, trend, totalFee, dbTransaction) {
    const vouchers = await this.database.getVouchersByOrderId(orderId, {
      dbTransaction,
    });
    let totalVfee = "0";
    for (const voucher of vouchers) {
      if (voucher.trend === trend) {
        switch (trend) {
          case "ask":
            totalVfee = SafeMath.plus(totalVfee, voucher.ask_fee);
            break;
          case "bid":
            totalVfee = SafeMath.plus(totalVfee, voucher.bid_fee);
            break;
          default:
        }
      }
    }
    return SafeMath.minus(totalFee, totalVfee);
  }

  _isIncludeTideBitMarket(instId) {
    return (
      Utils.marketFilterInclude(this.tidebitMarkets, [{ instId }]).length > 0
    );
  }

  _findSource(instId) {
    return this.config.markets[`tb${instId}`];
  }

  _findMarket(instId) {
    return this.tidebitMarkets.find((m) => m.instId === instId);
  }
}

module.exports = ExchangeHub;
