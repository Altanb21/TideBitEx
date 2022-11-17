module.exports = {
  REASON: {
    STRIKE_FEE: 100,
    STRIKE_ADD: 110,
    STRIKE_SUB: 120,
    STRIKE_UNLOCK: 130,
    ORDER_SUBMIT: 600,
    ORDER_CANCEL: 610,
    ORDER_FULLFILLED: 620,
  },
  FUNC: {
    UNLOCK_FUNDS: 1,
    LOCK_FUNDS: 2,
    PLUS_FUNDS: 3,
    SUB_FUNDS: 4,
    UNLOCK_AND_SUB_FUNDS: 5,
  },
  INST_TYPE: {
    SPOT: "SPOT",
  },
  ORDER_STATE_CODE: {
    CANCEL: 0,
    WAIT: 100,
    DONE: 200,
  },
  ORDER_STATE_TEXT: {
    CANCEL: "Canceled",
    WAIT: "Waiting",
    DONE: "Done",
    UNKNOWN: "Unknown",
  },
  DB_STATE_CODE: {
    0: "canceled",
    100: "wait",
    200: "done",
  },
  OKX_ORDER_STATE: {
    canceled: "canceled",
    live: "wait",
    partially_filled: "wait",
    filled: "done",
  },
  OKX_ORDER_STATE_CODE: {
    canceled: 0,
    live: 100,
    partially_filled: 100,
    filled: 200,
  },
  ORDER_STATE: {
    CANCEL: "canceled",
    WAIT: "wait",
    DONE: "done",
    FILLED: "filled",
    PARTIALLY_FILLED: "partially_filled",
    LIVE: "live",
    UNKNOWN: "unknown",
  },
  TYPE: {
    ORDER_ASK: "OrderAsk",
    ORDER_BID: "OrderBid",
  },
  ORDER_SIDE: {
    SELL: "sell",
    BUY: "buy",
  },
  ORDER_KIND: {
    ASK: "ask",
    BID: "bid",
    ALL: "all",
  },
  ORD_TYPE: {
    LIMIT: "limit",
    MARKET: "market",
    IOC: "ioc",
  },
  MODIFIABLE_TYPE: {
    ORDER: "Order",
    TRADE: "Trade",
  },
  EXCHANGE: {
    OKEX: 10,
  },
  MEMBER_TAG: {
    VIP_FEE: 1,
    HERO_FEE: 2,
  },
  // ++ TODO outerTrades status
  // 0: unproccess
  // 1: done
  // 9: ERROR: order is Done but outerTrades is not
  OUTERTRADE_STATUS: {
    UNPROCESS: 0,
    DONE: 1,
    SYSTEM_ERROR: 9,
    OTHER_SYSTEM_TRADE: 8,
    ClORDId_ERROR: 7,
    API_ORDER_CANCEL: 6,
    DB_ORDER_CANCEL: 5,
    DUPLICATE_PROCESS: 4,
    // DB_ORDER_DONE: 4,
  },
  STATE: {
    PENDING: "pending",
    HISTORY: "history",
  },
  TREND: {
    UP: "up",
    DOWN: "down",
  },
  TIME_RANGE_TYPE: {
    BETWEEN: "between",
    DAY_AFTER: "dayAfter",
  },
};
