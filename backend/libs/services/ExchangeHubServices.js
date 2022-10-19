const Database = require("../../constants/Database");
const SupportedExchange = require("../../constants/SupportedExchange");
const SafeMath = require("../SafeMath");
const Utils = require("../Utils");

class ExchangeHubService {
  _timer;
  _lastSyncTime = 0;
  _syncInterval = 0.5 * 60 * 60 * 1000; // 30 mins
  _minInterval = 1 * 24 * 60 * 60 * 1000; // 1天
  _interval = 3 * 24 * 60 * 60 * 1000; // 3天
  _maxInterval = 365 * 24 * 60 * 60 * 1000; // 93天 okex 最長只能問到3個月
  _isStarted = false;

  constructor({
    database,
    // connectors,
    systemMemberId,
    okexConnector,
    tidebitMarkets,
    emitUpdateData,
    processor,
    logger,
  }) {
    this.database = database;
    // this.connectors = connectors;
    this.systemMemberId = systemMemberId;
    this.tidebitMarkets = tidebitMarkets;
    this.okexConnector = okexConnector;
    this.logger = logger;
    this.name = "ExchangeHubService";
    this.emitUpdateData = emitUpdateData;
    this.processor = processor;
    return this;
  }

  /**
   * ++TODO gc，#674
   * 每筆 outerTrade 只保留180天
   * outerTrade不能抓180天以前的資料
   * !!! 目前外部交易所收取的手續費只有記錄在 outer_trades 的 data 欄位，
   * 做 GC的時候要先有地方記錄外部交易所收取的手續費 !!!
   * */
  async garbageCollection(outerTrades) {
    for (let trade of outerTrades) {
      const date = new Date(trade.update_at);
      const timestamp = date.getTime();
      if (timestamp > this._maxInterval && parseInt(trade.status) === 1) {
        const t = await this.database.transaction();
        try {
          await this.database.deleteOuterTrade(trade, { dbTransaction: t });
          await t.commit();
        } catch (error) {
          this.logger.error(`deleteOuterTrade`, error);
          await t.rollback();
        }
      }
    }
  }

  // async start() {
  //   this.logger.debug(`[${this.constructor.name}] start`);
  //   await this.sync();
  // }

  async sync({
    exchange = SupportedExchange.OKEX,
    data,
    interval = this._interval,
    force = false,
  }) {
    this.logger.debug(
      `------------- [${this.constructor.name}] sync -------------`
    );
    this.logger.debug(`data`, data);
    let time = Date.now(),
      // updateData,
      // result,
      clOrdId = data?.clOrdId;
    // 1. 定期（10mins）執行工作
    if (
      time - this._lastSyncTime > this._syncInterval ||
      force ||
      !this._isStarted
    ) {
      // 2. 從 API 取 outerTrades 並寫入 DB
      const outerTrades = await this._syncOuterTrades(
        exchange,
        interval,
        clOrdId
      );

      this._lastSyncTime = Date.now();
      // 3. 觸發從 DB 取 outertradesrecord 更新下列 DB table trades、orders、accounts、accounts_version、vouchers
      await this._processOuterTrades(outerTrades);

      // 4. 通知前端
      // this.emitUpdateData(updateData);
      // 5. 休息
      clearTimeout(this.timer);
      this.timer = setTimeout(
        () => this.sync({ exchange, interval: this._syncInterval }),
        this._syncInterval + 1000
      );
    }
    this.logger.debug(
      `------------- [${this.constructor.name}] sync [END] -------------`
    );
  }

  // ++ TODO
  async _updateOuterTradeStatus({
    order_id,
    trade_id,
    voucher_id,
    create_at,
    order_price,
    order_origin_volume,
    member_id,
    member_tag,
    email,
    id,
    status,
    update_at,
    dbTransaction,
  }) {
    this.logger.debug(
      `------------- [${this.constructor.name}] _updateOuterTradeStatus -------------`
    );
    this.logger.debug("data", {
      order_id,
      trade_id,
      voucher_id,
      create_at,
      order_price,
      order_origin_volume,
      member_id,
      member_tag,
      email,
      id,
      status,
      update_at,
      // dbTransaction,
    });
    try {
      switch (status) {
        case Database.OUTERTRADE_STATUS.ClORDId_ERROR:
          await this.database.updateOuterTrade(
            { id, status, create_at, update_at, order_id: 0 },
            { dbTransaction }
          );
          break;
        case Database.OUTERTRADE_STATUS.OTHER_SYSTEM_TRADE:
          await this.database.updateOuterTrade(
            { id, status, create_at, update_at, order_id, member_id },
            { dbTransaction }
          );
          break;
        case Database.OUTERTRADE_STATUS.DONE:
          await this.database.updateOuterTrade(
            {
              id,
              status,
              create_at,
              update_at,
              order_id,
              order_price,
              order_origin_volume,
              member_id,
              member_tag,
              email,
              trade_id,
              voucher_id,
            },
            { dbTransaction }
          );
          break;

        default:
      }
    } catch (error) {
      throw error;
    }
    this.logger.debug(
      `------------- [${this.constructor.name}] _updateOuterTradeStatus  [END]-------------`
    );
  }
  // ++ TODO 放到 ExchangeHub 裡面
  // 修改 只能有 difference 不能直接給修改值
  // 應該由這個 function走
  async _updateAccountsRecord({
    account,
    accBalDiff,
    accBal,
    accLocDiff,
    accLoc,
    reason,
    fee,
    modifiableId,
    updateAt,
    fun,
    dbTransaction,
  }) {
    try {
      /* !!! HIGH RISK (start) !!! */
      const amount = SafeMath.plus(accBal, accLoc);
      await this.database.insertAccountVersion(
        account.member_id,
        account.id,
        reason,
        accBalDiff,
        accLocDiff,
        fee,
        amount,
        modifiableId,
        Database.MODIFIABLE_TYPE.TRADE,
        updateAt,
        updateAt,
        account.currency,
        fun,
        { dbTransaction }
      );
      // ++TODO check updateAt
      const updateAccount = {
        id: account.id,
        balance: accBal,
        locked: accLoc,
        updated_at: `"${updateAt.slice(0, 19).replace("T", " ")}"`,
      };
      await this.database.updateAccount(updateAccount, { dbTransaction });
      /* !!! HIGH RISK (end) !!! */
    } catch (error) {
      this.logger.error(`_updateAccountsRecord`, error);
      throw error;
    }
  }

