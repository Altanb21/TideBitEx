const path = require("path");

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
const DepthBook = require("../libs/Books/DepthBook");
const TradeBook = require("../libs/Books/TradeBook");
const TickerBook = require("../libs/Books/TickerBook");
const OrderBook = require("../libs/Books/OrderBook");
const AccountBook = require("../libs/Books/AccountBook");
const ExchangeHubService = require("../libs/services/ExchangeHubServices");

class ExchangeHub extends Bot {
  fetchedOrders = {};
  fetchedOrdersInterval = 1 * 60 * 1000;
  systemMemberId;
  updateDatas = [];
  constructor() {
    super();
    this.name = "ExchangeHub";
    this.fetchedTickers = false;
  }

  async broadcast(market, { type, data }) {
    const ws = await this.getBot("WSChannel");
    return ws.broadcast(market, { type, data });
  }

  async broadcastAllClient({ type, data }) {
    const ws = await this.getBot("WSChannel");
    return ws.broadcastAllClient({ type, data });
  }

  async broadcastPrivateClient(memberId, { market, type, data }) {
    const ws = await this.getBot("WSChannel");
    return ws.broadcastPrivateClient(memberId, { market, type, data });
  }

  async broadcastAllPrivateClient(memberId, { type, data }) {
    const ws = await this.getBot("WSChannel");
    return ws.broadcastAllPrivateClient(memberId, { type, data });
  }

  async _eventListener() {
    EventBus.on(Events.account, (memberId, account) => {
      this.logger.log(
        `[${this.constructor.name}] EventBus.on(Events.account)`,
        memberId,
        account
      );
      this.broadcastAllPrivateClient(memberId, {
        type: Events.account,
        data: account,
      });
    });

    EventBus.on(Events.order, (memberId, market, order) => {
      this.logger.log(
        `[${this.constructor.name}] EventBus.on(Events.order)`,
        memberId,
        market,
        order
      );
      this.broadcastPrivateClient(memberId, {
        market,
        type: Events.order,
        data: order,
      });
    });

    EventBus.on(Events.trade, (memberId, market, tradeData) => {
      if (this._isIncludeTideBitMarket(market)) {
        this.logger.log(
          `[${this.constructor.name}] EventBus.on(Events.trade)`,
          memberId,
          market,
          tradeData
        );
        this.broadcastPrivateClient(memberId, {
          market,
          type: Events.trade,
          data: tradeData,
        });
      }
    });

    EventBus.on(Events.trades, (market, tradesData) => {
      this.broadcast(market, {
        type: Events.trades,
        data: tradesData,
      });
    });

    EventBus.on(Events.update, (market, booksData) => {
      this.broadcast(market, {
        type: Events.update,
        data: booksData,
      });
    });

    EventBus.on(Events.candleOnUpdate, (market, formatCandle) => {
      this.broadcast(market, {
        type: Events.candleOnUpdate,
        data: formatCandle,
      });
    });

    EventBus.on(Events.tickers, (updateTickers) => {
      this.broadcastAllClient({
        type: Events.tickers,
        data: updateTickers,
      });
    });

    EventBus.on(Events.orderDetailUpdate, async (instType, formatOrders) => {
      if (instType === "SPOT") {
        this.logger.log(
          ` ------------- [${this.constructor.name}] EventBus.on(Events.orderDetailUpdate [START]---------------`
        );
        // TODO: using message queue
        for (const formatOrder of formatOrders) {
          if (
            formatOrder.state !== "canceled" /* cancel order */ &&
            formatOrder.accFillSz !== "0" /* create order */
          ) {
            // await this._updateOrderDetail(formatOrder);
            // await this._syncTransactionDetail(formatOrder);
          }
        }
        this.logger.log(
          ` ------------- [${this.constructor.name}] EventBus.on(Events.orderDetailUpdate [END]---------------`
        );
      }
    });
  }

  /**
   *
   * @param {String} memberId
   * @param {String} instId
   * @param {String} market ex: ethusdt
   * @param {Object} order
   */
  _emitUpdateOrder({ memberId, instId, market, order }) {
    this.orderBook.updateByDifference(memberId, instId, {
      add: [order],
    });
    EventBus.emit(Events.order, memberId, market, {
      market: market,
      difference: this.orderBook.getDifference(memberId, instId),
    });
    this.logger.log(`difference`, order);
    this.logger.log(
      `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.order}] _emitUpdateOrder[market:${market}][memberId:${memberId}][instId:${instId}]`,
      this.orderBook.getDifference(memberId, instId)
    );
  }
  _emitNewTrade({ memberId, instId, market, trade }) {
    this.tradeBook.updateByDifference(instId, {
      add: [
        {
          ...trade,
          ts: parseInt(SafeMath.mult(trade.at, "1000")),
        },
      ],
    });
    EventBus.emit(Events.trade, memberId, market, {
      market,
      difference: this.tradeBook.getDifference(instId),
    });
    this.logger.log(`difference`, trade);
    this.logger.log(
      `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.trade}] _emitNewTrade[market:${market}][memberId:${memberId}][instId:${instId}]`,
      this.tradeBook.getDifference(instId)
    );
  }
  _emitUpdateAccount({ memberId, account }) {
    this.accountBook.updateByDifference(memberId, account);
    EventBus.emit(
      Events.account,
      memberId,
      this.accountBook.getDifference(memberId)
    );
    this.logger.log(`difference`, account);
    this.logger.log(
      `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.account}] _emitUpdateAccount[memberId:${memberId}]`,
      this.accountBook.getDifference(memberId)
    );
  }

