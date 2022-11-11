import React, { useContext } from "react";
import StoreContext from "../store/store-context";
import { useTranslation } from "react-i18next";

const HomeInfo = () => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  return (
    <div className="home-info">
      <div className="home-info__container">
        <div className="home-info__item">
          <div className="home-info__icon home-info__icon--bank"></div>
          <div className="home-info__content">
            <div className="home-info__heading">
              {t("home_info_bank_header")}
            </div>
            <div className="home-info__description">
              {t("home_info_bank_description")}
            </div>
          </div>
        </div>
        <div className="home-info__item">
          <div className="home-info__icon home-info__icon--shield"></div>
          <div className="home-info__content">
            <div className="home-info__heading">
              {t("home_info_shield_header")}
            </div>
            <div className="home-info__description">
              {t("home_info_shield_description")}
            </div>
          </div>
        </div>
        <div className="home-info__item">
          <div className="home-info__icon home-info__icon--currency"></div>
          <div className="home-info__content">
            <div className="home-info__heading">
              {t("home_info_currency_header")}
            </div>
            <div className="home-info__description">
              {t("home_info_currency_description")}
            </div>
          </div>
        </div>
        <div className="home-info__item">
          <div className="home-info__icon home-info__icon--chat"></div>
          <div className="home-info__content">
            <div className="home-info__heading">
              {t("home_info_chat_header")}
            </div>
            <div className="home-info__description">
              {t("home_info_chat_description")}
            </div>
          </div>
        </div>
      </div>
      <div className="home-info__action">
        <div className="home-info__content">
          <div className="home-info__heading">{t("custom_focus")}</div>
          <div className="home-info__description">
            {t("custom_focus_description")}
          </div>
        </div>
        <div className="home-info__button">{t("experience_now")}</div>
      </div>
    </div>
  );
};

export default HomeInfo;
