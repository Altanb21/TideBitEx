import SafeMath from "../../utils/SafeMath";
import BookBase from "../BookBase";

class AccountBook extends BookBase {
  _currentUser;
  constructor() {
    super();
    this.name = `AccountBook`;
    this._config = { remove: false, add: false, update: true };
    this._snapshot = {};
    this._difference = {};
    return this;
  }

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
   *
   * @param {String} currency
   * @param {Account} account
   * @returns
   */
  updateByDifference(accounts) {
    this._difference = {};
    try {
      accounts.forEach((account) => {
        this._difference[account.currency] = account;
        this._snapshot[account.currency] = account;
      });
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
