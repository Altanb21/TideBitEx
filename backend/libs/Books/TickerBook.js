const SupportedExchange = require("../../constants/SupportedExchange");
const BookBase = require("../BookBase");
const SafeMath = require("../SafeMath");
const Utils = require("../Utils");

class TickerBook extends BookBase {
  _instruments;
  constructor({ logger, markets }) {
    super({ logger, markets });
    this.name = `TickerBook`;
    this._config = { remove: false, add: false, update: true };
    this.markets.forEach((market) => {
      this._snapshot[market.instId] = null;
      this._difference[market.instId] = null;
    });
    return this;
  }

  /**
   * @param {any} data
   */
  set instruments(data) {
    this._instruments = data;
    this.logger.log(`[${this.constructor.name}] instruments`, this.instruments);
  }

  get instruments() {
    return this._instruments;
  }

  formatTicker(data, source) {
    const tbMarket = this._markets[data.instId]["market"];
    const instrument = this.instruments[data.instId];
    let id, change, changePct, ticker;
    switch (source) {
      case SupportedExchange.OKEX:
        id = data.instId.replace("-", "").toLowerCase();
        change = SafeMath.minus(data.last, data.open24h);
        changePct = SafeMath.gt(data.open24h, "0")
          ? SafeMath.div(change, data.open24h)
          : SafeMath.eq(change, "0")
          ? "0"
          : "1";
        ticker = {
          id,
          market: id,
          instId: data.instId,
          name: data.instId.replace("-", "/"),
          base_unit: data.instId.split("-")[0].toLowerCase(),
          quote_unit: data.instId.split("-")[1].toLowerCase(),
          last: data.last,
          change,
          changePct,
          open: data.open24h,
          high: data.high24h,
          low: data.low24h,
          volume: data.vol24h,
          // volumeCcy: data.volCcy24h,
          at: parseInt(SafeMath.div(data.ts, "1000")),
          ts: parseInt(data.ts),
          source,
          pricescale: tbMarket["price_group_fixed"],
          group: tbMarket["tab_category"],
          tickSz: Math.max(
            parseFloat(instrument.tickSz),
            parseFloat(Utils.getDecimal(tbMarket["bid"]["fixed"]))
          ).toString(),
          lotSz: Math.max(
            parseFloat(instrument.lotSz),
            parseFloat(Utils.getDecimal(tbMarket["ask"]["fixed"]))
          ).toString(),
          minSz: instrument.minSz,
          sell: data.askPx, // [about to decrepted]
          buy: data.bidPx, // [about to decrepted]
          ticker: {
            // [about to decrepted]
            buy: data.bidPx,
            sell: data.askPx,
            low: data.low24h,
            high: data.high24h,
            last: data.last,
            open: data.open24h,
            vol: data.vol24h,
          },
        };
        break;
      case SupportedExchange.TIDEBIT:
        change = SafeMath.minus(data.last, data.open);
        changePct = SafeMath.gt(data.open, "0")
          ? SafeMath.div(change, data.open)
          : SafeMath.eq(change, "0")
          ? "0"
          : "1";
        ticker = {
          ...data,
          name: tbMarket?.name || data?.name,
          base_unit: tbMarket?.base_unit || data?.base_unit,
          quote_unit: tbMarket?.quote_unit || data?.quote_unit,
          change,
          changePct,
          at: parseInt(data.at),
          ts: parseInt(SafeMath.mult(data.at, "1000")),
          source: SupportedExchange.TIDEBIT,
          pricescale: tbMarket?.price_group_fixed,
          group: tbMarket?.group,
          tickSz: Utils.getDecimal(tbMarket?.bid?.fixed),
          lotSz: Utils.getDecimal(tbMarket?.ask?.fixed),
          minSz: Utils.getDecimal(tbMarket?.ask?.fixed),
          ticker: {
            // [about to decrepted]
            buy: data.buy,
            sell: data.sell,
            low: data.low,
            high: data.high,
            last: data.last,
            open: data.open,
            vol: data.volume,
          },
        };
        break;
      default:
        break;
    }

    return ticker;
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
      !valueA ||
      (valueA?.instId === valueB.instId &&
        (!SafeMath.eq(valueA?.last, valueB.last) ||
          !SafeMath.eq(valueA?.open, valueB.open) ||
          !SafeMath.eq(valueA?.high, valueB.high) ||
          !SafeMath.eq(valueA?.low, valueB.low) ||
          !SafeMath.eq(valueA?.volume, valueB.volume)))
    );
  }

  updateByDifference(instId, ticker) {
    this._difference = {};
    try {
      if (this._compareFunction(this._snapshot[instId], ticker)) {
        this._difference[instId] = { ...this._difference[instId], ...ticker };
        this._snapshot[instId] = { ...this._snapshot[instId], ...ticker };
        return true;
      } else {
        return false;
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] error`, error);
      return false;
    }
  }

  updateAll(tickers) {
    // this.logger.log(`[${this.constructor.name}] updateAll tickers`, tickers);
    this._difference = {};
    try {
      Object.values(tickers).forEach((ticker) => {
        this._snapshot[ticker.instId] = ticker;
        this._difference[ticker.instId] = ticker;
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = TickerBook;