  init({ config, database, logger, i18n }) {
    this.systemMemberId = config.peatio.systemMemberId;
    return super
      .init({ config, database, logger, i18n })
      .then(async () => {
        this.tidebitMarkets = this.getTidebitMarkets();
        this.currencies = await this.database.getCurrencies();
        this.tickerBook = new TickerBook({
          logger,
          markets: this.tidebitMarkets,
        });
        this.depthBook = new DepthBook({
          logger,
          markets: this.tidebitMarkets,
        });
        this.tradeBook = new TradeBook({
          logger,
          markets: this.tidebitMarkets,
        });
        this.orderBook = new OrderBook({
          logger,
          markets: this.tidebitMarkets,
        });
        this.accountBook = new AccountBook({
          logger,
          markets: this.tidebitMarkets,
        });
      })
      .then(async () => {
        this.tideBitConnector = new TideBitConnector({ logger });
        await this.tideBitConnector.init({
          app: this.config.pusher.app,
          key: this.config.pusher.key,
          secret: this.config.pusher.secret,
          wsProtocol: this.config.pusher.protocol,
          wsHost: this.config.pusher.host,
          port: this.config.pusher.port,
          wsPort: this.config.pusher.wsPort,
          wssPort: this.config.pusher.wssPort,
          encrypted: this.config.pusher.encrypted,
          peatio: this.config.peatio.domain,
          redis: this.config.redis.domain,
          markets: this.config.markets,
          database: database,
          tickerBook: this.tickerBook,
          depthBook: this.depthBook,
          tradeBook: this.tradeBook,
          orderBook: this.orderBook,
          accountBook: this.accountBook,
          tidebitMarkets: this.tidebitMarkets,
          currencies: this.currencies,
        });
        this.okexConnector = new OkexConnector({ logger });
        await this.okexConnector.init({
          domain: this.config.okex.domain,
          apiKey: this.config.okex.apiKey,
          secretKey: this.config.okex.secretKey,
          passPhrase: this.config.okex.passPhrase,
          brokerId: this.config.okex.brokerId,
          wssPublic: this.config.okex.wssPublic,
          wssPrivate: this.config.okex.wssPrivate,
          markets: this.config.markets,
          tickerBook: this.tickerBook,
          depthBook: this.depthBook,
          tradeBook: this.tradeBook,
          orderBook: this.orderBook,
          accountBook: this.accountBook,
          currencies: this.currencies,
          database: this.database,
          tidebitMarkets: this.tidebitMarkets,
        });
        this.exchangeHubService = new ExchangeHubService({
          database,
          // connectors: {
          //   OKEX: this.okexConnector,
          // },
          systemMemberId: this.config.peatio.systemMemberId,
          okexConnector: this.okexConnector,
          tidebitMarkets: this.tidebitMarkets,
          logger,
        });
        return this;
      });
  }

  async _syncTransactionDetail(formatOrder) {
    this.logger.log(
      ` ------------- [${this.constructor.name}] _syncTransactionDetail [START]---------------`
    );
    const updateData = await this.exchangeHubService.sync(
      SupportedExchange.OKEX,
      true,
      { clOrdId: formatOrder?.clOrdId }
    );
    this.logger.log(`updateData length`, updateData?.length);
    if (updateData) {
      for (const data of updateData) {
        const memberId = data.memberId,
          market = data.market,
          instId = data.instId,
          updateOrder = data.updateOrder,
          newTrade = data.newTrade,
          updateAskAccount = data.updateAskAccount,
          updateBidAccount = data.updateBidAccount;
        if (updateOrder && memberId && instId) {
          this._emitUpdateOrder({
            memberId,
            instId,
            market,
            order: updateOrder,
          });
        }
        if (newTrade) {
          this._emitNewTrade({
            memberId,
            instId,
            market,
            trade: newTrade,
          });
        }
        if (updateAskAccount) {
          this._emitUpdateAccount({
            memberId,
            account: updateAskAccount,
          });
        }
        if (updateBidAccount) {
          this._emitUpdateAccount({
            memberId,
            account: updateBidAccount,
          });
        }
      }
    }
    this.logger.log(
      ` ------------- [${this.constructor.name}] _syncTransactionDetail [END]---------------`
    );
  }

