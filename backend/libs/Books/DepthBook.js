const BookBase = require("../BookBase");
const SafeMath = require("../SafeMath");

class DepthBook extends BookBase {
  constructor({ logger, markets }) {
    super({ logger, markets });
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
      SafeMath.eq(valueA.price, valueB.price) &&
      SafeMath.eq(valueA.amount, valueB.amount) &&
      valueA.side === valueB.side
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

  _trim(instId, data, tickerPrice) {
    let lotSz = this._markets[instId]["lotSz"] || 0,
      asks = [],
      bids = [];
    data.forEach((d) => {
      if (d.side === "asks") {
        asks.push({ ...d });
      }
      if (d.side === "bids") {
        bids.push({ ...d });
      }
    });
    asks = asks
      .filter((book) => {
        if (tickerPrice && book.price <= tickerPrice)
          this.logger.error(
            `askOrderPrice smaller then tickerPrice`,
            `askOrder`,
            book,
            `tickerPrice`,
            tickerPrice
          );
        return book.amount >= lotSz && book.price >= tickerPrice;
      })
      .sort((a, b) => +a.price - +b.price)
      .slice(0, 50);
    bids = bids
      .filter((book) => {
        if (tickerPrice && book.price > tickerPrice)
          this.logger.error(
            `bidOrderPrice bigger then tickerPrice`,
            book,
            `tickerPrice`,
            tickerPrice
          );
        if (asks[0]?.price && book.price > asks[0]?.price)
          this.logger.error(
            `bidOrderPrice bigger then ask[0]Price`,
            book,
            `asks[0]`,
            asks[0]
          );
        return (
          book.amount >= lotSz &&
          (tickerPrice && asks[0]?.price
            ? book.price <= tickerPrice && book.price < asks[0].price
            : tickerPrice
            ? book.price <= tickerPrice
            : asks[0]?.price
            ? book.price < asks[0].price
            : true)
        );
      })
      .sort((a, b) => +b.price - +a.price)
      .slice(0, 50);
    return asks.concat(bids);
  }

  // !!!! IMPORTANT 要遵守 tideLegacy 的資料格式
  getSnapshot(instId) {
    let market = instId.replace("-", "").toLowerCase(),
      sumAskAmount = "0",
      sumBidAmount = "0",
      asks = [],
      bids = [],
      total;
    for (let data of this._snapshot[instId]) {
      if (data.side === "asks") {
        sumAskAmount = SafeMath.plus(data.amount, sumAskAmount);
        asks.push([data.price, data.amount, sumAskAmount]);
      }
      if (data.side === "bids") {
        sumBidAmount = SafeMath.plus(data.amount, sumBidAmount);
        bids.push([data.price, data.amount, sumBidAmount]);
      }
    }
    total = SafeMath.plus(sumAskAmount || "0", sumBidAmount || "0");
    asks = asks.map((ask) => [...ask, SafeMath.div(ask[2], total)]);
    bids = bids.map((bid) => [...bid, SafeMath.div(bid[2], total)]);
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

  /**
   * @typedef {Object} Book
   * @property {string} market
   * @property {Array} asks
   * @property {Array} bids
   *
   * @param {Book} bookObj
   * @returns {Array<Depth>}
   */
  _formateBooks(bookObj) {
    let bookArr = [];
    bookObj.asks.forEach((ask) => {
      bookArr.push({
        price: ask[0],
        amount: ask[1],
        side: "asks",
      });
    });
    bookObj.bids.forEach((bid) => {
      bookArr.push({
        price: bid[0],
        amount: bid[1],
        side: "bids",
      });
    });
    // bookArr.sort((a, b) => +b.price - +a.price);
    // console.log(`[DepthBook _formateBooks]`, bookArr);
    return bookArr;
  }

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
  _getDifference(preArr, newArr) {
    const difference = {
      add: [],
      update: [],
      remove: [],
    };
    const update = preArr;
    newArr.forEach((data) => {
      const index = preArr.findIndex(
        (_data) =>
          SafeMath.eq(data.price, _data.price) && data.side === _data.side
      );
      if (index === -1 && SafeMath.gt(data.amount, "0")) {
        update.push(data);
        difference.add.push(data);
      }
      if (index !== -1) {
        if (SafeMath.eq(data.amount, "0")) {
          update.splice(index, 1);
          difference.remove.push(data);
        } else if (!SafeMath.eq(data.amount, preArr[index].amount)) {
          update[index] = data;
          difference.update.push(data);
        }
      }
    });
    // update.sort((a, b) => +b.price - +a.price);
    return { difference, update };
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
  updateByDifference(instId, lotSz, tickerPrice, data) {
    this.logger.log(
      `updateByDifference`,
      `lotSz`,
      lotSz,
      `tickerPrice`,
      tickerPrice,
      data
    );
    const asks = data.asks
      .filter((v) => parseFloat(v[1]) > 0)
      .map((v) => parseFloat(v[0]))
      .sort();
    const bids = data.bids
      .filter((v) => parseFloat(v[1]) > 0)
      .map((v) => parseFloat(v[0]))
      .sort()
      .reverse();
    const ask = asks[0];
    const bid = bids[0];
    if (ask <= bid) {
      this.logger.error("* askOrderPriceError *", `ask: ${ask}`, `bid: ${bid}`);
    } else {
      this.logger.log("* askOrderPrice normal *", `ask: ${ask}`, `bid: ${bid}`);
    }

    if (!this._markets[instId]["lotSz"]) this._markets[instId]["lotSz"] = lotSz;
    try {
      const result = this._getDifference(
        [...this._snapshot[instId]],
        this._formateBooks(data)
      );
      this.logger.log(`trim from updateByDifference`, result.difference);
      this._snapshot[instId] = this._trim(instId, result.update, tickerPrice);
      this._difference[instId] = this.result.difference;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * @param {String} instId BTC-USDT
   * @param {Array<Depth>} data
   */
  updateAll(instId, lotSz, tickerPrice, data) {
    this.logger.log(`updateAll`, `lotSz`, lotSz, `tickerPrice`, tickerPrice);
    if (!this._markets[instId]["lotSz"]) this._markets[instId]["lotSz"] = lotSz;
    this.logger.log(`trim from updateAll`);
    return super.updateAll(instId, this._formateBooks(data), tickerPrice);
  }
}

module.exports = DepthBook;