  async _updateAccByAskTrade({
    memberId,
    order,
    askCurr,
    bidCurr,
    askFeeRate,
    trade,
    market,
    dbTransaction,
  }) {
    // ex => ask:eth sell ask:eth => bid:usdt 增加 - (feeCcy bid:usdt) , decrease partial/all locked ask:eth
    this.logger.debug(
      `------------- [${this.constructor.name}] _updateAccByAskTrade -------------`
    );
    let askAccBalDiff,
      _askAccBalDiff,
      askAccBal,
      askLocDiff,
      _askLocDiff,
      askLoc,
      bidAccBalDiff,
      bidAccBal,
      bidLocDiff,
      bidLoc,
      updateAskAccount,
      updateBidAccount;
    try {
      /** !!! HIGH RISK (start) !!!
       * 1. get askAccount from table
       * 2. get bidAccount from table
       * 3. calculate askAccount balance change
       * 3.1 askAccount: balanceDiff = 0
       * 3.2 askAccount: balance = SafeMath.plus(askAccount.balance, balanceDiff)
       * 3.3 askAccount: lockedDiff = SafeMath.mult(fillSz, "-1")
       * 3.4 askAccount: locked = SafeMath.plus(askAccount.locked, lockedDiff),
       * 3.5 update accountBook
       * 3.6 update DB
       * 4. calculate bidAccount balance change
       * 4.1 bidAccount: balanceDiff = SafeMath.minus(SafeMath.mult(trade.fillPx, trade.fillSz), SafeMath.mult(SafeMath.mult(trade.fillPx, trade.fillSz), askFeeRate))
       * 4.2 bidAccount: balance = SafeMath.plus(bidAccount.balance, balanceDiff)
       * 4.3 bidAccount: lockedDiff  = 0
       * 4.4 bidAccount: locked = SafeMath.plus(bidAccount.locked, lockedDiff),
       * 4.5 update accountBook
       * 4.6 update DB
       */
      // 1. get askAccount from table
      const askAccount = await this.database.getAccountsByMemberId(memberId, {
        options: { currency: askCurr },
        limit: 1,
        dbTransaction,
      });
      // 2. get bidAccount from table
      const bidAccount = await this.database.getAccountsByMemberId(memberId, {
        options: { currency: bidCurr },
        limit: 1,
        dbTransaction,
      });
      // 3. calculate askAccount balance change
      // 3.1 askAccount: balanceDiff = 0
      askAccBalDiff = 0;
      // 3.2 askAccount: balance = SafeMath.plus(askAccount.balance, balanceDiff)
      askAccBal = SafeMath.plus(askAccount.balance, askAccBalDiff);
      // 3.3 askAccount: lockedDiff = SafeMath.mult(fillSz, "-1")
      askLocDiff = SafeMath.mult(trade.fillSz, "-1");
      // 3.4 askAccount: locked = SafeMath.plus(askAccount.locked, lockedDiff),
      askLoc = SafeMath.plus(askAccount.locked, askLocDiff);
      // ++ TODO 3.5 update accountBook
      updateAskAccount = {
        balance: askAccBal,
        locked: askLoc,
        currency: market.ask.currency.toUpperCase(),
        total: SafeMath.plus(askAccBal, askLoc),
      };
      // 3.6 update DB
      this.logger.debug(`askAccount`, askAccount);
      this.logger.debug(`askAccBalDiff`, askAccBalDiff);
      this.logger.debug(`askAccBal`, askAccBal);
      this.logger.debug(`askLocDiff`, askLocDiff);
      this.logger.debug(`askLoc`, askLoc);
      this.logger.debug(`askFee`, 0);
      this.logger.debug(`modifiableId`, trade.tradeId);
      this.logger.debug(`updateAt`, new Date(parseInt(trade.ts)).toISOString());
      await this._updateAccountsRecord({
        account: askAccount,
        accBalDiff: askAccBalDiff,
        accBal: askAccBal,
        accLocDiff: askLocDiff,
        accLoc: askLoc,
        reason: Database.REASON.STRIKE_SUB,
        fee: 0,
        modifiableId: trade.id,
        updateAt: new Date(parseInt(trade.ts)).toISOString(),
        fun: Database.FUNC.UNLOCK_AND_SUB_FUNDS,
        dbTransaction,
      });
      if (
        order.state_code === Database.ORDER_STATE_CODE.CANCEL &&
        order.volume > 0
      ) {
        _askAccBalDiff = order.volume;
        askAccBal = SafeMath.plus(askAccBal, _askAccBalDiff);
        _askLocDiff = SafeMath.mult(_askAccBalDiff, "-1");
        askLoc = SafeMath.plus(askLoc, _askLocDiff);
        await this._updateAccountsRecord({
          account: askAccount,
          accBalDiff: _askAccBalDiff,
          accBal: askAccBal,
          accLocDiff: _askLocDiff,
          accLoc: askLoc,
          reason: Database.REASON.ORDER_CANCEL,
          fee: 0,
          modifiableId: trade.id,
          updateAt: new Date(parseInt(trade.ts)).toISOString(),
          fun: Database.FUNC.UNLOCK_FUNDS,
          dbTransaction,
        });
      }
      // 4. calculate bidAccount balance change
      // 4.1 bidAccount: balanceDiff = SafeMath.minus(SafeMath.mult(trade.fillPx, trade.fillSz), trade.fee)
      bidAccBalDiff = SafeMath.minus(
        SafeMath.mult(trade.fillPx, trade.fillSz),
        SafeMath.mult(SafeMath.mult(trade.fillPx, trade.fillSz), askFeeRate)
      );
      // 4.2 bidAccount: balance = SafeMath.plus(bidAccount.balance, balanceDiff)
      bidAccBal = SafeMath.plus(bidAccount.balance, bidAccBalDiff);
      // 4.3 bidAccount: lockedDiff  = 0
      bidLocDiff = 0;
      // 4.4 bidAccount: locked = SafeMath.plus(bidAccount.locked, lockedDiff),
      bidLoc = SafeMath.plus(bidAccount.locked, bidLocDiff);
      // ++ TODO 4.5 update accountBook
      updateBidAccount = {
        balance: bidAccBal,
        locked: bidLoc,
        currency: market.bid.currency.toUpperCase(),
        total: SafeMath.plus(bidAccBal, bidLoc),
      };
      // 4.6 update DB
      this.logger.debug(`bidAccount`, bidAccount);
      this.logger.debug(`bidAccBalDiff`, bidAccBalDiff);
      this.logger.debug(`bidAccBal`, bidAccBal);
      this.logger.debug(`bidLocDiff`, bidLocDiff);
      this.logger.debug(`bidLoc`, bidLoc);
      this.logger.debug(
        `bidFee`,
        SafeMath.mult(SafeMath.mult(trade.fillPx, trade.fillSz), askFeeRate)
      );
      this.logger.debug(`modifiableId`, trade.tradeId);
      this.logger.debug(`updateAt`, new Date(parseInt(trade.ts)).toISOString());
      await this._updateAccountsRecord({
        account: bidAccount,
        accBalDiff: bidAccBalDiff,
        accBal: bidAccBal,
        accLocDiff: bidLocDiff,
        accLoc: bidLoc,
        reason: Database.REASON.STRIKE_ADD,
        fee: SafeMath.mult(
          SafeMath.mult(trade.fillPx, trade.fillSz),
          askFeeRate
        ),
        modifiableId: trade.id,
        updateAt: new Date(parseInt(trade.ts)).toISOString(),
        fun: Database.FUNC.PLUS_FUNDS,
        dbTransaction,
      });
    } catch (error) {
      this.logger.error(`_updateAccByAskTrade`, error);
      throw error;
    }
    this.logger.debug(`for [FRONTEND] updateAskAccount`, updateAskAccount);
    this.logger.debug(`for [FRONTEND] updateBidAccount`, updateBidAccount);
    this.logger.debug(
      `------------- [${this.constructor.name}] _updateAccByAskTrade [END]-------------`
    );
    return { updateAskAccount, updateBidAccount };
  }