  async start() {
    await super.start();
    await this.okexConnector.start();
    this._eventListener();
    // this._syncTransactionDetail();
    const t = await this.database.transaction();
    try {
      const ethAcc = await this.database.getAccountByMemberIdCurrency(2, 3, {
        dbTransaction: t,
      });
      this.logger.log(`ethAcc`, ethAcc);
      const usdtAcc = await this.database.getAccountByMemberIdCurrency(2, 34, {
        dbTransaction: t,
      });
      this.logger.log(`usdtAcc`, usdtAcc);
      const ethAccV = await this.database.getAccountVersionsByMemberIdCurrency(
        2,
        3,
        { dbTransaction: t }
      );
      this.logger.log(`ethAccV`, ethAccV);
      const usdtAccV = await this.database.getAccountVersionsByMemberIdCurrency(
        2,
        34,
        { dbTransaction: t }
      );
      this.logger.log(`usdtAccV`, usdtAccV);
      const order = await this.database.getOrder(332576077, {
        dbTransaction: t,
      });
      this.logger.log(`order`, order);
      const tradebyDBID = await this.database.getTradeByAskOrdId(332576077, {
        dbTransaction: t,
      });
      this.logger.log(`tradebyDBID`, tradebyDBID);
      const tradebyOKExID = await this.database.getTradeByAskOrdId(
        `467755654093094921`,
        { dbTransaction: t }
      );
      this.logger.log(`tradebyOKExID`, tradebyOKExID);
      const trades = await this.database.getTrades(`usdt`, "eth", {
        dbTransaction: t,
      });
      this.logger.log(`trades`, trades);
      const voucherbyDBID = await this.database.getVouchersByOrderId(
        332576077,
        {
          dbTransaction: t,
        }
      );
      this.logger.log(`voucherbyDBID`, voucherbyDBID);
      const voucherbyOKExID = await this.database.getVouchersByOrderId(
        `467755654093094921`,
        { dbTransaction: t }
      );
      this.logger.log(`voucherbyOKExID`, voucherbyOKExID);
      const vouchers = await this.database.getVouchers( {
        memberId:2, ask:'eth', bid:'usdt'
      });
      this.logger.log(`vouchers`, vouchers);
      await t.commit();
    } catch (error) {
      this.logger.error(`get DB data error`, error);
      await t.rollback();
    }
    return this;
  }

