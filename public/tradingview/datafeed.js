import { makeApiRequest } from "./helpers.js";
import { subscribeOnStream, unsubscribeFromStream } from "./streaming.js";

let configurationData;
const lastBarsCache = new Map();
const qs = window.location.search.replace("?", "").split("&");
const symbolName = qs.find((q) => q.includes("symbol"))?.replace("symbol=", "");
const source = qs.find((q) => q.includes("source"))?.replace("source=", "");

async function getConfigurationData() {
  const data = await makeApiRequest(`v1/tradingview/config`);
  // const data = await makeApiRequest(
  //   `https://test.tidebit.network/api/v1/tradingview/config`
  // );
  return data;
}

async function getSymbolItem(symbolName) {
  const data = await makeApiRequest(
    `v1/tradingview/symbols?symbol=${symbolName}`
  );
  // const data = await makeApiRequest(
  //   `https://test.tidebit.network/api/v1/tradingview/symbols?symbol=${symbolName}`
  // );
  return data;
}

const Datafeed = {
  onReady: async (callback) => {
    // console.log("[onReady]: Method call");
    if (!configurationData) configurationData = await getConfigurationData();
    callback(configurationData);
  },

  searchSymbols: async (
    userInput,
    exchange,
    symbolType,
    onResultReadyCallback
  ) => {
    // console.log("[searchSymbols]: Method call");
    // const symbols = await getAllSymbols();
    // const newSymbols = symbols.filter((symbol) => {
    //   const isExchangeValid = exchange === "" || symbol.exchange === exchange;
    //   const isFullSymbolContainsInput =
    //     symbol.full_name.toLowerCase().indexOf(userInput.toLowerCase()) !== -1;
    //   return isExchangeValid && isFullSymbolContainsInput;
    // });
    // onResultReadyCallback(newSymbols);
  },

  resolveSymbol: async (
    fullName,
    // symbolName,
    onSymbolResolvedCallback,
    onResolveErrorCallback
  ) => {
    if (!configurationData) configurationData = await getConfigurationData();
    const symbolItem = await getSymbolItem(symbolName);
    if (!symbolItem) {
      console.error("[resolveSymbol]: Cannot resolve symbol", symbolName);
      onResolveErrorCallback("cannot resolve symbol");
      return;
    }
    const symbolInfo = {
      ...symbolItem,
      exchange: "",
      data_status: "streaming",
      supported_resolutions: configurationData.supported_resolutions,
    };
    // console.log("[resolveSymbol]: Symbol resolved", symbolItem);
    onSymbolResolvedCallback(symbolInfo);
  },

  getBars: async (
    // symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback
    symbolInfo,
    resolution,
    rangeStartDate,
    rangeEndDate,
    onHistoryCallback,
    onErrorCallback
  ) => {
    let res,
      bars = [],
      // path = `https://new.tidebit.com/api/${
      //   source === "TideBit" ? "v2" : "v1"
      // }/tradingview/history`;
      path = `${source === "TideBit" ? "v2" : "v1"}/tradingview/history`;
    const from = rangeStartDate;
    const to = rangeEndDate;
    // console.log(`from`, from, new Date(from * 1000));
    // console.log(`to`, to, new Date(to * 1000));
    const urlParameters = {
      symbol: symbolInfo.ticker,
      from,
      to,
      resolution,
    };
    const query = Object.keys(urlParameters)
      .map((name) => `${name}=${encodeURIComponent(urlParameters[name])}`)
      .join("&");
    try {
      res = await makeApiRequest(`${path}?${query}`);
      if (source === "TideBit") {
        // console.log(`res`, res);
        if (res.s !== "ok" || res.t.length === 0) {
          // "noData" should be set if there is no data in the requested period.
          onHistoryCallback([], {
            noData: true,
          });
          return;
        }
        res.t.forEach((t, i) => {
          // console.log(`t[${i}]`,t, new Date(t*1000))
          if (t >= from && t < to) {
            bars = [
              ...bars,
              {
                time: t * 1000,
                low: res.l[i],
                high: res.h[i],
                open: res.o[i],
                close: res.c[i],
                volume: res.v[i],
              },
            ];
          }
        });
      } else {
        if (!res.success || res.payload.length === 0) {
          // "noData" should be set if there is no data in the requested period.
          onHistoryCallback([], {
            noData: true,
          });
          return;
        }
        bars = res.payload;
      }
      lastBarsCache.set(symbolInfo.full_name, {
        ...bars[bars.length - 1],
      });
      // console.log(
      //   `[getBars]: returned ${bars.length} bar(s) lastbar`,
      //   bars[bars.length - 1],
      //   bars
      // );
      onHistoryCallback(bars, {
        noData: false,
      });
    } catch (error) {
      console.error("[getBars]: Get error", error);
      onErrorCallback(error);
    }
  },

  subscribeBars: (
    symbolInfo,
    resolution,
    onRealtimeCallback,
    subscribeUID,
    onResetCacheNeededCallback
  ) => {
    // console.log(
    //   "[subscribeBars]: Method call with subscribeUID:",
    //   subscribeUID
    // );
    subscribeOnStream(
      symbolInfo,
      resolution,
      onRealtimeCallback,
      subscribeUID,
      onResetCacheNeededCallback,
      lastBarsCache.get(symbolInfo.full_name)
    );
  },

  unsubscribeBars: (subscriberUID) => {
    // console.log(
    //   "[unsubscribeBars]: Method call with subscriberUID:",
    //   subscriberUID
    // );
    unsubscribeFromStream(subscriberUID);
  },
};

export default Datafeed;
