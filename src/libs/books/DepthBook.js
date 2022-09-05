// import SafeMath from "../../utils/SafeMath";
import SafeMath from "../../utils/SafeMath";
import { formateDecimal } from "../../utils/Utils";
import BookBase from "../BookBase";

class DepthBook extends BookBase {
  unit;
  constructor() {
    super();
    this.name = `DepthBook`;
    this._config = { remove: true, add: true, update: false };
    return this;
  }

  changeRange(unit) {
    this.unit = unit;
  }

  getSnapshot(market, tickSz, lotSz) {
    try {
      let asks = [],
        bids = [];
      if (!this._snapshot[market]) this._snapshot[market] = [];
      for (let data of this._snapshot[market]) {
        let formatedData = {
          ...data,
          price: formateDecimal(data.price, {
            // decimalLength: 2,
            decimalLength: tickSz || 0,
            pad: true,
          }),
          amount: formateDecimal(data.amount, {
            // decimalLength: 2,
            decimalLength: lotSz || 0,
            pad: true,
          }),
          value: formateDecimal(data.value, {
            // decimalLength: 2,
            decimalLength: Math.min(tickSz || 0, lotSz || 0),
            pad: true,
          }),
        };
        if (data.side === "asks") {
          asks.push(formatedData);
        }
        if (data.side === "bids") {
          bids.push(formatedData);
        }
      }
      return {
        market,
        asks,
        bids,
      };
    } catch (error) {
      console.error(`[DepthBook getSnapshot]`, error);
      return false;
    }
  }

  // ++ TODO: verify function works properly
  _calculateDifference(arrayA, arrayB) {
    try {
      const onlyInLeft = (left, right) =>
        left.filter(
          (leftValue) =>
            !right.some((rightValue) =>
              this._compareFunction(leftValue, rightValue)
            )
        );
      const onlyInB = onlyInLeft(arrayB, arrayA);
      return {
        update: onlyInB,
      };
    } catch (error) {
      console.error(`[DepthBook] _calculateDifference error`, error);
      return {
        update: [],
      };
    }
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
  // ++ TODO: verify function works properly
  _formateBooks(bookObj) {
    const bookArr = [];
    bookObj.asks?.forEach((ask) => {
      bookArr.push({
        price: ask[0],
        amount: ask[1],
        value: ask[2],
        total: ask[3],
        depth: ask[4],
        side: "asks",
      });
    });
    bookObj.bids?.forEach((bid) => {
      bookArr.push({
        price: bid[0],
        amount: bid[1],
        value: bid[2],
        total: bid[3],
        depth: bid[4],
        side: "bids",
      });
    });
    return bookArr;
  }

  updateAll(market, data) {
    // console.log(`[DepthBook updateAll]`, market, data);
    return super.updateAll(market, this._formateBooks(data));
  }
}

export default DepthBook;
