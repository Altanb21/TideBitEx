import { useTranslation } from "react-i18next";
import React, { useContext } from "react";
import StoreContext from "../store/store-context";
import Languages from "../constant/Languages";
import { FaCaretDown } from "react-icons/fa";

const LanguageComponent = (props) => {
  const storeCtx = useContext(StoreContext);
  const { languageKey } = props;
  const switchLanguageHandler = () => {
    storeCtx.changeLanguage(languageKey);
  };
  return (
    <li
      className="home-header__option home-header__item"
      key={languageKey}
      onClick={switchLanguageHandler}
    >
      <div>{Languages[languageKey]}</div>
    </li>
  );
};

const LanguagesComponent = () => {
  const component = Object.keys(Languages).map((key) => (
    <LanguageComponent languageKey={key} />
  ));
  return component;
};

const HomeHeader = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();

  const privateComponent = !storeCtx.isLogin ? (
    <>
      <div className="home-header__item">
        <a className="home-header__link" href="/signin">
          {t("login")}
        </a>
      </div>
      <div className="home-header__item">
        <a className="home-header__link" href="/signup">
          {t("register")}
        </a>
      </div>
    </>
  ) : (
    <>
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
    </>
  );
  return (
    <div className="home-header">
      <a className="home-header__brand" href="/">
        <div></div>
      </a>
      <div className="home-header__container">
        <div className="home-header__collapse">
          <div className="home-header__dropdown">
            <input
              className="home-header__input"
              type="radio"
              name="home-header-dropdown"
            />
            <label className="home-header__label home-header__label--img">
              <div></div>
            </label>
            <div className="home-header__options">
              <div className="home-header__option home-header__item">
                <a
                  className="home-header__link home-header__link--logo"
                  href="http://isun.one/"
                >
                  <span className="home-header__logo home-header__logo--isun"></span>
                  <span>iSunOne</span>
                </a>
              </div>
              <div className="home-header__option home-header__item">
                <a
                  className="home-header__link home-header__link--logo"
                  href="https://xpa.exchange"
                >
                  <span className="home-header__logo home-header__logo--xpa"></span>
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
              <span>{t("navigator_trade")}</span>
              <span>
                <FaCaretDown />
              </span>
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
            <label className="home-header__item home-header__label home-header__label--text">
              <span>{t("member")}</span>
              <span>
                <FaCaretDown />
              </span>
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
          {/* <div className="home-header__item">
            <a className="home-header__link" href="/digital_staking/plans">
              {t("digital_staking")}
            </a>
          </div> */}
          <div className="home-header__item">
            <a className="home-header__link" href="/tbt">
              TBT
            </a>
          </div>
        </div>
        <div className="home-header__box">
          <div className="home-header__items">{privateComponent}</div>
          <div className="home-header__collapse">
            <div className="home-header__dropdown">
              <input
                className="home-header__input"
                type="radio"
                name="home-header-dropdown"
              />
              <label className="home-header__item home-header__label home-header__label--border">
                <span>{Languages[storeCtx.languageKey]}</span>
                <span>
                  <FaCaretDown />
                </span>
              </label>
              <div className="home-header__options">
                <LanguagesComponent />
              </div>
            </div>
          </div>
        </div>
        <div
          className="home-header__sidebar-btn"
          onClick={props.sidebarHandler}
        >
          <label className="home-header__label home-header__label--img">
            <div></div>
          </label>
        </div>
      </div>
    </div>
  );
};

export default HomeHeader;
