import React, { useContext } from "react";
import StoreContext from "../store/store-context";

const TickerTrend = () => {
  const storeCtx = useContext(StoreContext);
  return <div className="ticker-trend"></div>;
};

export default TickerTrend;
