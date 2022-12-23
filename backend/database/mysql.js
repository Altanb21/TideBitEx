const { Sequelize } = require("sequelize");
const Database = require("../constants/Database");
class mysql {
  constructor() {
    return this;
  }

  async init({ database, logger = console }) {
    try {
      this.logger = logger;
      // initial all database
      const initDB = { ...database };
      initDB.dialect = initDB.protocol;
      initDB.username = initDB.user;
      initDB.database = initDB.dbName;
      const initDBSequelize = new Sequelize(
        initDB.dbName,
        initDB.user,
        initDB.password,
        initDB,
        {
          // ...
          pool: {
            max: 20,
            min: 0,
            acquire: 60000,
            idle: 10000,
          },
        }
      );

      await initDBSequelize.authenticate();
      this.logger.log(
        `\x1b[1m\x1b[32mDB\x1b[0m\x1b[21m ${initDB.dbName} connect success`
      );
      this.db = initDBSequelize;
      return this;
    } catch (error) {
      this.logger.error(
        "\x1b[1m\x1b[31mDB\x1b[0m\x1b[21m \x1b[1m\x1b[31mconnect fails\x1b[0m\x1b[21m"
      );
      //throw error;
    }
  }

  async close() {
    this.db.close();
  }

  async transaction() {
    return this.db.transaction();
  }

