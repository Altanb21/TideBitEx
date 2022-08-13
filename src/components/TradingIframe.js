import React from "react";

const TradingIframe = (props) => {
  return (
    <iframe
      id="tradingview"
      className="main-chart__chart"
      src={`/tradingview/index.html${props.query}`}
      title="tradingview"
    ></iframe>
  );
};

export default TradingIframe;

// https://demo_feed.tradingview.com/history?symbol=AAPL&resolution=D&from=1655189857&to=1656053857
