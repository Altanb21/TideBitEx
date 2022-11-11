import { useTranslation } from "react-i18next";
import React, { useContext } from "react";
import StoreContext from "../store/store-context";

const HomeSidebar = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  return (
    <div className={`home-sidebar${props.active ? " active" : ""}`}>
      <div className="home-sidebar__overlay"></div>
      <div className="home-sidebar__menu">
        <div className="home-sidebar__header">
          <a className="home-sidebar__brand" href="/">
            <img
              src="/TideBit_White_hk.png"
              className="d-inline-block align-top"
              alt="TideBit"
              width="175px"
              height="60px"
            />
          </a>
        </div>
        <ul className="home-sidebar__items">
          <li className="home-sidebar__item">
            <a className="home-sidebar__item" href="/">
              {t("home")}
            </a>
          </li>
          <li className="home-sidebar__item">
            <a
              className="home-sidebar__item"
              href={`/markets/${storeCtx.defaultMarket}`}
            >
              {t("spot_trade")}
            </a>
          </li>
          <li className="home-sidebar__item">
            <a
              className="home-sidebar__item"
              href={`https://tidebit.zendesk.com/hc/zh-tw/articles/360003146914-%E5%A4%A7%E9%A1%8D%E4%BA%A4%E6%98%93Block-Trade-OTC-%E5%B0%88%E5%B1%AC-Whatsapp-852-62871829`}
            >
              {t("block_trade")}
            </a>
          </li>
          <li className="home-sidebar__item">
            <a className="home-sidebar__item" href="/digital_staking/plans">
              {t("digital_staking")}
            </a>
          </li>
          <li className="home-sidebar__item">
            <a className="home-sidebar__item" href="/tbt">
              {t("tbt")}
            </a>
          </li>
          <li className="home-sidebar__item">
            <a className="home-sidebar__item" href="/referral">
              {t("refer_now")}
            </a>
          </li>
          <li className="home-sidebar__item">
            <a className="home-sidebar__item" href="/zendesk">
              {t("support_center")}
            </a>
          </li>
          <li className="home-sidebar__item">
            <a
              className="home-sidebar__item"
              href="https://tidebit.zendesk.com/hc/zh-tw/sections/115002703828-公告"
            >
              {t("announcement")}
            </a>
          </li>
          {!storeCtx.isLogin && (
            <>
              <li className="home-sidebar__item">
                <a className="home-sidebar__item" href="/signin">
                  {t("login")}
                </a>
              </li>
              <li className="home-sidebar__item">
                <a className="home-sidebar__item" href="/register">
                  {t("register")}
                </a>
              </li>
            </>
          )}
          {storeCtx.isLogin && (
            <>
              <li className="home-sidebar__item">
                <a className="home-sidebar__item" href="/accounts">
                  {t("accounts")}
                </a>
              </li>
              <li className="home-sidebar__item">
                <a className="home-sidebar__item" href="/signout">
                  {t("logout")}
                </a>
              </li>
            </>
          )}
          <li className="home-sidebar__dropdown">
            <input
              className="home-sidebar__input"
              type="radio"
              name="home-sidebar-dropdown"
            />
            <label className="home-sidebar__item home-sidebar__label">
              {props.languageKey}
            </label>
            <div className="home-sidebar__options">
              {Object.keys(props.languages).map((key) => (
                <li
                  className="home-sidebar__option home-sidebar__item"
                  key={key}
                  onClick={() => {
                    props.changeLanguage(key);
                  }}
                >
                  <div>{props.languages[key]}</div>
                </li>
              ))}
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default HomeSidebar;
