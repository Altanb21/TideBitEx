import React, { Suspense, useContext } from "react";
import StoreContext from "../store/store-context";
import { Tabs, Tab, Nav } from "react-bootstrap";
import { useTranslation } from "react-i18next";

const TradePannel = React.lazy(() => import("./TradePannel"));

const MarketTrade = () => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  return (
    <div className="market-trade">
      <div className="market-trade__container">
        <div className="market-trade__header">{t("place_order")}</div>
        <Tabs defaultActiveKey="limit">
          <Suspense fallback={<div></div>}>
            <Tab eventKey="limit" title={t("limit")}>
              <TradePannel ordType="limit" />
            </Tab>
            <Tab eventKey="market" title={t("market")}>
              <TradePannel ordType="market" readyOnly={true} />
            </Tab>
            {/* <Tab eventKey="stop-limit" title="Stop Limit">
            <TradePannel ordType="stop-limit" />
          </Tab> */}
            {/* <Tab eventKey="stop-market" title="Stop Market">
            <TradePannel ordType="stop-market" />
          </Tab> */}
          </Suspense>
        </Tabs>
      </div>
      {storeCtx.isLogin === false && (
        <div className="market-trade__cover flex-row">
          <Nav.Link href="/signin">{t("login")}</Nav.Link>
          <Nav.Link href="/signup">{t("register")}</Nav.Link>
        </div>
      )}
    </div>
  );
};

export default MarketTrade;
