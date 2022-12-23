const Database = require("../../constants/Database");
const SupportedExchange = require("../../constants/SupportedExchange");
const SafeMath = require("../SafeMath");
const { waterfallPromise } = require("../Utils");
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
    tickersSettings,
    emitUpdateData,
    processor,
    logger,
  }) {
    this.name = "ExchangeHubService";
    this.database = database;
    this.systemMemberId = systemMemberId;
    this.tickersSettings = tickersSettings;
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
   * [deprecated] 2022/12/22
   * */
  async garbageCollection(outerTrades) {
    this.logger.debug(
      `[!!! deprecated][${new Date().toLocaleTimeString()}][${
        this.constructor.name
      }] garbageCollection return!`,
      outerTrades
    );
    return;
    // for (let trade of outerTrades) {
    //   const date = new Date(trade.update_at);
    //   const timestamp = date.getTime();
    //   if (timestamp > this._maxInterval && parseInt(trade.status) === 1) {
    //     const t = await this.database.transaction();
    //     try {
    //       await this.database.deleteOuterTrade(trade, { dbTransaction: t });
    //       await t.commit();
    //     } catch (error) {
    //       await t.rollback();
    //     }
    //   }
    // }
  }

  _processOuterTrades(outerTrades, options) {
    // let tmp,
    //   updateData = [];
    // 1. get all records from outer_trades table &  fillter records if record.status === 5-
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
        this.processor({
          ...JSON.parse(trade.data),
          exchangeCode: trade.exchange_code,
        });
      else this.processor(trade);
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
      this.logger.error(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }] insertOuterTrades`,
        outerTrades,
        error
      );
      result = false;
      await t.rollback();
    }
    /* !!! HIGH RISK (end) !!! */
    return result;
  }

  async insertOuterOrders(outerOrders) {
    /* !!! HIGH RISK (start) !!! */
    let result;
    const t = await this.database.transaction();
    try {
      await this.database.insertOuterOrders(outerOrders, { dbTransaction: t });
      result = true;
      await t.commit();
    } catch (error) {
      this.logger.error(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }] insertOuterTrades`,
        outerOrders,
        error
      );
      result = false;
      await t.rollback();
    }
    /* !!! HIGH RISK (end) !!! */
    return result;
  }

  async syncUnProcessedOuterTrades(exchange = SupportedExchange.OKEX) {
    // 1. 將系統內未被處理的 outerTrades 拿出來
    const outerTrades = await this.database.getOuterTradesByStatus({
      exchangeCode: Database.EXCHANGE[exchange.toUpperCase()],
      status: Database.OUTERTRADE_STATUS.UNPROCESS,
    });
    this.logger.debug(
      `[${new Date().toLocaleTimeString()}][${
        this.constructor.name
      }] syncUnProcessedOuterTrades(exchange:${exchange} outerTrades.length:[${
        outerTrades.length
      }]`,
      outerTrades
    );
    // 2. 將 outerTrade 一一交給承辦員 ( this.processor ) 處理更新下列 DB table trades、orders、accounts、accounts_version、vouchers
    this._processOuterTrades(outerTrades, { needParse: true });
  }

  /**
   *  -- temporary 2022-11-16
   *  [deprecated] 2022-11-18
   */
  async auditorAbnormalOuterTrades(exchange, start, end) {
    this.logger.debug(
      `[!!! deprecated][${new Date().toLocaleTimeString()}][${
        this.constructor.name
      }] accountVersionUpdateJob return!`,
      `exchange:${exchange}, start:${start}, end:${end}`
    );
    return;
    // const outerTrades = await this.database.getAbnormalOuterTrade({
    //   exchangeCode: Database.EXCHANGE[exchange.toUpperCase()],
    //   start,
    //   end,
    // });
    // // !!! high risk
    // this._processOuterTrades(outerTrades, { needParse: true });
  }

  /**
   *  -- temporary 2022-11-17
   * [deprecated] 2022-11-18
   */
  accountVersionUpdateJob = (updateAccountVersion) => {
    this.logger.debug(
      `[!!! deprecated][${new Date().toLocaleTimeString()}][${
        this.constructor.name
      }] accountVersionUpdateJob return!`,
      `updateAccountVersion:`,
      updateAccountVersion
    );
    return;
    // return async () => {
    //   let dbTransaction = await this.database.transaction();
    //   try {
    //     await this.database.updateAccountVersion(
    //       updateAccountVersion,
    //       dbTransaction
    //     );
    //     await dbTransaction.commit();
    //   } catch (error) {
    //     await dbTransaction.rollback();
    //   }
    // };
  };
  /**
   *  -- temporary 2022-11-17
   * [deprecated] 2022-11-18
   */
  async abnormalAccountVersionsHandler() {
    this.logger.debug(
      `[!!! deprecated][${new Date().toLocaleTimeString()}][${
        this.constructor.name
      }] abnormalAccountVersionsHandler return!`
    );
    return;
    // let accountVersions,
    //   accVsmodifiableTypeOrder = {},
    //   accVsmodifiableTypeTrade = {},
    //   orders,
    //   trades,
    //   updateAccountVersionsJob = [],
    //   abnormalOrderIds = [],
    //   abnormalTradeIds = [],
    //   abnormalAccountIds = {},
    //   outerTrades;
    // accountVersions = await this.database.getAbnormalAccountVersions(94); // tidebit.com: 841997111, test.tidebit.network: 94
    // for (let accountVersion of accountVersions) {
    //   if (!abnormalAccountIds[accountVersion.account_id])
    //     abnormalAccountIds[accountVersion.account_id] =
    //       accountVersion.account_id;
    //   if (accountVersion.modifiable_type === Database.MODIFIABLE_TYPE.ORDER) {
    //     if (!accVsmodifiableTypeOrder[accountVersion.modifiable_id])
    //       accVsmodifiableTypeOrder[accountVersion.modifiable_id] = [];
    //     accVsmodifiableTypeOrder[accountVersion.modifiable_id] = [
    //       ...accVsmodifiableTypeOrder[accountVersion.modifiable_id],
    //       accountVersion,
    //     ];
    //   }
    //   if (accountVersion.modifiable_type === Database.MODIFIABLE_TYPE.TRADE) {
    //     if (!accVsmodifiableTypeTrade[accountVersion.modifiable_id])
    //       accVsmodifiableTypeTrade[accountVersion.modifiable_id] = [];
    //     accVsmodifiableTypeTrade[accountVersion.modifiable_id] = [
    //       ...accVsmodifiableTypeTrade[accountVersion.modifiable_id],
    //       accountVersion,
    //     ];
    //   }
    // }
    // if (Object.keys(accVsmodifiableTypeOrder).length > 0) {
    //   orders = await this.database.getOrdersByIds(
    //     Object.keys(accVsmodifiableTypeOrder)
    //   );
    //   for (let orderId of Object.keys(accVsmodifiableTypeOrder)) {
    //     let order = orders.find((o) => SafeMath.eq(orderId, o.id));
    //     if (order) {
    //       let dateTime = new Date(
    //         order.state === Database.ORDER_STATE_CODE.CANCEL
    //           ? order.updated_at
    //           : order.created_at
    //       ).toISOString();
    //       updateAccountVersionsJob = [
    //         ...updateAccountVersionsJob,
    //         ...accVsmodifiableTypeOrder[orderId].map((accountVersion) =>
    //           this.accountVersionUpdateJob({
    //             id: accountVersion.id,
    //             created_at: `"${dateTime}"`,
    //             updated_at: `"${dateTime}"`,
    //           })
    //         ),
    //       ];
    //     } else {
    //       abnormalOrderIds = [...abnormalOrderIds, orderId];
    //     }
    //   }
    // }
    // if (Object.keys(accVsmodifiableTypeTrade).length > 0) {
    //   trades = await this.database.getTradesByIds(
    //     Object.keys(accVsmodifiableTypeTrade)
    //   );
    //   trades = trades.reduce((prev, curr) => {
    //     if (!prev[curr.id]) prev[curr.id] = curr;
    //     return prev;
    //   }, {});
    //   for (let tradeId of Object.keys(accVsmodifiableTypeTrade)) {
    //     let trade = trades[tradeId];
    //     try {
    //       if (trade) {
    //         let dateTime = new Date(trade.created_at).toISOString();
    //         updateAccountVersionsJob = [
    //           ...updateAccountVersionsJob,
    //           ...accVsmodifiableTypeTrade[tradeId].map((accountVersion) =>
    //             this.accountVersionUpdateJob({
    //               id: accountVersion.id,
    //               created_at: `"${dateTime}"`,
    //               updated_at: `"${dateTime}"`,
    //             })
    //           ),
    //         ];
    //       } else {
    //         abnormalTradeIds = [...abnormalTradeIds, tradeId];
    //       }
    //     } catch (error) {
    //       abnormalTradeIds = [...abnormalTradeIds, tradeId];
    //     }
    //   }
    //   if (abnormalTradeIds.length > 0) {
    //     outerTrades = await this.database.getOuterTradesByTradeIds(
    //       abnormalTradeIds
    //     );
    //     for (let outerTrade of outerTrades) {
    //       let outerTradeData = JSON.parse(outerTrade.data);
    //       let dateTime = new Date(parseInt(outerTradeData.ts)).toISOString();
    //       updateAccountVersionsJob = [
    //         ...updateAccountVersionsJob,
    //         ...accVsmodifiableTypeTrade[outerTrade.trade_id].map(
    //           (accountVersion) =>
    //             this.accountVersionUpdateJob({
    //               id: accountVersion.id,
    //               created_at: `"${dateTime}"`,
    //               updated_at: `"${dateTime}"`,
    //             })
    //         ),
    //       ];
    //     }
    //   }
    // }
    // waterfallPromise(updateAccountVersionsJob);
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
    let needProcessTrades = [];
    for (let trade of apiOuterTrades) {
      if (!dbOuterTrades[trade.tradeId])
        needProcessTrades = [...needProcessTrades, trade];
    }
    this.logger.debug(
      `[${new Date().toLocaleTimeString()}][${
        this.constructor.name
      }] _syncOuterTrades(exchange:${exchange}, interval:${interval}, clOrdId:${clOrdId}) apiOuterTrades.length:[${
        apiOuterTrades.length
      }] needProcessTrades.length:[${needProcessTrades.length}]`
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
    this._processOuterTrades(outerTrades, { needParse: false });
  }

  collectOrders(market, data) {
    let orders = data
      .map((outerOrder) => {
        let parsedClOrdId = Utils.parseClOrdId(outerOrder.clOrdId);
        let _formatOrder = {
          id: parsedClOrdId.orderId,
          exchangeCode: Database.EXCHANGE.OKEX,
          memberId: parsedClOrdId.memberId,
          market: market,
          price: outerOrder.px,
          volume: outerOrder.sz,
          averageFilledPrice: outerOrder.avgPx,
          accumulateFilledvolume: outerOrder.accFillSz,
          state: outerOrder.state,
          createdAt: new Date(parseInt(outerOrder.cTime)).toISOString(),
          updatedAt: new Date(parseInt(outerOrder.uTime)).toISOString(),
          data: JSON.stringify(outerOrder),
        };
        return _formatOrder;
      })
      .filter((outerOrder) => !!outerOrder.id);
    return orders;
  }

  async syncOuterOrders(exchange = SupportedExchange.OKEX) {
    let apiResonse,
      market,
      outerOrders = [];
    switch (exchange) {
      case SupportedExchange.OKEX:
        for (let instId of this.okexConnector.instIds) {
          market =
            this.tickersSettings[instId.replace("-", "").toLowerCase()].code;
          apiResonse = await this.okexConnector.router("getAllOrders", {
            query: {
              instId: instId,
            },
          });
          if (apiResonse.success) {
            outerOrders = outerOrders.concat(
              this.collectOrders(market, apiResonse.payload)
            );
          }
          // ++ TODO 2022/12/09 加上時間參數
          apiResonse = await this.okexConnector.router("getOrderHistory", {
            query: {
              instType: "SPOT",
              instId: instId,
            },
          });
          if (apiResonse.success) {
            outerOrders = outerOrders.concat(
              this.collectOrders(market, apiResonse.payload)
            );
          }
        }
        break;
      default:
        break;
    }
    if (outerOrders.length > 0) await this.insertOuterOrders(outerOrders);
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
      try {
        await this.syncOuterOrders(exchange);
        await this.syncAPIOuterTrades(exchange, data, interval);
        await this.syncUnProcessedOuterTrades(exchange);
      } catch (error) {
        this.logger.debug(
          `[${new Date().toLocaleTimeString()}][${
            this.constructor.name
          }] sync(exchange:${exchange}, interval:${interval}, force:${force}) error`,
          error,
          data
        );
      }
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
