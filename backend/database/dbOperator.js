const mysql = require("./mysql");

class DBOperator {
  database = null;
  _isInit = false;
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

  async getTotalAccountsAssets() {
    return this.database.getTotalAccountsAssets();
  }

  async getAccountsByMemberId(memberId) {
    return this.database.getAccountsByMemberId(memberId);
  }

  async getCurrencies() {
    return this.database.getCurrencies();
  }

  async getCurrenciesSymbol() {
    return this.database.getCurrenciesSymbol();
  }

  async getCurrency(currencyId) {
    return this.database.getCurrency(currencyId);
  }

  async getCurrencyByKey(currencyKey) {
    return this.database.getCurrencyByKey(currencyKey);
  }

  async getMembers() {
    return this.database.getMembers();
  }

  async getMemberById(memberId) {
    return this.database.getMemberById(memberId);
  }

  async getMemberByEmail(memberEmail) {
    return this.database.getMemberByEmail(memberEmail);
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

  async getDoneOrders({ quoteCcy, baseCcy, memberId, state, type }) {
    return this.database.getDoneOrders({
      quoteCcy,
      baseCcy,
      memberId,
      state,
      type,
    });
  }

  async getDoneOrder(orderId) {
    return this.database.getDoneOrder(orderId);
  }

  async getOrder(orderId, { dbTransaction }) {
    return this.database.getOrder(orderId, { dbTransaction });
  }

  async getOrders() {
    return this.database.getOrders();
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

  async getVoucherByOrderIdAndTradeId(orderId, tradeId) {
    return this.database.getVoucherByOrderIdAndTradeId(orderId, tradeId);
  }

  async getTradeByTradeFk(tradeFk) {
    return this.database.getTradeByTradeFk(tradeFk);
  }

  async getOuterTradesByStatus(exchangeCode, status) {
    return this.database.getOuterTradesByStatus(exchangeCode, status);
  }

  async getOrdersJoinMemberEmail(state) {
    return this.database.getOrdersJoinMemberEmail(state);
  }

  async getOuterTradesByDayAfter(exchangeCode, day) {
    return this.database.getOuterTradesByDayAfter(exchangeCode, day);
  }

  async getOuterTradesBetweenDays(exchangeCode, start, end) {
    return this.database.getOuterTradesBetweenDays(exchangeCode, start, end);
  }

  /* !!! HIGH RISK (start) !!! */
  async insertOrder({
    bid,
    ask,
    currency,
    price,
    volume,
    originVolume,
    state,
    doneAt,
    type,
    memberId,
    createdAt,
    updatedAt,
    sn,
    source,
    ordType,
    locked,
    originLocked,
    fundsReceived,
    tradesCount,
    dbTransaction,
  }) {
    return this.database.insertOrder(
      bid,
      ask,
      currency,
      price,
      volume,
      originVolume,
      state,
      doneAt,
      type,
      memberId,
      createdAt,
      updatedAt,
      sn,
      source,
      ordType,
      locked,
      originLocked,
      fundsReceived,
      tradesCount,
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
    // id, // trade_fk `${EXCHANGE_CODE}${trade.tradeId}`
    // exchange_code, // EXCHANGE_CODE
    // update_at,
    // status, // 0: unprocessed, 1: updateOrders, 2: updateAccounts, 3: insertTrades, 4: updateVouchers, 5: account_version
    // data,
    trades,
    { dbTransaction }
  ) {
    // console.log(`[DBOperator] insertOuterTrades`);
    return this.database.insertOuterTrades(trades, { dbTransaction });
  }

  async insertTrades(trade, { dbTransaction }) {
    return this.database.insertTrades(
      trade.price,
      trade.volume,
      trade.ask_id,
      trade.bid_id,
      trade.trend,
      trade.currency,
      trade.created_at,
      trade.updated_at,
      trade.ask_member_id,
      trade.bid_member_id,
      trade.funds,
      trade.trade_fk,
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
    return this.database.updateOuterTrade(datas, { dbTransaction });
  }

  async deleteOuterTrade(datas, { dbTransaction }) {
    return this.database.deleteOuterTrade(datas, { dbTransaction });
  }
  /* !!! HIGH RISK (end) !!! */
}

module.exports = DBOperator;
