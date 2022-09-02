import React from "react";
import HistoryOrder from "../components/HistoryOrder";
import MarketHistory from "../components/MarketHistory";
import MarketTrade from "../components/MarketTrade";
import DepthBook from "../components/DepthBook";
import SelectedTicker from "../components/SelectedTicker";
import TradingChart from "../components/TradingChart";
import { ThemeConsumer } from "../context/ThemeContext";
import UserInfo from "../components/UserInfo";

const DesktopExchange = (props) => {
  return (
    <main className="main">
      <main className="main__summary">
        <SelectedTicker />
        <UserInfo />
      </main>
      <section className="section">
        <div className="section__container">
          <div className="section__container--left">
            <DepthBook />
          </div>
          <div className="section__container--right">
            <ThemeConsumer>
              {({ data }) => <TradingChart theme={data.theme} />}
            </ThemeConsumer>
          </div>
        </div>
        <div className="section__container">
          <div className="section__container--left">
            <MarketTrade />
          </div>
          <div className="section__container--right">
            <HistoryOrder />
            <MarketHistory />
          </div>
        </div>
      </section>
    </main>
  );
};

export default DesktopExchange;
