import React, { useContext } from "react";
import {
  FaHome,
  FaCommentDots,
  FaDatabase,
  FaSignOutAlt,
  FaHistory,
  FaSignInAlt,
  FaUserPlus,
  FaExchangeAlt,
  FaInfoCircle,
} from "react-icons/fa";
import { BiLineChart, BiShare } from "react-icons/bi";
// import { GrAnnounce } from "react-icons/gr";
import { IoSettingsSharp } from "react-icons/io5";
import StoreContext from "../store/store-context";
import { useTranslation } from "react-i18next";
import DropDown from "./DropDown";

const SideBar = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  return (
    <ul className="sidebar">
      <li className="sidebar__item">
        <a className="sidebar__link" href="/">
          <FaHome size="1.8em" />
          <p>{t("home")}</p>
        </a>
      </li>
      <li className="sidebar__item">
        <a className="sidebar__link" href="/markets/ethhkd">
          <BiLineChart size="1.8em" />
          <p>{t("trading")}</p>
        </a>
      </li>
      <li className="sidebar__item">
        <a
          className="sidebar__link"
          href="https://tidebit.zendesk.com/hc/zh-tw/articles/360003146914-%E5%A4%A7%E9%A1%8D%E4%BA%A4%E6%98%93Block-Trade-OTC-%E5%B0%88%E5%B1%AC-Whatsapp-852-62871829"
        >
          <FaExchangeAlt size="1.8em" />
          <p>{t("block_trade")}</p>
        </a>
      </li>
      <li className="sidebar__item">
        <a className="sidebar__link" href="/digital_staking/plans">
          <FaDatabase size="1.8em" />
          <p>{t("digital_staking")}</p>
        </a>
      </li>
      <li className="sidebar__item">
        <a className="sidebar__link" href="/referrals">
          <BiShare size="1.8em" />
          <p>{t("refer_now")}</p>
        </a>
      </li>
      {storeCtx.isLogin && (
        <>
          <li className="sidebar__item">
            <a className="sidebar__link" href="/accounts">
              <FaCommentDots size="1.8em" />
              <p>{t("accounts")}</p>
            </a>
          </li>
          <li className="sidebar__item">
            <a className="sidebar__link" href="/history/orders">
              <FaHistory size="1.8em" />
              <p>{t("history")}</p>
            </a>
          </li>
          <li className="sidebar__item">
            <a className="sidebar__link" href="/settings">
              <IoSettingsSharp size="1.8em" />
              <p>{t("settings")}</p>
            </a>
          </li>
        </>
      )}
      <li className="sidebar__item">
        <a className="sidebar__link" href="/zendesk">
          <FaCommentDots size="1.8em" />
          <p>{t("support_center")}</p>
        </a>
      </li>
      <li className="sidebar__item">
        <a
          className="sidebar__link"
          href="https://tidebit.zendesk.com/hc/zh-tw/sections/115002703828-公告"
        >
          <FaInfoCircle size="1.8em" />
          <p>{t("announcement")}</p>
        </a>
      </li>
      {!storeCtx.isLogin && (
        <>
          <li className="sidebar__item">
            <a className="sidebar__link" href="/signin">
              <FaSignInAlt size="1.8em" />
              <p>{t("login")}</p>
            </a>
          </li>
          <li className="sidebar__item">
            <a className="sidebar__link" href="/signup">
              <FaUserPlus size="1.8em" />
              <p>{t("register")}</p>
            </a>
          </li>
        </>
      )}
      {storeCtx.isLogin && (
        <li className="sidebar__item">
          <a className="sidebar__link" href="/signout">
            <FaSignOutAlt size="1.8em" />
            <p>{t("logout")}</p>
          </a>
        </li>
      )}
      <DropDown
        options={Object.keys(props.languages)}
        selected={props.languageKey}
        onSelect={props.changeLanguage}
        placeholder="Language"
      >
        {(key) => <div>{props.languages[key]}</div>}
      </DropDown>
    </ul>
  );
};

export default SideBar;
