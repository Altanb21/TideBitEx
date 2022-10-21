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
      this.logger.debug(query);
      return accounts;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getAccountsByMemberId(memberId, { options, limit, dbTransaction }) {
    let placeholder = ``;
    // this.logger.debug(options);
    if (Object.keys(options)?.length > 0) {
      let keys = Object.keys(options);
      let values = Object.values(options);
      for (let index = 0; index < Object.keys(options).length; index++) {
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
    ORDER BY
      NULL
    LIMIT ${limit};
    `;
    const values = [memberId];
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
      this.logger.debug(query, values);
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
      this.logger.debug(
        "getAccountByMemberIdAndCurrency",
        query,
        `[${memberId}, ${currencyId}]`
      );
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
      this.logger.debug(error);
      if (dbTransaction) throw error;
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
      this.logger.debug("getTotalAccountsAssets", query);
      const [currencies] = await this.db.query({
        query,
      });
      return currencies;
    } catch (error) {
      this.logger.debug(error);
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
      this.logger.debug("getCurrenciesSymbol", query);
      const [currencies] = await this.db.query({
        query,
      });
      return currencies;
    } catch (error) {
      this.logger.debug(error);
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
      this.logger.debug("getCurrencies", query);
      const [currencies] = await this.db.query({
        query,
      });
      return currencies;
    } catch (error) {
      this.logger.debug(error);
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
      this.logger.debug("getCurrency", query, currencyId);
      const [[currency]] = await this.db.query({
        query,
        values: [currencyId],
      });

      return currency;
    } catch (error) {
      this.logger.debug(error);
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
      this.logger.debug("getCurrencyByKey", query, currencyKey);
      const [[currency]] = await this.db.query({
        query,
        values: [currencyKey],
      });

      return currency;
    } catch (error) {
      this.logger.debug(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/14
   * 沒有地方呼叫
   */
  async getMembers() {
    const query = "SELECT * FROM `members`;";
    try {
      this.logger.debug("getMembers", query);
      const [members] = await this.db.query({
        query,
      });
      return members;
    } catch (error) {
      this.logger.debug(error);
      return [];
    }
  }

  async getMemberByCondition(condition) {
    const query = `
    SELECT
	    members.id,
	    members.sn,
	    members.email,
	    members.member_tag
    FROM
	    members
    WHERE
	    members.${Object.keys(condition)[0]} = ?
    LIMIT 1;
    `;
    try {
      this.logger.debug("getMemberByCondition", query, condition);
      const [[member]] = await this.db.query({
        query,
        values: [Object.values(condition)[0]],
      });
      return member;
    } catch (error) {
      this.logger.debug(error);
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
      this.logger.debug("getMemberByEmail", query, `[${memberEmail}]`);
      const [[member]] = await this.db.query({
        query,
        values: [memberEmail],
      });
      return member;
    } catch (error) {
      this.logger.debug(error);
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
      this.logger.debug("getDoneOrder", query, `[${orderId}]`);
      const [[order]] = await this.db.query({
        query,
        values: [orderId],
      });
      return order;
    } catch (error) {
      this.logger.debug(error);
      return [];
    }
  }

  // ++ TODO 2022/10/14
  // CASE WHEN orders.type = 'OrderBid' THEN
  // (orders.origin_locked - orders.locked) / orders.funds_received
  // WHEN orders.type = 'OrderAsk' THEN
  // (orders.funds_received / orders.origin_volume)
  // END) AS price_avg,
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
          ${
            orderId
              ? `
          orders.id = ?
      LIMIT 1`
              : `
          orders.member_id = ?
	        AND orders.bid = ?
	        AND orders.ask = ?
          AND orders.state = ?
          AND orders.type = ?
          AND orders.ord_type <> '${ordType}'
      ORDER BY 
          created_at DESC
      LIMIT ${limit} OFFSET ${offset}
      `
          }
         ;`;
    try {
      this.logger.debug(
        "getDoneOrders",
        query,
        `[${memberId}, ${quoteCcy}, ${baseCcy}, ${state}, ${type}]`
      );
      const [orders] = await this.db.query({
        query,
        values: [memberId, quoteCcy, baseCcy, state, type],
      });
      return orders;
    } catch (error) {
      this.logger.debug(error);
      return [];
    }
  }

  async getOrderList({ quoteCcy, baseCcy, memberId, orderType, state, asc }) {
    // async getOrderList({ quoteCcy, baseCcy, memberId, orderType = "limit" }) {
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
    WHERE
      orders.member_id = ?
      AND orders.bid = ?
      AND orders.ask = ?
      ${state ? `AND orders.state = ${state}` : ``}
      ${orderType ? `AND orders.ord_type = ${orderType}` : ``}
    ORDER BY
      orders.created_at ${asc ? "ASC" : "DESC"};`;
    // AND orders.created_at > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${days} DAY)
    // LIMIT ${limit} OFFSET ${offset};`;// -- TODO
    try {
      this.logger.debug(
        "getOrderList",
        query,
        `[${memberId}, ${quoteCcy}, ${baseCcy}]`
        // `[${memberId}, ${quoteCcy}, ${baseCcy}, ${orderType}]`
      );
      const [orders] = await this.db.query({
        query,
        values: [memberId, quoteCcy, baseCcy],
        // values: [memberId, quoteCcy, baseCcy, orderType],
      });
      return orders;
    } catch (error) {
      this.logger.debug(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/19
   * 沒有地方呼叫
   */
  async getVouchers({ memberId, ask, bid, days, asc, limit, offset }) {
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
      vouchers.created_at ${asc ? "ASC" : "DESC"}
    LIMIT ${limit} OFFSET ${offset};`;
    try {
      this.logger.debug("getVouchers", query, `[${memberId}, ${ask}, ${bid}]`);
      const [trades] = await this.db.query({
        query,
        values: [memberId, ask, bid],
      });
      return trades;
    } catch (error) {
      this.logger.debug(error);
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
      this.logger.debug("getOrders", query);
      const [orders] = await this.db.query({
        query,
      });
      return orders;
    } catch (error) {
      this.logger.debug(error);
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
      this.logger.debug("getTrades", query, `[${quoteCcy}, ${baseCcy}]`);
      const [trades] = await this.db.query({
        query,
        values: [quoteCcy, baseCcy],
      });
      return trades;
    } catch (error) {
      this.logger.debug(error);
      return [];
    }
  }

  async getEmailsByMemberIds(memberIds) {
    let placeholder,
      // values = [],
      index = 0;
    for (let _ of memberIds) {
      placeholder += index === memberIds.length - 1 ? " ?," : " ?";
      // values.push(memberId);
      index++;
    }
    let query = `
    SELECT
	    members.id,
	    members.email
    FROM
	    members
    WHERE
	     members.id in(${placeholder})
    ORDER BY NULL;
    `;
    try {
      this.logger.debug("[mysql] getEmailsByMemberIds", query, memberIds);
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
      this.logger.debug("getOrdersJoinMemberEmail", query, `[${state}]`);
      const [orders] = await this.db.query({
        query,
        values: [state],
      });
      return orders;
    } catch (error) {
      this.logger.debug(error);
      return [];
    }
  }

  /**
   * [deprecated] 2022/10/19
   * 沒有地方呼叫
   */
  async getOuterTradesByStatus({
    exchangeCode,
    status,
    asc,
    limit,
    offset,
    days,
  }) {
    const query = `
    SELECT
      outer_trades.id,
      outer_trades.data,
      outer_trades.exchange_code
    FROM
      outer_trades
    WHERE
      outer_trades.exchange_code = ?
      AND(outer_trades.status = ?
        OR outer_trades.order_id IS NULL
        OR outer_trades.create_at IS NULL)
      AND outer_trades.create_at > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ${days} DAY)
    ORDER BY
      outer_trades.create_at ${asc ? "ASC" : "DESC"}
    LIMIT ${limit} OFFSET ${offset};`;
    try {
      this.logger.debug(
        "getOuterTradesByStatus",
        query,
        `[${exchangeCode}, ${status}]`
      );
      const [outerTrades] = await this.db.query({
        query,
        values: [exchangeCode, status],
      });
      return outerTrades;
    } catch (error) {
      this.logger.debug(error);
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
      this.logger.debug(
        "getOuterTradesBetweenDayss",
        query,
        `[${exchangeCode}, ${start}, ${end}]`
      );
      const [outerTrades] = await this.db.query({
        query,
        values: [exchangeCode, start, end],
      });
      return outerTrades;
    } catch (error) {
      this.logger.debug(error);
      return [];
    }
  }

  async getReferralCommissions({ market, start, end, limit, offset, asc }) {
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
        NULL
    LIMIT ${limit} OFFSET ${offset};`;
    try {
      this.logger.debug(
        "getReferralCommissions",
        query,

        `[${market}, ${start}, ${end}]`
      );
      const [outerTrades] = await this.db.query({
        query,
        values: [market, start, end],
      });
      return outerTrades;
    } catch (error) {
      this.logger.debug(error);
      return [];
    }
  }

  // ++ TO BE SOLVED 耗時
  async getOuterTrades({
    type,
    exchangeCode,
    days,
    start,
    end,
    limit,
    offset,
    asc,
  }) {
    const query = `
    SELECT 
        outer_trades.id,
        outer_trades.exchange_code,
        outer_trades.status,
        outer_trades.data,
        outer_trades.member_id,
        outer_trades.member_tag,
        outer_trades.email,
        outer_trades.order_id,
        outer_trades.order_price,
        outer_trades.order_origin_volume,
        outer_trades.trade_id,
        outer_trades.update_at,
        outer_trades.voucher_id
    FROM 
        outer_trades
    WHERE 
        outer_trades.exchange_code = ?
      ${
        type === Database.TIME_RANGE_TYPE.DAY_AFTER
          ? `
        AND outer_trades.create_at > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY)
        `
          : `
        AND outer_trades.create_at BETWEEN ?
        AND ?
        `
      }
    ORDER BY
        outer_trades.create_at ${asc ? "ASC" : "DESC"}
    LIMIT ${limit} OFFSET ${offset};`;
    try {
      this.logger.debug(
        "getOuterTrades",
        query,
        `${
          type === Database.TIME_RANGE_TYPE.DAY_AFTER
            ? `[${exchangeCode}, ${days}]`
            : `[${exchangeCode}, ${start}, ${end}]`
        }`
      );
      const [outerTrades] = await this.db.query({
        query,
        values:
          type === Database.TIME_RANGE_TYPE.DAY_AFTER
            ? [exchangeCode, days]
            : [exchangeCode, start, end],
      });
      return outerTrades;
    } catch (error) {
      this.logger.debug(error);
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
      this.logger.debug("getOrder", query, `[${orderId}]`);
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
      this.logger.debug(error);
      if (dbTransaction) throw error;
      return [];
    }
  }

  async getVouchersByOrderId(orderId, { dbTransaction }) {
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
    LIMIT 1;`;
    try {
      this.logger.debug("getVouchersByOrderId", query, orderId);
      const [vouchers] = await this.db.query(
        {
          query,
          values: [orderId],
        },
        {
          transaction: dbTransaction,
        }
      );
      return vouchers;
    } catch (error) {
      this.logger.debug(error);
      if (dbTransaction) throw error;
      return [];
    }
  }

  // 不應該超過 3 筆
  async getAccountVersionsByModifiableId(id, type) {
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
	    account_versions.modifiable_id = ?
      AND account_versions.modifiable_type = ?
    LIMIT 10;`;
    try {
      this.logger.debug(
        "getAccountVersionsByModifiableId",
        query,
        `[${id}, ${type}]`
      );
      const [accountVersions] = await this.db.query({
        query,
        values: [id, type],
      });
      return accountVersions;
    } catch (error) {
      this.logger.debug(error);
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
      this.logger.debug(
        "getVoucherByOrderIdAndTradeId",
        query,
        `[${orderId}, ${tradeId}]`
      );
      const [[voucher]] = await this.db.query({
        query,
        values: [orderId, tradeId],
      });
      return voucher;
    } catch (error) {
      this.logger.debug(error);
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
      this.logger.debug("getTradeByTradeFk", query, tradeFk);
      const [[trade]] = await this.db.query({
        query,
        values: [tradeFk],
      });
      this.logger.debug("getTradeByTradeFk trade", trade);
      return trade;
    } catch (error) {
      this.logger.debug(error);
      return null;
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
      this.logger.debug(
        "insertOrder",
        "DEFAULT",
        query,
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
        trades_count
      );
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
      this.logger.debug(
        "insertAccountVersion",
        query,
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
        currency,
        fun
      );
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
      this.logger.debug(`insertAccountVersion result`, result);
      accountVersionId = result[0];
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
    return accountVersionId;
  }

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
    let result;
    try {
      this.logger.debug(
        "[mysql] insertOuterTrades"
        // , query, values
      );
      result = await this.db.query(
        {
          query,
          values,
        },
        {
          transaction: dbTransaction,
        }
      );
      this.logger.debug(`insertOuterTrades`, result);
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
      this.logger.debug(
        "insertTrades",
        query,
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
        trade_fk
      );
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
      this.logger.debug(`insertTrades result`, result);
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
      this.logger.debug(
        "insertVouchers",
        query,
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
        created_at
      );
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
      this.logger.debug(`insertVouchers result`, result);
      voucherId = result[0];
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
    return voucherId;
  }

  async updateAccount(datas, { dbTransaction }) {
    try {
      const id = datas.id;
      const where = "`id` = " + id;
      delete datas.id;
      const set = Object.keys(datas).map((key) => `\`${key}\` = ${datas[key]}`);
      let query =
        "UPDATE `accounts` SET " + set.join(", ") + " WHERE " + where + ";";
      this.logger.debug("updateAccount", query);
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
      const where = "`id` = " + id;
      delete datas.id;
      const set = Object.keys(datas).map((key) => `\`${key}\` = ${datas[key]}`);
      let query =
        "UPDATE `orders` SET " + set.join(", ") + " WHERE " + where + ";";
      this.logger.debug("updateOrder", query);
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
      const where = "`id` = " + id;
      delete datas.id;
      const set = Object.keys(datas).map(
        (key) =>
          `\`${key}\` = ${key === "email" ? `"${datas[key]}"` : datas[key]}`
      );
      let query =
        "UPDATE `outer_trades` SET " + set.join(", ") + " WHERE " + where + ";";
      this.logger.debug("updateOuterTrade", query);
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
      this.logger.debug(query, values);
      return result;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }
  /* !!! HIGH RISK (end) !!! */
}

module.exports = mysql;
