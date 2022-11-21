module.exports = {
  // okex events
  subscribe: "subscribe",
  unsubscribe: "unsubscribe",
  tickerOnSibscribe: "tickerOnSibscribe",
  error: "error",
  instruments: "instruments",
  books: "books",
  booksActions: {
    snapshot: "snapshot",
    update: "update",
  },
  login: "login",
  candle1m: "candle1m",
  orders: "orders",
  // subscribe ticker event
  tickerOnUnsubscribe: "tickerOnUnsubscribe",
  userOnSubscribe: "userOnSubscribe",
  userOnUnsubscribe: "userOnUnsubscribe",
  registerMarket: "registerMarket",

  // update event
  tickers: "tickers",
  update: "update",
  trades: "trades",
  publicTrades: "publicTrades",
  account: "account",
  order: "order",
  marketOrder: "marketOrder",
  trade: "trade",
  candleOnUpdate: "candleOnUpdate",
  orderDetailUpdate: "orderDetailUpdate",
  // tradesDetailUpdate:"tradesDetailUpdate"

  userStatusUpdate: "userStatusUpdate",
  switchMarket: "switchMarket",
};
