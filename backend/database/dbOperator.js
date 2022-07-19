const path = require("path");

const mysql = require("./mysql");

class DBOperator {
  database = null;
  _isInit = false;
  REASON = {
    STRIKE_FEE: 100,
    STRIKE_ADD: 110,
    STRIKE_SUB: 120,
    STRIKE_UNLOCK: 130,
    ORDER_SUBMIT: 600,
    ORDER_CANCEL: 610,
    ORDER_FULLFILLED: 620,
  };
  FUNC = {
    UNLOCK_FUNDS: 1,
    LOCK_FUNDS: 2,
    PLUS_FUNDS: 3,
    SUB_FUNDS: 4,
    UNLOCK_AND_SUB_FUNDS: 5,
  };
  ORDER_STATE = {
    CANCEL: 0,
    WAIT: 100,
    DONE: 200,
  };
  TYPE = {
    ORDER_ASK: "OrderAsk",
    ORDER_BID: "OrderBid",
  };
  ORD_TYPE = {
    LIMIT: "limit",
    MARKET: "market",
  };
  MODIFIABLE_TYPE = {
    ORDER: "Order",
    TRADE: "Trade",
  };
  EXCHANGE = {
    OKEX: 10,
  };

  constructor() {
    return this;
  }

  async init({ dir, database, logger }) {
    if (this._isInit) return;
    this.database = new mysql();
    this._isInit = true;

    return this.database.init({ dir, database, logger });
  }

  down() {
    if (!this.database) return;
    this.database.close();
    this._isInit = false;
    this.database = null;
  }

  async transaction() {
    return this.database.transaction();
  }

  async getAccounts() {
    return this.database.getAccounts();
  }

  async getAccountsByMemberId(memberId) {
    return this.database.getAccountsByMemberId(memberId);
  }

  async getCurrencies(currencyId) {
    return this.database.getCurrencies(currencyId);
  }

  async getCurrency(currencyId) {
    return this.database.getCurrency(currencyId);
  }

  async getCurrencyByKey(currencyKey) {
    return this.database.getCurrencyByKey(currencyKey);
  }

  async getMemberById(memberId) {
    return this.database.getMemberById(memberId);
  }

  async getAccountByMemberIdCurrency(memberId, currencyId, { dbTransaction }) {
    return this.database.getAccountByMemberIdCurrency(memberId, currencyId, {
      dbTransaction,
    });
  }

  async getOrderList({ quoteCcy, baseCcy, state, memberId, orderType }) {
    return this.database.getOrderList({
      quoteCcy,
      baseCcy,
      state,
      memberId,
      orderType,
    });
  }

  async getOrder(orderId, { dbTransaction }) {
    return this.database.getOrder(orderId, { dbTransaction });
  }

  async getTrades(quoteCcy, baseCcy) {
    return this.database.getTrades(quoteCcy, baseCcy);
  }
  async getVouchers({ memberId, ask, bid }) {
    return this.database.getVouchers({ memberId, ask, bid });
  }
  async getVouchersByOrderId(orderId, { dbTransaction }) {
    return this.database.getVouchersByOrderId(orderId, { dbTransaction });
  }

  async getOuterTrades(exchangeCode, status) {
    return this.database.getOuterTrades(exchangeCode, status);
  }

  /* !!! HIGH RISK (start) !!! */
  async insertOrder(
    bid,
    ask,
    currency,
    price,
    volume,
    origin_volume,
    state,
    done_at,
    type,
    member_id,
    created_at,
    updated_at,
    sn,
    source,
    ord_type,
    locked,
    origin_locked,
    funds_received,
    trades_count,
    { dbTransaction }
  ) {
    return this.database.insertOrder(
      bid,
      ask,
      currency,
      price,
      volume,
      origin_volume,
      state,
      done_at,
      type,
      member_id,
      created_at,
      updated_at,
      sn,
      source,
      ord_type,
      locked,
      origin_locked,
      funds_received,
      trades_count,
      { dbTransaction }
    );
  }

  async insertAccountVersion(
    member_id,
    accountId,
    reason,
    balance,
    locked,
    fee,
    amount,
    modifiable_id,
    modifiable_type,
    created_at,
    updated_at,
    currency,
    fun,
    { dbTransaction }
  ) {
    return this.database.insertAccountVersion(
      member_id,
      accountId,
      reason,
      balance,
      locked,
      fee,
      amount,
      modifiable_id,
      modifiable_type,
      created_at,
      updated_at,
      currency,
      fun,
      { dbTransaction }
    );
  }

  async insertOuterTrades(
    id, // trade_fk `${EXCHANGE_CODE}${trade.tradeId}`
    exchange_code, // EXCHANGE_CODE
    update_at,
    status, // 0: unprocessed, 1: updateOrders, 2: updateAccounts, 3: insertTrades, 4: updateVouchers, 5: account_version
    data,
    { dbTransaction }
  ) {
    console.log(`[DBOperator] insertOuterTrades`);
    return this.database.insertOuterTrades(
      id, // trade_fk `${EXCHANGE_CODE}${trade.tradeId}`
      exchange_code, // EXCHANGE_CODE
      update_at,
      status, // 0: unprocessed, 1: updateOrders, 2: updateAccounts, 3: insertTrades, 4: updateVouchers, 5: account_version
      data,
      { dbTransaction }
    );
  }

  async insertTrades(
    price,
    volume,
    ask_id,
    bid_id,
    trend,
    currency,
    created_at,
    updated_at,
    ask_member_id,
    bid_member_id,
    funds,
    trade_fk,
    { dbTransaction }
  ) {
    return this.database.insertTrades(
      price,
      volume,
      ask_id,
      bid_id,
      trend,
      currency,
      created_at,
      updated_at,
      ask_member_id,
      bid_member_id,
      funds,
      trade_fk,
      { dbTransaction }
    );
  }

  async insertVouchers(
    member_id,
    order_id,
    trade_id,
    designated_trading_fee_asset_history_id,
    ask,
    bid,
    price,
    volume,
    value,
    trend,
    ask_fee,
    bid_fee,
    created_at,
    { dbTransaction }
  ) {
    return this.database.insertVouchers(
      member_id,
      order_id,
      trade_id,
      designated_trading_fee_asset_history_id,
      ask,
      bid,
      price,
      volume,
      value,
      trend,
      ask_fee,
      bid_fee,
      created_at,
      { dbTransaction }
    );
  }

  async updateAccount(datas, { dbTransaction }) {
    return this.database.updateAccount(datas, { dbTransaction });
  }

  async updateOrder(datas, { dbTransaction }) {
    return this.database.updateOrder(datas, { dbTransaction });
  }

  async updateOuterTrade(datas, { dbTransaction }) {
    this.logger.log("[dbOperator] updateOuterTrade", datas);
    return this.database.updateOuterTrade(datas, { dbTransaction });
  }
  /* !!! HIGH RISK (end) !!! */
}

module.exports = DBOperator;