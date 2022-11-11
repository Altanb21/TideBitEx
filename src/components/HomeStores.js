import React from "react";
import { useTranslation } from "react-i18next";

const HomeStores = () => {
  const { t } = useTranslation();
  return (
    <div className="home-stores">
      <div className="home-stores__container">
        <div className="home-stores__box">
          <a
            className="home-stores__link"
            href="https://itunes.apple.com/hk/app/tidebit/id1363945964?mt=8"
            target="_blank"
            rel="noreferrer"
          >
            <div className="home-stores__image home-stores__image--apple"></div>
          </a>
          <a
            className="home-stores__link"
            href="https://play.google.com/store/apps/details?id=com.tideisun.tidebit"
            target="_blank"
            rel="noreferrer"
          >
            <div className="home-stores__image home-stores__image--google"></div>
          </a>
        </div>
        <div className="home-stores__description">
          {t("home_stores_description")}
        </div>
      </div>
    </div>
  );
};

export default HomeStores;
