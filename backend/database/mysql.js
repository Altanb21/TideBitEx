const { Sequelize } = require("sequelize");
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

  async getAccounts() {
    const query = "SELECT * FROM `accounts`;";
    try {
      const [accounts] = await this.db.query({
        query,
      });
      this.logger.log(query);
      return accounts;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getAccountsByMemberId(memberId) {
    const query = "SELECT * FROM `accounts` WHERE `accounts`.member_id = ?;";
    const values = [memberId];
    try {
      const [accounts] = await this.db.query({
        query,
        values,
      });
      this.logger.log(query, values);
      return accounts;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }

  async getCurrencies() {
    const query = "SELECT * FROM `asset_bases`;";
    try {
      this.logger.log("getCurrencies", query);
      const [currencies] = await this.db.query({
        query,
      });
      return currencies;
    } catch (error) {
      this.logger.log(error);
      return [];
    }
  }

  async getCurrency(currencyId) {
    const query = "SELECT * FROM `asset_bases` WHERE `asset_bases`.`id` = ?;";
    try {
      this.logger.log("getCurrency", query, currencyId);
      const [[currency]] = await this.db.query({
        query,
        values: [currencyId],
      });

      return currency;
    } catch (error) {
      this.logger.log(error);
      return [];
    }
  }

  async getCurrencyByKey(currencyKey) {
    const query = "SELECT * FROM `asset_bases` WHERE `asset_bases`.`key` = ?;";
    try {
      this.logger.log("getCurrencyByKey", query, currencyKey);
      const [[currency]] = await this.db.query({
        query,
        values: [currencyKey],
      });

      return currency;
    } catch (error) {
      this.logger.log(error);
      return [];
    }
  }
  async getMemberById(memberId) {
    const query = "SELECT * FROM `members` WHERE `members`.`id` = ?;";
    try {
      this.logger.log("getMemberById", query, `[${memberId}]`);
      const [[member]] = await this.db.query({
        query,
        values: [memberId],
      });
      return member;
    } catch (error) {
      this.logger.log(error);
      return [];
    }
  }

  async getAccountByMemberIdCurrency(memberId, currencyId, { dbTransaction }) {
    const query =
      "SELECT * FROM `accounts` WHERE `accounts`.`member_id` = ? AND `accounts`.`currency` = ?;";
    try {
      this.logger.log(
        "getAccountByMemberIdCurrency",
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
      this.logger.log(error);
      if (dbTransaction) throw error;
      return [];
    }
  }
  async getOrderList({ quoteCcy, baseCcy, memberId, orderType = "limit" }) {
    const query =
      "SELECT * FROM `orders` WHERE `orders`.`member_id` = ? AND `orders`.`bid` = ? AND `orders`.`ask` = ? AND `orders`.`ord_type` = ?;";
    try {
      this.logger.log(
        "getOrderList",
        query,
        `[${memberId}, ${quoteCcy}, ${baseCcy}, ${orderType}]`
      );
      const [orders] = await this.db.query({
        query,
        values: [memberId, quoteCcy, baseCcy, orderType],
      });
      return orders;
    } catch (error) {
      this.logger.log(error);
      return [];
    }
  }

  async getVouchers({ memberId, ask, bid }) {
    const query =
      "SELECT * FROM `vouchers` WHERE `vouchers`.`member_id` = ? AND `vouchers`.`ask` = ? AND `vouchers`.`bid` = ?;";
    try {
      this.logger.log("getVouchers", query, `[${memberId}, ${ask}, ${bid}]`);
      const [trades] = await this.db.query({
        query,
        values: [memberId, ask, bid],
      });
      return trades;
    } catch (error) {
      this.logger.log(error);
      return [];
    }
  }

  async getTrades(quoteCcy, baseCcy) {
    const query =
      "SELECT `trades`.* FROM `trades`, `orders` WHERE `orders`.`id` = `trades`.`ask_id` AND `trades`.`currency` = ? AND `orders`.`ask` = ?;";
    try {
      this.logger.log("getTrades", query, `[${quoteCcy}, ${baseCcy}]`);
      const [trades] = await this.db.query({
        query,
        values: [quoteCcy, baseCcy],
      });
      return trades;
    } catch (error) {
      this.logger.log(error);
      return [];
    }
  }

  async getOuterTradesByStatus(exchangeCode, status) {
    const query =
      "SELECT * FROM `outer_trades` WHERE `outer_trades`.`exchange_code` = ? AND `outer_trades`.`status` = ?;";
    try {
      this.logger.log(
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
      this.logger.log(error);
      return [];
    }
  }

  async getOuterTradesByDayAfter(exchangeCode, day) {
    const query =
      "SELECT * FROM `outer_trades` WHERE `outer_trades`.`exchange_code` = ? AND `outer_trades`.`update_at` > DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY);";
    try {
      this.logger.log(
        "getOuterTradesByDayAfter",
        query,
        `[${exchangeCode}, ${day}]`
      );
      const [outerTrades] = await this.db.query({
        query,
        values: [exchangeCode, day],
      });
      return outerTrades;
    } catch (error) {
      this.logger.log(error);
      return [];
    }
  }

  async getOrder(orderId, { dbTransaction }) {
    const query = "SELECT * FROM `orders` WHERE `orders`.`id` = ?;";
    try {
      this.logger.log("getOrder", query, `[${orderId}]`);
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
      this.logger.log(error);
      if (dbTransaction) throw error;
      return [];
    }
  }

  async getVouchersByOrderId(orderId, { dbTransaction }) {
    const query = "SELECT * FROM `vouchers` WHERE `order_id` = ?;";
    try {
      this.logger.log("getVouchersByOrderId", query, orderId);
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
      this.logger.log(error);
      if (dbTransaction) throw error;
      return [];
    }
  }

  async getTradeByTradeFk(tradeFk) {
    const query = "SELECT * FROM `trades` WHERE `trade_fk` = ?;";
    try {
      this.logger.log("getTradeByTradeFk", query, tradeFk);
      const [[trade]] = await this.db.query({
        query,
        values: [tradeFk],
      });
      this.logger.log("getTradeByTradeFk trade", trade);
      return trade;
    } catch (error) {
      this.logger.log(error);
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
      this.logger.log(
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
    const query =
      "INSERT INTO `account_versions` (`id`, `member_id`, `account_id`, `reason`, `balance`, `locked`, `fee`, `amount`, `modifiable_id`, `modifiable_type`, `created_at`, `updated_at`, `currency`, `fun`)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
    try {
      this.logger.log(
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
      await this.db.query(
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
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
  }

  async insertOuterTrades(
    // id, // trade_fk `${EXCHANGE_CODE}${trade.tradeId}`
    // exchange_code, // EXCHANGE_CODE
    // update_at,
    // status, // 0: unprocessed, 1: _updateOrderbyTrade, 2: _insertTrades, 3: _insertVouchers, 4: _updateAccounts, 5: _insertAccountVersions
    // data,
    trades,
    { dbTransaction }
  ) {
    let query =
        "INSERT IGNORE INTO `outer_trades` (`id`,`exchange_code`,`update_at`,`status`,`data`) VALUES",
      values = [];
    for (let trade of trades) {
      query += " (?, ?, ?, ?, ?);";
      values.push([
        trade.id,
        trade.exchange_code,
        trade.update_at,
        trade.status,
        trade.data,
      ]);
    }
    try {
      this.logger.log("[mysql] insertOuterTrades", query, values);
      await this.db.query(
        {
          query,
          values,
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
      this.logger.log(
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
    let result;
    const query =
      "INSERT INTO `vouchers` (`id`,`member_id`,`order_id`,`trade_id`,`designated_trading_fee_asset_history_id`,`ask`,`bid`,`price`,`volume`,`value`,`trend`,`ask_fee`,`bid_fee`,`created_at`)" +
      " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);";
    try {
      this.logger.log(
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
    } catch (error) {
      this.logger.error(error);
      if (dbTransaction) throw error;
    }
    return result;
  }

  async updateAccount(datas, { dbTransaction }) {
    try {
      const id = datas.id;
      const where = "`id` = " + id;
      delete datas.id;
      const set = Object.keys(datas).map((key) => `\`${key}\` = ${datas[key]}`);
      let query =
        "UPDATE `accounts` SET " + set.join(", ") + " WHERE " + where + ";";
      this.logger.log("updateAccount", query);
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
      this.logger.log("updateOrder", query);
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
      const set = Object.keys(datas).map((key) => `\`${key}\` = ${datas[key]}`);
      let query =
        "UPDATE `outer_trades` SET " + set.join(", ") + " WHERE " + where + ";";
      this.logger.log("updateOuterTrade", query);
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
      this.logger.log(query, values);
      return result;
    } catch (error) {
      this.logger.error(error);
      return [];
    }
  }
  /* !!! HIGH RISK (end) !!! */
}

module.exports = mysql;
