import SafeMath from "../../utils/SafeMath";
import BookBase from "../BookBase";

class AccountBook extends BookBase {
  _currentUser;
  _snapshot = {};
  _difference = {};
  // _fiatCurrency = "hkd";
  // _sum;
  // _ratio = {
  //   hkd: 1,
  //   twd: 0.2623,
  //   jpy: 0.0715,
  //   krw: 0.0073,
  //   usd: 7.8,
  //   eur: 8.9341,
  //   try: 1.4637,
  // };
  //exchangeRate 是對美金
  constructor() {
    super();
    this.name = `AccountBook`;
    this._config = { remove: false, add: false, update: true };
    return this;
  }

  /**
   * [deprecated] 2022/10/28
   * move to tickerBook
   */
  // /**
  //  * @param {String} currency
  //  */
  // set fiatCurrency(currency) {
  //   this._fiatCurrency = currency;
  // }

  /**
   * [deprecated] 2022/10/28
   * move to tickerBook
   */
  // get fiatCurrency() {
  //   return this._fiatCurrency;
  // }

  /**
   * [deprecated] 2022/10/28
   * move to middleman
   */
  // getAssetsSum() {
  //   let sum = this._sum;
  //   // console.log(`[START] getAssetsSum sum`, sum);
  //   // console.log(
  //   //   `this._fiatCurrency[this._fiatCurrency !== "hkd"?${
  //   //     this._fiatCurrency !== "hkd"
  //   //   }] `,
  //   //   this._fiatCurrency
  //   // );
  //   if (!this._fiatCurrency && this._fiatCurrency !== "hkd")
  //     sum = SafeMath.mult(this._sum, this._ratio[this._fiatCurrency]);
  //   // console.log(`[END] getAssetsSum sum`, sum);
  //   return sum;
  // }

  getSnapshot(instId) {
    try {
      if (instId)
        return instId.split("-").reduce((prev, currency) => {
          prev[currency] = this._snapshot[currency];
          return prev;
        }, {});
      return this._snapshot;
    } catch (error) {
      console.error(`[AccountBook getSnapshot]`, error);
      return false;
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
   * [deprecated] 2022/10/28
   *  move to middleman
   */
  // sumUp = () => {
  //   let sum = 0;
  //   Object.values(this._snapshot).forEach((account, i) => {
  //     // console.log(`sumUp forEach account`, account);
  //     sum = SafeMath.plus(
  //       sum,
  //       SafeMath.mult(account.total, account.exchangeRate)
  //     );
  //     // console.log(`sumUp forEach sum[${i}]`, sum);
  //   });
  //   // console.log(`sumUp sum`, sum);
  //   this._sum = sum;
  // };

  /**
   *
   * @param {String} currency
   * @param {Account} account
   * @returns
   */
  updateByDifference(accounts) {
    // console.log(`updateByDifference accounts`, accounts);
    this._difference = {};
    try {
      accounts.forEach((account) => {
        this._difference[account.currency] = account;
        this._snapshot[account.currency] = account;
      });
      // this.sumUp();s
      return true;
    } catch (error) {
      console.error(`[AccountBook] error`, error);
      return false;
    }
  }

  /**
   *
   * @param {Array<Account>} account
   * @returns
   */
  updateAll(accounts) {
    // console.log(`[AccountBook updateAll]`, accounts);
    this._difference = {};
    try {
      accounts.forEach((account) => {
        // if (this._compareFunction(this._snapshot[account.currency], account)) {
        this._difference[account.currency] = account;
        // }
        this._snapshot[account.currency] = account;
      });
      // this.sumUp();
      return true;
    } catch (error) {
      console.error(`[AccountBook updateAll]`, error);
      return false;
    }
  }
  clearAll() {
    // console.log(`[AccountBook updateAll]`, accounts);
    const _updateSnapshot = {};
    Object.keys(this._snapshot).forEach((currency) => {
      this._difference[currency] = this._snapshot[currency];
      // }
      this._snapshot[currency] = {
        balance: "0",
        currency,
        locked: "0",
        total: "0",
      };
    });
    this._snapshot = _updateSnapshot;
  }
}

export default AccountBook;
