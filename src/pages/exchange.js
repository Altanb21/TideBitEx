import React, { Suspense, useContext, useEffect, useState } from "react";
import { useViewport } from "../store/ViewportProvider";
import Layout from "../components/Layout";
import StoreContext from "../store/store-context";
import { useLocation } from "react-router-dom";
import { useHistory } from "react-router-dom";
import Dialog from "../components/Dialog";
import { useTranslation } from "react-i18next";
// import DesktopExchange from "./desktop-exchange";
// import MobileExchange from "./mobile-exchange";
const DesktopExchange = React.lazy(() => import("./desktop-exchange"));
const MobileExchange = React.lazy(() => import("./mobile-exchange"));
const LoadingDialog = React.lazy(() => import("../components/LoadingDialog"));

const Exchange = () => {
  const storeCtx = useContext(StoreContext);
  const location = useLocation();
  // const [isInit, setIsInit] = useState(null);
  const [isStart, setIsStart] = useState(false);
  const { width } = useViewport();
  const history = useHistory();
  const breakpoint = 428;
  const { t } = useTranslation();

  useEffect(() => {
    // if (isInit === null) {
    //   setIsInit(false);
    //   storeCtx.init().then((_) => setIsInit(true));
    // }
    if (!isStart && location.pathname?.includes("/markets")) {
      window.storeCtx = storeCtx;
      storeCtx.start();
      setIsStart(true);
    }
    // ++TODO never called
    return () => {
      // storeCtx.stop();
      // clearInterval(interval)
    };
  }, [isStart, location.pathname, storeCtx]);

  return (
    <>
      {storeCtx.tokenExpired && (
        <Dialog
          className="exchange"
          title="Info"
          block={true}
          onConfirm={() => {
            history.replace({
              pathname: `/signin`,
            });
            window.location.reload();
          }}
        >
          <p className="info__text">{t("tokex_expire")}</p>
        </Dialog>
      )}
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
    </>
  );
};

export default Exchange;