  getTidebitMarkets() {
    try {
      const p = path.join(
        this.config.base.TideBitLegacyPath,
        "config/markets/markets.yml"
      );
      const markets = Utils.marketParser(p);
      const formatMarket = markets
        .filter((market) => market.visible !== false) // default visible is true, so if visible is undefined still need to show on list.
        .map((market) => {
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

  async getOrdersFromDb(query) {
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
    const orders = orderList.map((order) => {
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

  async getUsersAccounts() {
    // return new ResponseFormat({
    //   message:'test',
    //   code: Codes.API_UNKNOWN_ERROR,
    // });
    return this.tideBitConnector.router("getUsersAccounts", {});
  }

  // account api
  async getAccounts({ memberId }) {
    this.logger.log(
      `[${this.constructor.name}] getAccounts memberId`,
      memberId
    );
    if (memberId === -1) {
      return new ResponseFormat({
        message: "getAccounts",
        payload: null,
      });
    }
    return this.tideBitConnector.router("getAccounts", { memberId });
  }

  async getTicker({ params, query }) {
    const instId = this._findInstId(query.id);
    const index = this.tidebitMarkets.findIndex(
      (market) => instId === market.instId
    );
    this.logger.log(
      `[${this.constructor.name}] getTicker[index:${index}]`,
      instId
    );
    if (index !== -1) {
      const source = this._findSource(instId);
      this.logger.log(
        `[${this.constructor.name}] getTicker ticketSource`,
        source
      );
      switch (source) {
        case SupportedExchange.OKEX:
          return this.okexConnector.router("getTicker", {
            params,
            query: { ...query, instId },
            optional: { market: this.tidebitMarkets[index] },
          });
        case SupportedExchange.TIDEBIT:
          return this.tideBitConnector.router("getTicker", {
            params,
            query: { ...query, instId },
            optional: { market: this.tidebitMarkets[index] },
          });
        default:
          return new ResponseFormat({
            message: "getTicker",
            payload: null,
          });
      }
    } else {
      return new ResponseFormat({
        message: "getTicker",
        payload: null,
      });
    }
  }
  // account api end
  // market api
  async getTickers({ query }) {
    if (!this.fetchedTickers) {
      let filteredOkexTickers,
        filteredTBTickers = {};
      this.logger.debug(
        `*********** [${this.name}] getTickers [START] ************`
      );
      try {
        const okexRes = await this.okexConnector.router("getTickers", {
          query,
        });
        if (okexRes.success) {
          filteredOkexTickers = okexRes.payload;
        } else {
          this.logger.error(okexRes);
          return new ResponseFormat({
            message: "",
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
      } catch (error) {
        this.logger.error(error);
        return new ResponseFormat({
          message: error.stack,
          code: Codes.API_UNKNOWN_ERROR,
        });
      }
      // this.logger.log(`this.tidebitMarkets`, this.tidebitMarkets);
      try {
        const tideBitOnlyMarkets = Utils.marketFilterExclude(
          Object.values(filteredOkexTickers),
          this.tidebitMarkets
        );
        // this.logger.log(`tideBitOnlyMarkets`, tideBitOnlyMarkets);
        const tBTickersRes = await this.tideBitConnector.router("getTickers", {
          optional: { mask: tideBitOnlyMarkets },
        });
        if (tBTickersRes.success) {
          filteredTBTickers = tBTickersRes.payload;
        } else {
          this.logger.error(tBTickersRes);
          return new ResponseFormat({
            message: "",
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
        // this.logger.log(`filteredOkexTickers`, filteredOkexTickers);
        // this.logger.log(`filteredTBTickers`, filteredTBTickers);
        this.tickerBook.updateAll({
          ...filteredOkexTickers,
          ...filteredTBTickers,
        });
        this.logger.debug(
          `*********** [${this.name}] getTickers [END] ************`
        );
      } catch (error) {
        this.logger.error(error);
        return new ResponseFormat({
          message: error.stack,
          code: Codes.API_UNKNOWN_ERROR,
        });
      }
      this.fetchedTickers = true;
    }
    return new ResponseFormat({
      message: "getTickers",
      payload: this.tickerBook.getSnapshot(),
    });
  }

  async getDepthBooks({ query }) {
    this.logger.log(`[${this.constructor.name}] getDepthBooks`, query);
    const instId = this._findInstId(query.id);
    switch (this._findSource(instId)) {
      case SupportedExchange.OKEX:
        return this.okexConnector.router("getDepthBooks", {
          query: { ...query, instId },
        });
      case SupportedExchange.TIDEBIT:
        return this.tideBitConnector.router("getDepthBooks", {
          query: { ...query, instId },
        });
      default:
        return new ResponseFormat({
          message: "getDepthBooks",
          payload: {},
        });
    }
  }

  async getTradingViewConfig({ query }) {
    return Promise.resolve({
      supported_resolutions: ["1", "5", "15", "30", "60", "1D", "1W"],
      supports_group_request: false,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_search: true,
    });
  }

  async getTradingViewSymbol({ query }) {
    const id = decodeURIComponent(query.symbol).replace("/", "").toLowerCase();
    const instId = this._findInstId(id);
    const market = this.tidebitMarkets.find((market) => market.id === id);
    // this.logger.log(`getTradingViewSymbol market`, market);
    switch (this._findSource(instId)) {
      case SupportedExchange.OKEX:
        return this.okexConnector.router("getTradingViewSymbol", {
          query: { ...query, instId, id, market },
        });
      case SupportedExchange.TIDEBIT:
      default:
        return new ResponseFormat({
          message: "getTradingViewSymbol",
          payload: [],
        });
    }
  }

  async getTradingViewHistory({ query }) {
    const instId = this._findInstId(query.symbol);
    switch (this._findSource(instId)) {
      case SupportedExchange.OKEX:
        return this.okexConnector.router("getTradingViewHistory", {
          query: { ...query, instId },
        });
      case SupportedExchange.TIDEBIT:
      default:
        return new ResponseFormat({
          message: "getTradingViewHistory",
          payload: [],
        });
    }
  }

  async getCandlesticks({ query }) {
    switch (this._findSource(query.instId)) {
      case SupportedExchange.OKEX:
        return this.okexConnector.router("getCandlesticks", { query });
      case SupportedExchange.TIDEBIT:
      default:
        return new ResponseFormat({
          message: "getCandlesticks",
          payload: [],
        });
    }
  }

  async getTrades({ query }) {
    const instId = this._findInstId(query.id);
    switch (this._findSource(instId)) {
      case SupportedExchange.OKEX:
        return this.okexConnector.router("getTrades", {
          query: { ...query, instId },
        });
      case SupportedExchange.TIDEBIT:
        return this.tideBitConnector.router("getTrades", {
          query: { ...query, instId },
        });
      default:
        return new ResponseFormat({
          message: "getTrades",
          payload: [],
        });
    }
  }
  // market api end
  // trade api
  /**
   * ++ TODO
   * 外部 Order 掛單流程調整
   * 1. DB transaction
   * 2. 根據 order 單內容更新 account locked 與 balance
   * 3. 新增 account version
   * 4. 建立 TideBit order 單
   * 5. commit transaction
   * 6. 建立 OKX order 單
   * 6.1 掛單成功
   * 6.2 掛單失敗
   * 6.2.1 DB transaction
   * 6.2.2 根據 order locked amount 減少 account locked amount 並增加 balance amount
   * 6.2.3 新增 account_versions 記錄
   * 6.2.4 更新 order 為 cancel 狀態
   * 6.2.5 commit transaction
   */
  async postPlaceOrder({ header, params, query, body, memberId }) {
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
           * body.kind: order is 'bid' or 'ask'
           * orderData.price: body.price, price value
           * orderData.volume: body.volume, volume value
           * orderData.locked:
           *   if body.kind === 'bid', locked = body.price * body.volume
           *   if body.kind === 'ask', locked = body.volume
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
            orderData.ordType === "market" ? "ioc" : orderData.ordType,
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
          this.logger.log(
            `---------- [${this.constructor.name}]  postPlaceOrder  ----------`
          );
          this.logger.log("[RESPONSE]", okexOrderRes);
          this.logger.log(
            `---------- [${this.constructor.name}]  postPlaceOrder  ----------`
          );
          if (!okexOrderRes.success) {
            await t.rollback();
            return okexOrderRes;
          } else {
            if (body.ordType !== "market") {
              let _updateOrder = {
                instId: body.instId,
                ordType: body.ordType === "market" ? "ioc" : body.ordType,
                id: okexOrderRes.payload.ordId,
                clOrdId: okexOrderRes.payload.clOrdId,
                at: parseInt(SafeMath.div(Date.now(), "1000")),
                ts: Date.now(),
                market: body.market,
                kind: body.kind,
                price: body.price,
                origin_volume: body.volume,
                state: "wait",
                state_text: "Waiting",
                volume: body.volume,
              };
              this._emitUpdateOrder({
                memberId,
                instId: body.instId,
                market: body.market,
                order: _updateOrder,
              });
              let _updateAccount = {
                balance: SafeMath.plus(account.balance, balance),
                locked: SafeMath.plus(account.locked, locked),
                currency: this.currencies.find(
                  (curr) => curr.id === account.currency
                )?.symbol,
                total: SafeMath.plus(
                  SafeMath.plus(account.balance, balance),
                  SafeMath.plus(account.locked, locked)
                ),
              };
              this._emitUpdateAccount({
                memberId,
                account: _updateAccount,
              });
            }
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
      case SupportedExchange.TIDEBIT:
        await t.commit();
        return this.tideBitConnector.router("postPlaceOrder", {
          header,
          body: { ...body, market: this._findMarket(body.instId) },
        });
      default:
        await t.rollback();
        return new ResponseFormat({
          message: "instId not Support now",
          code: Codes.API_NOT_SUPPORTED,
        });
    }
  }

  // TODO integrate getOrderList and getOrderHistory into one
  async getOrderList({ query, memberId }) {
    this.logger.log(
      `-------------[${this.constructor.name} getOrderList]----------`
    );
    this.logger.log(` memberId:`, memberId);
    const instId = this._findInstId(query.market);
    const market = this._findMarket(instId);
    const source = this._findSource(instId);
    if (memberId !== -1) {
      switch (source) {
        case SupportedExchange.OKEX:
          const res = await this.okexConnector.router("getOrderList", {
            query: {
              ...query,
              instId,
              market,
              memberId,
            },
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
              const orders = await this.getOrdersFromDb({
                ...query,
                memberId,
                instId,
                market,
              });
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
        default:
          return new ResponseFormat({
            message: "getOrderList",
            payload: null,
          });
      }
    }
    return new ResponseFormat({
      message: "getOrderList",
      payload: null,
    });
  }

  async getOrderHistory({ query, memberId }) {
    const instId = this._findInstId(query.market);
    const market = this._findMarket(instId);
    // this.logger.log(
    //   `[${this.constructor.name} getOrderHistory instId(${instId})] memberId:`,
    //   memberId,
    //   `market`,
    //   market
    // );
    if (memberId === -1) {
      return new ResponseFormat({
        message: "getOrderHistory",
        payload: null,
      });
    }
    switch (this._findSource(instId)) {
      case SupportedExchange.OKEX:
      case SupportedExchange.TIDEBIT:
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
            const orders = await this.getOrdersFromDb({
              ...query,
              memberId,
              instId,
              market,
            });
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
      default:
        return new ResponseFormat({
          message: "getOrderHistory",
          payload: null,
        });
    }
  }

  async updateOrderStatus({ transacion, orderId, memberId, orderData }) {
    /* !!! HIGH RISK (start) !!! */
    // 1. get orderId from body
    // 2. get order data from table
    // 3. find and lock account
    // 4. update order state
    // 5. get balance and locked value from order
    // 6. add account_version
    // 7. update account balance and locked
    // 8. post okex cancel order
    // const t = await this.database.transaction();
    /*******************************************
     * body.clOrdId: custom orderId for okex
     * locked: value from order.locked, used for unlock balance, negative in account_version
     * balance: order.locked
     *******************************************/
    let result = false;
    const order = await this.database.getOrder(orderId, {
      dbTransaction: transacion,
    });
    const currencyId =
      order?.type === this.database.TYPE.ORDER_ASK ? order?.ask : order?.bid;
    const account = await this.database.getAccountByMemberIdCurrency(
      memberId,
      currencyId,
      { dbTransaction: transacion }
    );
    const newOrder = {
      id: orderId,
      state: this.database.ORDER_STATE.CANCEL,
    };
    const locked = SafeMath.mult(order.locked, "-1");
    const balance = order.locked;
    const fee = "0";

    const created_at = new Date().toISOString();

    const _updateOrder = {
      ...orderData,
      state: "canceled",
      state_text: "Canceled",
      at: parseInt(SafeMath.div(Date.now(), "1000")),
      ts: Date.now(),
    };
    this._emitUpdateOrder({
      memberId,
      instId: _updateOrder.instId,
      market: _updateOrder.market,
      order: _updateOrder,
    });
    try {
      await this.database.updateOrder(newOrder, { dbTransaction: transacion });
      if (account) {
        let _updateAccount = {
          balance: SafeMath.plus(account.balance, balance),
          locked: SafeMath.plus(account.locked, locked),
          currency: this.currencies.find((curr) => curr.id === account.currency)
            ?.symbol,
          total: SafeMath.plus(
            SafeMath.plus(account.balance, balance),
            SafeMath.plus(account.locked, locked)
          ),
        };
        this._emitUpdateAccount({ memberId, account: _updateAccount });
        await this._updateAccount(
          account,
          transacion,
          balance,
          locked,
          fee,
          this.database.MODIFIABLE_TYPE.ORDER,
          orderId,
          created_at,
          this.database.FUNC.UNLOCK_FUNDS
        );
      }
      result = true;
    } catch (error) {
      this.logger.error(
        `[${this.constructor.name} updateOrderStatus] error`,
        error
      );
    }
    // await t.commit();
    return result;
    /* !!! HIGH RISK (end) !!! */
  }
  // ++ TODO: fix multi return
  async postCancelOrder({ header, params, query, body, memberId }) {
    const source = this._findSource(body.instId);
    // const t = await this.database.transaction();
    try {
      // 1. get orderId from body.clOrdId
      let { orderId } =
        source === SupportedExchange.OKEX
          ? Utils.parseClOrdId(body.clOrdId)
          : { orderId: body.id };
      switch (source) {
        case SupportedExchange.OKEX:
          /* !!! HIGH RISK (start) !!! */
          let transacion = await this.database.transaction();
          let result = await this.updateOrderStatus({
            transacion,
            orderId,
            memberId,
            orderData: body,
          });
          if (result) {
            /* !!! HIGH RISK (end) !!! */
            const okexCancelOrderRes = await this.okexConnector.router(
              "postCancelOrder",
              { params, query, body }
            );
            this.logger.log(`postCancelOrder`, body);
            this.logger.log(`okexCancelOrderRes`, okexCancelOrderRes);
            if (!okexCancelOrderRes.success) {
              await transacion.rollback();
            } else {
              await transacion.commit();
            }
            return okexCancelOrderRes;
          } else {
            await transacion.rollback();
            return new ResponseFormat({
              message: "DB ERROR",
              code: Codes.CANCEL_ORDER_FAIL,
            });
          }
        case SupportedExchange.TIDEBIT:
          return this.tideBitConnector.router(`postCancelOrder`, {
            header,
            body: { ...body, orderId, market: this._findMarket(body.instId) },
          });

        default:
          // await t.rollback();
          return new ResponseFormat({
            message: "instId not Support now",
            code: Codes.API_NOT_SUPPORTED,
          });
      }
    } catch (error) {
      this.logger.error(error);
      // await t.rollback();
      return new ResponseFormat({
        message: error.message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  // ++ TODO
  // get pending orders by snapshot
  async cancelOrders({ header, body, memberId }) {
    const source = this._findSource(body.instId);
    try {
      switch (source) {
        case SupportedExchange.OKEX:
          // get pending orders by snapshot
          const _orders = await this.getOrdersFromDb({
            ...body,
            market: this._findMarket(body.instId),
            memberId,
            // state: this.database.ORDER_STATE.WAIT,
            // orderType: "limit",
          });

          const orders = _orders
            .filter(
              (_order) =>
                body.type === "all" ||
                (body.type === "ask" && _order.type === "OrderAsk") ||
                (body.type === "bid" && _order.type === "OrderBid")
            )
            .map((_order) => {
              return {
                ..._order,
                ordId: Utils.parseClOrdId(_order.clOrdId),
              };
            });
          const res = [];
          const err = [];
          orders.forEach(async (order) => {
            /* !!! HIGH RISK (start) !!! */
            let t = await this.updateOrderStatus({
              orderId: order.id,
              memberId,
              orderData: body,
            });
            /* !!! HIGH RISK (end) !!! */
            const okexCancelOrderRes = await this.okexConnector.router(
              "postCancelOrder",
              { body }
            );
            this.logger.log(`postCancelOrder`, body);
            this.logger.log(`okexCancelOrderRes`, okexCancelOrderRes);
            if (!okexCancelOrderRes.success) {
              err.push(okexCancelOrderRes);
              await t.rollback();
            } else {
              res.push(okexCancelOrderRes);
              await t.commit();
            }
          });
          if (err.length > 0) {
            return new ResponseFormat({
              message: "Fail to cancel partial orders",
              code: Codes.API_NOT_SUPPORTED,
            });
          } else {
            return new ResponseFormat({
              message: "postCancelOrder",
              payload: res,
            });
          }
        // const okexCancelOrdersRes = await this.okexConnector.router(
        //   "cancelOrders",
        //   { body: orders }
        // );
        // this.logger.log(`cancelAll orders`, orders);
        // this.logger.log(`cancelAll res`, okexCancelOrdersRes);
        // if (okexCancelOrdersRes.success) {
        //   orders.map((_order) =>
        //     this.updateOrderState({
        //       orderData: _order,
        //       orderId: order.ordId,
        //       memberId,
        //     })
        //   );
        // }

        // return okexCancelOrdersRes;

        /* !!! HIGH RISK (end) !!! */
        case SupportedExchange.TIDEBIT:
          let functionName =
            body.type === "ask"
              ? "cancelAllAsks"
              : body.type === "bid"
              ? "cancelAllBids"
              : body.type === "all"
              ? "cancelAllOrders"
              : undefined;
          if (functionName) {
            return this.tideBitConnector.router(`${functionName}`, {
              header,
              body: { ...body, market: this._findMarket(body.instId) },
            });
          } else
            return new ResponseFormat({
              message: "instId not Support now",
              code: Codes.API_NOT_SUPPORTED,
            });
        default:
          return new ResponseFormat({
            message: "instId not Support now",
            code: Codes.API_NOT_SUPPORTED,
          });
      }
    } catch (error) {
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
  async getExAccounts({ query }) {
    const { exchange } = query;
    this.logger.debug(`[${this.constructor.name}] getExAccounts`, exchange);
    switch (exchange) {
      case "OKEx":
      default:
        try {
          this.logger.debug(
            `[${this.constructor.name}] getExAccounts run default`
          );
          const okexRes = await this.okexConnector.router("getExAccounts", {
            query,
          });
          return okexRes;
        } catch (error) {
          this.logger.error(error);
          return new ResponseFormat({
            message: error.stack,
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
    }
  }

  async getOptions({ query }) {
    this.logger.debug(
      `[${this.constructor.name}] getOptions`,
      this.config.websocket.domain
    );
    return Promise.resolve(
      new ResponseFormat({
        message: "getOptions",
        payload: {
          wsUrl: this.config.websocket.domain,
        },
      })
    );
  }

  async _updateOrderDetail(formatOrder) {
    this.logger.log(
      `---------- [${this.constructor.name}]  _updateOrderDetail [START] ----------`
    );
    const t = await this.database.transaction();
    /* !!! HIGH RISK (start) !!! */
    // 1. get orderId from body
    // 2. get order data from table
    // 3. find and lock account
    // 4. update order state
    // 5. get balance and locked value from order
    // 6. add trade // -- CAUTION!!! skip now, tradeId use okex tradeId ++ TODO
    // 7. add vouchers
    // 8. add account_version
    // 9. update account balance and locked
    try {
      const {
        ordType,
        instId,
        accFillSz,
        clOrdId,
        tradeId,
        state,
        side,
        fillPx,
        fillSz,
        sz,
        fee,
        uTime,
        ordId,
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
      const base_unit = this.currencies.find(
        (curr) => curr.id === order.ask
      )?.key;
      const quote_unit = this.currencies.find(
        (curr) => curr.id === order.bid
      )?.key;
      if (!base_unit || !quote_unit)
        throw Error(
          `order base_unit[order.ask: ${order.ask}] or quote_unit[order.bid: ${order.bid}] not found`
        );
      await this.database.insertVouchers(
        memberId,
        orderId,
        tradeId, // ++ TODO reference step6 trade.id
        null,
        base_unit, // -- need change
        quote_unit, // -- need change
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

      const _updateOrder = {
        id: ordId,
        at: parseInt(SafeMath.div(uTime, "1000")),
        ts: parseInt(uTime),
        market: instId.replace("-", "").toLowerCase(),
        kind: side === "buy" ? "bid" : "ask",
        price: null, // market prcie
        origin_volume: sz,
        clOrdId: clOrdId,
        state:
          state === "canceled"
            ? "canceled"
            : state === "filled"
            ? "done"
            : "wait",
        state_text:
          state === "canceled"
            ? "Canceled"
            : state === "filled"
            ? "Done"
            : "Waiting",
        volume: SafeMath.minus(sz, fillSz),
        instId: instId,
        ordType: ordType,
        filled: state === "filled",
      };
      this.logger.log(
        `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.order}] updateOrder ln:1092`,
        _updateOrder
      );
      this.orderBook.updateByDifference(memberId, instId, {
        add: [_updateOrder],
      });
      let market = instId.replace("-", "").toLowerCase();
      EventBus.emit(Events.order, memberId, market, {
        market,
        difference: this.orderBook.getDifference(memberId, instId),
      });

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
      let _updateAcc = {
        balance: SafeMath.plus(accountAsk.balance, balanceA),
        locked: SafeMath.plus(accountAsk.balance, lockedA), //++ TODO verify => SafeMath.plus(accountAsk.balance, lockedA)
        currency: this.currencies.find(
          (curr) => curr.id === accountAsk.currency
        )?.symbol,
        total: SafeMath.plus(
          SafeMath.plus(accountAsk.balance, balanceA),
          SafeMath.plus(accountAsk.balance, lockedA) //++ TODO verify => SafeMath.plus(accountAsk.balance, lockedA)
        ),
      };
      this.accountBook.updateByDifference(memberId, _updateAcc);
      EventBus.emit(
        Events.account,
        memberId,
        this.accountBook.getDifference(memberId)
      );

      this.logger.log(
        `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.account}] _updateAcc ln:1057`,
        _updateAcc
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
      _updateAcc = {
        balance: SafeMath.plus(accountBid.balance, balanceB),
        locked: SafeMath.plus(accountBid.balance, lockedB),
        currency: this.currencies.find(
          (curr) => curr.id === accountBid.currency
        )?.symbol,
        total: SafeMath.plus(
          SafeMath.plus(accountBid.balance, balanceB),
          SafeMath.plus(accountBid.balance, lockedB)
        ),
      };
      this.accountBook.updateByDifference(memberId, _updateAcc);
      EventBus.emit(
        Events.account,
        memberId,
        this.accountBook.getDifference(memberId)
      );

      this.logger.log(
        `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.account}] _updateAcc ln:1086`,
        _updateAcc
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
          _updateAcc = {
            balance: SafeMath.plus(accountAsk.balance, changeLocked),
            locked: SafeMath.plus(accountAsk.balance, changeBalance),
            currency: this.currencies.find(
              (curr) => curr.id === accountAsk.currency
            )?.symbol,
            total: SafeMath.plus(
              SafeMath.plus(accountAsk.balance, changeLocked),
              SafeMath.plus(accountAsk.balance, changeBalance)
            ),
          };
          this.accountBook.updateByDifference(memberId, _updateAcc);
          EventBus.emit(
            Events.account,
            memberId,
            this.accountBook.getDifference(memberId)
          );
          this.logger.log(
            `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.account}] _updateAcc ln:1120`,
            _updateAcc
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
          _updateAcc = {
            balance: SafeMath.plus(accountBid.balance, changeLocked),
            locked: SafeMath.plus(accountBid.balance, changeBalance),
            currency: this.currencies.find(
              (curr) => curr.id === accountBid.currency
            )?.symbol,
            total: SafeMath.plus(
              SafeMath.plus(accountBid.balance, changeLocked),
              SafeMath.plus(accountBid.balance, changeBalance)
            ),
          };
          this.accountBook.updateByDifference(memberId, _updateAcc);
          EventBus.emit(
            Events.account,
            memberId,
            this.accountBook.getDifference(memberId)
          );
          this.logger.log(
            `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.account}] _updateAcc ln:1149`,
            _updateAcc
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
    const { id: bid } = this.currencies.find(
      (curr) => curr.key === market.quote_unit
    );
    const { id: ask } = this.currencies.find(
      (curr) => curr.key === market.base_unit
    );
    if (!bid) {
      throw new Error(`bid not found`);
    }
    if (!ask) {
      throw new Error(`ask not found`);
    }
    const currency = market.code;
    const locked =
      body.kind === "bid"
        ? SafeMath.mult(body.price, body.volume)
        : body.volume;
    const balance = SafeMath.mult(locked, "-1");

    const orderData = {
      bid,
      ask,
      currency,
      price: body.price || null,
      volume: body.volume,
      type:
        body.kind === "bid"
          ? this.database.TYPE.ORDER_BID
          : this.database.TYPE.ORDER_ASK,
      ordType: body.ordType === "market" ? "ioc" : body.ordType,
      locked,
      balance,
      currencyId: body.kind === "bid" ? bid : ask,
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

  _findInstId(id) {
    return this.config.markets[id.toUpperCase()];
  }

  _findSource(instId) {
    return this.config.markets[`tb${instId}`];
  }

  _findMarket(instId) {
    return this.tidebitMarkets.find((m) => m.instId === instId);
  }
}

module.exports = ExchangeHub;
