// import SafeMath from "../../utils/SafeMath";
import BookBase from "../BookBase";

class TradeBook extends BookBase {
  constructor() {
    super();
    this.name = `TradeBook`;
    this._config = { remove: false, add: true, update: false };
    this._prevSnapshot = {};
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
  _compareFunction(valueA, valueB) {
    return valueA.id === valueB.id;
  }

  updateAll(market, data) {
    if (!this._snapshot[market]) this._snapshot[market] = [];

    try {
      this._difference[market] = this._calculateDifference(
        this._snapshot[market],
        data
      );
      this._snapshot[market] = this._trim(data);
      if (!this._prevSnapshot[market])
        this._prevSnapshot[market] = this._snapshot[market];
    } catch (error) {
      console.error(`[BookBase] updateAll error`, error);
      return false;
    }
  }

  getSnapshot(market) {
    try {
      let trades;
      if (this._snapshot[market]) {
        trades = this._snapshot[market].map((trade) => {
          if (
            !this._prevSnapshot[market].some((_trade) =>
              this._compareFunction(trade, _trade)
            )
          ) {
            return { ...trade, update: true };
          } else return trade;
        });
        this._prevSnapshot[market] = this._snapshot[market];
      } else trades = [];
      return trades;
    } catch (error) {
      console.error(`[TradeBook getSnapshot]`, error);
      return false;
    }
  }
}

export default TradeBook;
