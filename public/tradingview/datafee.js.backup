// https://zlq4863947.gitbook.io/tradingview/3-shu-ju-bang-ding/js-api
// https://github.com/tradingview/charting-library-tutorial/blob/master/documentation/datafeed-implementation.md
const getParameterByName = (name) => {
  name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
  var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
    results = regex.exec(location.search);
  return results === null
    ? ""
    : decodeURIComponent(results[1].replace(/\+/g, " "));
};

const initOnReady = () => {
  const qs = window.location.search.replace("?", "").split("&");
  const symbol = qs.find((q) => q.includes("symbol"))?.replace("symbol=", "");
  const source = qs.find((q) => q.includes("source"))?.replace("source=", "");
  const isMobile =
    qs.find((q) => q.includes("mobile"))?.replace("mobile=", "") === "1";
  const widget = (window.tvWidget = new TradingView.widget({
    // debug: true, // uncomment this line to see Library errors and warnings in the console
    fullscreen: true,
    symbol: symbol,
    interval: "D",
    container_id: "tv_chart_container",

    //	BEWARE: no trailing slash is expected in feed URL
    // datafeed: Datafeed,
    datafeed:
      source === "OKEx"
        ? // ? Datafeed
          new window.Datafeeds.UDFCompatibleDatafeed("/api/v1/tradingview")
        : new window.Datafeeds.UDFCompatibleDatafeed("/api/v2/tradingview"),
    library_path: "charting_library/",
    locale: getParameterByName("lang") || "en",
    theme: "light",
    autosize: true,
    // custom_css_url: isMobile ? "tradingview_chart.css" : null,
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
  }));
};

window.addEventListener("load", initOnReady);
