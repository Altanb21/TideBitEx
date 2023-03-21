const Database = require("../../constants/Database");
const BookBase = require("../BookBase");
const SafeMath = require("../SafeMath");

class TradeBook extends BookBase {
  constructor({ logger, markets }) {
    super({ logger, markets });
    this.name = `TradeBook`;
    this._config = { remove: false, add: true, update: false };
    return this;
  }

  /**
   * @typedef {Object} Trade
   * @property {string} id 
   * @property {string} price
   * @property {string} volume
   * @property {string} market
   * @property {Number} at
   * @property {string} side 'up' || 'down'

   * @param {Trade} valueA
   * @param {Trade} valueB
   */
  // _compareFunction(valueA, valueB) {
  //   return super._compareFunction(valueA, valueB);
  // }

  /**
   * @param {Array<Trade>} arrayA
   * @param {Array<Trade>} arrayB
   * @param {Function} compareFunction
   * @returns
   */
  //  _calculateDifference(arrayA, arrayB) {
  //   return super._calculateDifference(arrayA, arrayB);
  // }

  // ++ TODO: verify function works properly
  _trim(instId, data) {
    let lotSz = this._markets[instId]["lotSz"] || 0;
    const trimed = data
      .filter((trade) => trade.volume >= lotSz)
      // .sort((a, b) => +b.at - +a.at)
      .slice(0, 500)
      .map((trade, i) =>
        !trade.side
          ? {
              ...trade,
              side:
                i === data.length - 1
                  ? Database.TREND.UP
                  : SafeMath.gt(trade.price, data[i + 1].price)
                  ? Database.TREND.UP
                  : Database.TREND.DOWN,
            }
          : trade
      );
    return trimed;
  }

  /**
   * @typedef {Object} Difference
   * @property {Arrary<Trade>} update
   * @property {Arrary<Trade>} add
   * @property {Arrary<Trade>} remove
   *
   * @param {String} instId BTC-USDT
   * @param {Difference} difference
   */
  updateByDifference(instId, lotSz, newTrades) {
    try {
      if (!this._markets[instId]["lotSz"])
        this._markets[instId]["lotSz"] = lotSz;
      let updateSnapshot = this._snapshot[instId].map((trade) => ({
        ...trade,
      }));
      let _newTrades = newTrades
        .map((newTrade) => ({ ...newTrade }))
        .sort((a, b) => +b.ts - +a.ts);
      let _newTrade = _newTrades[_newTrades.length - 1];
      if (
        !updateSnapshot[0] ||
        (_newTrade["ts"] >= updateSnapshot[0]?.ts &&
          _newTrade["id"] !== updateSnapshot[0]?.id)
      ) {
        this._snapshot[instId] = this._trim(
          instId,
          newTrades.concat(updateSnapshot)
        );
        this._difference[instId] = { add: newTrades };
      }
      return true;
    } catch (error) {
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }: OrderBook] updateByDifference(instId:${instId}) error`,
        error,
        newTrades
      );
      return false;
    }
  }

  // /**
  //  * @param {String} instId BTC-USDT
  //  * @param {Array<Order>} data
  //  */
  updateAll(instId, lotSz, data) {
    if (!this._markets[instId]["lotSz"]) this._markets[instId]["lotSz"] = lotSz;
    return super.updateAll(instId, data);
  }
}

module.exports = TradeBook;
