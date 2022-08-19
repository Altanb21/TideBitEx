import React, { useContext } from "react";
import { AccountMobileTile, PendingOrders } from "../components/HistoryOrder";
import MarketHistory from "../components/MarketHistory";
import MarketTrade from "../components/MarketTrade";
import DepthBook from "../components/DepthBook";
import TradingChart from "../components/TradingChart";
import { ThemeConsumer } from "../context/ThemeContext";
import StoreContext from "../store/store-context";
import { Tabs, Tab } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import MobileTickers from "../components/MobileTickers";
import MobileTicker from "../components/MobileTicker";
import DepthChart from "../components/DepthChart";

const MobileExchange = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  return (
    <main
      className="main"
      // onClick={() => {
      //   console.log(`MobileExchange onClick`);
      //   storeCtx.setFocusEl(null);
      // }}
    >
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
              <Tabs defaultActiveKey="market">
                <Tab eventKey="market" title={t("market")}>
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
            </div>
          </>
        )}
        {storeCtx.activePage === "assets" && (
          <div className="mobole-account__list">
            {storeCtx.accounts ? (
              Object.values(storeCtx.accounts).map((account) => (
                <AccountMobileTile account={account} />
              ))
            ) : (
              <div></div>
            )}
          </div>
        )}
        <div className="section__block"></div>
      </section>
    </main>
  );
};

export default MobileExchange;