  async _updateAccByBidTrade({
    memberId,
    bidFeeRate,
    askCurr,
    bidCurr,
    order,
    market,
    trade,
    dbTransaction,
  }) {
    this.logger.debug(
      `------------- [${this.constructor.name}] _updateAccByBidTrade -------------`
    );
    // ex => bid:usdt buy ask:eth => decrease partial/all locked bid:usdt , ask:eth - (feeCcy ask:eth)增加
    let askAccBalDiff,
      askAccBal,
      askLocDiff,
      askLoc,
      bidAccBalDiff,
      bidAccBal,
      bidLocDiff,
      bidLoc,
      _bidAccBalDiff,
      _bidLocDiff,
      updateAskAccount,
      updateBidAccount;
    try {
      /**
       * !!! HIGH RISK (start) !!!
       * 1. get askAccount from table
       * 2. get bidAccount from table
       * 3. calculate askAccount balance change
       * 3.1 askAccount: SafeMath.minus(trade.fillSz, SafeMath.mult(trade.fillSz, bidFeeRate));
       * 3.2 askAccount: balance = SafeMath.plus(askAccount.balance, balanceDiff)
       * 3.3 askAccount: lockedDiff = 0;
       * 3.4 askAccount: locked = SafeMath.plus(askAccount.locked, lockedDiff),
       * 3.5 update accountBook
       * 3.6 update DB
       * 4. calculate bidAccount balance change
       * 4.1 bidAccount: balanceDiff = 0
       * 4.2 bidAccount: balance = SafeMath.plus(bidAccount.balance, balanceDiff)
       * 4.3 bidAccount: lockedDiff  = SafeMath.mult(SafeMath.mult(trade.fillPx, trade.fillSz), "-1");
       * 4.4 bidAccount: locked = SafeMath.plus(bidAccount.locked, lockedDiff),
       * 4.5 update DB
       * 4.6 update accountBook
       * -----
       */
      // 1. get askAccount from table
      const askAccount = await this.database.getAccountsByMemberId(memberId, {
        options: { currency: askCurr },
        limit: 1,
        dbTransaction,
      });
      // 2. get bidAccount from table
      const bidAccount = await this.database.getAccountsByMemberId(memberId, {
        options: { currency: bidCurr },
        limit: 1,
        dbTransaction,
      });
      // 3. calculate askAccount balance change
      // 3.1 askAccount: SafeMath.plus(trade.fillSz, trade.fee);
      askAccBalDiff = SafeMath.minus(
        trade.fillSz,
        SafeMath.mult(trade.fillSz, bidFeeRate)
      );
      // 3.2 askAccount: balance = SafeMath.plus(askAccount.balance, balanceDiff)
      askAccBal = SafeMath.plus(askAccount.balance, askAccBalDiff);
      // 3.3 askAccount: lockedDiff = 0
      askLocDiff = 0;
      // 3.4 askAccount: locked = SafeMath.plus(askAccount.locked, lockedDiff),
      askLoc = SafeMath.plus(askAccount.locked, askLocDiff);
      // ++ TODO 3.5 update accountBook
      updateAskAccount = {
        balance: askAccBal,
        locked: askLoc,
        currency: market.ask.currency.toUpperCase(),
        total: SafeMath.plus(askAccBal, askLoc),
      };
      // 3.6 update DB
      this.logger.debug(`askAccount`, askAccount);
      this.logger.debug(`askAccBalDiff`, askAccBalDiff);
      this.logger.debug(`askAccBal`, askAccBal);
      this.logger.debug(`askLocDiff`, askLocDiff);
      this.logger.debug(`askLoc`, askLoc);
      this.logger.debug(`askFee`, SafeMath.abs(trade.fee));
      this.logger.debug(`modifiableId`, trade.tradeId);
      this.logger.debug(`updateAt`, new Date(parseInt(trade.ts)).toISOString());
      await this._updateAccountsRecord({
        account: askAccount,
        accBalDiff: askAccBalDiff,
        accBal: askAccBal,
        accLocDiff: askLocDiff,
        accLoc: askLoc,
        reason: Database.REASON.STRIKE_ADD,
        fee: SafeMath.mult(trade.fillSz, bidFeeRate),
        modifiableId: trade.id,
        updateAt: new Date(parseInt(trade.ts)).toISOString(),
        fun: Database.FUNC.PLUS_FUNDS,
        dbTransaction,
      });
      // 4. calculate bidAccount balance change
      // 4.1 bidAccount: lockedDiff  = SafeMath.mult(SafeMath.mult(trade.fillPx, trade.fillSz), "-1");
      bidLocDiff = SafeMath.mult(
        SafeMath.mult(trade.fillPx, trade.fillSz),
        "-1"
      );
      // 4.2 bidAccount: locked = SafeMath.plus(bidAccount.locked, lockedDiff),
      // ++ TODO if bidLoc < 0 ,!!! alert , systemError send email to all admins
      bidLoc = SafeMath.plus(bidAccount.locked, bidLocDiff);
      // 4.3 bidAccount: balanceDiff = 0;
      bidAccBalDiff = 0;
      // 4.4 bidAccount: balance = SafeMath.plus(bidAccount.balance, balanceDiff)
      bidAccBal = SafeMath.plus(bidAccount.balance, bidAccBalDiff);
      // 4.5 update DB
      this.logger.debug(`bidAccount`, bidAccount);
      this.logger.debug(`bidAccBalDiff`, bidAccBalDiff);
      this.logger.debug(`bidAccBal`, bidAccBal);
      this.logger.debug(`bidLocDiff`, bidLocDiff);
      this.logger.debug(`bidLoc`, bidLoc);
      this.logger.debug(`bidFee`, 0);
      this.logger.debug(`modifiableId`, trade.tradeId);
      this.logger.debug(`updateAt`, new Date(parseInt(trade.ts)).toISOString());
      await this._updateAccountsRecord({
        account: bidAccount,
        accBalDiff: bidAccBalDiff,
        accBal: bidAccBal,
        accLocDiff: bidLocDiff,
        accLoc: bidLoc,
        reason: Database.REASON.STRIKE_SUB,
        fee: 0,
        modifiableId: trade.id,
        updateAt: new Date(parseInt(trade.ts)).toISOString(),
        fun: Database.FUNC.UNLOCK_AND_SUB_FUNDS,
        dbTransaction,
      });
      this.logger.debug(`order.state_code`, order.state_code);
      this.logger.debug(
        `order.price[${order.price}] > trade.fillPx[${trade.fillPx}]`,
        order.price > trade.fillPx
      );
      this.logger.debug(
        `trade.fillSz[${trade.fillSz}] === order.volume[${order.volume}]]`,
        trade.fillSz === order.volume
      );
      if (
        order.state_code === Database.ORDER_STATE_CODE.DONE &&
        SafeMath.gt(order.locked, 0)
      ) {
        _bidAccBalDiff = order.locked;
        bidAccBal = SafeMath.plus(bidAccBal, _bidAccBalDiff);
        _bidLocDiff = SafeMath.mult(_bidAccBalDiff, "-1");
        bidLoc = SafeMath.plus(bidLoc, _bidLocDiff);
        await this._updateAccountsRecord({
          account: bidAccount,
          accBalDiff: _bidAccBalDiff,
          accBal: bidAccBal,
          accLocDiff: _bidLocDiff,
          accLoc: bidLoc,
          reason: Database.REASON.ORDER_FULLFILLED,
          fee: 0,
          modifiableId: trade.id,
          updateAt: new Date(parseInt(trade.ts)).toISOString(),
          fun: Database.FUNC.UNLOCK_FUNDS,
          dbTransaction,
        });
      }
      if (
        order.state_code === Database.ORDER_STATE_CODE.CANCEL &&
        order.volume > 0
      ) {
        _bidAccBalDiff = SafeMath.mult(order.price, order.volume);
        bidAccBal = SafeMath.plus(bidAccBal, _bidAccBalDiff);
        _bidLocDiff = SafeMath.mult(_bidAccBalDiff, "-1");
        bidLoc = SafeMath.plus(bidLoc, _bidLocDiff);
        await this._updateAccountsRecord({
          account: bidAccount,
          accBalDiff: _bidAccBalDiff,
          accBal: bidAccBal,
          accLocDiff: _bidLocDiff,
          accLoc: bidLoc,
          reason: Database.REASON.ORDER_CANCEL,
          fee: 0,
          modifiableId: trade.id,
          updateAt: new Date(parseInt(trade.ts)).toISOString(),
          fun: Database.FUNC.UNLOCK_FUNDS,
          dbTransaction,
        });
      }
      // ++ TODO 4.6 update accountBook
      updateBidAccount = {
        balance: bidAccBal,
        locked: bidLoc,
        currency: market.bid.currency.toUpperCase(),
        total: SafeMath.plus(bidAccBal, bidLoc),
      };
    } catch (error) {
      this.logger.error(`_updateAccByAskTrade`, error);
      throw error;
    }
    this.logger.debug(`for [FRONTEND] updateAskAccount`, updateAskAccount);
    this.logger.debug(`for [FRONTEND] updateBidAccount`, updateBidAccount);
    this.logger.debug(
      `------------- [${this.constructor.name}] _updateAccByBidTrade [END]-------------`
    );
    return { updateAskAccount, updateBidAccount };
  }

