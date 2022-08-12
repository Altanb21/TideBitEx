import React, { useContext, useEffect, useState } from "react";
import { useViewport } from "../store/ViewportProvider";
import DesktopExchange from "./desktop-exchange";
import MobileExchange from "./mobile-exchange";
import Layout from "../components/Layout";
import StoreContext from "../store/store-context";
import { useHistory, useLocation } from "react-router-dom";

const Exchange = () => {
  const storeCtx = useContext(StoreContext);
  const location = useLocation();
  const history = useHistory();
  const [isStart, setIsStart] = useState(false);
  const { width } = useViewport();
  const breakpoint = 428;

  useEffect(() => {
    if (location.pathname.includes("/markets")) {
      if (!location.pathname.includes("/markets/")) {
        history.push({
          pathname: `/markets/ethhkd`,
        });
      }
      let market = location.pathname.replace("/markets/", "");
      if (!isStart) {
        window.storeCtx = storeCtx;
        storeCtx.start(market);
        // storeCtx.sync();
        setIsStart(true);
      }
      if (isStart && storeCtx.selectedTicker?.market !== market) {
        storeCtx.selectMarket(market);
      }
    }
    // ++TODO never called
    return () => {
      // storeCtx.stop();
      // clearInterval(interval)
    };
  }, [history, isStart, location.pathname, storeCtx]);

  return (
    <Layout>
      {width <= breakpoint ? <MobileExchange /> : <DesktopExchange />}
    </Layout>
  );
};

export default Exchange;
