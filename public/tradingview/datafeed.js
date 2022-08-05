import { makeApiRequest } from "./helpers.js";
import { subscribeOnStream, unsubscribeFromStream } from "./streaming.js";

let configurationData;
const lastBarsCache = new Map();

async function getConfigurationData() {
  const data = await makeApiRequest(`v1/tradingview/config`);
  return data;
}

async function getSymbolItem(symbolName) {
  const data = await makeApiRequest(
    `v1/tradingview/symbols?symbol=${symbolName}`
  );
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
    const qs = window.location.search.replace("?", "").split("&");
    // const source = qs.find((q) => q.includes("source"))?.replace("source=", "");
    const symbolName = qs
      .find((q) => q.includes("symbol"))
      ?.replace("symbol=", "");
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
    const from = rangeStartDate;
    const to = rangeEndDate;
    // console.log(
    //   "[getBars]: Method call",
    //   symbolInfo,
    //   resolution,
    //   rangeStartDate,
    //   rangeEndDate,
    //   onHistoryCallback,
    //   onErrorCallback
    // );
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
      const res = await makeApiRequest(`v1/tradingview/history?${query}`);
      if (!res.success || res.payload.length === 0) {
        // "noData" should be set if there is no data in the requested period.
        onHistoryCallback([], {
          noData: true,
        });
        return;
      }
      let bars = res.payload;
      lastBarsCache.set(symbolInfo.full_name, {
        ...bars[bars.length - 1],
      });
      // console.log(
      //   `[getBars]: returned ${bars.length} bar(s) lastbar`,
      //   bars[bars.length - 1]
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