  /**
   * [deprecated] 2022/10/14
   * 原本是用在舊的管理設計(CurrenciesView)中用來顯示子帳號情況
   * getUsersAccounts
   */
  async getAccounts() {
    const query = "SELECT * FROM `accounts`;";
    try {
      const [accounts] = await this.db.query({
        query,
      });
      // this.logger.debug(query);
      return accounts;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async auditAccountBalance({ memberId, currency, startId, start, end }) {
    if (!memberId) throw Error(`memberId is required`);
    let placeholder = [];
    if (memberId) placeholder = [...placeholder, `member_id = ${memberId}`];
    if (currency) placeholder = [...placeholder, `currency = ${currency}`];
    if (startId) placeholder = [...placeholder, `id > ${startId}`];
    if (start && end)
      placeholder = [
        ...placeholder,
        `created_at BETWEEN "${start}"
      AND "${end}"`,
      ];
    let condition = placeholder.join(` AND `);
    const query = `
      SELECT
        account_id,
        member_id,
        currency,
        sum(balance) as sum_balance,
        sum(locked) as sum_locked,
	      min(id) AS oldest_id,
	      max(id) AS lastest_id
      FROM
        account_versions
      WHERE
        ${condition}
      GROUP BY account_id
      ;`;
    try {
      // this.logger.debug(
      //   "auditAccountBalance",
      //   query,
      //   memberId,
      //   currency,
      //   startId
      // );
      const [accountVersions] = await this.db.query({
        query,
      });
      return accountVersions;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getAccountsByMemberId(memberId, { options, limit, dbTransaction }) {
    let placeholder = ``,
      limitCondition = limit ? `LIMIT ${limit}` : ``;
    // this.logger.debug(options);
    if (Object.keys(options)?.length > 0) {
      let keys = Object.keys(options);
      let values = Object.values(options);
      for (let index = 0; index < Object.keys(options).length; index++) {
        if (values[index])
          placeholder += ` AND accounts.${keys[index]} = ${values[index]}`;
      }
    }
    // this.logger.debug(placeholder);
    const query = `
    SELECT
	    accounts.id,
	    accounts.member_id,
	    accounts.currency,
	    accounts.balance,
	    accounts.locked,
	    accounts.created_at,
	    accounts.updated_at
    FROM
	    accounts
    WHERE
	    accounts.member_id = ?${placeholder}
    ${limitCondition}
    ;`;
    const values = [memberId];
    // this.logger.debug(query, values);
    try {
      let accounts;
      if (dbTransaction) {
        [[accounts]] = await this.db.query(
          {
            query,
            values,
          },
          {
            transaction: dbTransaction,
            lock: dbTransaction.LOCK.UPDATE,
          }
        );
      } else {
        [accounts] = await this.db.query({
          query,
          values,
        });
      }
      // this.logger.debug(`getAccountsByMemberId`, accounts);
      return accounts;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/19
   * 與 getAccountByMemberId 合併
   */
  async getAccountByMemberIdAndCurrency(
    memberId,
    currencyId,
    { dbTransaction }
  ) {
    const query = `
    SELECT
	    accounts.id,
	    accounts.member_id,
	    accounts.currency,
	    accounts.balance,
	    accounts.locked,
	    accounts.created_at,
	    accounts.updated_at
    FROM
	    accounts
    WHERE
	    accounts.member_id = ?
      AND accounts.currency = ?
    LIMIT 1;
    `;
    try {
      // this.logger.debug(
      //   "getAccountByMemberIdAndCurrency",
      //   query,
      //   `[${memberId}, ${currencyId}]`
      // );
      const [[account]] = await this.db.query(
        {
          query,
          values: [memberId, currencyId],
        },
        {
          transaction: dbTransaction,
          lock: dbTransaction.LOCK.UPDATE,
        }
      );
      return account;
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
      return [];
    }
  }

  async getAssetBalances() {
    const query = `
    SELECT
      id,
      asset_key,
      category,
      amount,
      crash_counter,
      refresh_at,
      benchmark_realtime
    FROM
      asset_balances
    ;
    `;
    try {
      // this.logger.debug("getAssetBalances", query);
      const [assetBalances] = await this.db.query({
        query,
      });
      return assetBalances;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getTotalAccountsAssets() {
    const query = `
    SELECT
	    accounts.currency,
	    SUM(accounts.balance) AS total_balace,
	    SUM(accounts.locked) AS total_locked
    FROM
	    accounts
    GROUP BY
	    accounts.currency;
    `;
    try {
      // this.logger.debug("getTotalAccountsAssets", query);
      const [currencies] = await this.db.query({
        query,
      });
      return currencies;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/14
   * 原本是用在 account 的 currency 去 asset_bases 查找 account 的 symbal及 key
   * 已有 coins.yml 的資料取代
   */
  async getCurrenciesSymbol() {
    const query = `
    SELECT
	    accounts.currency,
	    asset_bases.key,
	    asset_bases.symbol
    FROM
	    accounts
	    LEFT JOIN asset_bases ON accounts.currency = asset_bases.id
    GROUP BY
	    accounts.currency;`;
    try {
      // this.logger.debug("getCurrenciesSymbol", query);
      const [currencies] = await this.db.query({
        query,
      });
      return currencies;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/14
   * 原本是用在 account 的 currency 去 asset_bases 查找 account 的 symbal及 key
   * 已有 coins.yml 的資料取代
   */
  async getCurrencies() {
    const query = "SELECT * FROM `asset_bases`;";
    try {
      // this.logger.debug("getCurrencies", query);
      const [currencies] = await this.db.query({
        query,
      });
      return currencies;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/14
   * 沒有地方呼叫
   */
  async getCurrency(currencyId) {
    const query = "SELECT * FROM `asset_bases` WHERE `asset_bases`.`id` = ?;";
    try {
      // this.logger.debug("getCurrency", query, currencyId);
      const [[currency]] = await this.db.query({
        query,
        values: [currencyId],
      });

      return currency;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/14
   * 沒有地方呼叫
   */
  async getCurrencyByKey(currencyKey) {
    const query = "SELECT * FROM `asset_bases` WHERE `asset_bases`.`key` = ?;";
    try {
      // this.logger.debug("getCurrencyByKey", query, currencyKey);
      const [[currency]] = await this.db.query({
        query,
        values: [currencyKey],
      });

      return currency;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async countMembers(conditions) {
    let placeholder = [];
    if (conditions?.before)
      placeholder = [...placeholder, `id < ${conditions.before}`];
    if (conditions?.activated)
      placeholder = [...placeholder, `activated = ${conditions.activated}`];
    let condition =
      placeholder.length > 0 ? `WHERE ${placeholder.join(` AND `)}` : ``;
    const query = `
    SELECT 
        count(*) as counts
    FROM
        members
    ${condition}
    ;`;

    try {
      // this.logger.debug("countMembers", query);
      const [[result]] = await this.db.query({
        query,
      });
      // this.logger.debug(`result`, result, result.counts);
      return result.counts;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getMembers({ limit, offset }) {
    const query = `
    SELECT
        id,
        sn,
        email,
        member_tag,
        refer,
        refer_code,
        activated
    FROM
        members
    ORDER BY
        id
    LIMIT ${limit} OFFSET ${offset}
    ;`;
    try {
      // this.logger.debug("getMembers", query);
      const [members] = await this.db.query({
        query,
      });
      return members;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getMembersLatestAuditRecordIds(ids, groupByAccountId) {
    let placeholder = ids.join(`,`);
    let groupBy = `member_id${groupByAccountId ? ", account_id" : ""}`;
    const query = `
    SELECT
	    max(id) as id,
	    max(updated_at) as updated_at
    FROM
      audit_account_records
    WHERE
	    member_id in(${placeholder})
    GROUP BY
	    ${groupBy}
    ORDER BY
      id
    ;`;
    try {
      // this.logger.debug("getMembersLatestAuditRecordIds", query);
      const [auditRecordIds] = await this.db.query({
        query,
      });
      return auditRecordIds.map((o) => o.id);
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getAccountLatestAuditRecord(accountId) {
    const query = `
    SELECT
      id,
      member_id,
      account_id,
      currency,
      account_version_id_start,
      account_version_id_end,
      balance,
      expect_balance,
      locked,
      expect_locked,
      created_at,
      updated_at,
      fixed_at,
      issued_by
    FROM
      audit_account_records
    WHERE
      account_id = ?
    ORDER BY
      id DESC
    LIMIT 1
    ;`;
    try {
      // this.logger.debug("getAccountLatestAuditRecord", query);
      const [[auditRecord]] = await this.db.query({
        query,
        values: [accountId],
      });
      return auditRecord;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getMembersAuditRecordByIds(ids) {
    if (!ids.length > 0) return [];
    let placeholder = ids.join(`,`);
    const query = `
    SELECT
      id,
      member_id,
      account_id,
      currency,
      account_version_id_start,
      account_version_id_end,
      balance,
      expect_balance,
      locked,
      expect_locked,
      updated_at,
      fixed_at
    FROM
      audit_account_records
    WHERE
	    id in(${placeholder})
    ORDER BY
      id
    ;`;
    try {
      // this.logger.debug("getMembersLatestAuditRecordIds", query);
      const [auditRecords] = await this.db.query({
        query,
      });
      return auditRecords;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getMembersLatestAccountVersionIds(ids, groupByAccountId) {
    let placeholder = ids.join(`,`);
    let groupBy = `member_id${groupByAccountId ? ", account_id" : ""}`;
    const query = `
    SELECT
	    max(id) as id,
	    max(updated_at) as updated_at
    FROM
	    account_versions
    WHERE
	    member_id in(${placeholder})
    GROUP BY
	    ${groupBy}
    ;`;
    try {
      // this.logger.debug("getMembersLatestAccountVersionIds", query);
      const [accountVersionIds] = await this.db.query({
        query,
      });
      return accountVersionIds.map((o) => o.id);
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getMembersAccountVersionByIds(ids) {
    if (!ids.length > 0) return [];
    let placeholder = ids.join(`,`);
    const query = `
    SELECT
      account_versions.id,
      account_versions.member_id,
      account_versions.account_id,
      account_versions.reason,
      account_versions.balance,
      account_versions.locked,
      account_versions.fee,
      account_versions.amount,
      account_versions.modifiable_id,
      account_versions.modifiable_type,
      account_versions.created_at,
      account_versions.currency,
      account_versions.fun
    FROM
	    account_versions
    WHERE
	    account_versions.id in (${placeholder})
    ORDER BY
      id
    ;`;
    try {
      // this.logger.debug(
      //   "getMembersAccountVersionByIds",
      //   query,
      // );
      const [accountVersions] = await this.db.query({
        query,
      });
      return accountVersions;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async getMemberReferral({ referrerId, refereeId }) {
    const query = `
    SELECT
      member_referrals.id,
      member_referrals.commission_plan_id,
      member_referrals.is_enabled,
      member_referrals.created_at
    FROM
      member_referrals
    WHERE
      member_referrals.referrer_id = ?
      AND member_referrals.referee_id = ?
    LIMIT 1;
    `;
    try {
      // this.logger.debug(
      //   "getMemberReferral",
      //   query,
      //   `[${referrerId}, ${refereeId}]`
      // );
      const [[memberReferral]] = await this.db.query({
        query,
        values: [referrerId, refereeId],
      });
      // this.logger.debug("getMemberReferral memberReferral", memberReferral);
      return memberReferral;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getDefaultCommissionPlan() {
    const query = `
    SELECT
      commission_plans.id,
      commission_plans.name,
      commission_plans.is_enabled,
      commission_plans.is_default
    FROM
      commission_plans
    WHERE
      commission_plans.is_enabled = 1
      AND commission_plans.is_default = 1
    LIMIT 1;
    `;
    try {
      // this.logger.debug("getDefaultCommissionPlan", query);
      const [[defaultCommissionPlan]] = await this.db.query({
        query,
      });
      return defaultCommissionPlan;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getCommissionPolicies(planId) {
    const query = `
    SELECT
      commission_policies.id,
      commission_policies.referred_months,
      commission_policies.rate,
      commission_policies.is_enabled
    FROM
      commission_policies
    WHERE
      commission_policies.plan_id = ?
    LIMIT 12;
    `;
    try {
      // this.logger.debug("getCommissionPolicies", query, `[${planId}]`);
      const [commissionPolicies] = await this.db.query({
        query,
        values: [planId],
      });
      return commissionPolicies;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getMemberByCondition(conditions) {
    let placeholder = [],
      values = [];
    if (conditions.id) {
      placeholder = [...placeholder, `id = ?`];
      values = [...values, conditions.id];
    }
    if (conditions.email) {
      placeholder = [...placeholder, `email = ?`];
      values = [...values, conditions.email];
    }
    if (conditions.referCode) {
      placeholder = [...placeholder, `refer_code = ?`];
      values = [...values, conditions.referCode];
    }
    let condition = placeholder.join(` AND `);
    const query = `
      SELECT
	      id,
	      sn,
	      email,
	      member_tag,
	      refer,
        refer_code,
        activated
      FROM
	      members
      WHERE
        ${condition}
      LIMIT 1;
    `;
    try {
      const [[member]] = await this.db.query({
        query,
        values,
      });
      return member;
    } catch (error) {
      this.logger.error(error);
      this.logger.trace("getMemberByCondition", query, values);
      return [];
    }
  }

  async getReferralCommissionsByConditions({ conditions, limit, offset, asc }) {
    let tableName = `referral_commissions`,
      placeholder = ``,
      arr = [],
      values = [],
      orderCodition = asc ? "ASC" : "DESC";
    if (conditions[`referredByMemberId`]) {
      arr = [...arr, `${tableName}.referred_by_member_id = ?`];
      values = [...values, conditions[`referredByMemberId`]];
    }
    if (conditions[`tradeMemberId`]) {
      arr = [...arr, `${tableName}.trade_member_id = ?`];
      values = [...values, conditions[`tradeMemberId`]];
    }
    if (conditions[`voucherId`]) {
      arr = [...arr, `${tableName}.voucher_id = ?`];
      values = [...values, conditions[`voucherId`]];
    }
    if (conditions[`market`]) {
      arr = [...arr, `${tableName}.market = ?`];
      values = [...values, conditions[`market`]];
    }
    if (conditions[`currency`]) {
      arr = [...arr, `${tableName}.currency = ?`];
      values = [...values, conditions[`currency`]];
    }
    if (conditions[`state`]) {
      arr = [...arr, `${tableName}.state = ?`];
      values = [...values, conditions[`state`]];
    }
    if (conditions[`start`] && conditions[`end`]) {
      arr = [...arr, `${tableName}.created_at BETWEEN ? AND ?`];
      values = [...values, conditions[`start`], conditions[`end`]];
    }
    placeholder = arr.join(` AND `);
    const query = `
    SELECT 
        referral_commissions.id,
        referral_commissions.referred_by_member_id,
        referral_commissions.trade_member_id,
        referral_commissions.voucher_id,
        referral_commissions.market,
        referral_commissions.currency,
        referral_commissions.ref_gross_fee,
        referral_commissions.ref_net_fee,
        referral_commissions.amount,
        referral_commissions.state,
        referral_commissions.created_at,
        referral_commissions.updated_at
    FROM
	      referral_commissions
    WHERE 
        ${placeholder}
    ORDER BY
        referral_commissions.created_at ${orderCodition};`;
    // LIMIT ${limit} OFFSET ${offset};`;
    // ++ TODO 要小心資料量過大的問題
    try {
      // this.logger.debug("getReferralCommissionsByConditions", query, values);
      const [referralCommissions] = await this.db.query({
        query,
        values,
      });
      return referralCommissions;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/14
   * getMemberById 同 getMemberByEmail整合成 getMemberByCondition
   */
  async getMemberByEmail(memberEmail) {
    const query = "SELECT * FROM `members` WHERE `members`.`email` = ?;";
    try {
      // this.logger.debug("getMemberByEmail", query, `[${memberEmail}]`);
      const [[member]] = await this.db.query({
        query,
        values: [memberEmail],
      });
      return member;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/14
   * 與 getDoneOrders 整合
   */
  async getDoneOrder(orderId) {
    const query = `
      SELECT
	        orders.id,
	        orders.bid,
	        orders.ask,
	        orders.currency,
	        (SUM(vouchers.price * vouchers.volume) / orders.origin_volume) AS price,
	        orders.volume,
	        orders.origin_volume,
	        orders.state,
	        orders.done_at,
	        orders.type,
	        orders.member_id,
	        orders.created_at,
	        orders.updated_at,
	        orders.sn,
	        orders.source,
	        orders.ord_type,
	        orders.locked,
	        orders.origin_locked,
	        orders.funds_received,
	        orders.trades_count
      FROM
          orders
	        JOIN vouchers ON orders.id = vouchers.order_id
      WHERE
          orders.id = ?;`;
    try {
      // this.logger.debug("getDoneOrder", query, `[${orderId}]`);
      const [[order]] = await this.db.query({
        query,
        values: [orderId],
      });
      return order;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getDoneOrders({
    orderId,
    quoteCcy,
    baseCcy,
    memberId,
    state,
    type,
    ordType,
    offset,
    limit,
  }) {
    if (!orderId && (!quoteCcy || !baseCcy || !memberId || !state || !type)) {
      this.logger.error("missing params");
      return [];
    }
    let whereCondition = orderId
      ? ` orders.id = ?`
      : ` orders.member_id = ?
	        AND orders.bid = ?
	        AND orders.ask = ?
          AND orders.state = ?
          AND orders.type = ?
          AND orders.ord_type <> '${ordType}
        ORDER BY 
          updated_at DESC`;
    let limitCondition = orderId
      ? `LIMIT 1`
      : limit
      ? `LIMIT ${limit} ${offset ? `OFFSET ${offset}` : ``}`
      : ``;
    if (!whereCondition) throw Error(`missing where condition`);
    const query = `
      SELECT
	        orders.id,
	        orders.bid,
	        orders.ask,
	        orders.currency,
          orders.price,
	        orders.volume,
	        orders.origin_volume,
	        orders.state,
	        orders.done_at,
	        orders.type,
	        orders.member_id,
	        orders.created_at,
	        orders.updated_at,
	        orders.sn,
	        orders.source,
	        orders.ord_type,
	        orders.locked,
	        orders.origin_locked,
	        orders.funds_received,
	        orders.trades_count
      FROM
          orders
      WHERE
          ${whereCondition}
      ${limitCondition}
         ;`;
    try {
      // this.logger.debug(
      //   "getDoneOrders",
      //   query,
      //   orderId ? [orderId] : [memberId, quoteCcy, baseCcy, state, type]
      // );
      const [orders] = await this.db.query({
        query,
        values: orderId
          ? [orderId]
          : [memberId, quoteCcy, baseCcy, state, type],
      });
      return orders;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getOrderList({ quoteCcy, baseCcy, memberId, orderType, state, asc }) {
    if (!memberId || !quoteCcy || !baseCcy) throw Error(`missing params`);
    let placeholder = [];
    if (memberId) placeholder = [...placeholder, `member_id = ${memberId}`];
    if (quoteCcy) placeholder = [...placeholder, `bid = ${quoteCcy}`];
    if (baseCcy) placeholder = [...placeholder, `ask = ${baseCcy}`];
    if (orderType) placeholder = [...placeholder, `ord_type = ${orderType}`];
    if (state) placeholder = [...placeholder, `state = ${state}`];
    let whereCondition =
      placeholder.length > 0 ? ` WHERE ${placeholder.join(` AND `)}` : ``;
      if (!whereCondition) throw Error(`missing where condition`);
    let orderCodition = asc ? "ASC" : "DESC";
    const query = `
    SELECT
      orders.id,
      orders.bid,
      orders.ask,
      orders.price,
      orders.volume,
      orders.origin_volume,
      orders.state,
      orders.type,
      orders.member_id,
      orders.created_at,
      orders.ord_type,
      orders.locked,
      orders.origin_locked,
      orders.funds_received,
      orders.trades_count,
      orders.created_at,
      orders.updated_at
    FROM
      orders
    ${whereCondition}
    ORDER BY
      orders.updated_at ${orderCodition};`;

    try {
      // this.logger.debug("getOrderList", query);
      const [orders] = await this.db.query({
        query,
      });
      return orders;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/19
   * 沒有地方呼叫
   */
  async getVouchers({ memberId, ask, bid, days, asc, limit, offset }) {
    let orderCodition = asc ? "ASC" : "DESC";
    const query = `
    SELECT
      vouchers.id,
      vouchers.member_id,
      vouchers.order_id,
      vouchers.trade_id,
      vouchers.ask,
      vouchers.bid,
      vouchers.price,
      vouchers.volume,
      vouchers.value,
      vouchers.trend,
      vouchers.ask_fee,
      vouchers.bid_fee,
      vouchers.created_at
    FROM
      vouchers
    WHERE
      vouchers.member_id = ?
      AND vouchers.ask = ?
      AND vouchers.bid = ?
      AND vouchers.created_at > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${days} DAY)
    ORDER BY
      vouchers.created_at ${orderCodition}
    LIMIT ${limit} OFFSET ${offset};`;
    try {
      // this.logger.debug("getVouchers", query, `[${memberId}, ${ask}, ${bid}]`);
      const [trades] = await this.db.query({
        query,
        values: [memberId, ask, bid],
      });
      return trades;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/14
   * 沒有地方呼叫
   */
  async getOrders() {
    const query = "SELECT * FROM `orders`;";
    try {
      // this.logger.debug("getOrders", query);
      const [orders] = await this.db.query({
        query,
      });
      return orders;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/14
   * 沒有地方呼叫
   */
  async getTrades(quoteCcy, baseCcy) {
    const query =
      "SELECT `trades`.* FROM `trades`, `orders` WHERE `orders`.`id` = `trades`.`ask_id` AND `trades`.`currency` = ? AND `orders`.`ask` = ?;";
    try {
      // this.logger.debug("getTrades", query, `[${quoteCcy}, ${baseCcy}]`);
      const [trades] = await this.db.query({
        query,
        values: [quoteCcy, baseCcy],
      });
      return trades;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getEmailsByMemberIds(memberIds) {
    if (!memberIds.length > 0) return [];
    let placeholder = memberIds.join(`,`);
    let query = `
    SELECT
	    members.id,
	    members.email
    FROM
	    members
    WHERE
	     members.id in(${placeholder});
    `;
    try {
      // this.logger.debug("[mysql] getEmailsByMemberIds", query, memberIds);
      const [emails] = await this.db.query({
        query,
        values: memberIds,
      });
      return emails;
    } catch (error) {
      this.logger.error(error);
    }
  }

  /**
   * [deprecated] 2022/10/14
   * replaced by getEmailByMemberId
   * 原本用在 getOuterPendingOrders 取得 outerOrder 紀錄的 memberId 對應的 email
   */
  async getOrdersJoinMemberEmail(state) {
    const query = `
    SELECT
	    orders.id,
	    orders.member_id,
	    members.email,
	    members.member_tag
    FROM
	    orders
	    JOIN members ON orders.member_id = members.id
    WHERE
	    orders.state = ?;`;
    try {
      // this.logger.debug("getOrdersJoinMemberEmail", query, `[${state}]`);
      const [orders] = await this.db.query({
        query,
        values: [state],
      });
      return orders;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   *  -- temporary 2022-11-16
   */
  async getAbnormalOuterTrade({ exchangeCode, start, end }) {
    const query = `
    SELECT
	    *
    FROM
	    outer_trades
    WHERE
	    exchange_code = ?
	    AND status <> 8
	    AND status <> 7
	    AND update_at BETWEEN ?
	    AND ?
    ;`;
    try {
      const [outerTrades] = await this.db.query({
        query,
        values: [exchangeCode, start, end],
      });
      return outerTrades;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getOuterTradesByStatus({ exchangeCode, status, asc, limit, offset }) {
    const query = `
      SELECT
        outer_trades.id,
        outer_trades.data,
        outer_trades.exchange_code
      FROM
        outer_trades
      WHERE
        outer_trades.exchange_code = ?
        AND outer_trades.status = ?
     ;`;

    try {
      // this.logger.debug(
      //   "getOuterTradesByStatus",
      //   query,
      //   `[${exchangeCode}, ${status}]`
      // );
      const [outerTrades] = await this.db.query({
        query,
        values: [exchangeCode, status],
      });
      return outerTrades;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/14
   * getOuterTradesBetweenDays 同 getOuterTradesByDayAfter 整合在
   * getOuterTrades
   */
  async getOuterTradesBetweenDays(exchangeCode, start, end) {
    const query = `
    SELECT outer_trades.*,
        referral_commissions.ref_gross_fee,
        referral_commissions.ref_net_fee,
        referral_commissions.amount,
        referral_commissions.state
    FROM outer_trades
        LEFT JOIN referral_commissions ON outer_trades.voucher_id = referral_commissions.voucher_id
    WHERE
        outer_trades.exchange_code = ?
        AND outer_trades.create_at BETWEEN ?
        AND ?
    ORDER BY
        outer_trades.create_at DESC;`;
    try {
      // this.logger.debug(
      //   "getOuterTradesBetweenDayss",
      //   query,
      //   `[${exchangeCode}, ${start}, ${end}]`
      // );
      const [outerTrades] = await this.db.query({
        query,
        values: [exchangeCode, start, end],
      });
      return outerTrades;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/26
   * integrate with getReferralCommissionsByConditions
   */
  async getReferralCommissions({ market, start, end, limit, offset, asc }) {
    let orderCodition = asc ? "ASC" : "DESC";
    const query = `
    SELECT 
        referral_commissions.id,
        referral_commissions.referred_by_member_id,
        referral_commissions.trade_member_id,
        referral_commissions.voucher_id,
        referral_commissions.market,
        referral_commissions.currency,
        referral_commissions.ref_gross_fee,
        referral_commissions.ref_net_fee,
        referral_commissions.amount,
        referral_commissions.state
    FROM
	      referral_commissions
    WHERE 
        referral_commissions.market = ?
        AND referral_commissions.created_at BETWEEN ?
        AND ?
    ORDER BY
        referral_commissions.created_at ${orderCodition}
    LIMIT ${limit} OFFSET ${offset};`;
    try {
      // this.logger.debug(
      //   "getReferralCommissions",
      //   query,

      //   `[${market}, ${start}, ${end}]`
      // );
      const [outerTrades] = await this.db.query({
        query,
        values: [market, start, end],
      });
      return outerTrades;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  // ++ TO BE SOLVED 耗時
  async getOuterTrades({
    type,
    exchangeCode,
    currency,
    status,
    days,
    start,
    end,
    limit,
    offset,
    asc,
  }) {
    if (
      !exchangeCode ||
      (type === Database.TIME_RANGE_TYPE.DAY_AFTER && !days) ||
      (type === Database.TIME_RANGE_TYPE.BETWEEN && (!start || !end))
    )
      throw Error(`missing params`);
    let placeholder = [];
    if (exchangeCode)
      placeholder = [...placeholder, `exchange_code = ${exchangeCode}`];
    if (currency) placeholder = [...placeholder, `currency = ${currency}`];
    if (status) placeholder = [...placeholder, `status = ${status}`];
    if (type === Database.TIME_RANGE_TYPE.DAY_AFTER && days)
      placeholder = [
        ...placeholder,
        `create_at > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${days} DAY)`,
      ];
    if (type === Database.TIME_RANGE_TYPE.BETWEEN && start && end)
      placeholder = [
        ...placeholder,
        `create_at BETWEEN "${start}"
        AND "${end}"`,
      ];
    let whereCondition =
      placeholder.length > 0 ? ` WHERE ${placeholder.join(` AND `)}` : ``;
      if (!whereCondition) throw Error(`missing where condition`);
    let orderCodition = asc ? "ASC" : "DESC";
    let limitCondition = limit
      ? `LIMIT ${limit} ${offset ? `OFFSET ${offset}` : ``}`
      : ``;
    const query = `
    SELECT 
        outer_trades.id,
        outer_trades.exchange_code,
        outer_trades.status,
        outer_trades.data,
        outer_trades.member_id,
        outer_trades.member_tag,
        outer_trades.kind,
        outer_trades.email,
        outer_trades.order_id,
        outer_trades.order_price,
        outer_trades.order_origin_volume,
        outer_trades.voucher_price,
        outer_trades.voucher_volume,
        outer_trades.voucher_fee,
        outer_trades.voucher_fee_currency,
        outer_trades.referral_commission_id,
        outer_trades.referral,
        outer_trades.trade_id,
        outer_trades.create_at,
        outer_trades.update_at,
        outer_trades.voucher_id
    FROM 
        outer_trades
    ${whereCondition}
    ORDER BY
        outer_trades.create_at ${orderCodition}
    ${limitCondition}
    ;`;
    try {
      // this.logger.debug("getOuterTrades", query);
      const [outerTrades] = await this.db.query({
        query,
      });
      return outerTrades;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getDepositRecords({ memberId, currency, start, end, asc }) {
    if (!memberId || !currency || !start || !end) throw Error(`missing params`);
    let placeholder = [`aasm_state = 'accepted'`];
    if (memberId) placeholder = [...placeholder, `member_id = ${memberId}`];
    if (currency) placeholder = [...placeholder, `currency = ${currency}`];
    if (start && end)
      placeholder = [
        ...placeholder,
        `created_at BETWEEN "${start}"
        AND "${end}"`,
      ];
    let whereCondition =
      placeholder.length > 0 ? ` WHERE ${placeholder.join(` AND `)}` : ``;
      if (!whereCondition) throw Error(`missing where condition`);
    let orderCodition = asc ? "ASC" : "DESC";
    const query = `
    SELECT 
        id,
        account_id,
        member_id,
        currency,
        amount,
        fee,
        aasm_state,
        created_at,
        updated_at
    FROM 
        deposits
    ${whereCondition}
    ORDER BY
        created_at ${orderCodition}
    ;`;
    try {
      // this.logger.debug("getDepositRecords", query);
      const [deposits] = await this.db.query({
        query,
      });
      return deposits;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getWithdrawRecords({ memberId, currency, start, end, asc }) {
    if (!memberId || !currency || !start || !end) throw Error(`missing params`);
    let placeholder = [`aasm_state = 'done'`];
    if (memberId) placeholder = [...placeholder, `member_id = ${memberId}`];
    if (currency) placeholder = [...placeholder, `currency = ${currency}`];
    if (start && end)
      placeholder = [
        ...placeholder,
        `created_at BETWEEN "${start}"
        AND "${end}"`,
      ];
    let whereCondition =
      placeholder.length > 0 ? ` WHERE ${placeholder.join(` AND `)}` : ``;
      if (!whereCondition) throw Error(`missing where condition`);
    let orderCodition = asc ? "ASC" : "DESC";
    const query = `
    SELECT 
        id,
        account_id,
        member_id,
        currency,
        amount,
        fee,
        aasm_state,
        created_at,
        updated_at
    FROM 
        withdraws
    ${whereCondition}
    ORDER BY
        created_at ${orderCodition}
    ;`;
    try {
      // this.logger.debug("getWithdrawRecords", query);
      const [withdraws] = await this.db.query({
        query,
      });
      return withdraws;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getOrderRecords({ memberId, currency, start, end, asc }) {
    if (!memberId || !start || !end) throw Error(`missing params`);
    let placeholder = [];
    if (memberId) placeholder = [...placeholder, `member_id = ${memberId}`];
    if (currency)
      placeholder = [
        ...placeholder,
        `(ask = ${currency} OR bid = ${currency})`,
      ];
    if (start && end)
      placeholder = [
        ...placeholder,
        `created_at BETWEEN "${start}"
        AND "${end}"`,
      ];
    let whereCondition =
      placeholder.length > 0 ? ` WHERE ${placeholder.join(` AND `)}` : ``;
      if (!whereCondition) throw Error(`missing where condition`);
    let orderCodition = asc ? "ASC" : "DESC";
    const query = `
    SELECT 
        id,
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
        ord_type,
        locked,
        origin_locked,
        funds_received,
        trades_count
    FROM 
        orders
    ${whereCondition}
    ORDER BY
        created_at ${orderCodition}
    ;`;
    try {
      // this.logger.debug("getOrderRecords", query);
      let [withdraws] = await this.db.query({
        query,
      });
      return withdraws;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async countOuterTrades({
    id,
    exchangeCode,
    currency,
    type,
    orderId,
    status,
    days,
    start,
    end,
  }) {
    if (
      !exchangeCode ||
      (type === Database.TIME_RANGE_TYPE.DAY_AFTER && !days) ||
      (type === Database.TIME_RANGE_TYPE.BETWEEN && (!start || !end))
    )
      throw Error(`missing params`);
    let placeholder = [];
    if (id) placeholder = [...id, `id = ${id}`];
    if (exchangeCode)
      placeholder = [...placeholder, `exchange_code = ${exchangeCode}`];
    if (orderId) placeholder = [...placeholder, `order_id = ${orderId}`];
    if (currency) placeholder = [...placeholder, `currency = ${currency}`];
    if (status) placeholder = [...placeholder, `status = ${status}`];
    if (type === Database.TIME_RANGE_TYPE.DAY_AFTER && days)
      placeholder = [
        ...placeholder,
        `create_at > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${days} DAY)`,
      ];
    if (type === Database.TIME_RANGE_TYPE.BETWEEN && start && end)
      placeholder = [
        ...placeholder,
        `create_at BETWEEN "${start}"
        AND "${end}"`,
      ];
    let whereCondition =
      placeholder.length > 0 ? ` WHERE ${placeholder.join(` AND `)}` : ``;
      if (!whereCondition) throw Error(`missing where condition`);
    const query = `
    SELECT 
        count(*) as counts
    FROM 
        outer_trades
    ${whereCondition}
    ;`;
    try {
      // this.logger.debug("countOuterTrades", query);
      const [[counts]] = await this.db.query({
        query,
      });
      // this.logger.debug(`counts`, counts);
      return counts;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async countOrders({ currency, state }) {
    const query = `
    SELECT 
        count(*) as counts
    FROM 
        orders
    WHERE 
      orders.currency = ?
      AND orders.state = ?
    ;`;
    try {
      // this.logger.debug("countOrders", query, `${`[${currency}, ${state}]`}`);
      const [[counts]] = await this.db.query({
        query,
        values: [currency, state],
      });
      // this.logger.debug(`counts`, counts);
      return counts;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getOrder(orderId, { dbTransaction }) {
    const query = `
      SELECT
	        orders.id,
	        orders.bid,
	        orders.ask,
	        orders.currency,
          orders.price,
	        orders.volume,
	        orders.origin_volume,
	        orders.state,
	        orders.done_at,
	        orders.type,
	        orders.member_id,
	        orders.created_at,
	        orders.updated_at,
	        orders.sn,
	        orders.source,
	        orders.ord_type,
	        orders.locked,
	        orders.origin_locked,
	        orders.funds_received,
	        orders.trades_count
      FROM
          orders
      WHERE
          orders.id = ?
      LIMIT 1;`;
    try {
      // this.logger.debug("getOrder", query, `[${orderId}]`);
      const [[order]] = await this.db.query(
        {
          query,
          values: [orderId],
        },
        {
          transaction: dbTransaction,
          lock: dbTransaction.LOCK.UPDATE,
        }
      );
      return order;
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
      return [];
    }
  }

  async getVouchersByOrderId(orderId) {
    const query = `
    SELECT
      vouchers.id,
      vouchers.member_id,
      vouchers.order_id,
      vouchers.trade_id,
      vouchers.ask,
      vouchers.bid,
      vouchers.price,
      vouchers.volume,
      vouchers.value,
      vouchers.trend,
      vouchers.ask_fee,
      vouchers.bid_fee,
      vouchers.created_at
    FROM
      vouchers
    WHERE
      vouchers.order_id = ?
    ;`;
    try {
      // this.logger.debug("getVouchersByOrderId", query, orderId);
      const [vouchers] = await this.db.query({
        query,
        values: [orderId],
      });
      return vouchers;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  // 不應該超過 3 筆
  async getAccountVersionsByModifiableIds(ids, type) {
    if (!ids.length > 0) return [];
    let placeholder = ids.join(`,`);
    const query = `
    SELECT
      id,
      member_id,
      account_id,
      reason,
      balance,
      locked,
      fee,
      amount,
      modifiable_id,
      modifiable_type,
      created_at,
      currency,
      fun
    FROM
	    account_versions
    WHERE
	    modifiable_id in(${placeholder})
      AND modifiable_type = ?
    ;`;
    try {
      // this.logger.debug("getAccountVersionsByModifiableId", query, `[${type}]`);
      const [accountVersions] = await this.db.query({
        query,
        values: [type],
      });
      return accountVersions;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  /**
   * 待優化，可以同 getVoucherBy ? 整合
   */
  async getVoucherByOrderIdAndTradeId(orderId, tradeId) {
    const query = `
    SELECT
      vouchers.id,
      vouchers.member_id,
      vouchers.order_id,
      vouchers.trade_id,
      vouchers.ask,
      vouchers.bid,
      vouchers.price,
      vouchers.volume,
      vouchers.value,
      vouchers.trend,
      vouchers.ask_fee,
      vouchers.bid_fee,
      vouchers.created_at
    FROM
      vouchers
    WHERE
      vouchers.order_id = ?
      AND vouchers.trade_id = ?
    LIMIT 1;`;
    try {
      // this.logger.debug(
      //   "getVoucherByOrderIdAndTradeId",
      //   query,
      //   `[${orderId}, ${tradeId}]`
      // );
      const [[voucher]] = await this.db.query({
        query,
        values: [orderId, tradeId],
      });
      return voucher;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async getTradeByTradeFk(tradeFk) {
    const query = `
    SELECT
      trades.id,
      trades.price,
      trades.volume,
      trades.ask_id,
      trades.bid_id,
      trades.trend,
      trades.currency,
      trades.created_at,
      trades.ask_member_id,
      trades.bid_member_id,
      trades.funds,
      trades.trade_fk
    FROM
      trades
    WHERE
      trades.trade_fk = ?
    LIMIT 1;`;
    try {
      // this.logger.debug("getTradeByTradeFk", query, tradeFk);
      const [[trade]] = await this.db.query({
        query,
        values: [tradeFk],
      });
      // this.logger.debug("getTradeByTradeFk trade", trade);
      return trade;
    } catch (error) {
      this.logger.error(error);
      return null;
    }
  }

  async getOrdersByIds(ids) {
    if (!ids.length > 0) return [];
    let placeholder = ids.join(`,`);
    let query = `
    SELECT
	    orders.id,
	    orders.member_id,
	    orders.price,
      orders.volume,
      orders.origin_volume,
      orders.state,
      orders.ord_type,
      orders.funds_received,
      orders.created_at,
      orders.updated_at
    FROM
      orders
    WHERE
      orders.id in(${placeholder});
    `;
    try {
      // this.logger.debug("[mysql] getOrdersByIds", query, ids);
      const [orders] = await this.db.query({
        query,
        values: ids,
      });
      return orders;
    } catch (error) {
      this.logger.error(error);
    }
  }

  async getTradesByIds(ids) {
    if (!ids.length > 0) return [];
    let placeholder = ids.join(`,`);
    let query = `
    SELECT
	    trades.id,
	    trades.ask_id,
	    trades.bid_id,
	    trades.ask_member_id,
	    trades.bid_member_id,
	    trades.price,
      trades.volume,
      trades.currency,
      trades.funds,
      trades.trade_fk,
      trades.created_at,
      trades.updated_at
    FROM
      trades
    WHERE
      trades.id in(${placeholder});
    `;
    try {
      // this.logger.debug("[mysql] getTradesByIds", query, ids);
      const [orders] = await this.db.query({
        query,
      });
      return orders;
    } catch (error) {
      this.logger.error(error);
    }
  }

  async getVouchersByIds(ids) {
    if (!ids.length > 0) return [];
    let placeholder = ids.join(`,`);
    let query = `
    SELECT
	    vouchers.id,
	    vouchers.price,
      vouchers.volume,
      vouchers.trend,
      vouchers.ask,
      vouchers.bid,
      vouchers.ask_fee,
      vouchers.bid_fee
    FROM
      vouchers
    WHERE
      vouchers.id in(${placeholder});
    `;
    try {
      // this.logger.debug("[mysql] getVouchersByIds", query, ids);
      const [vouchers] = await this.db.query({
        query,
        values: ids,
      });
      return vouchers;
    } catch (error) {
      this.logger.error(error);
    }
  }

  async getOuterTradesByTradeIds(tradeIds) {
    let placeholder = tradeIds.join(`,`);
    let query = `
    SELECT
      outer_trades.trade_id,
	    outer_trades.data
    FROM
      outer_trades
    WHERE
      outer_trades.trade_id in(${placeholder});
    `;
    try {
      // this.logger.debug("[mysql] getVouchersByIds", query, ids);
      const [vouchers] = await this.db.query({
        query,
      });
      return vouchers;
    } catch (error) {
      this.logger.error(error);
    }
  }

  async getReferralCommissionsByMarkets({ markets, start, end, asc }) {
    let placeholder = markets.join(`,`);
    let orderCodition = asc ? "ASC" : "DESC";
    const query = `
    SELECT 
        referral_commissions.id,
        referral_commissions.referred_by_member_id,
        referral_commissions.trade_member_id,
        referral_commissions.voucher_id,
        referral_commissions.market,
        referral_commissions.currency,
        referral_commissions.ref_gross_fee,
        referral_commissions.ref_net_fee,
        referral_commissions.amount,
        referral_commissions.state,
        referral_commissions.created_at,
        referral_commissions.updated_at
    FROM
	      referral_commissions
    WHERE 
        referral_commissions.market in(${placeholder})
        AND referral_commissions.created_at BETWEEN "${start}"
        AND "${end}"
    ORDER BY
        referral_commissions.created_at ${orderCodition};`;
    try {
      // this.logger.debug("getReferralCommissionsByConditions", query, markets);
      const [referralCommissions] = await this.db.query({
        query,
        values: markets,
      });
      return referralCommissions;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  /**
   *  -- temporary 2022-11-17
   * [deprecated] 2022-11-18
   */
  async getAbnormalAccountVersions(id) {
    const query = `
    SELECT
      id,
      member_id,
      account_id,
      reason,
      modifiable_type,
      modifiable_id
    FROM
      account_versions
    WHERE
      id > ?
      AND created_at = '0000-00-00 00:00:00'
    ORDER BY
      id;`;
    try {
      // this.logger.debug("getAbnormalAccountVersions", query, id);
      const [accountVersions] = await this.db.query({
        query,
        values: [id],
      });
      return accountVersions;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
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
    const query =
      "INSERT INTO `orders` (" +
      "`id`, `bid`, `ask`, `currency`, `price`, `volume`, `origin_volume`, `state`," +
      " `done_at`, `type`, `member_id`, `created_at`, `updated_at`, `sn`, `source`," +
      " `ord_type`, `locked`, `origin_locked`, `funds_received`, `trades_count`)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";

    try {
      // this.logger.debug(
      //   "insertOrder",
      //   "DEFAULT",
      //   query,
      //   bid,
      //   ask,
      //   currency,
      //   price,
      //   volume,
      //   origin_volume,
      //   state,
      //   done_at,
      //   type,
      //   member_id,
      //   created_at,
      //   updated_at,
      //   sn,
      //   source,
      //   ord_type,
      //   locked,
      //   origin_locked,
      //   funds_received,
      //   trades_count
      // );
      return this.db.query(
        {
          query,
          values: [
            "DEFAULT",
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
          ],
        },
        {
          transaction: dbTransaction,
        }
      );
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
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
    let result, accountVersionId;
    const query =
      "INSERT INTO `account_versions` (`id`, `member_id`, `account_id`, `reason`, `balance`, `locked`, `fee`, `amount`, `modifiable_id`, `modifiable_type`, `created_at`, `updated_at`, `currency`, `fun`)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
    try {
      // this.logger.debug(
      //   "insertAccountVersion",
      //   query,
      //   "DEFAULT",
      //   member_id,
      //   accountId,
      //   reason,
      //   balance,
      //   locked,
      //   fee,
      //   amount,
      //   modifiable_id,
      //   modifiable_type,
      //   created_at,
      //   updated_at,
      //   currency,
      //   fun
      // );
      result = await this.db.query(
        {
          query,
          values: [
            "DEFAULT",
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
          ],
        },
        {
          transaction: dbTransaction,
        }
      );
      accountVersionId = result[0];
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
    return accountVersionId;
  }

  async insertOuterOrders(orders, { dbTransaction }) {
    let query,
      placeholder,
      values = [];
    for (let order of orders) {
      values = [
        ...values,
        `(${order.id}, ${order.exchangeCode}, ${order.memberId}, ${
          order.market
        }, ${order.price}, ${order.volume}, ${
          !!order.averageFilledPrice ? order.averageFilledPrice : null
        }, ${order.accumulateFilledvolume}, "${order.state}", "${
          order.createdAt
        }", "${order.updatedAt}", '${order.data}')`,
      ];
    }
    // this.logger.debug("[mysql] insertOuterOrders values", values);
    placeholder = values.join(`, `);
    query = `
    INSERT INTO outer_orders (id, exchange_code, member_id, market, price, volume, average_filled_price, accumulate_filled_volume, state, created_at, updated_at, data)
      VALUES ${placeholder} ON DUPLICATE KEY UPDATE average_filled_price = VALUES(average_filled_price), 
      accumulate_filled_volume = VALUES(accumulate_filled_volume),
      state = VALUES(state),
      updated_at = VALUES(updated_at),
      data = VALUES(data)
    ;
    `;
    // let result;
    try {
      // this.logger.debug("[mysql] insertOuterOrder query", query);
      await this.db.query(
        {
          query,
        },
        {
          transaction: dbTransaction,
        }
      );
      // this.logger.debug(`insertOuterOrders`, result);
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
  }

  // ++ TODO 2022/11/25 需要優化 query 不在同一句可以看到
  async insertOuterTrades(trades, { dbTransaction }) {
    let query =
        "INSERT IGNORE INTO `outer_trades` (`id`,`exchange_code`,`create_at`,`status`,`data`) VALUES",
      values = [],
      index = 0;
    for (let trade of trades) {
      query +=
        index === trades.length - 1 ? " (?, ?, ?, ?, ?);" : " (?, ?, ?, ?, ?),";
      values.push(trade.tradeId);
      values.push(trade.exchangeCode);
      values.push(trade.createdAt);
      values.push(trade.status);
      values.push(trade.data);
      index++;
    }
    // let result;
    try {
      // this.logger.debug("[mysql] insertOuterTrades", query, values);
      await this.db.query(
        {
          query,
          values,
        },
        {
          transaction: dbTransaction,
        }
      );
      // this.logger.debug(`insertOuterTrades`, result);
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
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
    let result, tradeId;
    const query =
      "INSERT INTO `trades` (`id`,`price`,`volume`,`ask_id`,`bid_id`,`trend`,`currency`,`created_at`,`updated_at`,`ask_member_id`,`bid_member_id`,`funds`,`trade_fk`)" +
      // " OUTPUT Inserted.ID " +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
    try {
      // this.logger.debug(
      //   "insertTrades",
      //   query,
      //   "DEFAULT",
      //   price,
      //   volume,
      //   ask_id,
      //   bid_id,
      //   trend,
      //   currency,
      //   created_at,
      //   updated_at,
      //   ask_member_id,
      //   bid_member_id,
      //   funds,
      //   trade_fk
      // );
      result = await this.db.query(
        {
          query,
          values: [
            "DEFAULT",
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
          ],
        },
        {
          transaction: dbTransaction,
        }
      );
      // this.logger.debug(`insertTrades result`, result);
      tradeId = result[0];
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
    return tradeId;
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
    let result, voucherId;
    const query =
      "INSERT INTO `vouchers` (`id`,`member_id`,`order_id`,`trade_id`,`designated_trading_fee_asset_history_id`,`ask`,`bid`,`price`,`volume`,`value`,`trend`,`ask_fee`,`bid_fee`,`created_at`)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
    try {
      // this.logger.debug(
      //   "insertVouchers",
      //   query,
      //   "DEFAULT",
      //   member_id,
      //   order_id,
      //   trade_id,
      //   designated_trading_fee_asset_history_id,
      //   ask,
      //   bid,
      //   price,
      //   volume,
      //   value,
      //   trend,
      //   ask_fee,
      //   bid_fee,
      //   created_at
      // );
      result = await this.db.query(
        {
          query,
          values: [
            "DEFAULT",
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
          ],
        },
        {
          transaction: dbTransaction,
        }
      );
      // this.logger.debug(`insertVouchers result`, result);
      voucherId = result[0];
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
    return voucherId;
  }

  async insertReferralCommission(
    referredByMemberId,
    tradeMemberId,
    voucherId,
    appliedPlanId,
    appliedPolicyId,
    trend,
    market,
    currency,
    refGrossFee,
    refNetFee,
    amount,
    state,
    depositedAt,
    createdAt,
    updatedAt,
    { dbTransaction }
  ) {
    let result, referralCommissionId;
    const query =
      "INSERT INTO `referral_commissions` (`id`,`referred_by_member_id`,`trade_member_id`,`voucher_id`,`applied_plan_id`, `applied_policy_id`, `trend`, `market`, `currency`, `ref_gross_fee`, `ref_net_fee`, `amount`, `state`, `deposited_at`, `created_at`, `updated_at`)" +
      // " OUTPUT Inserted.ID " +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
    try {
      // this.logger.debug(
      //   "insertReferralCommission",
      //   query,
      //   "DEFAULT",
      //   referredByMemberId,
      //   tradeMemberId,
      //   voucherId,
      //   appliedPlanId,
      //   appliedPolicyId,
      //   trend,
      //   market,
      //   currency,
      //   refGrossFee,
      //   refNetFee,
      //   amount,
      //   state,
      //   depositedAt,
      //   createdAt,
      //   updatedAt
      // );
      result = await this.db.query(
        {
          query,
          values: [
            "DEFAULT",
            referredByMemberId,
            tradeMemberId,
            voucherId,
            appliedPlanId,
            appliedPolicyId,
            trend,
            market,
            currency,
            refGrossFee,
            refNetFee,
            amount,
            state,
            depositedAt,
            createdAt,
            updatedAt,
          ],
        },
        {
          transaction: dbTransaction,
        }
      );
      // this.logger.debug(`insertReferralCommission result`, result);
      referralCommissionId = result[0];
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
    return referralCommissionId;
  }

  async insertAuditAccountRecord(
    account_id,
    member_id,
    currency,
    account_version_id_start,
    account_version_id_end,
    balance,
    expect_balance,
    locked,
    expect_locked,
    created_at,
    updated_at,
    fixed_at,
    issued_by,
    { dbTransaction }
  ) {
    let result, accountVersionId;
    const query = `
    INSERT INTO audit_account_records (id, account_id, member_id, currency, account_version_id_start, account_version_id_end, balance, expect_balance, locked, expect_locked, created_at, updated_at, fixed_at, issued_by) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE balance = ${balance}, 
      expect_balance = ${expect_balance}, 
      locked = ${locked}, 
      expect_locked = ${expect_locked}, 
      updated_at = "${updated_at}";`;
    try {
      // this.logger.debug(
      //   "insertAuditAccountRecord",
      //   query,
      //   "DEFAULT",
      //   account_id,
      //   member_id,
      //   currency,
      //   account_version_id_start,
      //   account_version_id_end,
      //   balance,
      //   expect_balance,
      //   locked,
      //   expect_locked,
      //   created_at,
      //   updated_at,
      //   fixed_at,
      //   issued_by
      // );
      result = await this.db.query(
        {
          query,
          values: [
            "DEFAULT",
            account_id,
            member_id,
            currency,
            account_version_id_start,
            account_version_id_end,
            balance,
            expect_balance,
            locked,
            expect_locked,
            created_at,
            updated_at,
            fixed_at,
            issued_by,
          ],
        },
        {
          transaction: dbTransaction,
        }
      );
      accountVersionId = result[0];
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
    return accountVersionId;
  }

  async insertFixedAccountRecord(
    account_id,
    member_id,
    currency,
    audit_account_records_id,
    origin_balance,
    balance,
    origin_locked,
    locked,
    created_at,
    updated_at,
    issued_by,
    { dbTransaction }
  ) {
    let result, accountVersionId;
    const query = `
    INSERT INTO fixed_account_records (id, account_id, member_id, currency, audit_account_records_id, origin_balance, balance, origin_locked, locked, created_at, updated_at, issued_by) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;
    try {
      // this.logger.debug(
      //   "insertFixedAccountRecord",
      //   query,
      //   "DEFAULT",
      // account_id,
      // member_id,
      // currency,
      // audit_account_records_id,
      // origin_balance,
      // balance,
      // origin_locked,
      // locked,
      // created_at,
      // updated_at,
      // issued_by,
      // );
      result = await this.db.query(
        {
          query,
          values: [
            "DEFAULT",
            account_id,
            member_id,
            currency,
            audit_account_records_id,
            origin_balance,
            balance,
            origin_locked,
            locked,
            created_at,
            updated_at,
            issued_by,
          ],
        },
        {
          transaction: dbTransaction,
        }
      );
      accountVersionId = result[0];
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
    return accountVersionId;
  }

  async updateAccount(datas, { dbTransaction }) {
    try {
      const id = datas.id;
      const where = "id = " + id;
      delete datas.id;
      const set = Object.keys(datas).map((key) => `${key} = ${datas[key]}`);
      const placeholder = set.join(", ");
      let query = `
      UPDATE
      	accounts
      SET
        ${placeholder}
      WHERE
        ${where}
      LIMIT 1;
      `;
      // this.logger.debug("updateAccount", query);
      if (!id) throw Error(`id is required`);
      await this.db.query(
        {
          query,
        },
        {
          transaction: dbTransaction,
        }
      );
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
  }

  /**
   * [deprecated] 2022-12-06
   */
  async updateAuditAccountRecord(datas, { dbTransaction }) {
    try {
      const id = datas.id;
      if (!id) throw Error(`id is required`);
      const where = "id = " + id;
      delete datas.id;
      const set = Object.keys(datas).map((key) => `${key} = ${datas[key]}`);
      const placeholder = set.join(", ");
      let query = `
      UPDATE
      	audit_account_records
      SET
        ${placeholder}
      WHERE
        ${where}
      LIMIT 1;`;
      // this.logger.debug("updateAuditAccountRecord", query);
      await this.db.query(
        {
          query,
        },
        {
          transaction: dbTransaction,
        }
      );
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
  }

  /**
   *  -- temporary 2022-11-17
   * [deprecated] 2022-11-18
   */
  async updateAccountVersion(datas, { dbTransaction }) {
    try {
      const id = datas.id;
      if (!id) throw Error(`id is required`);
      const where = "`id` = " + id;
      delete datas.id;
      const set = Object.keys(datas).map((key) => `\`${key}\` = ${datas[key]}`);
      const placeholder = set.join(", ");
      let query =
        "UPDATE `account_versions` SET " +
        placeholder +
        " WHERE " +
        where +
        " LIMIT 1;";
      // this.logger.debug("updateAccountVersion", query);
      await this.db.query(
        {
          query,
        },
        {
          transaction: dbTransaction,
        }
      );
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
  }

  async updateOrder(datas, { dbTransaction }) {
    try {
      const id = datas.id;
      if (!id) throw Error(`id is required`);
      const where = "id = " + id;
      delete datas.id;
      const set = Object.keys(datas).map((key) => `${key} = ${datas[key]}`);
      const placeholder = set.join(", ");
      let query = `
      UPDATE
        orders
      SET
        ${placeholder}
      WHERE
        ${where}
      LIMIT 1;`;
      // this.logger.debug("updateOrder", query);
      await this.db.query(
        {
          query,
        },
        {
          transaction: dbTransaction,
          lock: dbTransaction.LOCK.UPDATE,
        }
      );
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
  }

  async updateOuterTrade(datas, { dbTransaction }) {
    try {
      const id = datas.id;
      if (!id) throw Error(`id is required`);
      const where = "`id` = " + id;
      delete datas.id;
      const set = Object.keys(datas).map(
        (key) =>
          `\`${key}\` = ${key === "email" ? `"${datas[key]}"` : datas[key]}`
      );
      const placeholder = set.join(", ");
      let query =
        "UPDATE `outer_trades` SET " +
        placeholder +
        " WHERE " +
        where +
        " LIMIT 1;";
      // this.logger.debug("updateOuterTrade", query);
      await this.db.query(
        {
          query,
        },
        {
          transaction: dbTransaction,
          lock: dbTransaction.LOCK.UPDATE,
        }
      );
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
  }

  /**
   * [deprecated] 2022-11-25
   */
  async deleteOuterTrade(datas, { dbTransaction }) {
    const query =
      "DELETE FROM `outer_trades` WHERE `outer_trades`.`id` = ? AND `outer_trades`.`exchange_code` = ?;";
    const values = [datas.id, datas.exchange_code];
    try {
      const result = await this.db.query(
        {
          query,
          values,
        }
        // {
        //   transaction: dbTransaction,
        //   lock: dbTransaction.LOCK., // ++ TODO verify
        // }
      );
      // this.logger.debug(query, values);
      return result;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }
  /* !!! HIGH RISK (end) !!! */
}

module.exports = mysql;
