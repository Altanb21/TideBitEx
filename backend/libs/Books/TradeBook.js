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
      .sort((a, b) => +b.at - +a.at)
      .slice(0, 50)
      .map((trade, i) =>
        !trade.side
          ? {
              ...trade,
              side:
                i === data.length - 1
                  ? "up"
                  : SafeMath.gte(trade.price, data[i + 1].price)
                  ? "up"
                  : "down",
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
  updateByDifference(instId, lotSz, difference) {
    if (!this._markets[instId]["lotSz"]) this._markets[instId]["lotSz"] = lotSz;
    // this.logger.debug(
    //   `[${this.constructor.name}]updateByDifference`,
    //   instId,
    //   difference
    // );
    // const add = difference.add.filter(
    //   (diff) => !this._snapshot[instId].some((trade) => trade.id === diff.id)
    // );
    return super.updateByDifference(instId, difference);
  }

  // /**
  //  * @param {String} instId BTC-USDT
  //  * @param {Array<Order>} data
  //  */
  // updateAll(instId, lotSz, data) {
  //   if (!this._markets[instId]["lotSz"]) this._markets[instId]["lotSz"] = lotSz;
  //   try {
  //     this.logger.log(`[${this.constructor.name}] updateAll[${instId}]`);
  //     super.updateAll(instId, data);

  //     this._snapshot[instId] = this._trim(instId, this._snapshot[instId]);
  //     // this._difference[instId] = difference;
  //     this.logger.log(
  //       `[${this.constructor.name}] updateAll[${instId}]`,
  //       this._snapshot[instId]
  //     );
  //     return true;
  //   } catch (error) {
  //     return false;
  //   }
  // }
}

module.exports = TradeBook;
