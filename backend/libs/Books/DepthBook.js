const BookBase = require("../BookBase");
const SafeMath = require("../SafeMath");

class DepthBook extends BookBase {
  endPriceResult;
  constructor({ logger, markets }) {
    super({ logger, markets });
    this.markets.forEach((market) => {
      this._snapshot[market.instId] = { asks: [], bids: [] };
      this._difference[market.instId] = { asks: {}, bids: {} };
    });
    this._config = { remove: true, add: true, update: true };
    this.name = `DepthBook`;
    return this;
  }

  /**
   * @typedef {Object} Depth
   * @property {string} price
   * @property {string} amount
   * @property {string} side 'asks' || 'bids'
   *
   * @param {Depth} valueA
   * @param {Depth} valueB
   */
  _compareFunction(valueA, valueB) {
    return (
      SafeMath.eq(valueA[0], valueB[0]) && SafeMath.eq(valueA[1], valueB[1])
    );
  }

  /**
   * @param {Array<Depth>} arrayA
   * @param {Array<Depth>} arrayB
   * @param {Function} compareFunction
   * @returns
   */
  // _calculateDifference(arrayA, arrayB) {
  //   return super._calculateDiffence(arrayA, arrayB);
  // }

  // _trim(instId, data) {
  //   let lotSz = this._markets[instId]["lotSz"] || 0,
  //     asks = [],
  //     bids = [];
  //   data.forEach((d) => {
  //     if (d.side === "asks") {
  //       asks.push({ ...d });
  //     }
  //     if (d.side === "bids") {
  //       bids.push({ ...d });
  //     }
  //   });
  //   asks = asks
  //     .filter((book) => {
  //       return book.amount >= lotSz;
  //     })
  //     .sort((a, b) => +a.price - +b.price)
  //     .slice(0, 50);
  //   bids = bids
  //     .filter((book) => {
  //       if (asks[0]?.price && book.price > asks[0]?.price)
  //         this.logger.error(
  //           `bidOrderPrice bigger then ask[0]Price`,
  //           book,
  //           `asks[0]`,
  //           asks[0]
  //         );
  //       return (
  //         book.amount >= lotSz &&
  //         (asks[0]?.price ? book.price < asks[0].price : true)
  //       );
  //     })
  //     .sort((a, b) => +b.price - +a.price)
  //     .slice(0, 50);
  //   return asks.concat(bids);
  // }

  // !!!! IMPORTANT 要遵守 tideLegacy 的資料格式
  getSnapshot(instId) {
    let total,
      ask,
      bid,
      result,
      market = instId.replace("-", "").toLowerCase(),
      sumAskAmount = "0",
      sumBidAmount = "0",
      lotSz = this._markets[instId]["lotSz"] || 0,
      asks = this._snapshot[instId].asks
        .filter((v) => SafeMath.gte(v[1], lotSz))
        .sort((a, b) => +a[0] - +b[0])
        .slice(0, 50)
        .map((v) => {
          sumAskAmount = SafeMath.plus(v[1], sumAskAmount);
          return [v[0], v[1], sumAskAmount];
        }),
      bids = this._snapshot[instId].bids
        .filter((v) => SafeMath.gte(v[1], lotSz))
        .sort((a, b) => +b[0] - +a[0])
        .slice(0, 50)
        .map((v) => {
          sumBidAmount = SafeMath.plus(v[1], sumBidAmount);
          return [v[0], v[1], sumBidAmount];
        });
    total = SafeMath.plus(sumAskAmount || "0", sumBidAmount || "0");
    asks = asks.map((v) => [...v, SafeMath.div(v[3], total)]);
    bids = bids.map((v) => [...v, SafeMath.div(v[3], total)]);
    if (asks.length > 0 && bids.length > 0) {
      ask = asks[0];
      bid = bids[0];
      if (parseFloat(ask[0]) > parseFloat(bid[0])) {
        result = `ask: ${ask}, bid: ${bid}`;
      } else {
        this.logger.error(new Date().toLocaleTimeString());
        result = `* ask: ${ask}, bid: ${bid}`;
      }

      if (this.endPriceResult && this.endPriceResult !== result) {
        if (result.includes("*"))
          this.logger.error(`cross Price error`, result);
        // else this.logger.log(result);
      }
      this.endPriceResult = result;
    }
    return {
      market,
      asks,
      bids,
      total,
    };
  }

