import React, { useContext, useEffect, useState } from "react";
import StoreContext from "../store/store-context";
import { useViewport } from "../store/ViewportProvider";

// import TradingApexChart from "./TradingApexChart";
// import TradingViewChart from "./TradingViewChart";
import { useTranslation } from "react-i18next";
import TradingIframe from "./TradingIframe";

const TradingChart = (props) => {
  const storeCtx = useContext(StoreContext);
  const { width } = useViewport();
  const breakpoint = 428;
  const { t } = useTranslation();
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [query, setQuery] = useState(null);

  useEffect(() => {
    if (
      storeCtx.selectedTicker &&
      selectedTicker?.instId !== storeCtx.selectedTicker?.instId
    ) {
      const { name, pricescale, source } = storeCtx.selectedTicker;
      const arr = [];
      if (name) arr.push(`symbol=${name}`);
      if (pricescale) arr.push(`pricescale=${pricescale}`);
      if (source) arr.push(`source=${source}`);
      if (props.isMobile) arr.push(`mobile=${1}`);
      const qs = !!arr.length ? `?${arr.join("&")}` : "";
      setQuery(qs);
      setSelectedTicker({ ...storeCtx.selectedTicker });
    }
  }, [storeCtx.selectedTicker, props.isMobile, selectedTicker?.instId]);

  return (
    <div
      className={`main-chart${
        width <= breakpoint ? " main-chart--mobile" : ""
      }`}
    >
      <div className="main-chart__header">{t("chart")}</div>
      {/* {window.location.host.includes("legacy2") ? ( */}
      {!!query && (
        <TradingIframe isMobile={width <= breakpoint} query={query} />
      )}
      {/* ) : storeCtx.selectedTicker?.source === "TideBit" ? (
        <TradingApexChart />
      ) : (
        <TradingViewChart theme={props.theme} />
      )} */}
    </div>
  );
};

export default TradingChart;
