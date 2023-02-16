import Events from "../constant/Events";
import { ORDER_STATE } from "../constant/OrderState";
import AccountBook from "../libs/books/AccountBook";
import DepthBook from "../libs/books/DepthBook";
import OrderBook from "../libs/books/OrderBook";
import TickerBook from "../libs/books/TickerBook";
import TradeBook from "../libs/books/TradeBook";
import TideBitWS from "../libs/TideBitWS";
import SafeMath from "../utils/SafeMath";
import Communicator from "./Communicator";
// import Pusher from "pusher-js";
// import { randomID } from "dvalue";
// import { wait } from "../utils/Utils";

class Middleman {
  // _userId;
  email;
  memberId;
  isLogin = null;
  constructor() {
    this.name = "Middleman";
    this.accountBook = new AccountBook();
    this.depthBook = new DepthBook();
    this.orderBook = new OrderBook();
    this.tickerBook = new TickerBook();
    this.tradeBook = new TradeBook();
    this.tbWebSocket = new TideBitWS();
    // this._userId = randomID(8);
    // console.log(`[Middleman] userId`, this._userId);
    // this.communicator = new Communicator({ userId: this._userId });
    this.communicator = new Communicator();
    // -- TEST
    window.middleman = this;
    // -- TEST
    return this;
  }

  setbaseCurrency(baseCurrency) {
    this.tickerBook.baseCurrency = baseCurrency;
  }

  async getInstruments(instType) {
    try {
      const instruments = await this.communicator.instruments(instType);
      this.instruments = instruments;
      return instruments;
    } catch (error) {
      // this.instruments = [];
      throw error;
    }
  }