  getDifference(instId) {
    return super.getDifference(instId);
  }

  // /**
  //  * @typedef {Object} Book
  //  * @property {string} market
  //  * @property {Array} asks
  //  * @property {Array} bids
  //  *
  //  * @param {Book} bookObj
  //  * @returns {Array<Depth>}
  //  */
  // _formateBooks(bookObj) {
  //   let bookArr = [];
  //   bookObj.asks.forEach((ask) => {
  //     bookArr.push({
  //       price: ask[0],
  //       amount: ask[1],
  //       side: "asks",
  //     });
  //   });
  //   bookObj.bids.forEach((bid) => {
  //     bookArr.push({
  //       price: bid[0],
  //       amount: bid[1],
  //       side: "bids",
  //     });
  //   });
  //   // bookArr.sort((a, b) => +b.price - +a.price);
  //   // console.log(`[DepthBook _formateBooks]`, bookArr);
  //   return bookArr;
  // }

  /**
   *
   *   
   * {
    price: '10'
    amount: '1'
    side: 'bids',
  }
   * @param {Array<Depth>} preArr
   * @param {Array<Depth>} newArr
   * @returns {Difference} difference
   */
  _getDifference(instId, data) {
    const asks = data.asks;
    const bids = data.bids;
    const myBooks = {
      ...this._snapshot[instId],
      asks: [...this._snapshot[instId].asks],
      bids: [...this._snapshot[instId].bids],
    };
    const asksDifference = {
      add: [],
      update: [],
      remove: [],
    };
    const bidsDifference = {
      add: [],
      update: [],
      remove: [],
    };
    asks.forEach((v) => {
      const index = myBooks.asks.findIndex((a) => {
        return v[0] === a[0];
      });
      if (index > -1) {
        if (v[1] > 0) {
          myBooks.asks[index] = v;
          asksDifference.update.push(v);
        } else {
          myBooks.asks.splice(index, 1);
          asksDifference.remove.push(v);
        }
      } else {
        myBooks.asks.push(v);
        asksDifference.add.push(v);
      }
    });
    bids.forEach((v) => {
      const index = myBooks.bids.findIndex((a) => {
        return v[0] === a[0];
      });
      if (index > -1) {
        if (v[1] > 0) {
          myBooks.bids[index] = v;
          bidsDifference.update.push(v);
        } else {
          myBooks.bids.splice(index, 1);
          bidsDifference.remove.push(v);
        }
      } else {
        myBooks.bids.push(v);
        bidsDifference.add.push(v);
      }
    });
    const difference = {
      asks: asksDifference,
      bids: bidsDifference,
    };
    return { difference, update: myBooks };
  }

  /**
   * @typedef {Object} Difference
   * @property {Arrary<Depth>} update
   * @property {Arrary<Depth>} add
   * @property {Arrary<Depth>} remove
   *
   * @param {String} instId BTC-USDT
   * @param {Difference} difference
   */
  updateByDifference(instId, lotSz, data) {
    if (!this._markets[instId]["lotSz"]) this._markets[instId]["lotSz"] = lotSz;
    try {
      const result = this._getDifference(instId, data);
      this._snapshot[instId] = result.update;
      this._difference[instId] = result.difference;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * @param {String} instId BTC-USDT
   * @param {Array<Depth>} data
   */
  updateAll(instId, lotSz, data) {
    try {
      if (!this._markets[instId]["lotSz"])
        this._markets[instId]["lotSz"] = lotSz;
      this._difference[instId]["asks"] = this._calculateDifference(
        this._snapshot[instId].asks,
        data.asks
      );
      this._difference[instId]["bids"] = this._calculateDifference(
        this._snapshot[instId].bids,
        data.bids
      );
      this._snapshot[instId] = data;
      return true;
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] updateAll error`, error);
      return false;
    }
  }
}

module.exports = DepthBook;
