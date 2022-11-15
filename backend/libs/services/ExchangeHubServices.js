const Database = require("../../constants/Database");
const SupportedExchange = require("../../constants/SupportedExchange");
const Utils = require("../Utils");

class ExchangeHubService {
  _timer;
  _lastSyncTime = 0;
  _syncInterval = 0.5 * 60 * 60 * 1000; // 30 mins
  _minInterval = 1 * 24 * 60 * 60 * 1000; // 1天
  _interval = 3 * 24 * 60 * 60 * 1000; // 3天
  _maxInterval = 7 * 24 * 60 * 60 * 1000; // 7天 okex 最長只能問到3個月
  _isStarted = false;
  _delayTime = 1000; // 1s

  constructor({
    database,
    systemMemberId,
    okexConnector,
    tidebitMarkets,
    emitUpdateData,
    processor,
    logger,
  }) {
    this.name = "ExchangeHubService";
    this.database = database;
    this.systemMemberId = systemMemberId;
    this.tidebitMarkets = tidebitMarkets;
    this.okexConnector = okexConnector;
    this.logger = logger;
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

  async _processOuterTrades(outerTrades, options) {
    // let tmp,
    //   updateData = [];
    // -1. get all records from outer_trades table &  fillter records if record.status === 5-
    // const outerTrades = await this.database.getOuterTradesByStatus(
    //   Database.EXCHANGE[exchange.toUpperCase()],
    //   0
    // );
    // if (Math.random() < 0.01) {
    //   this.garbageCollection(outerTrades);
    // }
    // 2. _processOuterTrade
    for (let trade of outerTrades) {
      if (options.needParse)
        await this.processor({
          ...JSON.parse(trade.data),
          exchangeCode: trade.exchange_code,
        });
      else await this.processor(trade);
      // tmp = await this._processOuterTrade({
      //   ...JSON.parse(trade.data),
      //   exchangeCode: trade.exchange_code,
      // });
      // if (tmp) updateData.push(tmp);
    }
    // return updateData;
  }

  async insertOuterTrades(outerTrades) {
    /* !!! HIGH RISK (start) !!! */
    let result;
    // for (let trade of outerTrades) {
    //   result = await this._insertOuterTrade(trade);
    // }
    const t = await this.database.transaction();
    try {
      await this.database.insertOuterTrades(outerTrades, { dbTransaction: t });
      result = true;
      await t.commit();
    } catch (error) {
      // ++ TODO 需要有獨立的機制處理沒有正確紀錄的 outer_trades
      // 失敗的情境：
      // 1. 收到 OKX event.orders 觸發的時間點剛好是 ExchangeHubServices.sync 的時間，會導致這個時間等整筆 insertOuterTrades 失敗
      this.logger.error(new Date().toISOString());
      this.logger.error(`insertOuterTrades`, outerTrades, error);
      result = false;
      await t.rollback();
    }
    return result;
  }

  async syncUnProcessedOuterTrades(exchange = SupportedExchange.OKEX) {
    // 1. 將系統內未被處理的 outerTrades 拿出來
    const outerTrades = await this.database.getOuterTradesByStatus({
      exchangeCode: Database.EXCHANGE[exchange.toUpperCase()],
      status: Database.OUTERTRADE_STATUS.UNPROCESS,
    });
    this.logger.debug(`syncUnProcessedOuterTrades [${outerTrades.length}]`);
    // 2. 將 outerTrade 一一交給承辦員 ( this.processor ) 處理更新下列 DB table trades、orders、accounts、accounts_version、vouchers
    await this._processOuterTrades(outerTrades, { needParse: true });
  }

  async _getOuterTradesFromAPI(exchange, interval) {
    let outerTrades,
      endDate = new Date(),
      end = endDate.getTime(),
      begin = end - interval - this._delayTime * 1.2;
    switch (exchange) {
      case SupportedExchange.OKEX:
      default:
        let okexRes;
        if (interval > this._interval) {
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
    let outerTrades = await this._getOuterTradesFromAPI(exchange, interval);
    let index, newRetry;
    if (clOrdId) {
      index = outerTrades?.findIndex((trade) => trade.clOrdId === clOrdId);
      if (index === -1 && retry > 0) {
        newRetry = retry - 1;
        await Utils.wait(2500);
        return this._getTransactionsDetail(
          exchange,
          interval,
          clOrdId,
          newRetry
        );
      }
    }
    return outerTrades;
  }

  async _syncOuterTrades(exchange, interval, clOrdId) {
    let days = Math.ceil(interval / (60 * 60 * 24 * 1000));
    let exchangeCode = Database.EXCHANGE[exchange.toUpperCase()];
    let dbOuterTrades = await this.database.getOuterTrades({
      type: Database.TIME_RANGE_TYPE.DAY_AFTER,
      exchangeCode,
      days: days,
      asc: true,
      limit: null,
    });
    dbOuterTrades = dbOuterTrades.reduce((prev, curr) => {
      if (!prev[curr.id.toString()]) prev[curr.id.toString()] = curr;
      return prev;
    }, {});
    let apiOuterTrades = await this._getTransactionsDetail(
      exchange,
      interval,
      clOrdId
    );
    this.logger.debug(`apiOuterTrades[${apiOuterTrades.length}]`)
    let needProcessTrades = [];
    for (let trade of apiOuterTrades) {
      if (!dbOuterTrades[trade.tradeId])
        needProcessTrades = [...needProcessTrades, trade];
    }
    this.logger.debug(
      `_syncOuterTrades needProcessTrades[${needProcessTrades.length}]`
    );
    return needProcessTrades;
  }

  async syncAPIOuterTrades(exchange = SupportedExchange.OKEX, data, interval) {
    // 1. 從 API 取 outerTrades，回傳需要寫入 DB 的 outerTrades
    const outerTrades = await this._syncOuterTrades(
      exchange,
      interval,
      data?.clOrdId
    );

    if (outerTrades.length <= 0) return; // 沒有待處理任務
    // 2. 將 outerTrades寫入 DB => 工讀生
    await this.insertOuterTrades(outerTrades);

    // 3. 將 outerTrade 一一交給承辦員 ( this.processor ) 處理更新下列 DB table trades、orders、accounts、accounts_version、vouchers
    await this._processOuterTrades(outerTrades, { needParse: false });
  }

  async sync({
    exchange = SupportedExchange.OKEX,
    data,
    interval = this._maxInterval,
    force = false,
  }) {
    let time = Date.now();
    // 1. 定期（30mins）執行工作
    if (
      time - this._lastSyncTime > this._syncInterval ||
      force ||
      !this._isStarted
    ) {
      this._lastSyncTime = Date.now();
      await this.syncAPIOuterTrades(exchange, data, interval);
      await this.syncUnProcessedOuterTrades(exchange);

      // 5. 休息
      clearTimeout(this.timer);
      this.timer = setTimeout(
        () => this.sync({ exchange, interval: this._syncInterval }),
        this._syncInterval + this._delayTime
      );
    }
  }
}

module.exports = ExchangeHubService;
