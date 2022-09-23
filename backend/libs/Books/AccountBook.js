const BookBase = require("../BookBase");
const SafeMath = require("../SafeMath");

class AccountBook extends BookBase {
  _ratio = {
    hkd: 1,
    twd: 0.2623,
    jpy: 0.0715,
    krw: 0.0073,
    usd: 7.8,
    eur: 8.9341,
    try: 1.4637,
  };
  exchangeRates = {};
  constructor({ logger, markets, coinsSettings, priceList }) {
    super({ logger, markets });
    this._config = { remove: false, add: false, update: true };
    this.coinsSettings = coinsSettings;
    this.priceList = priceList;
    this.exchangeRates = this.coinsSettings
      .filter((coin) => coin.visible)
      .reduce((prev, curr) => {
        prev[curr.code.toUpperCase()] = {
          ...curr,
          rate:
            curr.code === "try"
              ? this._ratio.try
              : this.priceList[curr.code]
              ? SafeMath.mult(this.priceList[curr.code], this._ratio.usd)
              : 0,
        };
        return prev;
      }, {});
    this.logger.log(`this.exchangeRates `, this.exchangeRates);

    this.name = `AccountBook`;
    return this;
  }

  getExchangeRate() {
    return this.exchangeRates;
  }

  getDifference(memberId) {
    if (!this._difference[memberId]) return null;
    else
      return Object.values(this._difference[memberId]).map((account) => ({
        ...account,
        exchangeRate: this.exchangeRates[account.currency]?.rate || 0,
      }));
  }

  getSnapshot(memberId, instId) {
    if (!this._snapshot[memberId]) return null;
    else {
      if (instId)
        return instId.split("-").map((currency) => ({
          ...this._snapshot[memberId][currency],
          exchangeRate: this.exchangeRates[currency]?.rate || 0,
        }));
      return Object.values(this._snapshot[memberId]).map((account) => ({
        ...account,
        exchangeRate: this.exchangeRates[account.currency]?.rate || 0,
      }));
    }
  }

  /**
   *  return need update Account
   * @typedef {Object} Account
   * @property {String} currency
   * @property {String} balance
   * @property {String} locked
   * @property {String} total
   *
   * @param {Account} valueA
   * @param {Account} valueB
   */
  _compareFunction(valueA, valueB) {
    return (
      valueA?.currency === valueB.currency &&
      (!SafeMath.eq(valueA?.balance, valueB.balance) ||
        !SafeMath.eq(valueA?.locked, valueB.locked))
    );
  }

  /**
   *
   * @param {Account} account
   * @returns
   */
  updateByDifference(memberId, account) {
    this._difference[memberId] = {};
    if (!this._snapshot[memberId]) this._snapshot[memberId] = {};
    if (
      this._compareFunction(this._snapshot[memberId][account.currency], account)
    ) {
      try {
        this._difference[memberId][account.currency] = account;
        this._snapshot[memberId][account.currency] = account;
        return true;
      } catch (error) {
        console.error(`[${this.constructor.name}] error`, error);
        return false;
      }
    }
  }

  /**
   *
   * @param {Array<Account>} account
   * @returns
   */
  updateAll(memberId, accounts) {
    this._difference[memberId] = {};
    if (!this._snapshot[memberId]) this._snapshot[memberId] = {};
    try {
      accounts.forEach((account) => {
        this._difference[memberId][account.currency] = account;
        this._snapshot[memberId][account.currency] = account;
      });
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = AccountBook;
