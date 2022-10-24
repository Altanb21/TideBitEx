import React, { useContext } from "react";
import { ThemeConsumer } from "../context/ThemeContext";
import StoreContext from "../store/store-context";
import { Tabs, Tab } from "react-bootstrap";
import { useTranslation } from "react-i18next";

const TradingChart = React.lazy(() => import("../components/TradingChart"));
const MobileTickers = React.lazy(() => import("../components/MobileTickers"));
const MobileTicker = React.lazy(() => import("../components/MobileTicker"));
const MarketTrade = React.lazy(() => import("../components/MarketTrade"));
const DepthChart = React.lazy(() => import("../components/DepthChart"));
const DepthBook = React.lazy(() => import("../components/DepthBook"));
const PendingOrders = React.lazy(() => import("../components/PendingOrders"));
const MarketHistory = React.lazy(() => import("../components/MarketHistory"));
const AccountMobileTile = React.lazy(() =>
  import("../components/AccountMobileTile")
);

const MobileExchange = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  return (
    <main
      className="main scrollbar-custom"
      // onClick={() => {
      //   console.log(`MobileExchange onClick`);
      //   storeCtx.setFocusEl(null);
      // }}
    >
      <React.Suspense>
        {(storeCtx.activePage === "chart" ||
          storeCtx.activePage === "market" ||
          storeCtx.activePage === "trade") && <MobileTickers />}
        {(storeCtx.activePage === "chart" ||
          storeCtx.activePage === "market") && <MobileTicker />}
        <section
          className={`section${
            storeCtx.activePage === "assets" ? " section--assets" : ""
          }${storeCtx.activePage === "market" ? " section--market" : ""}`}
        >
          {storeCtx.activePage === "chart" && (
            <>
              <ThemeConsumer>
                {({ data }) => <TradingChart theme={data.theme} />}
              </ThemeConsumer>
            </>
          )}
          {storeCtx.activePage === "market" && (
            <>
              <DepthChart />
              <div className="order-book--mobile">
                <DepthBook />
              </div>
            </>
          )}
          {storeCtx.activePage === "trade" && (
            <>
              <div className="section__container">
                <MarketTrade />
              </div>
              <div className="section__container section__container--mobile">
                <React.Suspense>
                  <Tabs defaultActiveKey="market">
                    <Tab eventKey="market" title={t("navigator_market")}>
                      <DepthBook />
                    </Tab>
                    {storeCtx.isLogin && (
                      <Tab eventKey="my_orders" title={t("my_orders")}>
                        <PendingOrders />
                      </Tab>
                    )}
                    <Tab eventKey="trades" title={t("trades")}>
                      <MarketHistory />
                    </Tab>
                  </Tabs>
                </React.Suspense>
              </div>
            </>
          )}
          {storeCtx.activePage === "assets" && (
            <React.Suspense>
              <div className="mobole-account__list">
                {storeCtx.accounts?.accounts ? (
                  Object.values(storeCtx.accounts.accounts).map((account) => (
                    <AccountMobileTile
                      account={account}
                      withTitle={false}
                      showAvailable={true}
                      showTotal={false}
                    />
                  ))
                ) : (
                  <div></div>
                )}
              </div>
            </React.Suspense>
          )}
          <div className="section__block"></div>
        </section>
      </React.Suspense>
    </main>
  );
};

export default MobileExchange;
