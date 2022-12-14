import { useTranslation } from "react-i18next";
import React, { useContext } from "react";
import StoreContext from "../store/store-context";
import Languages from "../constant/Languages";
import { FaCaretDown } from "react-icons/fa";

const LanguageComponent = (props) => {
  const storeCtx = useContext(StoreContext);
  const { languageKey, sidebarHandler } = props;
  const switchLanguageHandler = () => {
    sidebarHandler();
    storeCtx.changeLanguage(languageKey);
  };
  return (
    <li
      className="home-sidebar__option home-sidebar__item"
      key={languageKey}
      onClick={switchLanguageHandler}
    >
      <div>{Languages[languageKey]}</div>
    </li>
  );
};

const LanguagesComponent = (props) => {
  const component = Object.keys(Languages).map((key) => (
    <LanguageComponent
      languageKey={key}
      sidebarHandler={props.sidebarHandler}
    />
  ));
  return component;
};

const HomeSidebar = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();

  const privateComponent = !storeCtx.isLogin ? (
    <>
      <li className="home-sidebar__item">
        <a className="home-sidebar__link" href="/signin">
          {t("login")}
        </a>
      </li>
      <li className="home-sidebar__item">
        <a className="home-sidebar__link" href="/signup">
          {t("register")}
        </a>
      </li>
    </>
  ) : (
    <>
      <li className="home-sidebar__item">
        <a className="home-sidebar__link" href="/accounts">
          {t("accounts")}
        </a>
      </li>
      <li className="home-sidebar__item">
        <a className="home-sidebar__link" href="/signout">
          {t("logout")}
        </a>
      </li>
    </>
  );
  return (
    <div className={`home-sidebar${props.active ? " active" : ""}`}>
      <div
        className="home-sidebar__overlay"
        onClick={props.sidebarHandler}
      ></div>
      <div className="home-sidebar__menu">
        <div className="home-sidebar__header">
          <a className="home-sidebar__brand" href="/">
            <div></div>
          </a>
        </div>
        <ul className="home-sidebar__items">
          <li className="home-sidebar__item">
            <a className="home-sidebar__link" href="/">
              {t("home")}
            </a>
          </li>
          <li className="home-sidebar__item">
            <a
              className="home-sidebar__link"
              href={`/markets/${storeCtx.defaultMarket}`}
            >
              {t("spot_trade")}
            </a>
          </li>
          <li className="home-sidebar__item">
            <a
              className="home-sidebar__link"
              href={`https://tidebit.zendesk.com/hc/zh-tw/articles/360003146914-%E5%A4%A7%E9%A1%8D%E4%BA%A4%E6%98%93Block-Trade-OTC-%E5%B0%88%E5%B1%AC-Whatsapp-852-62871829`}
            >
              {t("block_trade")}
            </a>
          </li>
          {/* <li className="home-sidebar__item">
            <a className="home-sidebar__link" href="/digital_staking/plans">
              {t("digital_staking")}
            </a>
          </li> */}
          <li className="home-sidebar__item">
            <a className="home-sidebar__link" href="/tbt">
              TBT
            </a>
          </li>
          <li className="home-sidebar__item">
            <a className="home-sidebar__link" href="/referral">
              {t("refer_now")}
            </a>
          </li>
          <li className="home-sidebar__item">
            <a className="home-sidebar__link" href="/zendesk">
              {t("support_center")}
            </a>
          </li>
          <li className="home-sidebar__item">
            <a
              className="home-sidebar__link"
              href="https://tidebit.zendesk.com/hc/zh-tw/sections/115002703828-公告"
            >
              {t("announcement")}
            </a>
          </li>
          {privateComponent}
          <li className="home-sidebar__dropdown">
            <input
              className="home-sidebar__input"
              type="checkbox"
              id="home-sidebar-dropdown"
            />
            <label
              className="home-sidebar__item home-sidebar__label"
              htmlFor="home-sidebar-dropdown"
            >
              <span>{Languages[storeCtx.languageKey]}</span>
              <span>
                <FaCaretDown />
              </span>
            </label>
            <div className="home-sidebar__options">
              <LanguagesComponent sidebarHandler={props.sidebarHandler} />
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default HomeSidebar;
