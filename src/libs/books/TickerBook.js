import SafeMath from "../../utils/SafeMath";
import BookBase from "../BookBase";

class TickerBook extends BookBase {
  _baseCurrency = "hkd";
  _ratio = {
    hkd: 1,
    twd: 0.2623,
    jpy: 0.0715,
    krw: 0.0073,
    usd: 7.8,
    eur: 8.9341,
    try: 1.4637,
  };
  constructor() {
    super();
    this.name = `TickerBook`;
    this._config = { remove: false, add: false, update: true };
    this._difference = {};
    this._snapshot = {};
    this._prevSnapshot = {};
    this._currentMarket = null;
    this._currentTicker = null;
    return this;
  }

  /**
   * @param {String} currency
   */
  set baseCurrency(currency) {
    this._baseCurrency = currency.toLowerCase();
  }

  get baseCurrency() {
    return this._baseCurrency;
  }

  /**
   * return need update ticker
   * @typedef {Object} Ticker
   * @property {String} id = market
   * @property {String} market
   * @property {String} instId
   * @property {String} name
   * @property {String} base_unit
   * @property {String} quote_unit
   * @property {String} group
   * @property {String} last
   * @property {String} change
   * @property {String} changePct
   * @property {String} open
   * @property {String} high
   * @property {String} low
   * @property {String} volume
   * @property {Number} at
   * @property {String} source
   * @param {Ticker} valueA
   * @param {Ticker} valueB
   */
  _compareFunction(valueA, valueB) {
    return (
      valueA?.instId === valueB.instId &&
      // WORKAROUND
      SafeMath.gt(valueB?.last, "0") &&
      (!SafeMath.eq(valueA?.last, valueB.last) ||
        !SafeMath.eq(valueA?.open, valueB.open) ||
        !SafeMath.eq(valueA?.high, valueB.high) ||
        !SafeMath.eq(valueA?.low, valueB.low) ||
        !SafeMath.eq(valueA?.volume, valueB.volume))
    );
  }

  getPrice(currency) {
    let price = 0,
      ticker;
    if (this._ratio[currency.toLowerCase()])
      price = this._ratio[currency.toLowerCase()];
    else {
      ticker = this._snapshot[`${currency.toLowerCase()}${this._baseCurrency}`];
      if (ticker) {
        price = ticker.last;
      } else {
        ticker = Object.keys(this._snapshot)
          .sort((a, b) => a.code - b.code)
          .find((t) => t.baseUnit === currency.toLowerCase());
        if (ticker) price = ticker.last * this.getPrice(this.quoteUnit);
      }
    }
    return price;
  }

  getTickerSnapshot() {
    return this._snapshot[this._currentMarket];
  }

  getSnapshot() {
    const tickers = Object.keys(this._snapshot).map((market) =>
      !!this._difference[market]
        ? { ...this._snapshot[market], update: true }
        : this._snapshot[market]
    );
    // console.log(`this._difference`, this._difference)
    this._difference = {};
    return tickers;
  }

  getCurrentTicker() {
    this._currentTicker = this._snapshot[this._currentMarket];
    // console.log(`this._snapshot`, this._snapshot)
    return this._currentTicker;
  }

  setCurrentMarket(market) {
    this._currentMarket = market;
  }

  getCurrentMarket() {
    return this._currentMarket;
  }

  updateByDifference(tickers) {
    Object.values(tickers).forEach((ticker) => {
      // if (ticker.instId === "BTC-USDT")
      //   console.log(
      //     `TickerBook _updateTickers ticker.last`,
      //     ticker.last,
      //     new Date(ticker.ts).toISOString(),
      //     this._compareFunction(this._snapshot[ticker.market], ticker)
      //   );
      // if (this._compareFunction(this._snapshot[ticker.market], ticker)) {
      try {
        const preTicker = { ...this._snapshot[ticker.market] };
        this._difference[ticker.market] = {
          ...preTicker,
          ...ticker,
        };
        this._snapshot[ticker.market] = {
          ...preTicker,
          ...ticker,
        };
        return true;
      } catch (error) {
        console.error(`[${this.constructor.name}] error`, error);
        return false;
      }
      // }
    });
  }

  updateAll(tickers) {
    this._difference = {};
    // console.log(`[TickerBook updateAll]`, tickers);
    try {
      Object.values(tickers).forEach((ticker) => {
        // ++ WORKAROUND TODO: enhance performance
        // if (this._compareFunction(this._snapshot[ticker.market], ticker)) {
        // this._difference[ticker.market] = ticker;
        // }
        this._snapshot[ticker.market] = ticker;
      });
      return true;
    } catch (error) {
      console.error(`[TickerBook updateAll]`, error);
      return false;
    }
  }
}

export default TickerBook;
