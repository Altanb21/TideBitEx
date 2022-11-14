import React from "react";
import HomeFooter from "../components/HomeFooter";
import HomeHeader from "../components/HomeHeader";
import HomeInfo from "../components/HomeInfo";
import HomeSidebar from "../components/HomeSidebar";
import Slideshow from "../components/Slideshow";
import TickerTrend from "../components/TickerTrend";
import { useTranslation } from "react-i18next";

const Home = () => {
  const { t } = useTranslation();
  return (
    <div className="home">
      <HomeHeader />
      <HomeSidebar />
      <Slideshow />
      <div className="home__announcement--container">
        <div className="home__announcement--item">
          <a href="https://tidebit.zendesk.com/hc/en-us/articles/4407410607129">
            {t("home-announcement-1")}
          </a>
        </div>
      </div>
      <TickerTrend />
      <HomeInfo />
      <HomeFooter />
    </div>
  );
};

export default Home;
