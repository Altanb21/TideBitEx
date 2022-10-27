import React from "react";

const StoreContext = React.createContext({
  defaultMarket: null,
  exchangeRates: null,
  languageKey: null,
  isLogin: null,
  selectedTicker: null,
  tickers: [],
  books: [],
  trades: [],
  candles: null,
  resolution: null,
  pendingOrders: [],
  closeOrders: [],
  orderHistories: [],
  accounts: null,
  activePage: null,
  depthBook: null,
  // sellPx: null,
  orderType: null,
  focusEl: null,
  tickSz: null,
  lotSz: null,
  memberEmail: null,
  disableTrade: false,
  // orderTypeHandler: (orderType) => {},
  setIsLogin: () => {},
  sync: () => {},
  init: () => {},
  start: () => {},
  stop: () => {},
  depthBookHandler: (price, amount) => {},
  // sellHandler: (price, amount) => {},
  setLanguageKey: (key) => {},
  /**
   * @typedef {Object} Ticker
   * @property {String} instType
   * @property {String} instId
   * @property {String} last
  //  * @property {String} lastSz
  //  * @property {String} askPx
  //  * @property {String} askSz
  //  * @property {String} bidPx
  //  * @property {String} bidSz
   * @property {String} sell
   * @property {String} buy
   * @property {String} open
   * @property {String} high
   * @property {String} low
   * @property {String} volume
  //  * @property {String} volCcy24h
  //  * @property {String} sodUtc0
  //  * @property {String} sodUtc8
   * @property {String} at
   */
  /**
   * @param {String} market
   * @returns null
   */
  selectMarket: (market) => {},
  /**
   * @param {String} instType SPOT,MARGIN,SWAP,FUTURES,OPTION
   * @param {String} from
   * @param {String} limit max 500, default 100
   * @returns {Promise<Array<Ticker>>}
   */
  /**
   * @param {String} id
   * @returns {Ticker} ticker
   */
  // findTicker: (id) => {},
  // getTickers: async (instType, from, limit) => {},
  /**
   * @typedef {Object} Book
   * @property {Array} asks
   * @property {Array} bids
   * @property {String} ts
   */
  /**
   * @param {String} instId BTC-USDT
   * @param {String} sz defalt 1, max 400
   * @returns {Promise<Array<Book>>}
   */
  // getBooks: async (instId, sz) => {},
  /**
   * @typedef {Object} Trade
   * @property instId
   * @property tradeId
   * @property px
   * @property sz
   * @property side
   * @property ts
   */
  /**
   * @param {String} instId BTC-USDT
   * @param {String} limit max 500, default 100
   * @returns {Promise<Array<Trade>>}
   */
  // getTrades: async (instId, limit) => {},
  /**
   * @param {String} instId BTC-USDT
   * @param {String} bar 1m/3m/5m/15m/30m/1H/2H/4H/6H/12H/1D/1W/1M/3M/6M/1Y, default 1m
   * @param {String} after
   * @param {String} before
   * @param {String} limit The maximum is 300. The default is 100.
   * @returns {Promise<Array<Array<String>>>}
   */
  // resolutionHandler: async (resolution) => {},
  /**
   * @typedef {Object} PendingOrder
   * @property {string} accFillSz
   * @property {string} avgPx
   * @property {string} cTime
   * @property {string} category
   * @property {string} ccy
   * @property {string} clOrdId
   * @property {string} fee
   * @property {string} feeCcy
   * @property {string} fillPx
   * @property {string} fillSz
   * @property {string} fillTime
   * @property {string} instId
   * @property {string} instType
   * @property {string} lever
   * @property {string} ordId
   * @property {string} ordType 订单类型: {market：市价单, limit：限价单, post_only：只做maker单, fok：全部成交或立即取消, ioc：立即成交并取消剩余, optimal_limit_ioc：市价委托立即成交并取消剩余（仅适用交割、永续）}
   * @property {string} pnl
   * @property {string} posSide
   * @property {string} px 委托价格
   * @property {string} rebate
   * @property {string} rebateCcy
   * @property {string} side 订单方向
   * @property {string} slOrdPx
   * @property {string} slTriggerPx
   * @property {string} slTriggerPxType
   * @property {string} source
   * @property {string} state 订单状态: live：等待成交, partially_filled：部分成交
   * @property {string} sz 委托数量
   * @property {string} tag
   * @property {string} tdMode
   * @property {string} tgtCcy
   * @property {string} tpOrdPx
   * @property {string} tpTriggerPx
   * @property {string} tpTriggerPxType
   * @property {string} tradeId
   * @property {string} uTime
   * @property {string} cTime 订单创建时间
   */
  /**
   * @typedef {Object} OrderRequestOptions
   * @property {String} instId
   * @property {String} instType "SPOT"
   * @property {String} ordType ex: "post_only,fok,ioc"
   * @property {String} state
   * @property {String} after
   * @property {String} before
   * @property {String} limit
   */
  /**
   *
   * @param {OrderRequestOptions} options
   * @returns {Promise<Array<PendingOrder>>}
   */
  // getOrderList: async (options) => {},
  // getCloseOrders: async (options) => {},
  /**
   * @typedef {Object} BalanceDetail
   * @property {string} availBal 可用余额
  //  * @property {string} availEq 可用保证金
  //  * @property {string} cashBal 币种余额
   * @property {string} totalBal 币种余额
   * @property {string} ccy 币种
  //  * @property {string} crossLiab 币种全仓负债额
  //  * @property {string} disEq 美金层面币种折算权益
  //  * @property {string} eq 币种总权益
  //  * @property {string} eqUsd 币种权益美金价值
   * @property {string} frozenBal 币种占用金额
  //  * @property {string} interest 计息
  //  * @property {string} isoEq 币种逐仓仓位权益
  //  * @property {string} isoLiab 币种逐仓负债额
  //  * @property {string} isoUpl 逐仓未实现盈亏
  //  * @property {string} liab 币种负债额
  //  * @property {string} maxLoan 币种最大可借
  //  * @property {string} mgnRatio 保证金率
  //  * @property {string} notionalLever 币种杠杆倍数
  //  * @property {string} ordFrozen 挂单冻结数量
  //  * @property {string} twap 当前负债币种触发系统自动换币的风险
   * @property {string} uTime 币种余额信息的更新时间，Unix时间戳的毫秒数格式，如 1597026383085
  //  * @property {string} upl 未实现盈亏
  //  * @property {string} uplLiab 由于仓位未实现亏损导致的负债
  //  * @property {string} stgyEq 策略权益
   */
  /**
   * @typedef {Object} Balance
   * @property {string} adjEq 美金层面有效保证金
   * @property {string} imr
   * @property {string} isoEq
   * @property {string} mgnRatio
   * @property {string} mmr
   * @property {string} notionalUsd
   * @property {string} ordFroz
   * @property {string} totalEq
   * @property {string} uTime
   * @property {Promise<Array<BalanceDetail>>} details
   */
  /**
   * balance
   * @param {String} ccy ex: "BTC,ETH"
   * @returns {Promise<Balance>}
   */
  // getAccounts: async (ccy) => {},
  /**
   * @typedef {Object} Order
   * @property {string} instId 產品Id
   * @property {string} tdMode 交易模式:{保證金模式: {isolated: 逐倉, cross: 全倉}, 非保證金模式: cash}
   * @property {string} side 訂單方向
   * @property {string} ordType 訂單模式
   * @property {string} px 委託價格, 僅適用於limit
   * @property {string} sz 委託數量
   */
  /**
   * @typedef {Object} OrderResult
   * @property {string} ordId 訂單Id
   * @property {string} clOrdId 自定義訂單Id
   * @property {string} tag 訂單標籤
   * @property {string} sCode 事件執行成果，成功為'0'
   * @property {string} sMsg 事件執行失敗的訊息
   */
  /**
   * postOrder
   * @param {Order} order
   * @returns {Promise<OrderResult>}
   */
  postOrder: async (order) => {},
  /**
   * cancelOrder
   * @param {Order} order
   * @returns {Promise<Object>}
   */
  cancelOrder: async (order) => {},
  cancelOrders: async (id, type) => {},
  activePageHandler: () => {},
  getExAccounts: async (exchange) => {},
  getUsersAccounts: async () => {},
  getOuterTradeFills: async (exchange, start, end) => {},
  getOuterPendingOrders: async (exchange, limit, offset) => {},
  setFocusEl: () => {},
  changeRange: () => {},
  getAdminUser: async () => {},
  getAdminUsers: async () => {},
  addAdminUser: async (newUser) => {},
  deleteAdminUser: async (user) => {},
  updateAdminUser: async (updateUser) => {},
  getExchangeRates: async () => {},
  getCoinsSettings: async () => {},
  updateCoinSetting: async (id, visible) => {},
  updateCoinsSettings: async () => {},
  updateDepositSetting: async (id, type, data) => {},
  updateWithdrawSetting: async (id, type, data) => {},
  getTickersSettings: async () => {},
  updateTickerSetting: async (id, type, data) => {},
  getPlatformAssets: async () => {},
  updatePlatformAsset: async (id, data) => {},
  getDashboardData: async () => {},
});

export default StoreContext;