  async _insertVouchers({
    memberId,
    askFeeRate,
    bidFeeRate,
    orderId,
    trade,
    market,
    dbTransaction,
  }) {
    this.logger.debug(
      `------------- [${this.constructor.name}] _insertVouchers -------------`
    );
    this.logger.debug(`insertVouchers trade`, trade);
    /* !!! HIGH RISK (start) !!! */
    // 1. insert Vouchers to DB
    let id,
      voucher,
      tmp = trade.instId.toLowerCase().split("-"),
      askId = tmp[0],
      bidId = tmp[1];
    this.logger.debug(`askId`, askId);
    this.logger.debug(`bidId`, bidId);
    if (!askId || !bidId)
      throw Error(
        `order base_unit[order.ask: ${askId}] or quote_unit[order.bid: ${bidId}] not found`
      );
    /**
     * ++ TODO
     * fee 也要根據用戶的等級來收，#672
     */
    try {
      id = await this.database.insertVouchers(
        memberId,
        orderId, // ++TODO check order_id is trade.clOrdId or orderId
        trade.id,
        null,
        askId,
        bidId,
        trade.fillPx,
        trade.fillSz,
        SafeMath.mult(trade.fillPx, trade.fillSz),
        trade.side === Database.ORDER_SIDE.BUY
          ? Database.ORDER_KIND.BID
          : Database.ORDER_KIND.ASK,
        trade.side === Database.ORDER_SIDE.SELL
          ? SafeMath.mult(SafeMath.mult(trade.fillPx, trade.fillSz), askFeeRate)
          : "0", //ask_fee
        trade.side === Database.ORDER_SIDE.BUY
          ? SafeMath.mult(trade.fillSz, bidFeeRate)
          : "0", //bid_fee
        new Date(parseInt(trade.ts)).toISOString(),
        { dbTransaction }
      );
    } catch (error) {
      this.logger.error(`insertVouchers`, error);
      throw error;
    }
    voucher = {
      id,
      orderId,
      tradeId: trade.id,
      askId,
      bidId,
      price: trade.fillPx,
      volume: trade.fillSz,
      value: SafeMath.mult(trade.fillPx, trade.fillSz),
      kind:
        trade.side === Database.ORDER_SIDE.BUY
          ? Database.ORDER_KIND.BID
          : Database.ORDER_KIND.ASK,
      fee:
        trade.side === Database.ORDER_SIDE.SELL
          ? SafeMath.mult(SafeMath.mult(trade.fillPx, trade.fillSz), askFeeRate)
          : SafeMath.mult(trade.fillSz, bidFeeRate),
      feeCcy: trade.feeCcy,
    };
    this.logger.debug(
      `------------- [${this.constructor.name}] _insertVouchers [END] (id:${id})-------------`
    );
    return voucher;
  }

