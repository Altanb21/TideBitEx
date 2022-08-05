import { makeApiRequest, generateSymbol, parseFullSymbol } from "./helpers.js";
import { subscribeOnStream, unsubscribeFromStream } from "./streaming.js";

const lastBarsCache = new Map();
// let configurationData;
const configurationData = {
  supported_resolutions: ["1D", "1W", "1M"],
  exchanges: [
    {
      value: "Bitfinex",
      name: "Bitfinex",
      desc: "Bitfinex",
    },
    {
      // `exchange` argument for the `searchSymbols` method, if a user selects this exchange
      value: "Kraken",

      // filter name
      name: "Kraken",

      // full exchange name displayed in the filter popup
      desc: "Kraken bitcoin exchange",
    },
  ],
  symbols_types: [
    {
      name: "crypto",

      // `symbolType` argument for the `searchSymbols` method, if a user selects this symbol type
      value: "crypto",
    },
    // ...
  ],
};

async function getConfigurationData() {
  const data = await makeApiRequest(`api/v1/tradingview/config`);
  return data;
}

async function getSymbolItem(symbolName) {
  const data = await makeApiRequest(
    `api/v1/tradingview/symbols?symbol=${symbolName}`
  );
  return data;
}

async function getAllSymbols() {
  const data = await makeApiRequest("data/v3/all/exchanges");
  let allSymbols = [];

  for (const exchange of configurationData.exchanges) {
    const pairs = data.Data[exchange.value].pairs;

    for (const leftPairPart of Object.keys(pairs)) {
      const symbols = pairs[leftPairPart].map((rightPairPart) => {
        const symbol = generateSymbol(
          exchange.value,
          leftPairPart,
          rightPairPart
        );
        return {
          symbol: symbol.short,
          full_name: symbol.full,
          description: symbol.short,
          exchange: exchange.value,
          type: "crypto",
        };
      });
      allSymbols = [...allSymbols, ...symbols];
    }
  }
  return allSymbols;
}

const Datafeed = {
  onReady: (callback) => {
    console.log("[onReady]: Method call");
    setTimeout(() => callback(configurationData));
  },

  searchSymbols: async (
    userInput,
    exchange,
    symbolType,
    onResultReadyCallback
  ) => {
    console.log("[searchSymbols]: Method call");
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
    // fullName,
    symbolName,
    onSymbolResolvedCallback,
    onResolveErrorCallback
  ) => {
    // if (!configurationData) configurationData = await getConfigurationData();
    console.log("[resolveSymbol]: Method call", symbolName);
    // console.log("[resolveSymbol]: Method call", fullName);
    // const exchange = fullName.split(":")[0];
    // const symbolName = fullName.split(":")[1];
    /**
     * SymbolItem
     * {
     *  description: "BTC/USD",
     *  exchange: "Bitfinex",
     *  full_name: "Bitfinex:BTC/USD",
     *  symbol: "BTC/USD",
     *  type: "crypto",
     * }
     * Array<SymbolItem>
     */
     const symbols = await getAllSymbols();
     const symbolItem = symbols.find(
       ({ full_name }) => full_name === symbolName
     );
    // const symbolItem = await getSymbolItem(symbolName);
    if (!symbolItem) {
      console.log("[resolveSymbol]: Cannot resolve symbol", symbolName);
      onResolveErrorCallback("cannot resolve symbol");
      return;
    }
    /**
     * ticker: "ethusdt"
     * name: "ETH/USDT"
     * has_daily: true
     * has_intraday: true
     * has_weekly_and_monthly: true
     * intraday_multipliers: (5) ['1', '5', '15', '30', '60']
     * minmov: 1
     * minmove2: 0
     * pricescale: 10000
     * session: "24x7"
     * timezone: "Asia/Hong_Kong"
     * volume_precision: 8
     * --------
     * base_name: ['BTC/USD']
     * data_status: "streaming"
     * description: "BTC/USD"
     * exchange: "Bitfinex"
     * full_name: "Bitfinex:BTC/USD"
     * has_intraday: false
     * has_no_volume: true
     * has_weekly_and_monthly: false
     * legs: ['BTC/USD']
     * minmov: 1
     * name: "BTC/USD"
     * pricescale: 100
     * pro_name: "Bitfinex:BTC/USD"
     * session: "24x7"
     * supported_resolutions: (3) ['1D', '1W', '1M']
     * ticker: "Bitfinex:BTC/USD"
     * timezone: "Etc/UTC"
     * type: "crypto"
     * volume_precision: 2
     */
    // const symbolInfo = {
    //   ...symbolItem,
    //   data_status: "streaming",
    //   description: symbolItem.description,
    //   type: "crypto",
    //   exchange,
    //   supported_resolutions: configurationData.supported_resolutions,

    //   has_intraday: false,
    //   has_no_volume: true,
    //   has_weekly_and_monthly: false,
    //   data_status: "streaming",
    // };
    const symbolInfo = {
      ticker: symbolItem.full_name,
      name: symbolItem.symbol,
      description: symbolItem.description,
      type: symbolItem.type,
      session: "24x7",
      timezone: "Etc/UTC",
      exchange: symbolItem.exchange,
      minmov: 1,
      pricescale: 100,
      has_intraday: false,
      has_no_volume: true,
      has_weekly_and_monthly: false,
      supported_resolutions: configurationData.supported_resolutions,
      volume_precision: 2,
      data_status: "streaming",
    };
    console.log("[resolveSymbol]: Symbol resolved", symbolInfo);
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
    // const { from, to, firstDataRequest } = periodParams;
    const from = rangeStartDate;
    const to = rangeEndDate;
    console.log(
      "[getBars]: Method call",
      symbolInfo,
      resolution,
      rangeStartDate,
      rangeEndDate,
      onHistoryCallback,
      onErrorCallback
    );
    const parsedSymbol = parseFullSymbol(symbolInfo.full_name);
    const urlParameters = {
      e: parsedSymbol.exchange,
      fsym: parsedSymbol.fromSymbol,
      tsym: parsedSymbol.toSymbol,
      toTs: to,
      limit: 2000,
    };
    const query = Object.keys(urlParameters)
      .map((name) => `${name}=${encodeURIComponent(urlParameters[name])}`)
      .join("&");
    try {
      const data = await makeApiRequest(`data/histoday?${query}`);
      if (
        (data.Response && data.Response === "Error") ||
        data.Data.length === 0
      ) {
        // "noData" should be set if there is no data in the requested period.
        onHistoryCallback([], {
          noData: true,
        });
        return;
      }
      let bars = [];
      data.Data.forEach((bar) => {
        if (bar.time >= from && bar.time < to) {
          bars = [
            ...bars,
            {
              time: bar.time * 1000,
              low: bar.low,
              high: bar.high,
              open: bar.open,
              close: bar.close,
            },
          ];
        }
      });
      //   if (firstDataRequest) {
      lastBarsCache.set(symbolInfo.full_name, {
        ...bars[bars.length - 1],
      });
      //   }
      console.log(`[getBars]: returned ${bars.length} bar(s)`);
      onHistoryCallback(bars, {
        noData: false,
      });
    } catch (error) {
      console.log("[getBars]: Get error", error);
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
    console.log(
      "[subscribeBars]: Method call with subscribeUID:",
      subscribeUID
    );
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
    console.log(
      "[unsubscribeBars]: Method call with subscriberUID:",
      subscriberUID
    );
    unsubscribeFromStream(subscriberUID);
  },
};

export default Datafeed;
