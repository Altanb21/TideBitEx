import React, { Suspense, useContext, useEffect, useState } from "react";
import { useViewport } from "../store/ViewportProvider";
import Layout from "../components/Layout";
import StoreContext from "../store/store-context";
import { useLocation } from "react-router-dom";
// import DesktopExchange from "./desktop-exchange";
// import MobileExchange from "./mobile-exchange";
const DesktopExchange = React.lazy(() => import("./desktop-exchange"));
const MobileExchange = React.lazy(() => import("./mobile-exchange"));
const LoadingDialog = React.lazy(() => import("../components/LoadingDialog"));

const Exchange = () => {
  const storeCtx = useContext(StoreContext);
  const location = useLocation();
  const [isInit, setIsInit] = useState(null);
  const [isStart, setIsStart] = useState(false);
  const { width } = useViewport();
  const breakpoint = 428;

  useEffect(() => {
    if (isInit === null) {
      setIsInit(false);
      storeCtx.init().then((_) => setIsInit(true));
    }
    if (isInit && !isStart && location.pathname?.includes("/markets")) {
      window.storeCtx = storeCtx;
      storeCtx.start();
      setIsStart(true);
    }
    // ++TODO never called
    return () => {
      // storeCtx.stop();
      // clearInterval(interval)
    };
  }, [isInit, isStart, location.pathname, storeCtx]);

  return (
    <Layout>
      <Suspense
        fallback={
          <div className="loading">
            <LoadingDialog />
          </div>
        }
      >
        {width <= breakpoint ? <MobileExchange /> : <DesktopExchange />}
      </Suspense>
    </Layout>
  );
};

export default Exchange;
