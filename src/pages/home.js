import React, { useState } from "react";
import HomeFooter from "../components/HomeFooter";
import HomeHeader from "../components/HomeHeader";
import HomeInfo from "../components/HomeInfo";
import HomeSidebar from "../components/HomeSidebar";
import Slideshow from "../components/Slideshow";
import TickerTrend from "../components/TickerTrend";
import { useTranslation } from "react-i18next";
import HomeStores from "../components/HomeStores";

const Home = () => {
  const { t } = useTranslation();
  const [active, setActive] = useState(false);
  const sidebarHandler = () => setActive((prev) => !prev);
  return (
    <div className="home">
      <HomeHeader sidebarHandler={sidebarHandler} />
      <HomeSidebar active={active} sidebarHandler={sidebarHandler} />
      <div className="home__infos">
        <Slideshow />
        <div className="home__announcement">
          <div className="home__announcement-container">
            <div className="home__announcement-item">
              <a href="https://tidebit.zendesk.com/hc/en-us/articles/4407410607129">
                {t("home-announcement-1")}
              </a>
            </div>
          </div>
        </div>
        <TickerTrend />
      </div>
      <HomeInfo />
      <HomeStores />
      <HomeFooter />
    </div>
  );
};

export default Home;
