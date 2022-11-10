const SupportedExchange = require("../../constants/SupportedExchange");
const BookBase = require("../BookBase");
const SafeMath = require("../SafeMath");
const Utils = require("../Utils");

class TickerBook extends BookBase {
  _instruments;
  _tickersSettings;
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
  constructor({ logger, markets, tickersSettings }) {
    super({ logger, markets });
    this.name = `TickerBook`;
    this._config = { remove: false, add: false, update: true };
    this._tickersSettings = tickersSettings;
    this.markets.forEach((market) => {
      this._snapshot[market.instId] = { ...tickersSettings[market.id] };
      this._difference[market.instId] = { ...tickersSettings[market.id] };
    });
    return this;
  }

  /**
   * @param {any} data
   */
  set instruments(data) {
    this._instruments = data;
    // this.logger.debug(`[${this.constructor.name}] instruments`, this.instruments);
  }

  get instruments() {
    return this._instruments;
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

  getPrice(currency) {
    // this.logger.debug(
    //   `this._snapshot[${currency.toUpperCase()}-${this._baseCurrency.toUpperCase()}]`,
    //   this._snapshot[
    //     `${currency.toUpperCase()}-${this._baseCurrency.toUpperCase()}`
    //   ]
    // );
    let price = 0,
      ticker;
    if (this._ratio[currency.toLowerCase()])
      price = this._ratio[currency.toLowerCase()];
    else {
      ticker =
        this._snapshot[
          `${currency.toUpperCase()}-${this._baseCurrency.toUpperCase()}`
        ];
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

  formatTicker(data, source) {
    let change,
      changePct,
      ticker,
      tickerSetting = this._tickersSettings[data.id],
      instrument;
    if (tickerSetting && tickerSetting?.visible) {
      switch (source) {
        case SupportedExchange.OKEX:
          instrument = this.instruments[data.instId];
          change = SafeMath.minus(data.last, data.open24h);
          changePct = SafeMath.gt(data.open24h, "0")
            ? SafeMath.div(change, data.open24h)
            : SafeMath.eq(change, "0")
            ? "0"
            : "1";
          ticker = {
            ...tickerSetting,
            market: data.id,
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
            tickSz: instrument.tickSz.toString(),
            // tickSz: Math.max(
            //   parseFloat(instrument.tickSz),
            //   parseFloat(Utils.getDecimal(tickerSetting["bid"]["fixed"]))
            // ).toString(),
            lotSz: instrument.lotSz.toString(),
            // lotSz: Math.max(
            //   parseFloat(instrument.lotSz),
            //   parseFloat(Utils.getDecimal(tickerSetting["ask"]["fixed"]))
            // ).toString(),
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
            ...tickerSetting,
            ...data,
            group: tickerSetting.group,
            change,
            changePct,
            at: parseInt(data.at),
            ts: parseInt(SafeMath.mult(data.at, "1000")),
            source: SupportedExchange.TIDEBIT,
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
    let result = false;
    this._difference = {};
    try {
      if (this._compareFunction(this._snapshot[instId], ticker)) {
        const tickerSetting = this._tickersSettings[ticker.id];
        if (tickerSetting?.source === ticker.source) {
          this._difference[instId] = { ...this._difference[instId], ...ticker };
          this._snapshot[instId] = { ...this._snapshot[instId], ...ticker };
          result = true;
        }
      }
    } catch (error) {
      this.logger.error(`[${this.constructor.name}] error`, error);
    }
    return result;
  }

  updateTickersSettings(tickersSettings) {
    this._tickersSettings = tickersSettings;
    this._snapshot = Object.values(this._snapshot).reduce((prev, ticker) => {
      prev[ticker.instId] = {
        ...ticker,
        source: this._tickersSettings[ticker.id].source,
        visible: this._tickersSettings[ticker.id].visible,
        ask: {
          ...this._tickersSettings[ticker.id].ask,
        },
        bid: {
          ...this._tickersSettings[ticker.id].bid,
        },
      };
      return prev;
    }, {});
    this._difference = Object.values(this._difference).reduce(
      (prev, ticker) => {
        prev[ticker.instId] = {
          ...ticker,
          source: this._tickersSettings[ticker.id].source,
          visible: this._tickersSettings[ticker.id].visible,
          ask: {
            ...this._tickersSettings[ticker.id].ask,
          },
          bid: {
            ...this._tickersSettings[ticker.id].bid,
          },
        };
        return prev;
      },
      {}
    );
  }

  updateAll(okexTickers, tidebitTickers) {
    // this.logger.debug(`[${this.constructor.name}] updateAll tickers`, tickers);
    this._difference = {};
    try {
      Object.values(this._tickersSettings || {}).forEach((tickerSetting) => {
        let ticker;

        switch (tickerSetting?.source) {
          case SupportedExchange.OKEX:
            ticker = okexTickers[tickerSetting?.id] || {
              ...tickerSetting,
              market: tickerSetting.id,
              buy: "0.0",
              sell: "0.0",
              low: "0.0",
              high: "0.0",
              last: "0.0",
              open: "0.0",
              volume: "0.0",
              change: "0.0",
              changePct: "0.0",
              at: 0,
              ts: 0,
            };
            this._snapshot[tickerSetting?.instId] = ticker;
            this._difference[tickerSetting?.instId] = ticker;
            break;
          case SupportedExchange.TIDEBIT:
            ticker = tidebitTickers[tickerSetting?.id] || {
              ...tickerSetting,
              market: tickerSetting.id,
              buy: "0.0",
              sell: "0.0",
              low: "0.0",
              high: "0.0",
              last: "0.0",
              open: "0.0",
              volume: "0.0",
              change: "0.0",
              changePct: "0.0",
              at: 0,
              ts: 0,
            };
            this._snapshot[tickerSetting?.instId] = ticker;
            this._difference[tickerSetting?.instId] = ticker;
            break;
          default:
            break;
        }
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  getSnapshot(instId) {
    // this.logger.debug(
    //   `[${this.constructor.name}] getSnapshot(${instId})`,
    //   this._snapshot[instId],
    //   this._snapshot
    // );
    if (instId) return this._snapshot[instId];
    else return this._snapshot;
  }
}

module.exports = TickerBook;