  async _insertTrades({ memberId, orderId, market, trade, dbTransaction }) {
    this.logger.debug(
      `------------- [${this.constructor.name}] insertTrades -------------`
    );
    /* !!! HIGH RISK (start) !!! */
    // 1. insert Vouchers to DB
    let id, _trade;
    // this.logger.debug(`market`, market);
    if (!market) throw Error(`market not found`);
    _trade = {
      price: trade.fillPx,
      volume: trade.fillSz,
      ask_id: trade.side === Database.ORDER_SIDE.SELL ? orderId : null,
      bid_id: trade.side === Database.ORDER_SIDE.BUY ? orderId : null,
      trend: null,
      currency: market.code,
      created_at: new Date(parseInt(trade.ts)).toISOString(),
      updated_at: new Date(parseInt(trade.ts)).toISOString(),
      ask_member_id:
        trade.side === Database.ORDER_SIDE.SELL
          ? memberId
          : this.systemMemberId,
      bid_member_id:
        trade.side === Database.ORDER_SIDE.BUY ? memberId : this.systemMemberId,
      funds: SafeMath.mult(trade.fillPx, trade.fillSz),
      trade_fk: trade.tradeId,
    };
    try {
      id = await this.database.insertTrades(_trade, { dbTransaction });
    } catch (error) {
      this.logger.error(`insertVouchers`, error);
      throw error;
    }
    _trade = {
      id,
      price: trade.fillPx,
      volume: trade.fillSz,
      market: market.id,
      at: parseInt(SafeMath.div(trade.ts, "1000")),
      ts: trade.ts,
    };
    this.logger.debug(`for [FORNTEND] _updateTrade`, _trade);
    this.logger.debug(
      `------------- [${this.constructor.name}] insertTrades [END] -------------`
    );
    return _trade;
  }

  async _insertTradesRecord({
    memberId,
    askFeeRate,
    bidFeeRate,
    orderId,
    market,
    trade,
    dbTransaction,
  }) {
    let insertTradesResult, insertVouchersResult, newTrade, voucher, _trade;
    this.logger.debug(
      `------------- [${this.constructor.name}] _insertTradesRecord -------------`
    );
    /* !!! HIGH RISK (start) !!! */
    try {
      // 1. get _trade By trade_fk
      _trade = await this.database.getTradeByTradeFk(trade.tradeId);
      this.logger.debug(`_trade`, _trade);
      // 2. if _trade is not exist
      if (!_trade) {
        // 3. insert trade to DB
        insertTradesResult = await this._insertTrades({
          memberId,
          orderId,
          trade,
          market,
          dbTransaction,
        });
        newTrade = insertTradesResult;
        // 3. insert voucher to DB
        insertVouchersResult = await this._insertVouchers({
          memberId,
          askFeeRate,
          bidFeeRate,
          orderId,
          trade: { ...trade, id: insertTradesResult.id },
          market,
          dbTransaction,
        });
        voucher = insertVouchersResult;
        this.logger.debug(`newTrade`, newTrade);
        this.logger.debug(`voucher`, voucher);
      } else {
        this.logger.debug(`this trade is already exist`);
        voucher = await this.database.getVoucherByOrderIdAndTradeId(
          orderId,
          _trade.id
        );
        this.logger.debug(`voucher`, voucher);
      }
    } catch (error) {
      this.logger.error(`_insertTradesRecord`, error);
      throw error;
    }
    this.logger.debug(
      `------------- [${this.constructor.name}] _insertTradesRecord [END]-------------`
    );
    return { newTrade, voucher, trade: _trade };
  }

  async _updateOrderbyTrade({
    memberId,
    orderId,
    market,
    trade,
    dbTransaction,
  }) {
    this.logger.debug(
      `------------- [${this.constructor.name}] _updateOrderbyTrade -------------`
    );
    let _order,
      _updateOrder,
      stateCode = Database.ORDER_STATE_CODE.WAIT,
      state = Database.ORDER_STATE.WAIT,
      state_text = Database.ORDER_STATE_TEXT.WAIT,
      filled = false,
      price,
      volume,
      locked,
      updateAt,
      doneAt,
      fundsReceived,
      tradesCount,
      value,
      _orderDetails;
    // get _order data from table
    this.logger.debug(`orderId`, orderId);
    _order = await this.database.getOrder(orderId, { dbTransaction });
    this.logger.debug(`db _order`, _order);
    this.logger.debug(`memberId`, memberId);
    try {
      if (
        _order &&
        _order?.member_id.toString() === memberId.toString() &&
        _order?.state === Database.ORDER_STATE_CODE.WAIT
      ) {
        price = Utils.removeZeroEnd(_order.price);
        value = SafeMath.mult(trade.fillPx, trade.fillSz);
        volume = SafeMath.minus(_order.volume, trade.fillSz);
        locked =
          trade.side === Database.ORDER_SIDE.BUY
            ? SafeMath.minus(
                _order.locked,
                SafeMath.mult(trade.fillPx, trade.fillSz)
              )
            : SafeMath.minus(_order.locked, trade.fillSz);
        updateAt = `"${new Date()
          .toISOString()
          .slice(0, 19)
          .replace("T", " ")}"`;
        fundsReceived =
          trade.side === Database.ORDER_SIDE.BUY
            ? SafeMath.plus(_order.funds_received, trade.fillSz)
            : SafeMath.plus(_order.funds_received, value); //++ TODO to be verify: 使用 TideBit ticker 測試)
        tradesCount = SafeMath.plus(_order.trades_count, "1");
        if (SafeMath.eq(volume, "0")) {
          let res = await this.okexConnector.router("getOrderDetails", {
            query: {
              instId: trade.instId,
              ordId: trade.ordId,
            },
          });
          if (res.success) {
            _orderDetails = res.payload;
            price = _orderDetails.avgPx;
          }
          stateCode = Database.ORDER_STATE_CODE.DONE;
          state = Database.ORDER_STATE.DONE;
          state_text = Database.ORDER_STATE_TEXT.DONE;
          filled = true;
          // --locked = "0"; //++ TODO to be verify: 使用 TideBit ticker 測試)
          doneAt = `"${new Date(parseInt(trade.ts))
            .toISOString()
            .slice(0, 19)
            .replace("T", " ")}"`;
        } else {
          let res = await this.okexConnector.router("getOrderDetails", {
            query: {
              instId: trade.instId,
              ordId: trade.ordId,
            },
          });
          if (res.success) {
            _orderDetails = res.payload;
            this.logger.debug(`for _orderDetails`, _orderDetails);
            if (_orderDetails.state === Database.ORDER_STATE.CANCEL) {
              state = _orderDetails.state;
              stateCode = Database.ORDER_STATE_CODE.CANCEL;
              state_text = Database.ORDER_STATE_TEXT.CANCEL;
              // do not update locked amount to calculate average fill price
              // locked = "0"; ++ !!!! ALERT
            } else {
              stateCode = Database.ORDER_STATE_CODE.WAIT;
              state = Database.ORDER_STATE.WAIT;
              state_text = Database.ORDER_STATE_TEXT.WAIT;
            }
          }
        }
        _updateOrder = {
          id: _order.id,
          volume,
          state: stateCode,
          locked,
          funds_received: fundsReceived,
          trades_count: tradesCount,
          updated_at: updateAt,
          done_at: doneAt,
        };
        /* !!! HIGH RISK (start) !!! */
        // update orders table order data
        await this.database.updateOrder(_updateOrder, { dbTransaction });
        // update orderbook order data
        _updateOrder = {
          instId: trade.instId,
          ordType: _order.ord_type,
          id: _order.id,
          ordId: trade.ordId,
          clOrdId: trade.clOrdId,
          at: parseInt(SafeMath.div(trade.ts, "1000")),
          ts: parseInt(trade.ts),
          market: market.id,
          kind:
            trade.side === Database.ORDER_SIDE.BUY
              ? Database.ORDER_KIND.BID
              : Database.ORDER_KIND.ASK,
          price,
          volume,
          locked,
          origin_volume: Utils.removeZeroEnd(_order.origin_volume),
          state_text,
          filled,
          state,
          state_code: stateCode,
        };
        this.logger.debug("_updateOrder for [FRONTEND]", _updateOrder);
      } else {
        if (_order?.member_id.toString() === memberId)
          this.logger.error(
            `[${this.constructor.name}], order has been closed`
          );
        else {
          this.logger.error(
            "orderId and memberId is not match, this order is in other environment"
          );
          _order = null;
        }
      }
    } catch (error) {
      this.logger.error(`_updateOrderbyTrade`, error);
      throw error;
    }
    this.logger.debug(
      `------------- [${this.constructor.name}] _updateOrderbyTrade [END] -------------`
    );
    return { updateOrder: _updateOrder, order: _order };
  }

