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
  constructor({ logger, markets }) {
    super({ logger, markets });
    this._config = { remove: false, add: false, update: true };
    this.name = `AccountBook`;
    return this;
  }

  /**
   * @param {any} data
   */
  set priceList(data) {
    this._priceList = data;
    // this.logger.log(`[${this.constructor.name}] priceList`, this.priceList);
  }

  get priceList() {
    return this._priceList;
  }

  getDifference(memberId) {
    if (!this._difference[memberId]) return null;
    else return Object.values(this._difference[memberId]);
  }

  getSnapshot(memberId, instId) {
    if (!this._snapshot[memberId]) return null;
    else {
      if (instId)
        return instId.split("-").map((currency) => ({
          ...this._snapshot[memberId][currency],
          exchangeRate:
            currency.toLowerCase() === "try"
              ? this._ratio.try
              : SafeMath.mult(
                  this.priceList[currency.toLowerCase()],
                  this._ratio.usd
                ) || 0,
        }));
      return Object.values(this._snapshot[memberId]).map((account) => ({
        ...account,
        exchangeRate:
          account.currency.toLowerCase() === "try"
            ? this._ratio.try
            : SafeMath.mult(
                this.priceList[account.currency.toLowerCase()],
                this._ratio.usd
              ) || 0,
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
