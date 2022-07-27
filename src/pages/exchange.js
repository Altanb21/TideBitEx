import React, { useContext, useEffect, useState } from "react";
import { useViewport } from "../store/ViewportProvider";
import DesktopExchange from "./desktop-exchange";
import MobileExchange from "./mobile-exchange";
import Layout from "../components/Layout";
import StoreContext from "../store/store-context";
import { useLocation } from "react-router-dom";

const Exchange = () => {
  const storeCtx = useContext(StoreContext);
  const location = useLocation();
  const [isStart, setIsStart] = useState(false);
  const { width } = useViewport();
  const breakpoint = 414;

  useEffect(() => {
    if (location.pathname.includes("/markets")) {
      if (!isStart) {
        window.storeCtx = storeCtx;
        storeCtx.start();
        storeCtx.sync();
        setIsStart(true);
      }
    }
    // ++TODO never called
    return () => {
      // storeCtx.stop();
      // clearInterval(interval)
    };
  }, [isStart, location.pathname, storeCtx]);

  return (
    <Layout>
      {width <= breakpoint ? <MobileExchange /> : <DesktopExchange />}
    </Layout>
  );
};

export default Exchange;
