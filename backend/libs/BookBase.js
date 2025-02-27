const SafeMath = require("./SafeMath");

class BookBase {
  constructor({ logger, markets }) {
    this.logger = logger;
    this._config = { remove: true, add: true, update: true };
    this.name = `BookBase`;
    this._snapshot = {};
    this._difference = {};
    this._markets = {};
    this.markets = markets;
    this.markets.forEach((market) => {
      this._markets[market.instId] = {};
      this._markets[market.instId]["market"] = market;
      this._snapshot[market.instId] = [];
      this._difference[market.instId] = [];
    });
    return this;
  }

  /**
   *
   * @param {Object} valueA
   * @param {Object} valueB
   */
  _compareFunction(valueA, valueB) {
    return SafeMath.eq(valueA.id, valueB.id);
  }

  /**
   *
   * @param {Array<Object>} arrayA
   * @param {Array<Object>} arrayB
   * @param {Function} compareFunction
   * @returns
   */
  _calculateDifference(arrayA, arrayB) {
    try {
      const onlyInLeft = (left, right) =>
        left.filter(
          (leftValue) =>
            !right.some((rightValue) =>
              this._compareFunction(leftValue, rightValue)
            )
        );

      const onlyInA = this._config.remove ? onlyInLeft(arrayA, arrayB) : [];
      const onlyInB = this._config.add ? onlyInLeft(arrayB, arrayA) : [];
      return {
        remove: onlyInA,
        add: onlyInB,
      };
    } catch (error) {
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }: BaseBook] _calculateDifference error`,
        error,
        arrayA,
        arrayB
      );
      return {
        remove: [],
        add: [],
      };
    }
  }

  /**
   *
   * @param {String} instId
   * @returns {Array<Object>}
   */
  getSnapshot(instId) {
    if (instId) return this._snapshot[instId];
    else return this._snapshot;
  }

  /**
   *
   * @param {String} instId
   * @returns {Array<Object>}
   */
  getDifference(instId) {
    if (instId) return this._difference[instId];
    else return this._difference;
  }

  /**
   * @param {String} str1
   * @param {String} str2
   */
  _isEqual(str1, str2) {
    return SafeMath.isNumber(str1) && SafeMath.isNumber(str2)
      ? SafeMath.eq(str1, str2)
      : str1 === str2;
  }

  // control data length
  // implement in TradeBook & DepthBook
  _trim(instId, data) {
    return data;
  }

  /**
   *
   * @param {String} instId
   * @returns {Boolean}
   */
  updateByDifference(instId, difference) {
    let updateSnapshot;
    try {
      if (this._config.remove) {
        updateSnapshot = this._snapshot[instId].filter(
          (data) =>
            !difference.remove?.some((diff) => this._isEqual(data.id, diff.id))
        );
      }
      if (this._config.add) {
        updateSnapshot = this._snapshot[instId]
          .filter(
            (data) =>
              !difference.add?.some((diff) => this._isEqual(data.id, diff.id))
          )
          .concat(difference.add);
      }
      this._snapshot[instId] = updateSnapshot;
      this._difference[instId] = difference;
      return true;
    } catch (error) {
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }: BaseBook] updateByDifference(instId:${instId}) error`,
        error,
        difference
      );
      return false;
    }
  }

  /**
   *
   * @param {String} instId
   * @returns {Boolean}
   */
  updateAll(instId, data) {
    try {
      this._difference[instId] = this._calculateDifference(
        this._snapshot[instId],
        data
      );
      this._snapshot[instId] = this._trim(instId, data);
      return true;
    } catch (error) {
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }: BaseBook] updateAll(instId:${instId}) error`,
        error,
        data
      );
      return false;
    }
  }
}

module.exports = BookBase;