  /**
   * - id: xpaeth
       code: 18
       name: XPA/ETH
       base_unit: xpa
       quote_unit: eth
       bid: {fee: 0.001, currency: eth, fixed: 8, hero_fee: 0, vip_fee: 0.001}
       ask: {fee: 0.002, currency: xpa, fixed: 2, hero_fee: 0, vip_fee: 0.001}
       sort_order: 7
       tab_category: alts
       price_group_fixed: 8
       primary: true
   * order=64: price = 101 eth bid 1 xpa => locked 101 eth
   * account_version=155: reason = 600(=ORDER_SUBMIT), balance = -101, locked = 101 modified_id = 64 , modified_type = Order, currency = 3(=eth), fun = 2(LOCK_FUNDS)
   * order=65: price = 100 eth ask 0.01 xpa => locked 0.01 eth
   * account_version=156: reason = 600(=ORDER_SUBMIT), balance = -0.01, locked = 0.01 modified_id = 65 , modified_type = Order, currency = 9(=xpa), fun = 2(LOCK_FUNDS)
   * trade=153:  price = 101, volume = 0.01, ask=65, bid=64, trend = 1, currency=18, ask_member_id=65538, bid_member_id = 65538, funds = 1.01
   * order=64: bid=3, ask=9, currency=18, price = 101, volume = 0.99, origin_volume = 1, state = 100, type = OrderBid, member_id = 65538, locked = 99.9900000000000000, origin_locked = 101.0000000000000000, fund_receive= 0.0100000000000000,
   * order=65: bid=3, ask=9, currency=18, price = 100, volume = 0, origin_volume = 0.01, state = 200, type = OrderAsk, member_id = 65538, locked = 0.0000000000000000, origin_locked = 0.0100000000000000, fund_receive = 1.0100000000000000, 
   * vouchers=33: member_id = 65538, order_id = 64, trade_id = 153, ask = xpa, bid = eth, price = 101, volume = 0.01, value = 1.01, trend = bid, ask_fee = 0, bid_fee = 0.00001(fillSz*bid.feeRate),
   * vouchers=34: member_id = 65538, order_id = 65, trade_id = 153, ask = xpa, bid = eth, price = 101, volume = 0.01, value = 1.01, trend = ask, ask_fee = 0.0020200000000000 , bid_fee = 0,
   * --- order=64,vouchers=33,trend:bid, bid:xpa, fee:xpa(fillSz*bid.feeRate)
   * account_version=158: eth, reason= 120(STRIKE_SUB: 120),  balance = 0, locked = -1.01(fillPx:101, fillSz: 0.01), fee = 0, modified_id = 153, modified_type = trade, currency = 3, fuc = 5(UNLOCK_AND_SUB_FUNDS: 5)
   * account_version=159: xpa, reason= 110(STRIKE_ADD: 110),  balance = 0.00999(fillSz - fee), locked = 0, fee = 0.00001(same as: voucher=33, fillSz:0.01, bid.fee: 0.001), modified_id = 153, modified_type = trade, currency = 9, fuc = 3PLUS_FUNDS: 3)
   * --- order=65,vouchers=34,trend:ask, ask:xpa, fee:eth
   * account_version=160: xpa, reason= 120(STRIKE_SUB: 120),  balance = 0, locked = -0.01, fee = 0, modified_id = 153, modified_type = trade, currency = 9, fuc = 5(UNLOCK_AND_SUB_FUNDS: 5)
   * account_version=161: eth, reason= 110(STRIKE_ADD: 110),  balance = 1.00798, locked = 0, fee = 0.00202(same as: voucher=34, fillPx:101* fillSz: 0.01* ask.fee: 0.001), modified_id = 153, modified_type = trade, currency = 3, fuc = 3(PLUS_FUNDS: 3)
   * account=3,memberId=65538: balance = 898.9737600000000000, locked = 99.9910000000000000
   * account=9,memberId=65538: balance = 999.9996300000000000, locked = 0.0100000000000000
   */
  /**
   * @typedef {Object} Trade
   * @property {string} side "sell"
   * @property {string} fillSz "0.002"
   * @property {string} fillPx "1195.86"
   * @property {string} fee "-0.001913376"
   * @property {string} ordId "467755654093094921"
   * @property {string} insType "SPOT"
   * @property {string} instId "ETH-USDT"
   * @property {string} clOrdId "377bd372412fSCDE11235m49o"
   * @property {string} posSide "net"
   * @property {string} billId "467871903972212805"
   * @property {string} tag "377bd372412fSCDE"
   * @property {string} execType "M"
   * @property {string} tradeId "225260494"
   * @property {string} feecy "USDT"
   * @property {string} ts "1657821354546
   */
  /**
   * @param {Trade} trade
   */
  async _processOuterTrade(trade) {
    this.logger.debug(
      `------------- [${this.constructor.name}] _processOuterTrade -------------`
    );
    let tmp,
      memberId,
      member,
      memberTag,
      askFeeRate,
      bidFeeRate,
      orderId,
      market,
      order,
      resultOnOrderUpdate,
      updateOrder,
      newTrade,
      dbTrade,
      voucher,
      resultOnAccUpdate,
      updateAskAccount,
      updateBidAccount,
      result,
      t = await this.database.transaction();
    // 1. parse  memberId, orderId from trade.clOrdId

    tmp = Utils.parseClOrdId(trade.clOrdId);

    market = this._findMarket(trade.instId);
    memberId = tmp.memberId;
    orderId = tmp.orderId;
    if (memberId && orderId) {
      member = await this.database.getMemberByCondition({ id: memberId });
      if (member) {
        memberTag = member.member_tag;
        this.logger.debug(`member.member_tag`, member.member_tag); // 1 是 vip， 2 是 hero
        if (memberTag) {
          if (memberTag.toString() === Database.MEMBER_TAG.VIP_FEE.toString()) {
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
        /* !!! HIGH RISK (start) !!! */
        // 1. _updateOrderbyTrade
        // 2. _insertTrades & _insertVoucher
        // 3. side === 'buy' ? _updateAccByBidTrade : _updateAccByAskTrade
        // 5. _updateOuterTradeStatus
        // ----------
        this.logger.debug(`outerTrade`, trade);
        this.logger.debug(`memberId`, memberId);
        this.logger.debug(`orderId`, orderId);
        this.logger.debug(`askFeeRate`, askFeeRate);
        this.logger.debug(`bidFeeRate`, bidFeeRate);
        try {
          // 1. _updateOrderbyTrade
          resultOnOrderUpdate = await this._updateOrderbyTrade({
            memberId,
            orderId,
            trade,
            market,
            dbTransaction: t,
          });
          order = resultOnOrderUpdate?.order;
          updateOrder = resultOnOrderUpdate?.updateOrder;
          // if this order is in this environment
          if (order) {
            // 2. _insertTrades & _insertVouchers
            let output = await this._insertTradesRecord({
              memberId,
              askFeeRate,
              bidFeeRate,
              orderId,
              market,
              trade,
              dbTransaction: t,
            });
            newTrade = output.newTrade;
            voucher = output.voucher;
            dbTrade = output.trade;
            // 3. side === 'buy' ? _updateAccByBidTrade : _updateAccByAskTrade
            // if this trade does need update
            if (updateOrder && newTrade) {
              if (trade.side === Database.ORDER_SIDE.BUY)
                resultOnAccUpdate = await this._updateAccByBidTrade({
                  memberId,
                  bidFeeRate,
                  market,
                  order: updateOrder,
                  askCurr: order.ask,
                  bidCurr: order.bid,
                  trade: { ...trade, id: newTrade.id },
                  dbTransaction: t,
                });
              else
                resultOnAccUpdate = await this._updateAccByAskTrade({
                  memberId,
                  askFeeRate,
                  market,
                  order: updateOrder,
                  askCurr: order.ask,
                  bidCurr: order.bid,
                  trade: { ...trade, id: newTrade.id },
                  dbTransaction: t,
                });
              updateAskAccount = resultOnAccUpdate.updateAskAccount;
              updateBidAccount = resultOnAccUpdate.updateBidAccount;
            }
            /**
             * ++ TODO，要開票
             * 1. 記錄 tidebit 要付給 okex 的 手續費 或是 tidebit 從 okex 收到的 手續費
             * 2. 根據 member 的推薦人發送獎勵 （抽成比例由 DB 裡面記錄 member 的方案來確認 (
             *     referral_commissions
             *     commission_plans
             *     commission_policies)
             *    ）
             */
            // 4. _updateOuterTradeStatus
            await this._updateOuterTradeStatus({
              order_id: orderId,
              member_id: memberId,
              trade_id: newTrade?.id || dbTrade.id,
              voucher_id: voucher?.id || null,
              order_price: order.price,
              order_origin_volume: order.origin_volume,
              member_tag: memberTag,
              email: member.email,
              id: trade.tradeId,
              status: Database.OUTERTRADE_STATUS.DONE,
              create_at: `"${new Date(parseInt(trade.ts))
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")}"`,
              update_at: `"${new Date()
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")}"`,
              dbTransaction: t,
            });
            await t.commit();
          } else {
            this.logger.error(
              "order not exist, this order is in other environment"
            );
            await this._updateOuterTradeStatus({
              order_id: orderId,
              member_id: memberId,
              id: trade.tradeId,
              status: Database.OUTERTRADE_STATUS.OTHER_SYSTEM_TRADE,
              create_at: `"${new Date(parseInt(trade.ts))
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")}"`,
              update_at: `"${new Date()
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")}"`,
              dbTransaction: t,
            });
            await t.commit();
          }
        } catch (error) {
          this.logger.error(`_processOuterTrade`, error);
          await t.rollback();
        }
        this.logger.debug(
          `------------- [${this.constructor.name}] _processOuterTrade [END] -------------`
        );
        result = {
          memberId,
          instId: trade.instId,
          market: market.id,
          updateOrder,
          newTrade,
          updateAskAccount,
          updateBidAccount,
        };
      } else {
        this.logger.error(
          "member not exist, this order is in other environment"
        );
        await this._updateOuterTradeStatus({
          order_id: orderId,
          member_id: memberId,
          id: trade.tradeId,
          status: Database.OUTERTRADE_STATUS.OTHER_SYSTEM_TRADE,
          create_at: `"${new Date(parseInt(trade.ts))
            .toISOString()
            .slice(0, 19)
            .replace("T", " ")}"`,
          update_at: `"${new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " ")}"`,
          dbTransaction: t,
        });
        await t.commit();
      }
    } else {
      await this._updateOuterTradeStatus({
        id: trade.tradeId,
        status: Database.OUTERTRADE_STATUS.ClORDId_ERROR,
        create_at: `"${new Date(parseInt(trade.ts))
          .toISOString()
          .slice(0, 19)
          .replace("T", " ")}"`,
        update_at: `"${new Date()
          .toISOString()
          .slice(0, 19)
          .replace("T", " ")}"`,
        dbTransaction: t,
      });
      await t.commit();
    }
    return result;
  }

  async _processOuterTrades(outerTrades) {
    // let tmp,
    //   updateData = [];
    this.logger.debug(`[${this.constructor.name}] _processOuterTrades`);
    // -1. get all records from outer_trades table &  fillter records if record.status === 5-
    // const outerTrades = await this.database.getOuterTradesByStatus(
    //   Database.EXCHANGE[exchange.toUpperCase()],
    //   0
    // );
    // if (Math.random() < 0.01) {
    //   this.garbageCollection(outerTrades);
    // }
    this.logger.debug(
      `need processOuterTrade[${outerTrades.length}]`,
      outerTrades
    );
    // 2. _processOuterTrade
    for (let trade of outerTrades) {
      await this.processor(Database.MODIFIABLE_TYPE.TRADE, trade);
      // tmp = await this._processOuterTrade({
      //   ...JSON.parse(trade.data),
      //   exchangeCode: trade.exchange_code,
      // });
      // if (tmp) updateData.push(tmp);
    }
    // return updateData;
  }

  // ++TODO check, rm sql inside forLoop
  async _insertOuterTrades(outerTrades) {
    /* !!! HIGH RISK (start) !!! */
    let result;
    this.logger.debug(`[${this.constructor.name}] insertOuterTrades`);
    // for (let trade of outerTrades) {
    //   result = await this._insertOuterTrade(trade);
    // }
    const t = await this.database.transaction();
    try {
      await this.database.insertOuterTrades(outerTrades, { dbTransaction: t });
      result = true;
      await t.commit();
    } catch (error) {
      this.logger.error(`insertOuterTrades`, error);
      result = false;
      await t.rollback();
    }
    this.logger.debug(
      `------------- [${this.constructor.name}] _insertOuterTrade [END] -------------`
    );
    return result;
  }

  async _getOuterTradesFromAPI(exchange, interval) {
    this.logger.debug(
      `------------- [${this.constructor.name}] _getOuterTradesFromAPI --------------`
    );
    let outerTrades,
      _endDate = new Date(),
      endDate = new Date(
        new Date(
          `${_endDate.getFullYear()}-${
            _endDate.getMonth() + 1
          }-${_endDate.getDate()} 23:59:59`
        )
      ),
      end = endDate.getTime(),
      begin = end - interval;

    this.logger.debug(
      `[${this.constructor.name}] begin[${begin}]`,
      new Date(begin)
    );
    this.logger.debug(`[${this.constructor.name}] end[${end}]`, new Date(end));
    switch (exchange) {
      case SupportedExchange.OKEX:
      default:
        let okexRes;
        if (interval > this._interval) {
          this.logger.debug(`fetchTradeFillsHistoryRecords`);
          okexRes = await this.okexConnector.router(
            "fetchTradeFillsHistoryRecords",
            {
              query: {
                instType: Database.INST_TYPE.SPOT,
                begin,
                end,
                sz: 100,
              },
            }
          );
          this._isStarted = true;
        } else {
          this.logger.debug(`fetchTradeFillsRecords`);
          okexRes = await this.okexConnector.router("fetchTradeFillsRecords", {
            query: {
              instType: "SPOT",
              begin,
              end,
              sz: 100,
            },
          });
        }
        if (okexRes.success) {
          outerTrades = okexRes.payload;
        }
        break;
    }

    return outerTrades;
  }

  async _getTransactionsDetail(exchange, interval, clOrdId, retry = 3) {
    this.logger.debug(
      `--- [${this.constructor.name}] _getTransactionsDetail ---`
    );
    let outerTrades = await this._getOuterTradesFromAPI(exchange, interval);
    let index, newRetry;
    if (clOrdId) {
      this.logger.debug(`clOrdId`, clOrdId);
      index = outerTrades?.findIndex((trade) => trade.clOrdId === clOrdId);
      if (index === -1 && retry > 0) {
        newRetry = retry - 1;
        this.logger.debug(`_getOuterTradesFromAPI recall newRetry`, newRetry);
        await Utils.wait(2500);
        return this._getTransactionsDetail(
          exchange,
          interval,
          clOrdId,
          newRetry
        );
      }
    }
    this.logger.debug(
      `--- [${this.constructor.name}] _getTransactionsDetail [END]---`
    );
    return outerTrades;
  }

  async _syncOuterTrades(exchange, interval, clOrdId) {
    let days = Math.ceil(interval / (60 * 60 * 24 * 1000));
    this.logger.debug(
      `[${this.constructor.name}] _syncOuterTrades (days: ${days})`
    );
    let exchangeCode = Database.EXCHANGE[exchange.toUpperCase()];
    const dbOuterTrades = await this.database.getOuterTrades({
      type: Database.TIME_RANGE_TYPE.DAY_AFTER,
      exchangeCode,
      days: days,
      asc: true,
    });
    let apiOuterTrades = await this._getTransactionsDetail(
      exchange,
      interval,
      clOrdId
    );
    let needProcessTrades = [],
      abnormalTrades = [];
    for (let trade of apiOuterTrades) {
      let index = dbOuterTrades.findIndex(
        (dbTrade) => dbTrade.id.toString() === trade.tradeId
      );
      if (index === -1) needProcessTrades = [...needProcessTrades, trade];
      else if (
        index !== -1 &&
        (dbOuterTrades[index].status === Database.OUTERTRADE_STATUS.UNPROCESS ||
          dbOuterTrades[index].status ===
            Database.OUTERTRADE_STATUS.SYSTEM_ERROR)
      )
        abnormalTrades = [...abnormalTrades, trade];
    }
    // this.logger.debug(`apiOuterTrades`, apiOuterTrades);
    // const _filtered = outerTrades.filter(
    //   (trade) =>
    //     _outerTrades.findIndex(
    //       (_trade) => _trade.id.toString() === trade.tradeId
    //     ) === -1
    // );
    // let result = false;
    // if (_filtered.length > 0) {
    // this.logger.debug(`_filtered[${_filtered.length}]`, _filtered);
    // result = await this._insertOuterTrades(_filtered);
    // }
    /**
     * ++TODO handle abnormalTrades
     */
    this.logger.error(`_syncOuterTrades abnormalTrades`, abnormalTrades);
    return needProcessTrades;
  }

  _findMarket(instId) {
    return this.tidebitMarkets.find((m) => m.instId === instId);
  }
}

module.exports = ExchangeHubService;
