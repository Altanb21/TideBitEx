import { useTranslation } from "react-i18next";
import React, { useContext } from "react";
import StoreContext from "../store/store-context";
import Languages from "../constant/Languages";

const HomeHeader = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  return (
    <div className="home-header">
      <a className="home-header__brand" href="/">
        <img
          src="/TideBit_White_hk.png"
          className="d-inline-block align-top"
          alt="TideBit"
          width="175px"
          height="60px"
        />
      </a>
      <div className="home-header__container">
        <div className="home-header__collapse">
          <div className="home-header__dropdown">
            <input
              className="home-header__input"
              type="radio"
              name="home-header-dropdown"
            />
            <label className="home-header__label home-header__label--img"></label>
            <div className="home-header__options">
              <div className="home-header__option home-header__item">
                <a
                  className="home-header__link home-header__link--logo"
                  href="http://isun.one/"
                >
                  <span className="home-header__logo-container home-header__logo-isun"></span>
                  <span>iSunOne</span>
                </a>
              </div>
              <div className="home-header__option home-header__item">
                <a
                  className="home-header__link home-header__link--logo"
                  href="https://xpa.exchange"
                >
                  <span className="home-header__logo-container home-header__logo-xpa"></span>
                  <span>XPA Exchange</span>
                </a>
              </div>
            </div>
          </div>
          <div className="home-header__dropdown">
            <input
              className="home-header__input"
              type="radio"
              name="home-header-dropdown"
            />
            <label className="home-header__item home-header__label home-header__label--text">
              <span>{t("trade")}</span>
              <span></span>
            </label>
            <div className="home-header__options">
              <div className="home-header__option home-header__item">
                <a
                  className="home-header__link"
                  href={`/markets/${storeCtx.defaultMarket}`}
                >
                  <span>{t("spot_trade")}</span>
                </a>
              </div>
              <div className="home-header__option home-header__item">
                <a
                  className="home-header__link"
                  href={`https://tidebit.zendesk.com/hc/zh-tw/articles/360003146914-%E5%A4%A7%E9%A1%8D%E4%BA%A4%E6%98%93Block-Trade-OTC-%E5%B0%88%E5%B1%AC-Whatsapp-852-62871829`}
                >
                  <span>{t("block_trade")}</span>
                </a>
              </div>
            </div>
          </div>
          <div className="home-header__dropdown">
            <input
              className="home-header__input"
              type="radio"
              name="home-header-dropdown"
            />
            <label className="home-header__label home-header__label--text">
              <span>{t("member")}</span>
              <span></span>
            </label>
            <div className="home-header__options">
              <div className="home-header__option home-header__item">
                <a className="home-header__link" href="/referral">
                  <span>{t("refer_friend")}</span>
                </a>
              </div>
              <div className="home-header__option home-header__item">
                <a className="home-header__link" href="/transfer">
                  <span>{t("transfer")}</span>
                </a>
              </div>
            </div>
          </div>
          <div className="home-header__item">
            <a className="home-header__link" href="/digital_staking/plans">
              {t("digital_staking")}
            </a>
          </div>
          <div className="home-header__item">
            <a className="home-header__link" href="/tbt">
              {t("tbt")}
            </a>
          </div>
        </div>
        <div className="home-header__collapse">
          {!storeCtx.isLogin && (
            <div className="home-header__box">
              <div className="home-header__items">
                <div className="home-header__item">
                  <a className="home-header__link" href="/signin">
                    {t("login")}
                  </a>
                </div>
                <div className="home-header__item">
                  <a className="home-header__link" href="/register">
                    {t("register")}
                  </a>
                </div>
              </div>
              <div className="home-header__sidebar-btn">
                <label className="home-header__label home-header__label--img"></label>
              </div>
            </div>
          )}
          {storeCtx.isLogin && (
            <div className="home-header__box">
              <div className="home-header__items">
                <div className="home-header__item">
                  <a className="home-header__link" href="/accounts">
                    {t("accounts")}
                  </a>
                </div>
                <div className="home-header__item">
                  <a className="home-header__link" href="/signout">
                    {t("logout")}
                  </a>
                </div>
              </div>
              <div className="home-header__sidebar-btn">
                <label className="home-header__label home-header__label--img"></label>
              </div>
            </div>
          )}
          <div className="home-header__dropdown">
            <input
              className="home-header__input"
              type="radio"
              name="home-header-dropdown"
            />
            <label className="home-header__item home-header__label home-header__label--border">
              {Languages[storeCtx.languageKey]}
            </label>
            <div className="home-header__options">
              {Object.keys(Languages).map((key) => (
                <li
                  className="home-header__option home-header__item"
                  key={key}
                  onClick={() => {
                    storeCtx.changeLanguage(key);
                  }}
                >
                  <div>{Languages[key]}</div>
                </li>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeHeader;
