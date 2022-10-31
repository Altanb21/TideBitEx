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

  async getAccountsByMemberId(
    memberId,
    { options = {}, limit = 100, dbTransaction }
  ) {
    return this.database.getAccountsByMemberId(memberId, {
      options,
      limit,
      dbTransaction,
    });
  }

  /**
   * [deprecated] 2022/10/14
   * 原本是用在 account 的 currency 去 asset_bases 查找 account 的 symbal及 key
   * 已有 coins.yml 的資料取代
   */
  async getCurrencies() {
    return this.database.getCurrencies();
  }

  /**
   * [deprecated] 2022/10/14
   * 原本是用在 account 的 currency 去 asset_bases 查找 account 的 symbal及 key
   * 已有 coins.yml 的資料取代
   */
  async getCurrenciesSymbol() {
    return this.database.getCurrenciesSymbol();
  }

  /**
   * [deprecated] 2022/10/14
   * 沒有地方呼叫
   */
  async getCurrency(currencyId) {
    return this.database.getCurrency(currencyId);
  }

  /**
   * [deprecated] 2022/10/14
   * 沒有地方呼叫
   */
  async getCurrencyByKey(currencyKey) {
    return this.database.getCurrencyByKey(currencyKey);
  }

  /**
   * [deprecated] 2022/10/14
   * 沒有地方呼叫
   */
  async getMembers() {
    return this.database.getMembers();
  }

  /**
   * [deprecated] 2022/10/14
   * getMemberById 同 getMemberByEmail整合成 getMemberByCondition
   */
  async getMemberById(memberId) {
    return this.database.getMemberById(memberId);
  }

  /**
   * [deprecated] 2022/10/14
   * getMemberById 同 getMemberByEmail整合成 getMemberByCondition
   */
  async getMemberByEmail(memberEmail) {
    return this.database.getMemberByEmail(memberEmail);
  }

  async getMemberByCondition(condition) {
    return this.database.getMemberByCondition(condition);
  }

  async getCommissionPolicies(planId) {
    return this.database.getCommissionPolicies(planId);
  }

  async getMemberReferral({ referrerId, refereeId }) {
    return this.database.getMemberReferral({ referrerId, refereeId });
  }
  /**
   * [deprecated] 2022/10/14
   * 與 getAccountsByMemberId 合併
   */
  async getAccountByMemberIdAndCurrency(
    memberId,
    currencyId,
    { dbTransaction }
  ) {
    return this.database.getAccountByMemberIdAndCurrency(memberId, currencyId, {
      dbTransaction,
    });
  }

  async getOrderList({
    quoteCcy,
    baseCcy,
    memberId,
    orderType,
    state,
    asc = false,
  }) {
    return this.database.getOrderList({
      quoteCcy,
      baseCcy,
      memberId,
      orderType,
      state,
      asc,
    });
  }

  async getDoneOrders({
    orderId,
    quoteCcy,
    baseCcy,
    memberId,
    state,
    type,
    ordType = "limit",
    offset = 0,
    limit = 100,
  }) {
    return this.database.getDoneOrders({
      orderId,
      quoteCcy,
      baseCcy,
      memberId,
      state,
      type,
      ordType,
      offset,
      limit,
    });
  }

  /**
   * [deprecated] 2022/10/14
   * 與 getDoneOrders 整合
   */
  async getDoneOrder(orderId) {
    return this.database.getDoneOrder(orderId);
  }

  async getOrder(orderId, { dbTransaction }) {
    return this.database.getOrder(orderId, { dbTransaction });
  }

  /**
   * [deprecated] 2022/10/14
   * 沒有地方呼叫
   */
  async getOrders() {
    return this.database.getOrders();
  }

  /**
   * [deprecated] 2022/10/14
   * 沒有地方呼叫
   */
  async getTrades(quoteCcy, baseCcy) {
    return this.database.getTrades(quoteCcy, baseCcy);
  }

  async getVouchers({
    memberId,
    ask,
    bid,
    days = 30,
    asc = false,
    limit = 100,
    offset = 0,
  }) {
    return this.database.getVouchers({
      memberId,
      ask,
      bid,
      days,
      asc,
      limit,
      offset,
    });
  }

  async getVouchersByOrderId(orderId, { dbTransaction }) {
    return this.database.getVouchersByOrderId(orderId, { dbTransaction });
  }

  async getVoucherByOrderIdAndTradeId(orderId, tradeId) {
    return this.database.getVoucherByOrderIdAndTradeId(orderId, tradeId);
  }

  async getAccountVersionsByModifiableId(id, type) {
    return this.database.getAccountVersionsByModifiableId(id, type);
  }

  async getTradeByTradeFk(tradeFk) {
    return this.database.getTradeByTradeFk(tradeFk);
  }

  async getOuterTradesByStatus({
    exchangeCode,
    status,
    asc = true,
    limit = 100,
    offset = 0,
    // days = 30,
  }) {
    return this.database.getOuterTradesByStatus({
      exchangeCode,
      status,
      asc,
      limit,
      offset,
      // days,
    });
  }

  async getDefaultCommissionPlan() {
    return this.database.getDefaultCommissionPlan();
  }

  async getEmailsByMemberIds(memberIds) {
    return this.database.getEmailsByMemberIds(memberIds);
  }
  /**
   * [deprecated] 2022/10/14
   * replaced by getEmailByMemberId
   */
  async getOrdersJoinMemberEmail(state) {
    return this.database.getOrdersJoinMemberEmail(state);
  }

  /**
   * [deprecated] 2022/10/14
   * getOuterTradesBetweenDays 同 getOuterTradesByDayAfter 整合在
   * getOuterTrades
   */
  async getOuterTradesByDayAfter(exchangeCode, day) {
    return this.database.getOuterTradesByDayAfter(exchangeCode, day);
  }

  /**
   * [deprecated] 2022/10/14
   * getOuterTradesBetweenDays 同 getOuterTradesByDayAfter 整合在
   * getOuterTrades
   */
  async getOuterTradesBetweenDays(exchangeCode, start, end) {
    return this.database.getOuterTradesBetweenDays(exchangeCode, start, end);
  }

  /**
   * [deprecated] 2022/10/26
   * integrate with getReferralCommissionsByConditions
   */
  async getReferralCommissions({
    market,
    start,
    end,
    limit = 100,
    offset = 0,
    asc = false,
  }) {
    return this.database.getReferralCommissions({
      market,
      start,
      end,
      limit,
      offset,
      asc,
    });
  }

  async getReferralCommissionsByConditions({
    conditions,
    limit = 100,
    offset = 0,
    asc = false,
  }) {
    return this.database.getReferralCommissionsByConditions({
      conditions,
      limit,
      offset,
      asc,
    });
  }

  async getOuterTrades({
    type,
    exchangeCode,
    days,
    start,
    end,
    limit = 100,
    offset = 0,
    asc = false,
  }) {
    return this.database.getOuterTrades({
      type,
      exchangeCode,
      days,
      start,
      end,
      limit,
      offset,
      asc,
    });
  }

  async getVouchersByIds(ids) {
    return this.database.getVouchersByIds(ids);
  }

  async getReferralCommissionsByMarkets({ markets, start, end, asc = false }) {
    return this.database.getReferralCommissionsByMarkets({
      markets,
      start,
      end,
      asc,
    });
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

  async insertAccountVersion(accountVersion, { dbTransaction }) {
    return this.database.insertAccountVersion(
      accountVersion.memberId,
      accountVersion.accountId,
      accountVersion.reason,
      accountVersion.balance,
      accountVersion.locked,
      accountVersion.fee,
      accountVersion.amount,
      accountVersion.modifiableId,
      accountVersion.modifiableType,
      accountVersion.createdAt,
      accountVersion.updatedAt,
      accountVersion.currency,
      accountVersion.fun,
      { dbTransaction }
    );
  }

  async insertOuterTrades(trades, { dbTransaction }) {
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

  async insertVouchers(voucher, { dbTransaction }) {
    return this.database.insertVouchers(
      voucher.member_id,
      voucher.order_id,
      voucher.trade_id,
      voucher.designated_trading_fee_asset_history_id,
      voucher.ask,
      voucher.bid,
      voucher.price,
      voucher.volume,
      voucher.value,
      voucher.trend,
      voucher.ask_fee,
      voucher.bid_fee,
      voucher.created_at,
      { dbTransaction }
    );
  }

  async insertReferralCommission(referralCommission, { dbTransaction }) {
    return this.database.insertReferralCommission(
      referralCommission.referredByMemberId,
      referralCommission.tradeMemberId,
      referralCommission.voucherId,
      referralCommission.appliedPlanId,
      referralCommission.appliedPolicyId,
      referralCommission.trend,
      referralCommission.market,
      referralCommission.currency,
      referralCommission.refGrossFee,
      referralCommission.refNetFee,
      referralCommission.amount,
      referralCommission.state,
      referralCommission.depositedAt,
      referralCommission.createdAt,
      referralCommission.updatedAt,
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
