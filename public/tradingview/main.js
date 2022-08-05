// Datafeed implementation, will be added later
import Datafeed from "./datafeed.js";

const qs = window.location.search.replace("?", "").split("&");
const symbol = qs.find((q) => q.includes("symbol"))?.replace("symbol=", "");
const source = qs.find((q) => q.includes("source"))?.replace("source=", "");
const isMobile =
  qs.find((q) => q.includes("mobile"))?.replace("mobile=", "") === "1";
  
const getParameterByName = (name) => {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
    results = regex.exec(location.search);
  return results === null
    ? ""
    : decodeURIComponent(results[1].replace(/\+/g, " "));
};

window.tvWidget = new TradingView.widget({
  // symbol: "Bitfinex:BTC/USD", // default symbol
  symbol: `${source}:${symbol}`,
  interval: "D", // default interval
  fullscreen: true, // displays the chart in the fullscreen mode
  container_id: "tv_chart_container",
  datafeed: Datafeed,
  library_path: "charting_library/",
  locale: getParameterByName("lang") || "en",
  theme: "light",
  autosize: true,
  favorites: isMobile
      ? {
          intervals: ["1", "5", "60", "D"],
        }
      : null,
    disabled_features: isMobile
      ? [
          "edit_buttons_in_legend",
          "header_settings",
          "header_undo_redo",
          "header_symbol_search",
          "header_compare",
          "compare_symbol",
          "header_indicators",
          "header_screenshot",
          "left_toolbar",
          "timeframes_toolbar",
          "property_pages",
        ]
      : ["header_symbol_search", "header_compare"],
});
