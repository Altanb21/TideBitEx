const path = require("path");
const axios = require("axios");

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
const Database = require("../constants/Database");

class ExchangeHub extends Bot {
  fetchedOrders = {};
  fetchedOrdersInterval = 1 * 60 * 1000;
  systemMemberId;
  okexBrokerId;
  updateDatas = [];
  constructor() {
    super();
    this.name = "ExchangeHub";
    this.fetchedTickers = false;
  }

  init({ config, database, logger, i18n }) {
    this.okexBrokerId = config.okex.brokerId;
    this.systemMemberId = config.peatio.systemMemberId;
    return super
      .init({ config, database, logger, i18n })
      .then(async () => {
        this.tidebitMarkets = this.getTidebitMarkets();
        this.adminUsers = this.getAdminUsers();
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
          websocketDomain: this.config.websocket.domain,
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
          systemMemberId: this.config.peatio.systemMemberId,
          okexConnector: this.okexConnector,
          tidebitMarkets: this.tidebitMarkets,
          emitUpdateData: (updateData) => this.emitUpdateData(updateData),
          logger,
        });
        return this;
      });
  }

  async start() {
    await super.start();
    await this.okexConnector.start();
    this._eventListener();
    await this.exchangeHubService.sync(SupportedExchange.OKEX, null, true);
    return this;
  }

  emitUpdateData(updateData) {
    this.logger.log(`upateData`, updateData);
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
  }

  getAdminUsers() {
    try {
      const p = path.join(
        this.config.base.TideBitLegacyPath,
        "config/roles.yml"
      );
      const users = Utils.fileParser(p);
      const formatUsers = users.map((user) => {
        return {
          ...user,
        };
      });
      this.logger.log(`-*-*-*-*- getAdminUsers -*-*-*-*-`, formatUsers);
      return formatUsers;
    } catch (error) {
      this.logger.error(error);
      process.exit(1);
    }
  }

  getTidebitMarkets() {
    try {
      const p = path.join(
        this.config.base.TideBitLegacyPath,
        "config/markets/markets.yml"
      );
      const markets = Utils.fileParser(p);
      const formatMarket = markets
        .filter((market) => market.visible !== false) // default visible is true, so if visible is undefined still need to show on list.
        .map((market) => {
          const instId = market.name.split("/").join("-").toUpperCase();
          return {
            ...market,
            instId,
            instType: "",
            group: market.tab_category,
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
    let _orders,
      _doneMarketBidOrders,
      orders = [];
    _orders = await this.database.getOrderList({
      quoteCcy: bid,
      baseCcy: ask,
      memberId: query.memberId,
    });
    _doneMarketBidOrders = await this.database.getDoneOrders({
      quoteCcy: bid,
      baseCcy: ask,
      memberId: query.memberId,
      state: Database.ORDER_STATE_CODE.DONE,
      type: Database.TYPE.ORDER_BID,
    });
    _orders = _orders
      .filter(
        (_order) =>
          !(
            _order.type === Database.TYPE.ORDER_BID &&
            _order.state === Database.ORDER_STATE_CODE.DONE &&
            _order.ord_type !== Database.ORD_TYPE.LIMIT
          )
      )
      .concat(_doneMarketBidOrders);
    for (let _order of _orders) {
      let order;
      order = {
        id: _order.id,
        ts: parseInt(new Date(_order.updated_at).getTime()),
        at: parseInt(
          SafeMath.div(new Date(_order.updated_at).getTime(), "1000")
        ),
        market: query.instId.replace("-", "").toLowerCase(),
        kind:
          _order.type === Database.TYPE.ORDER_ASK
            ? Database.ORDER_KIND.ASK
            : Database.ORDER_KIND.BID,
        price: _order.price ? Utils.removeZeroEnd(_order.price) : _order.price,
        origin_volume: Utils.removeZeroEnd(_order.origin_volume),
        volume: Utils.removeZeroEnd(_order.volume),
        state_code: _order.state,
        state: SafeMath.eq(_order.state, Database.ORDER_STATE_CODE.CANCEL)
          ? Database.ORDER_STATE.CANCEL
          : SafeMath.eq(_order.state, Database.ORDER_STATE_CODE.WAIT)
          ? Database.ORDER_STATE.WAIT
          : SafeMath.eq(_order.state, Database.ORDER_STATE_CODE.DONE)
          ? Database.ORDER_STATE.DONE
          : Database.ORDER_STATE.UNKNOWN,
        state_text: SafeMath.eq(_order.state, Database.ORDER_STATE_CODE.CANCEL)
          ? Database.ORDER_STATE_TEXT.CANCEL
          : SafeMath.eq(_order.state, Database.ORDER_STATE_CODE.WAIT)
          ? Database.ORDER_STATE_TEXT.WAIT
          : SafeMath.eq(_order.state, Database.ORDER_STATE_CODE.DONE)
          ? Database.ORDER_STATE_TEXT.DONE
          : Database.ORDER_STATE_TEXT.UNKNOWN,
        clOrdId: _order.id,
        instId: query.instId,
        ordType: _order.ord_type,
        filled: _order.volume !== _order.origin_volume,
      };
      if (
        order.state_code === Database.ORDER_STATE_CODE.DONE &&
        order.ordType !== Database.ORD_TYPE.LIMIT &&
        _order.type === Database.TYPE.ORDER_ASK
      ) {
        orders.push({
          ...order,
          price: SafeMath.div(_order.funds_received, _order.origin_volume),
        });
      } else if (
        (order.state_code === Database.ORDER_STATE_CODE.WAIT &&
          order.ordType === Database.ORD_TYPE.LIMIT) || // 非限價單不顯示在 pendingOrders)
        order.state_code === Database.ORDER_STATE_CODE.CANCEL || // canceled 單
        (order.state_code === Database.ORDER_STATE_CODE.DONE &&
          order.ordType === Database.ORD_TYPE.LIMIT) ||
        (order.state_code === Database.ORDER_STATE_CODE.DONE &&
          order.ordType !== Database.ORD_TYPE.LIMIT &&
          _order.type === Database.TYPE.ORDER_BID)
      ) {
        if (order.price) {
          // _canceledOrders.push(order);
          orders.push(order);
        }
        // tidebit 市價單（no price）是否會出現交易失敗導致交易 canceled ？ okex 市價單或ioc單失敗會顯示 cancled 且有price
        else
          this.logger.error(
            `!!! NOTICE !!! canceledOrder without price`,
            order
          );
      } else if (
        order.state_code === Database.ORDER_STATE_CODE.DONE &&
        _order.type === Database.TYPE.ORDER_BID
      ) {
      }
    }
    // const orders = _pendingOrders
    //   .concat(_canceledOrders)
    //   .concat(_doneOrders)
    //   .sort((a, b) => b.ts - a.ts);
    return orders;
  }

  async getUsersAccounts() {
    return this.tideBitConnector.router("getUsersAccounts", {});
  }

  async getPriceList() {
    try {
      const res = await axios({
        method: `get`,
        url: `https://cc.isun.one/api/cc/PriceList`,
      });
      if (res.data && res.status !== 200) {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
      }
      this.logger.log(`getPriceList res`, res);
      return res.data;
    } catch (e) {
      this.logger.error(`getPriceList e`, e);
    }
  }

  // account api
  async getAccounts({ memberId }) {
    let priceList = await this.getPriceList();
    this.accountBook.priceList = priceList;
    this.logger.debug(
      `*********** [${this.name}] getAccounts memberId:[${memberId}]************`
    );

    if (!memberId || memberId === -1) {
      return new ResponseFormat({
        message: "getAccounts",
        payload: null,
      });
    }
    return this.tideBitConnector.router("getAccounts", { memberId });
  }

  async getTicker({ params, query }) {
    this.logger.debug(`*********** [${this.name}] getTicker ************`);
    const instId = this._findInstId(query.id);
    const index = this.tidebitMarkets.findIndex(
      (market) => instId === market.instId
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

  async getTickers({ query }) {
    this.logger.debug(`*********** [${this.name}] getTickers ************`);
    if (!this.fetchedTickers) {
      let filteredOkexTickers,
        filteredTBTickers = {};
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
        // this.logger.debug(
        //   `*********** [${this.name}] getTickers [END] ************`
        // );
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
    this.logger.debug(
      `*********** [${this.name}] getDepthBooks ************`,
      query
    );
    const instId = this._findInstId(query.market);
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
    this.logger.debug(
      `*********** [${this.name}] getTradingViewConfig ************`,
      query
    );
    return Promise.resolve({
      supported_resolutions: ["1", "5", "15", "30", "60", "1D", "1W"],
      supports_group_request: false,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_search: true,
    });
  }

  async getTradingViewSymbol({ query }) {
    this.logger.debug(
      `*********** [${this.name}] getTradingViewConfig ************`,
      query
    );
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
        return this.tideBitConnector.router("getTradingViewSymbol", {
          query: { ...query, instId, id, market },
        });
      default:
        return new ResponseFormat({
          message: "getTradingViewSymbol",
          payload: [],
        });
    }
  }

  async getTradingViewHistory({ query }) {
    this.logger.debug(
      `*********** [${this.name}] getTradingViewConfig ************`,
      query
    );
    const instId = this._findInstId(query.symbol);
    switch (this._findSource(instId)) {
      case SupportedExchange.OKEX:
        return this.okexConnector.router("getTradingViewHistory", {
          query: { ...query, instId },
        });
      case SupportedExchange.TIDEBIT:
        return this.tideBitConnector.router("getTradingViewHistory", {
          query: { ...query, instId },
        });
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
    this.logger.debug(
      `*********** [${this.name}] getTrades ************`,
      query
    );
    const instId = this._findInstId(query.market);
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

  async getOuterTradeFills({ query }) {
    this.logger.debug(
      `*********** [${this.name}] getOuterTradeFills ************`,
      query
    );
    let outerTrades = [];
    switch (query.exchange) {
      case SupportedExchange.OKEX:
        const _outerTrades = await this.database.getOuterTradesByDayAfter(
          Database.EXCHANGE[query.exchange.toUpperCase()],
          query.days // 30 || 365
        );
        // const res = await this.okexConnector.router(
        //   "fetchTradeFillsHistoryRecords",
        //   {
        //     query: { ...query, instType: Database.INST_TYPE.SPOT },
        //   }
        // );
        // if (res.success) {
        // for (let trade of res.payload) {
        for (let _trade of _outerTrades) {
          let trade = JSON.parse(_trade.data),
            parsedClOrdId = Utils.parseClOrdId(trade.clOrdId),
            memberId = parsedClOrdId.memberId,
            orderId = parsedClOrdId.orderId,
            askFeeRate,
            bidFeeRate,
            market = this._findMarket(trade.instId),
            memberTag = _trade.member_tag,
            fee,
            processTrade,
            revenue;
          if (memberTag) {
            if (
              memberTag.toString() === Database.MEMBER_TAG.VIP_FEE.toString()
            ) {
              askFeeRate = market.ask.vip_fee;
              bidFeeRate = market.bid.vip_fee;
            }
            if (
              memberTag.toString() === Database.MEMBER_TAG.HERO_FEE.toString()
            ) {
              askFeeRate = market.ask.hero_fee;
              bidFeeRate = market.bid.hero_fee;
            }
          } else {
            askFeeRate = market.ask.fee;
            bidFeeRate = market.bid.fee;
          }
          fee =
            _trade.status === Database.OUTERTRADE_STATUS.DONE
              ? trade.side === Database.ORDER_SIDE.SELL
                ? SafeMath.mult(
                    SafeMath.mult(trade.fillPx, trade.fillSz),
                    askFeeRate
                  )
                : SafeMath.mult(trade.fillSz, bidFeeRate)
              : null;
          revenue =
            _trade.status === Database.OUTERTRADE_STATUS.DONE
              ? _trade.ref_net_fee
                ? SafeMath.minus(
                    SafeMath.minus(fee, Math.abs(trade.fee)),
                    Math.abs(_trade.ref_net_fee)
                  )
                : SafeMath.minus(fee, Math.abs(trade.fee))
              : null;
          processTrade = {
            ...trade,
            orderId,
            px:
              _trade.status === Database.OUTERTRADE_STATUS.DONE
                ? Utils.removeZeroEnd(_trade.order_price)
                : null,
            sz:
              _trade.status === Database.OUTERTRADE_STATUS.DONE
                ? Utils.removeZeroEnd(_trade.order_origin_volume)
                : null,
            email: _trade?.email || null,
            memberId,
            externalFee: Math.abs(trade.fee),
            fee,
            revenue: revenue,
            exchange: query.exchange,
            referral: _trade.ref_net_fee
              ? Utils.removeZeroEnd(_trade.ref_net_fee)
              : null,
            ts: parseInt(trade.ts),
          };
          // this.logger.log(`processTrade`, processTrade);
          outerTrades = [...outerTrades, processTrade];
        }
        // }
        // this.logger.log(`outerTrades`, outerTrades);
        return new ResponseFormat({
          message: "getOuterTradeFills",
          payload: outerTrades,
        });
      default:
        return new ResponseFormat({
          message: "getOuterTradeFills",
          payload: null,
        });
    }
  }

  async getOuterPendingOrders({ query }) {
    this.logger.debug(
      `*********** [${this.name}] getOuterPendingOrders ************`,
      query
    );
    let outerOrders = [],
      dbOrders = await this.database.getOrdersJoinMemberEmail(
        Database.ORDER_STATE_CODE.WAIT
      );
    switch (query.exchange) {
      case SupportedExchange.OKEX:
        const res = await this.okexConnector.router("getAllOrders", {
          query: { ...query, instType: Database.INST_TYPE.SPOT },
        });
        if (res.success) {
          for (let order of res.payload) {
            let parsedClOrdId = Utils.parseClOrdId(order.clOrdId),
              memberId = parsedClOrdId.memberId,
              id = parsedClOrdId.orderId,
              dbOrder = dbOrders.find(
                (_dbOrder) => _dbOrder.id.toString() === id.toString()
              ),
              fundsReceived =
                order.side === Database.ORDER_SIDE.BUY
                  ? SafeMath.mult(order.avgPx, order.accFillSz)
                  : order.accFillSz,
              processOrder;
            processOrder = {
              ...order,
              unFillSz: SafeMath.minus(order.sz, order.accFillSz),
              id,
              email: dbOrder?.email || null,
              memberId,
              exchange: query.exchange,
              fundsReceived,
              ts: parseInt(order.uTime),
            };
            // this.logger.log(`processOrder`, processOrder);
            outerOrders = [...outerOrders, processOrder];
          }
        }
        return new ResponseFormat({
          message: "getOuterPendingOrders",
          payload: outerOrders,
        });
      default:
        return new ResponseFormat({
          message: "getOuterPendingOrders",
          payload: null,
        });
    }
  }

  // market api end
  // trade api
  /**
   * ++ TODO
   * 外部 Order 掛單流程調整
   * 1. DB transaction
   * 2. 建立 TideBit order 單
   * ~2.~ 3. 根據 order 單內容更新 account locked 與 balance
   * ~3.~ 4. 新增 account version
   * ~4. 建立 TideBit order 單~
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
    this.logger.log(
      `---------- [${this.constructor.name}]  postPlaceOrder  ----------`
    );
    if (!memberId || memberId === -1) {
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
    switch (this._findSource(body.instId)) {
      case SupportedExchange.OKEX:
        let orderData,
          order,
          orderId,
          clOrdId,
          currencyId,
          account,
          result,
          response,
          updateOrder,
          // * 1. DB transaction
          t = await this.database.transaction();
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
          //  * 2. 建立 TideBit order 單
          orderData = await this._getPlaceOrderData(memberId, body);
          order = await this.database.insertOrder({
            ...orderData,
            dbTransaction: t,
          });
          orderId = order[0];
          clOrdId = `${this.okexBrokerId}${memberId}m${orderId}o`.slice(0, 32);
          // clOrdId = 377bd372412fSCDE60977m247674466o
          // brokerId = 377bd372412fSCDE
          // memberId = 60976
          // orderId = 247674466
          this.logger.error(`clOrdId`, clOrdId);
          // * ~2.~ 3. 根據 order 單內容更新 account locked 與 balance
          // * ~3.~ 4. 新增 account version
          currencyId =
            body.kind === Database.ORDER_KIND.BID
              ? orderData.bid
              : orderData.ask;
          account = await this.database.getAccountByMemberIdCurrency(
            memberId,
            currencyId,
            { dbTransaction: t }
          );
          await this._updateAccount({
            account,
            reason: Database.REASON.ORDER_SUBMIT,
            dbTransaction: t,
            balance: orderData.balance,
            locked: orderData.locked,
            fee: 0,
            modifiableType: Database.MODIFIABLE_TYPE.ORDER,
            modifiableId: orderId,
            createdAt: orderData.createdAt,
            fun: Database.FUNC.LOCK_FUNDS,
          });
          //   * 5. commit transaction
          await t.commit();
          //   * 6. 建立 OKX order 單
          response = await this.okexConnector.router("postPlaceOrder", {
            memberId,
            orderId,
            body: {
              instId: body.instId,
              tdMode: body.tdMode,
              // ccy: body.ccy,
              clOrdId,
              tag: this.brokerId,
              side:
                body.kind === Database.ORDER_KIND.BID
                  ? Database.ORDER_SIDE.BUY
                  : Database.ORDER_SIDE.SELL,
              // posSide: body.posSide,
              ordType: orderData.ordType,
              sz: body.volume,
              px: orderData.price,
              // reduceOnly: body.reduceOnly,
              // tgtCcy: body.tgtCcy,
            },
          });
          this.logger.log("[RESPONSE]", response);
          updateOrder = {
            instId: body.instId,
            ordType:
              body.ordType === Database.ORD_TYPE.MARKET
                ? Database.ORD_TYPE.IOC
                : body.ordType,
            id: orderId,
            clOrdId,
            at: parseInt(SafeMath.div(Date.now(), "1000")),
            ts: Date.now(),
            market: body.market,
            kind: body.kind,
            price: body.price,
            origin_volume: body.volume,
            state: Database.ORDER_STATE.WAIT,
            state_text: Database.ORDER_STATE_TEXT.WAIT,
            volume: body.volume,
          };
          if (response.success) {
            // * 6.1 掛單成功
            if (body.ordType === Database.ORD_TYPE.LIMIT) {
              updateOrder = {
                ...updateOrder,
                ordId: response.payload.ordId,
                clOrdId: response.payload.clOrdId,
              };
              this._emitUpdateOrder({
                memberId,
                instId: body.instId,
                market: body.market,
                order: updateOrder,
              });
              let _updateAccount = {
                balance: SafeMath.plus(account.balance, orderData.balance),
                locked: SafeMath.plus(account.locked, orderData.locked),
                currency: this.currencies.find(
                  (curr) => curr.id === account.currency
                )?.symbol,
                total: SafeMath.plus(
                  SafeMath.plus(account.balance, orderData.balance),
                  SafeMath.plus(account.locked, orderData.locked)
                ),
              };
              this._emitUpdateAccount({
                memberId,
                account: _updateAccount,
              });
            }
          } else {
            //  * 6.2 掛單失敗
            //  * 6.2.1 DB transaction
            t = await this.database.transaction();
            //    * 6.2.2 根據 order locked amount 減少 account locked amount 並增加 balance amount
            //    * 6.2.3 新增 account_versions 記錄
            //    * 6.2.4 更新 order 為 cancel 狀態
            result = await this.updateOrderStatus({
              transacion: t,
              orderId,
              memberId,
              orderData: updateOrder,
            });
            if (result) {
              //   * 6.2.5 commit transaction
              await t.commit();
            } else {
              await t.rollback();
              response = new ResponseFormat({
                message: "DB ERROR",
                code: Codes.DB_OPERATION_ERROR,
              });
            }
          }
        } catch (error) {
          this.logger.error(error);
          await t.rollback();
          response = new ResponseFormat({
            message: error.message,
            code: Codes.DB_OPERATION_ERROR,
          });
        }
        // -- WORKAROUND
        setTimeout(() => {
          this.exchangeHubService.sync(
            SupportedExchange.OKEX,
            updateOrder,
            true
          );
        }, 2000);
        // -- WORKAROUND
        return response;
      /* !!! HIGH RISK (end) !!! */
      case SupportedExchange.TIDEBIT:
        return this.tideBitConnector.router("postPlaceOrder", {
          header,
          body: { ...body, market: this._findMarket(body.instId) },
        });
      default:
        return new ResponseFormat({
          message: "instId not Support now",
          code: Codes.API_NOT_SUPPORTED,
        });
    }
  }

  async getOrders({ query, memberId }) {
    this.logger.debug(
      `*********** [${this.name}] getOrders memberId:[${memberId}]************`,
      query
    );
    const instId = this._findInstId(query.market);
    const market = this._findMarket(instId);
    const source = this._findSource(instId);
    if (memberId && memberId !== -1) {
      let pendingOrders, orderHistories, orders;
      switch (source) {
        case SupportedExchange.OKEX:
          const pendingOrdersRes = await this.okexConnector.router(
            "getOrderList",
            {
              query: {
                ...query,
                instId,
                market,
                memberId,
              },
            }
          );
          this.logger.log(`pendingOrdersRes`, pendingOrdersRes);
          pendingOrders = pendingOrdersRes.success
            ? pendingOrdersRes.payload
            : [];
          orderHistories = await this.getOrdersFromDb({
            ...query,
            memberId,
            instId,
            market,
          });
          orderHistories = orderHistories.filter(
            (order) => order.state_code !== Database.ORDER_STATE_CODE.WAIT
          );
          this.orderBook.updateAll(
            memberId,
            instId,
            pendingOrders.concat(orderHistories)
          );
          return new ResponseFormat({
            message: "getOrders",
            payload: this.orderBook.getSnapshot(memberId, instId),
          });
        case SupportedExchange.TIDEBIT:
          orders = await this.getOrdersFromDb({
            ...query,
            memberId,
            instId,
            market,
          });
          this.orderBook.updateAll(memberId, instId, orders);
          return new ResponseFormat({
            message: "getOrders",
            payload: this.orderBook.getSnapshot(memberId, instId),
          });
        default:
          return new ResponseFormat({
            message: "getOrders",
            payload: null,
          });
      }
    }
    return new ResponseFormat({
      message: "getOrders",
      payload: null,
    });
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
    if (!memberId || memberId === -1) {
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
    let result = false,
      order,
      locked,
      balance,
      fee,
      updateOrder,
      currencyId,
      account,
      updateAccount,
      createdAt = new Date().toISOString();
    try {
      order = await this.database.getOrder(orderId, {
        dbTransaction: transacion,
      });
      if (order && order.state !== Database.ORDER_STATE_CODE.CANCEL) {
        currencyId =
          order?.type === Database.TYPE.ORDER_ASK ? order?.ask : order?.bid;
        account = await this.database.getAccountByMemberIdCurrency(
          memberId,
          currencyId,
          { dbTransaction: transacion }
        );
        locked = SafeMath.mult(order.locked, "-1");
        balance = order.locked;
        fee = "0";
        if (account) {
          const newOrder = {
            id: orderId,
            state: Database.ORDER_STATE_CODE.CANCEL,
          };
          await this.database.updateOrder(newOrder, {
            dbTransaction: transacion,
          });
          await this._updateAccount({
            account,
            dbTransaction: transacion,
            balance,
            locked,
            fee,
            modifiableType: Database.MODIFIABLE_TYPE.ORDER,
            modifiableId: orderId,
            createdAt,
            fun: Database.FUNC.UNLOCK_FUNDS,
            reason: Database.REASON.ORDER_CANCEL,
          });
          updateOrder = {
            ...orderData,
            state: Database.ORDER_STATE.CANCEL,
            state_text: Database.ORDER_STATE_TEXT.CANCEL,
            at: parseInt(SafeMath.div(Date.now(), "1000")),
            ts: Date.now(),
          };
          this._emitUpdateOrder({
            memberId,
            instId: updateOrder.instId,
            market: updateOrder.market,
            order: updateOrder,
          });
          updateAccount = {
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
          this._emitUpdateAccount({ memberId, account: updateAccount });
          result = true;
        }
      }
    } catch (error) {
      this.logger.error(
        `[${this.constructor.name} updateOrderStatus] error`,
        error
      );
    }
    return result;
    /* !!! HIGH RISK (end) !!! */
  }
  // ++ TODO: fix multi return
  async postCancelOrder({ header, params, query, body, memberId }) {
    const source = this._findSource(body.instId);
    // const t = await this.database.transaction();
    try {
      // 1. get orderId from body.clOrdId
      // let { orderId } =
      //   source === SupportedExchange.OKEX
      //     ? Utils.parseClOrdId(body.clOrdId)
      //     : { orderId: body.id };
      let orderId = body.id;
      switch (source) {
        case SupportedExchange.OKEX:
          /* !!! HIGH RISK (start) !!! */
          let result,
            response,
            transacion = await this.database.transaction();

          result = await this.updateOrderStatus({
            transacion,
            orderId,
            memberId,
            orderData: body,
          });
          if (result) {
            /* !!! HIGH RISK (end) !!! */
            response = await this.okexConnector.router("postCancelOrder", {
              params,
              query,
              body,
            });
            this.logger.log(`postCancelOrder`, body);
            this.logger.log(`okexCancelOrderRes`, response);
            if (!response.success) {
              await transacion.rollback();
            } else {
              await transacion.commit();
            }
          } else {
            await transacion.rollback();
            response = new ResponseFormat({
              message: "DB ERROR",
              code: Codes.CANCEL_ORDER_FAIL,
            });
          }
          return response;
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
            // state: Database.ORDER_STATE_CODE.WAIT,
            // orderType: Database.ORD_TYPE.LIMIT,
          });

          const orders = _orders
            .filter(
              (_order) =>
                body.type === Database.ORDER_KIND.ALL ||
                (body.type === Database.ORDER_KIND.ASK &&
                  _order.type === Database.TYPE.ORDER_ASK) ||
                (body.type === Database.ORDER_KIND.BID &&
                  _order.type === Database.TYPE.ORDER_BID)
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
        /* !!! HIGH RISK (end) !!! */
        case SupportedExchange.TIDEBIT:
          let functionName =
            body.type === Database.ORDER_KIND.ASK
              ? "cancelAllAsks"
              : body.type === Database.ORDER_KIND.BID
              ? "cancelAllBids"
              : body.type === Database.ORDER_KIND.ALL
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
      case SupportedExchange.OKEX:
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

  async getOptions({ query, memberId, email, token }) {
    this.logger.debug(`*********** [${this.name}] getOptions ************`);
    this.logger.debug(
      `[${this.constructor.name}] getOptions`,
      this.config.websocket.domain
    );
    this.logger.debug(
      `[${this.constructor.name}] memberId`,
      memberId,
      `email`,
      email
    );
    return Promise.resolve(
      new ResponseFormat({
        message: "getOptions",
        payload: {
          wsUrl: this.config.websocket.domain,
          memberId: memberId,
          email: email,
          // peatioSession: token,
        },
      })
    );
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
      if (order.state !== Database.ORDER_STATE_CODE.WAIT) {
        await t.rollback();
        this.logger.error(`[${this.constructor.name}], order has been closed`);
      }
      const currencyId =
        order.type === Database.TYPE.ORDER_ASK ? order.ask : order.bid;
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

      let orderState = Database.ORDER_STATE_CODE.WAIT;
      if (state === Database.ORDER_STATE.FILLED) {
        orderState = Database.ORDER_STATE_CODE.DONE;
      }

      const lockedA =
        side === Database.ORDER_SIDE.SELL ? SafeMath.mult(fillSz, "-1") : "0";
      const totalFee = SafeMath.abs(fee);
      const feeA =
        side === Database.ORDER_SIDE.BUY
          ? await this._calculateFee(
              orderId,
              Database.ORDER_KIND.ASK,
              totalFee,
              t
            )
          : "0";
      const balanceA =
        side === Database.ORDER_SIDE.BUY ? SafeMath.minus(fillSz, feeA) : "0";

      const value = SafeMath.mult(fillPx, fillSz);
      const lockedB =
        side === Database.ORDER_SIDE.BUY ? SafeMath.mult(value, "-1") : "0";
      const feeB =
        side === Database.ORDER_SIDE.SELL
          ? await this._calculateFee(
              orderId,
              Database.ORDER_KIND.BID,
              totalFee,
              t
            )
          : "0";
      const balanceB =
        side === Database.ORDER_SIDE.SELL ? SafeMath.minus(value, feeB) : "0";

      const newOrderVolume = SafeMath.minus(order.origin_volume, accFillSz);
      const newOrderLocked = SafeMath.plus(
        order.locked,
        side === Database.ORDER_SIDE.BUY ? lockedB : lockedA
      );
      const newFundReceive = side === Database.ORDER_SIDE.BUY ? fillSz : value;

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
        order.type === Database.TYPE.ORDER_ASK
          ? Database.ORDER_KIND.ASK
          : Database.ORDER_KIND.BID,
        order.type === Database.TYPE.ORDER_ASK ? feeB : "0", // get bid, so fee is bid
        order.type === Database.TYPE.ORDER_ASK ? "0" : feeA, // get ask, so fee is ask
        created_at,
        { dbTransaction: t }
      );

      await this.database.updateOrder(newOrder, { dbTransaction: t });

      const _updateOrder = {
        id: ordId,
        at: parseInt(SafeMath.div(uTime, "1000")),
        ts: parseInt(uTime),
        market: instId.replace("-", "").toLowerCase(),
        kind:
          side === Database.ORDER_SIDE.BUY
            ? Database.ORDER_KIND.BID
            : Database.ORDER_KIND.ASK,
        price: null, // market prcie
        origin_volume: sz,
        clOrdId: clOrdId,
        state:
          state === Database.ORDER_STATE.CANCEL
            ? Database.ORDER_STATE.CANCEL
            : state === Database.ORDER_STATE.FILLED
            ? Database.ORDER_STATE.DONE
            : Database.ORDER_STATE.WAIT,
        state_text:
          state === Database.ORDER_STATE.CANCEL
            ? Database.ORDER_STATE_TEXT.CANCEL
            : state === Database.ORDER_STATE.FILLED
            ? Database.ORDER_STATE_TEXT.DONE
            : Database.ORDER_STATE_TEXT.WAIT,
        volume: SafeMath.minus(sz, fillSz),
        instId: instId,
        ordType: ordType,
        filled: state === Database.ORDER_STATE.FILLED,
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
      await this._updateAccount({
        account: accountAsk,
        dbTransaction: t,
        balance: balanceA,
        locked: lockedA,
        fee: feeA,
        modifiableType: Database.MODIFIABLE_TYPE.TRADE,
        modifiableId: tradeId,
        createdAt: created_at,
        fun:
          order.type === Database.TYPE.ORDER_ASK
            ? Database.FUNC.UNLOCK_AND_SUB_FUNDS
            : Database.FUNC.PLUS_FUNDS,
      });
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
      await this._updateAccount({
        account: accountBid,
        dbTransaction: t,
        balance: balanceB,
        locked: lockedB,
        fee: feeB,
        modifiableType: Database.MODIFIABLE_TYPE.TRADE,
        modifiableId: tradeId,
        createdAt: created_at,
        fun:
          order.type === Database.TYPE.ORDER_ASK
            ? Database.FUNC.PLUS_FUNDS
            : Database.FUNC.UNLOCK_AND_SUB_FUNDS,
      });
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
        orderState === Database.ORDER_STATE_CODE.DONE &&
        SafeMath.gt(newOrderLocked, "0")
      ) {
        if (order.type === Database.TYPE.ORDER_ASK) {
          // ++ TODO reference step6 trade.id
          await this._updateAccount({
            account: accountAsk,
            dbTransaction: t,
            balance: changeLocked,
            locked: changeBalance,
            fee: 0,
            modifiableType: Database.MODIFIABLE_TYPE.TRADE,
            modifiableId: tradeId,
            createdAt: created_at,
            fun: Database.FUNC.UNLOCK_FUNDS,
          });
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
        } else if (order.type === Database.TYPE.ORDER_BID) {
          // ++ TODO reference step6 trade.id
          await this._updateAccount({
            account: accountBid,
            dbTransaction: t,
            balance: changeLocked,
            locked: changeBalance,
            fee: 0,
            modifiableType: Database.MODIFIABLE_TYPE.TRADE,
            modifiableId: tradeId,
            createdAt: created_at,
            fun: Database.FUNC.UNLOCK_FUNDS,
          });
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

  async _getPlaceOrderData(memberId, body) {
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
    const type =
      body.kind === Database.ORDER_KIND.BID
        ? Database.TYPE.ORDER_BID
        : Database.TYPE.ORDER_ASK;
    const ordType =
      body.ordType === Database.ORD_TYPE.MARKET
        ? Database.ORD_TYPE.IOC
        : body.ordType;
    const price =
      ordType === Database.ORD_TYPE.IOC
        ? type === Database.TYPE.ORDER_BID
          ? body.price
            ? (parseFloat(body.price) * 1.1).toString()
            : null
          : body.price
          ? (parseFloat(body.price) * 0.9).toString()
          : null
        : body.price || null;
    const locked =
      type === Database.TYPE.ORDER_BID
        ? SafeMath.mult(price, body.volume)
        : body.volume;
    const balance = SafeMath.mult(locked, "-1"); // balanceDiff
    const createdAt = new Date().toISOString();
    const orderData = {
      bid,
      ask,
      currency,
      price,
      volume: body.volume,
      originVolume: body.volume,
      state: Database.ORDER_STATE_CODE.WAIT,
      doneAt: null,
      type,
      memberId,
      createdAt,
      updatedAt: createdAt,
      sn: null,
      source: "Web",
      ordType,
      locked,
      originLocked: locked,
      fundsReceived: 0,
      tradesCount: 0,
      balance,
    };
    return orderData;
  }

  async _updateAccount({
    account,
    reason,
    dbTransaction,
    balance,
    locked,
    fee,
    modifiableType,
    modifiableId,
    createdAt,
    fun,
  }) {
    /* !!! HIGH RISK (start) !!! */
    const updatedAt = createdAt;
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
      reason,
      // Database.REASON.ORDER_CANCEL,
      balance,
      locked,
      fee,
      amount,
      modifiableId,
      modifiableType,
      createdAt,
      updatedAt,
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
          case Database.ORDER_KIND.ASK:
            totalVfee = SafeMath.plus(totalVfee, voucher.ask_fee);
            break;
          case Database.ORDER_KIND.BID:
            totalVfee = SafeMath.plus(totalVfee, voucher.bid_fee);
            break;
          default:
        }
      }
    }
    return SafeMath.minus(totalFee, totalVfee);
  }
  /**
   *
   * @param {String} memberId
   * @param {String} instId
   * @param {String} market ex: ethusdt
   * @param {Object} order
   */
  _emitUpdateOrder({ memberId, instId, market, order }) {
    this.logger.log(`_emitUpdateOrder difference`, order);
    this.orderBook.updateByDifference(memberId, instId, {
      add: [order],
    });
    EventBus.emit(Events.order, memberId, market, {
      market: market,
      difference: this.orderBook.getDifference(memberId, instId),
    });
    this.logger.log(
      `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.order}] _emitUpdateOrder[market:${market}][memberId:${memberId}][instId:${instId}]`,
      this.orderBook.getDifference(memberId, instId)
    );
  }
  /**
   *
   * @param {String} memberId
   * @param {String} instId
   * @param {String} market ex: ethusdt
   * @param {Object} order
   */
  _emitUpdateMarketOrder({ memberId, instId, market, order }) {
    this.orderBook.updateByDifference(memberId, instId, {
      add: [order],
    });
    EventBus.emit(Events.marketOrder, memberId, market, {
      market: market,
      difference: this.orderBook.getDifference(memberId, instId),
    });
    this.logger.log(`difference`, order);
    this.logger.log(
      `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.marketOrder}] _emitUpdateMarketOrder[market:${market}][memberId:${memberId}][instId:${instId}]`,
      this.orderBook.getDifference(memberId, instId)
    );
  }

  _emitNewTrade({ memberId, instId, market, trade }) {
    this.tradeBook.updateByDifference(instId, 0, [
      {
        ...trade,
        ts: trade.ts || parseInt(SafeMath.mult(trade.at, "1000")),
      },
    ]);
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

    EventBus.on(Events.candleOnUpdate, (market, trade) => {
      this.broadcast(market, {
        type: Events.candleOnUpdate,
        data: trade,
      });
    });

    EventBus.on(Events.tickers, (updateTickers) => {
      this.broadcastAllClient({
        type: Events.tickers,
        data: updateTickers,
      });
    });

    EventBus.on(Events.orderDetailUpdate, async (instType, formatOrders) => {
      if (instType === Database.INST_TYPE.SPOT) {
        this.logger.log(
          ` ------------- [${this.constructor.name}] EventBus.on(Events.orderDetailUpdate [START]---------------`
        );
        // TODO: using message queue
        for (const formatOrder of formatOrders) {
          if (
            formatOrder.state !==
              Database.ORDER_STATE.CANCEL /* cancel order */ &&
            formatOrder.accFillSz !== "0" /* create order */
          ) {
            // await this._updateOrderDetail(formatOrder);
            await this.exchangeHubService.sync(
              SupportedExchange.OKEX,
              formatOrder,
              true
            );
          } else if (formatOrder.state === Database.ORDER_STATE.CANCEL) {
            let result,
              orderId,
              memberId,
              transacion = await this.database.transaction();
            try {
              let parsedClOrdId = Utils.parseClOrdId(formatOrder.clOrdId);
              orderId = parsedClOrdId.orderId;
              memberId = parsedClOrdId.memberId;
            } catch (e) {
              this.logger.error(`ignore`);
            }
            if (orderId && memberId) {
              result = await this.updateOrderStatus({
                transacion,
                orderId,
                memberId,
                orderData: {
                  ...formatOrder,
                  id: orderId,
                  at: parseInt(SafeMath.div(formatOrder.uTime, "1000")),
                  ts: formatOrder.uTime,
                  market: formatOrder.instId.replace("-", "").toLowerCase(),
                  kind: Database.ORDER_SIDE.BUY
                    ? Database.ORDER_KIND.BID
                    : Database.ORDER_KIND.ASK,
                  price: formatOrder.px,
                  origin_volume: formatOrder.sz,
                  state: Database.ORDER_STATE.CANCEL,
                  state_text: Database.ORDER_STATE_TEXT.CANCEL,
                  volume: SafeMath.minus(formatOrder.sz, formatOrder.fillSz),
                },
              });
              if (result) {
                await transacion.commit();
              } else {
                await transacion.rollback();
              }
            }
          }
        }
        this.logger.log(
          ` ------------- [${this.constructor.name}] EventBus.on(Events.orderDetailUpdate [END]---------------`
        );
      }
    });
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
