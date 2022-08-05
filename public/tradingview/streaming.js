import { parseFullSymbol } from "./helpers.js";

// const socket = io('wss://streamer.cryptocompare.com');
const socket = new WebSocket("wss://test.tidebit.network");
const channelToSubscription = new Map();

// Connection opened
socket.addEventListener("open", (event) => {
  // socket.send('Hello Server!');
  console.log("[socket] Connected");
});

socket.addEventListener("close", (reason) => {
  console.log("[socket] Disconnected:", reason);
});

socket.addEventListener("error", (error) => {
  console.log("[socket] Error:", error);
});

// Listen for messages
socket.addEventListener("message", (event) => {
  let metaData = JSON.parse(event.data);

  switch (metaData.type) {
    case "candleOnUpdate":
      // 0~Bitfinex~BTC~USD~1~1181312512~1659667877~0.005~23064~115.32~1659667877~314000000~326000000~1bf
      console.log("channelToSubscription", channelToSubscription);
      console.log("Message from server ", metaData);

      const tradePrice = parseFloat(metaData.data.trade.price);
      const tradeTime = parseInt(metaData.data.trade.ts);
      const channelString = `market:${metaData.data.market}`;
      // const channelString = `0~OKEx~ETH~USDT`;
      /**
       * subscriptionItem
       * {
       *   handlers: [{…}]
       *   lastDailyBar: {
       *     close: 23248,
       *     high: 23418,
       *     isBarClosed: false,
       *     isLastBar: true,
       *     low: 22619.03,
       *     open: 23088,
       *     time: 1659657600000,
       *   }
       *   resolution: "D,
       *   subscribeUID: "Bitfinex:BTC/USD_D",
       * }
       */
      const subscriptionItem = channelToSubscription.get(channelString);
      console.log(`subscriptionItem`, subscriptionItem);
      if (subscriptionItem === undefined) {
        return;
      }
      const lastDailyBar = subscriptionItem.lastDailyBar;
      const nextDailyBarTime = getNextDailyBarTime(lastDailyBar.time);

      let bar;
      if (tradeTime >= nextDailyBarTime) {
        bar = {
          time: nextDailyBarTime,
          open: tradePrice,
          high: tradePrice,
          low: tradePrice,
          close: tradePrice,
        };
        console.log("[socket] Generate new bar", bar);
      } else {
        bar = {
          ...lastDailyBar,
          high: Math.max(lastDailyBar.high, tradePrice),
          low: Math.min(lastDailyBar.low, tradePrice),
          close: tradePrice,
        };
        console.log("[socket] Update the latest bar by price", tradePrice);
      }
      subscriptionItem.lastDailyBar = bar;

      // send data to every subscriber of that symbol
      subscriptionItem.handlers.forEach((handler) => handler.callback(bar));
      break;
    default:
  }
});

function getNextDailyBarTime(barTime) {
  const date = new Date(barTime * 1000);
  date.setDate(date.getDate() + 1);
  return date.getTime() / 1000;
}

export function subscribeOnStream(
  symbolInfo,
  resolution,
  onRealtimeCallback,
  subscribeUID,
  onResetCacheNeededCallback,
  lastDailyBar
) {
  console.log("[subscribeBars]: symbolInfo", symbolInfo);
  //   const parsedSymbol = parseFullSymbol(symbolInfo.full_name);
  const channelString = `market:${symbolInfo.ticker}`;
  //   const channelString = `ethusdt`;
  const handler = {
    id: subscribeUID,
    callback: onRealtimeCallback,
  };
  let subscriptionItem = channelToSubscription.get(channelString);
  if (subscriptionItem) {
    // already subscribed to the channel, use the existing subscription
    subscriptionItem.handlers.push(handler);
    return;
  }
  subscriptionItem = {
    subscribeUID,
    resolution,
    lastDailyBar,
    handlers: [handler],
  };
  channelToSubscription.set(channelString, subscriptionItem);
  console.log(
    "[subscribeBars]: Subscribe to streaming. Channel:",
    channelString
  );
  socket.send(
    JSON.stringify({
      op: "switchMarket",
      args: {
        market: "ethusdt",
        // market: symbolInfo.ticker,
      },
    })
  );
}

export function unsubscribeFromStream(subscriberUID) {
  // find a subscription with id === subscriberUID
  for (const channelString of channelToSubscription.keys()) {
    const subscriptionItem = channelToSubscription.get(channelString);
    const handlerIndex = subscriptionItem.handlers.findIndex(
      (handler) => handler.id === subscriberUID
    );

    if (handlerIndex !== -1) {
      // remove from handlers
      subscriptionItem.handlers.splice(handlerIndex, 1);

      if (subscriptionItem.handlers.length === 0) {
        // unsubscribe from the channel, if it was the last handler
        console.log(
          "[unsubscribeBars]: Unsubscribe from streaming. Channel:",
          channelString
        );
        // ++ TODO
        // socket.emit("SubRemove", { subs: [channelString] });
        channelToSubscription.delete(channelString);
        break;
      }
    }
  }
}
