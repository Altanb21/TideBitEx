import Events from "../constant/Events";
import AccountBook from "../libs/books/AccountBook";
import DepthBook from "../libs/books/DepthBook";
import OrderBook from "../libs/books/OrderBook";
import TickerBook from "../libs/books/TickerBook";
import TradeBook from "../libs/books/TradeBook";
import TideBitWS from "../libs/TideBitWS";
import Communicator from "./Communicator";
// import Pusher from "pusher-js";
// import { randomID } from "dvalue";
import { wait } from "../utils/Utils";

class Middleman {
  // _userId;
  memberId;
  isLogin = false;
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

  async postOrder(order) {
    if (this.isLogin) return await this.communicator.order(order);
  }
  async cancelOrder(order) {
    if (this.isLogin) {
      const result = await this.communicator.cancel(order);
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

  async cancelOrders(options) {
    if (this.isLogin) {
      return await this.communicator.cancelOrders(options);
    }
  }

  async getExAccounts(exchange) {
    return await this.communicator.getExAccounts(exchange);
  }

  async getUsersAccounts(exchange) {
    return await this.communicator.getUsersAccounts(exchange);
  }

  getMyOrders(market) {
    if (!market) market = this.tickerBook.getCurrentTicker()?.market;
    return this.orderBook.getSnapshot(market);
  }

  async _getOrderList(market, options = {}) {
    try {
      const orders = await this.communicator.getOrderList({
        ...options,
        market,
      });
      if (!!orders) this.orderBook.updateByDifference(market, { add: orders });
      // if (!!orders) this.orderBook.updateAll(market, orders);
    } catch (error) {
      console.error(`_getOrderList error`, error);
      // throw error;
    }
  }

  async _getOrderHistory(market, options = {}) {
    try {
      const orders = await this.communicator.getOrderHistory({
        ...options,
        market,
      });
      if (!!orders) this.orderBook.updateByDifference(market, { add: orders });
      // if (!!orders) this.orderBook.updateAll(market, orders);
    } catch (error) {
      console.error(`_getOrderHistory error`, error);
      // throw error;
    }
  }

  getTickers() {
    return this.tickerBook.getSnapshot();
  }

  async _getTickers(instType = "SPOT", from, limit) {
    let rawTickers,
      tickers = {};

    try {
      rawTickers = await this.communicator.tickers(instType, from, limit);
      Object.values(rawTickers)
        .filter((t) => !!t)
        .forEach((t) => {
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

  getTrades(market) {
    if (!market) market = this.tickerBook.getCurrentTicker()?.market;
    let lotSz = this.tickerBook.getCurrentTicker()?.lotSz;
    return this.tradeBook.getSnapshot(market, lotSz);
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

  getDepthBooks(market) {
    if (!market) market = this.tickerBook.getCurrentTicker()?.market;
    let lotSz = this.tickerBook.getCurrentTicker()?.lotSz;
    // console.log(`getBooks current market`, market)
    return this.depthBook.getSnapshot(market, lotSz);
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

  getTicker() {
    return this.tickerBook.getCurrentTicker();
  }

  async _getTicker(market) {
    try {
      const ticker = await this.communicator.ticker(market);
      if (ticker) this.tickerBook.updateByDifference(market, ticker[market]);
    } catch (error) {
      console.error(`_getTicker error`, error);
    }
  }

  // parseXSRFToken() {
  //   let cookies = window.document.cookie.split(";");
  //   const data = cookies.find((v) => {
  //     return /XSRF-TOKEN/.test(v);
  //   });
  //   const XSRFToken = !data
  //     ? undefined
  //     : decodeURIComponent(data.split("=")[1]);
  //   console.log(`parseXSRFToken XSRFToken`, XSRFToken);
  //   return XSRFToken;
  // }

  async _getAccounts(market) {
    try {
      const res = await this.communicator
        .getAccounts
        // this.selectedTicker?.instId?.replace("-", ",")
        ();
      // console.log(`_getAccounts res`, res);
      if (res) {
        if (res.accounts) {
          this.accountBook.updateAll(res.accounts);
        }
        if (res.memberId) {
          if (!this.isLogin || this.memberId !== res.memberId) {
            this.memberId = res.memberId;
            this.isLogin = true;
            try {
              const CSRFToken = await this.communicator.CSRFTokenRenew();
              // console.log(`[Middleman] _getAccounts userId`, this._userId);
              // const userId = this._userId;
              this.tbWebSocket.setCurrentUser(market, {
                CSRFToken,
                memberId: this.memberId,
                // userId,
              });
              this.tickerBook.setCurrentMarket(market);
            } catch (error) {
              console.error(`tbWebSocket error`, error);
            }
          }
        }
      } else {
        this.isLogin = false;
        this.memberId = null;
        this.accountBook.clearAll();
        this.orderBook.clearAll();
      }
    } catch (error) {
      console.error(`_getAccounts error`, error);
      this.isLogin = false;
      this.accountBook.clearAll();
    }
  }

  getAccounts(instId) {
    return this.accountBook.getSnapshot(instId);
  }

  async selectMarket(market) {
    let lotSz;
    this.tickerBook.setCurrentMarket(market);
    if (!this.tickerBook.getCurrentTicker()) await this._getTicker(market);
    lotSz = this.tickerBook.getCurrentTicker()?.lotSz;
    this.depthBook.lotSz = lotSz;
    this.tbWebSocket.setCurrentMarket(market, lotSz);
    // await this._getDepthBooks({ market, lotSz });
    await this._getTrades({ market, lotSz });
    if (this.isLogin) {
      await this._getOrderList(market);
      await this._getOrderHistory(market);
    }
    // let pusher = new Pusher("2b78567f96a2c0f40368", {
    //   wsHost: "pusher.tinfo.top",
    //   port: 4567,
    //   disableFlash: true,
    //   disableStats: true,
    //   disabledTransports: ["flash", "sockjs"],
    //   forceTLS: false,
    // });
    // window.pusher = pusher;
    // let channel = pusher.subscribe(`market-${market}-global`);
    // window.channel = channel;
    // channel.bind("update", (data) => console.log(`update`, data));
    // channel.bind("trades", (data) => console.log(`trades`, data));
    // let globalChannel = pusher.subscribe("market-global");
    // globalChannel.bind("tickers", (data) => console.log(`tickers`,data));
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

  async start(market) {
    const options = await this.communicator.getOptions();
    this.tbWebSocket.init({
      url: `${window.location.protocol === "https:" ? "wss://" : "ws://"}${
        options.wsUrl
      }/ws`,
    });
    // this._tbWSEventListener();
    // this._getAccounts(market);
    await this._getTickers();
    await this._getAccounts(market);
    await this.selectMarket(market);
  }

  async sync() {
    // --- WORKAROUND---
    // await wait(1 * 60 * 1000);
    // if (this.isLogin) {
    // console.log(`--- WORKAROUND--- sync [START]`);
    const market = this.tickerBook.getCurrentMarket();
    await this._getAccounts(market);
    await this._getOrderList(market);
    await this._getOrderHistory(market);
    // console.log(`--- WORKAROUND--- sync [END]`);
    // }
    // this.sync();
    // --- WORKAROUND---
  }

  stop() {
    // TODO stop ws
  }
}

export default Middleman;