  async getAdminUser() {
    try {
      const response = await this.communicator.getAdminUser(
        this.memberId || "0"
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  async getAdminUsers() {
    try {
      const response = await this.communicator.getAdminUsers();
      return response;
    } catch (error) {
      throw error;
    }
  }

  async getCoinsSettings() {
    try {
      const response = await this.communicator.getCoinsSettings();
      return response;
    } catch (error) {
      throw error;
    }
  }

  async updateCoinsSettings(visible) {
    try {
      const response = await this.communicator.updateCoinsSettings(visible);
      return response;
    } catch (error) {
      throw error;
    }
  }

  async updateCoinSetting(id, visible) {
    try {
      const response = await this.communicator.updateCoinSetting(id, visible);
      return response;
    } catch (error) {
      throw error;
    }
  }

  async updateDepositSetting(id, type, data) {
    try {
      const response = await this.communicator.updateDepositSetting(
        id,
        type,
        data
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  async updateWithdrawSetting(id, type, data) {
    try {
      const response = await this.communicator.updateWithdrawSetting(
        id,
        type,
        data
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  async getTickersSettings() {
    try {
      const response = await this.communicator.getTickersSettings();
      return response;
    } catch (error) {
      throw error;
    }
  }

  async updateTickerSetting(id, type, data) {
    try {
      const response = await this.communicator.updateTickerSetting(
        id,
        type,
        data
      );
      return response;
    } catch (error) {
      throw error;
    }
  }

  async getPlatformAssets() {
    try {
      const response = await this.communicator.getPlatformAssets();
      return response;
    } catch (error) {
      throw error;
    }
  }

  async updatePlatformAsset(id, data) {
    try {
      const response = await this.communicator.updatePlatformAsset(id, data);
      return response;
    } catch (error) {
      throw error;
    }
  }

  async getDashboardData() {
    try {
      const response = await this.communicator.getDashboardData();
      return response;
    } catch (error) {
      throw error;
    }
  }

  async addAdminUser(newUser) {
    try {
      const response = await this.communicator.addAdminUser(newUser);
      return response;
    } catch (error) {
      throw error;
    }
  }

  async deleteAdminUser(user) {
    try {
      const response = await this.communicator.deleteAdminUser(user);
      return response;
    } catch (error) {
      throw error;
    }
  }

  async updateAdminUser(updateUser) {
    try {
      const response = await this.communicator.updateAdminUser(updateUser);
      return response;
    } catch (error) {
      throw error;
    }
  }

  async getOuterTradesProfits({ ticker, exchange, start, end }) {
    try {
      return await this.communicator.getOuterTradesProfits({
        instId: ticker,
        exchange,
        start,
        end,
      });
    } catch (error) {
      throw error;
    }
  }

  async getOuterTradeFills({ instId, exchange, start, end, limit, offset }) {
    try {
      return await this.communicator.getOuterTradeFills({
        instId,
        exchange,
        start,
        end,
        limit,
        offset,
      });
    } catch (error) {
      throw error;
    }
  }

  async getOuterPendingOrders({ instId, exchange, before, after }) {
    try {
      return await this.communicator.getOuterPendingOrders({
        instId,
        exchange,
        before,
        after,
      });
    } catch (error) {
      throw error;
    }
  }

  async getMembers({ email, offset, limit }) {
    try {
      return await this.communicator.getMembers({ email, offset, limit });
    } catch (error) {
      throw error;
    }
  }

  async auditorMemberAccounts({ memberId, currency }) {
    try {
      return await this.communicator.auditorMemberAccounts({
        memberId,
        currency,
      });
    } catch (error) {
      throw error;
    }
  }

  async auditorMemberBehavior({ memberId, currency, start, end }) {
    try {
      return await this.communicator.auditorMemberBehavior({
        memberId,
        currency,
        start,
        end,
      });
    } catch (error) {
      throw error;
    }
  }

  async fixAccountHandler(accountId) {
    try {
      return await this.communicator.fixAccountHandler(accountId);
    } catch (error) {
      throw error;
    }
  }

  async logout() {
    try {
      const res = await this.communicator.logout();
      this.tbWebSocket.setCurrentUser(null);
      this.memberId = null;
      this.email = null;
      this.isLogin = false;
      return res;
    } catch (error) {
      throw error;
    }
  }

  async postOrder(order) {
    if (this.isLogin) return await this.communicator.order(order);
  }

  async cancelOrder(order) {
    if (this.isLogin) {
      const result = await this.communicator.cancel(order.id);
      console.log(`cancelOrder result`, result);
      if (result.success) {
        this.orderBook.updateByDifference(
          this.tickerBook.getCurrentTicker()?.market,
          { add: [{ ...order, state: "cancel", state_text: "Canceled" }] }
        );
        console.log(
          `cancelOrder this.orderBook.snapshot`,
          this.orderBook.getSnapshot(this.tickerBook.getCurrentTicker()?.market)
        );
      }
    }
  }

  async forceCancelOrder(order) {
    return await this.communicator.forceCancelOrder(order);
  }

  async cancelOrders(options) {
    if (this.isLogin) {
      return await this.communicator.cancelOrders(options);
    }
  }

  /**
   * [deprecated] 2022/10/14
   */
  async getExAccounts(exchange) {
    return await this.communicator.getExAccounts(exchange);
  }

  /**
   * [deprecated] 2022/10/14
   */
  async getUsersAccounts(exchange) {
    return await this.communicator.getUsersAccounts(exchange);
  }

  getMyOrdersSnapshot(market) {
    if (!market) market = this.tickerBook.getCurrentTicker()?.market;
    return this.orderBook.getSnapshot(market);
  }

  async _getOrders(market, options = {}) {
    try {
      const openOrders = await this.communicator.getOrders({
        state: ORDER_STATE.OPEN,
        market,
        limit: 1000,
      });
      const orderHistories = await this.communicator.getOrders({
        state: ORDER_STATE.OPEN,
        market,
        limit: 1000,
      });
      const orders = openOrders.concat(orderHistories);
      // if (!!orders) this.orderBook.updateByDifference(market, { add: orders });
      if (!!orders) this.orderBook.updateAll(market, orders);
    } catch (error) {
      console.error(`_getOrders error`, error);
      // throw error;
    }
  }

  getTickersSnapshot() {
    return this.tickerBook.getSnapshot();
  }

  async getTickers(instType = "SPOT", from, limit) {
    let rawTickers,
      tickers = {};

    try {
      rawTickers = await this.communicator.tickers(instType, from, limit);
      rawTickers.forEach((t) => {
        const ticker = {
          ...t,
          tickSz: t.tickSz || "0.01", //下單價格精度，如 0.0001
          lotSz: t.lotSz || "0.01", //下單數量精度，如 BTC-USDT-SWAP：1
          minSz: t.minSz || "0.01", //最小下單數量
          maxLmtSz: t.maxLmtSz || "10000", //合約或現貨限價單的單筆最大委託數量
          maxMktSz: t.maxMktSz || "99999", //合約或現貨市價單的單筆最大委託數量
        };
        tickers[ticker.instId] = ticker;
      });
      this.tickerBook.updateAll(tickers);
    } catch (error) {
      console.error(`get tickers error`, error);
      throw error;
    }
    return this.tickers;
  }

  /**
   * [deprecated] 2022/10/28
   */
  async getExchangeRates() {
    try {
      const exchangeRates = await this.communicator.getExchangeRates();
      this.exchangeRates = exchangeRates;
      // console.log(`middleman this.exchangeRates`, this.exchangeRates)
      return exchangeRates;
    } catch (error) {
      this.exchangeRates = {};
      throw error;
    }
  }

  getTradesSnapshot(market, length = 50, asc = false) {
    if (!market) market = this.tickerBook.getCurrentTicker()?.market;
    return this.tradeBook.getSnapshot(market, length, asc);
  }

  async _getTrades({ market, limit, lotSz }) {
    try {
      const trades = await this.communicator.getTrades({
        market,
        limit,
        lotSz,
      });
      this.tradeBook.updateAll(market, trades);
    } catch (error) {
      console.error(`_getTrades error`, error);
      // throw error;
    }
  }

  getDepthBooksSnapshot(market) {
    if (!market) market = this.tickerBook.getCurrentTicker()?.market;
    return this.depthBook.getSnapshot(market);
  }

  getDepthChartData(books) {
    const _bids = books.bids
      .map((bid) => ({ ...bid }))
      .sort((a, b) => +a.price - +b.price);
    const _asks = books.asks.map((ask) => ({ ...ask }));
    if (_bids.length > _asks.length) {
      const d = _asks.length - 1;
      for (let i = _asks.length; i < _bids.length; i++) {
        _asks.push({
          price: SafeMath.plus(
            _asks[i - 1]?.price || "0",
            i + 1 > _bids.length - 1
              ? SafeMath.minus(
                  _bids[_bids.length - 1]?.price,
                  _bids[_bids.length - 2]?.price
                )
              : SafeMath.minus(_bids[i + 1]?.price, _bids[i]?.price)
          ),
          total: _asks[d]?.total || "0",
        });
      }
    } else if (_bids.length < _asks.length) {
      for (let i = _bids.length; i < _asks.length; i++) {
        const d = _bids.length - 1;
        _bids.push({
          price: SafeMath.plus(
            _bids[i - 1]?.price || "0",
            i + 1 > _bids.length - 1
              ? SafeMath.minus(
                  _asks[_asks.length - 1]?.price,
                  _asks[_asks.length - 2]?.price
                )
              : SafeMath.minus(_asks[i + 1]?.price, _asks[i]?.price)
          ),
          total: _bids[d]?.total || "0",
        });
      }
    }
    const _bs = _bids
      .map((b) => ({
        x: b.price,
        y: b.total,
      }))
      .concat(
        _asks.map((a) => ({
          x: a.price,
          y: null,
        }))
      );
    const _as = _bids
      .map((b) => ({
        x: b.price,
        y: null,
      }))
      .concat(
        _asks.map((a) => ({
          x: a.price,
          y: a.total,
        }))
      );
    return {
      asks: _as,
      bids: _bs,
    };
  }

  async _getDepthBooks({ market, sz, lotSz }) {
    try {
      const depthBook = await this.communicator.getDepthBooks({
        market,
        sz,
        lotSz,
      });
      this.depthBook.updateAll(market, depthBook);
    } catch (error) {
      console.error(`_getDepthBooks error`, error);
      // throw error;
    }
  }

  getCurrentTicker() {
    return this.tickerBook.getCurrentTicker();
  }

  getTickerSnapshot(market) {
    return this.tickerBook.getTickerSnapshot(market);
  }

  async _getTicker(market) {
    try {
      const ticker = await this.communicator.ticker(market);
      if (ticker) this.tickerBook.updateByDifference(market, ticker[market]);
    } catch (error) {
      console.error(`_getTicker error`, error);
    }
  }

  parseXSRFToken() {
    let cookies = window.document.cookie.split(";");
    const data = cookies.find((v) => {
      return /XSRF-TOKEN/.test(v);
    });
    const XSRFToken = !data
      ? undefined
      : decodeURIComponent(data.split("=")[1]);
    // console.log(`parseXSRFToken XSRFToken`, XSRFToken);
    return XSRFToken;
  }

  async getAccounts() {
    try {
      const res = await this.communicator
        .getAccounts
        // this.selectedTicker?.instId?.replace("-", ",")
        ();
      // console.log(`_getAccounts res`, res);
      if (res) {
        this.accountBook.updateAll(res.accounts);
        if (!this.memberId) {
          this.memberId = res.memberId;
          this.email = res.email;
          if (this.memberId) {
            this.registerUser(res.peatioSession);
            this.isLogin = true;
          } else {
            this.isLogin = false;
          }
        }
      } else {
        this.isLogin = false;
      }
    } catch (error) {
      console.error(`_getAccounts error`, error);
      // this.isLogin = false;
      this.accountBook.clearAll();
    }
  }

  getPrice(currency) {
    return this.tickerBook.getPrice(currency);
  }

  getAccountsSnapshot(instId) {
    let accounts = this.accountBook.getSnapshot(),
      sum = 0;
    Object.keys(accounts).forEach((currency) => {
      let price = this.tickerBook.getPrice(currency);
      let amount = SafeMath.mult(accounts[currency].total, price);
      sum = sum + parseFloat(amount);
      accounts[currency] = {
        ...accounts[currency],
        price,
        amount,
      };
    });
    if (instId)
      accounts = instId.split("-").reduce((prev, currency) => {
        prev[currency] = accounts[currency];
        return prev;
      }, {});
    return {
      accounts,
      sum: sum.toFixed(2),
    };
  }

  async registerMarket(market) {
    this.tbWebSocket.registerMarket(market);
    await this._getTrades({ market });
  }

  async selectMarket(market) {
    let lotSz;
    this.tickerBook.setCurrentMarket(market);
    if (!this.tickerBook.getCurrentTicker()) await this._getTicker(market);
    lotSz = this.tickerBook.getCurrentTicker()?.lotSz;
    this.depthBook.lotSz = lotSz;
    this.tbWebSocket.setCurrentMarket(market);
    await this._getDepthBooks({ market, lotSz });
    await this._getTrades({ market, lotSz });
    if (this.isLogin) {
      await this._getOrders(market);
    }
  }

  _tbWSEventListener() {
    this.tbWebSocket.onmessage = (msg) => {
      let metaData = JSON.parse(msg.data);
      // console.log(metaData);
      switch (metaData.type) {
        case Events.account:
          // console.log(`_tbWSEventListener Events.account`, metaData);
          // console.log(
          //   `_tbWSEventListener this.accountBook.getSnapshot`,
          //   this.accountBook.getSnapshot()
          // );
          this.accountBook.updateByDifference(metaData.data);
          // console.log(
          //   `_tbWSEventListener this.accountBook.getSnapshot`,
          //   this.accountBook.getSnapshot()
          // );
          break;
        case Events.update:
          this.depthBook.updateAll(metaData.data.market, metaData.data);
          break;
        case Events.order:
          // console.log(`_tbWSEventListener Events.order`, metaData);
          // console.log(
          //   `_tbWSEventListener this.orderBook.getSnapshot`,
          //   this.orderBook.getSnapshot(metaData.data.market)
          // );
          this.orderBook.updateByDifference(
            metaData.data.market,
            metaData.data.difference
          );
          // console.log(
          //   `_tbWSEventListener this.orderBook.getSnapshot`,
          //   this.orderBook.getSnapshot(metaData.data.market)
          // );
          break;
        case Events.tickers:
          // if (metaData.data["BTC-USDT"])
          //   console.log(
          //     `middleman metaData.data["BTC-USDT"].last`,
          //     metaData.data["BTC-USDT"]?.last
          //   );
          this.tickerBook.updateByDifference(metaData.data);
          break;
        case Events.trades:
          // console.log(`middleman metaData.data.trades`, metaData.data.trades);
          this.tradeBook.updateAll(metaData.data.market, metaData.data.trades);
          break;
        case Events.trade:
          this.tradeBook.updateByDifference(
            metaData.data.market,
            metaData.data.difference
          );
          break;
        default:
      }
    };
  }

  async registerUser(peatioSession) {
    try {
      const CSRFToken = await this.communicator.CSRFTokenRenew();
      const XSRFToken = this.parseXSRFToken();
      this.tbWebSocket.setCurrentUser({
        CSRFToken,
        memberId: this.memberId,
        peatioSession,
        XSRFToken,
      });
    } catch (error) {
      console.error(`tbWebSocket error`, error);
    }
  }

  async initWs() {
    const options = await this.communicator.getOptions();
    this.tbWebSocket.init({
      url: `${window.location.protocol === "https:" ? "wss://" : "ws://"}${
        options.wsUrl
      }/ws`,
      memberId: options.memberId,
    });
    if (options.memberId && options.peatioSession) {
      this.isLogin = true;
      this.memberId = options.memberId;
      this.email = options.email;
      this.registerUser(options.peatioSession);
    } else {
      this.isLogin = null;
    }
  }

  stop() {
    // TODO stop ws
  }
}

export default Middleman;
