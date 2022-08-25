import React, { useState, useContext } from "react";
import StoreContext from "../store/store-context";

import { useTranslation } from "react-i18next";
import { AccountMobileTile } from "./HistoryOrder";

const ToggleButton = (props) => {
  return (
    <div class="toggle-button-cover" onClick={props.onClick}>
      <div class="button-cover">
        <div class="button b2" id="button-12">
          <input type="checkbox" class="checkbox" checked={props.status} />
          <div class="knobs">
            <span>{props.option}</span>
          </div>
          <div class="layer"></div>
        </div>
      </div>
    </div>
  );
};

const UserInfo = (props) => {
  const [openSound, setOpenSound] = useState(false);
  const [openNotification, setOpenNotification] = useState(false);
  const [openAccounts, setOpenAccounts] = useState(false);
  const [accountsShowMore, setAccountsShowMore] = useState(false);
  const [openNav, setOpenNav] = useState(false);
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  const openAccountsHandler = (open) => {
    setOpenAccounts((prev) => (open !== undefined ? open : !prev));
  };
  const openNavsHandler = (open) => {
    setOpenNav((prev) => (open !== undefined ? open : !prev));
  };

  return (
    <div className="user-info">
      <div className="user-info__accounts">
        <div
          className="user-info__accounts--label"
          onMouseEnter={() => openAccountsHandler(true)}
          onMouseLeave={() => openAccountsHandler(false)}
          onClick={(_) => openAccountsHandler()}
        >{`${t("total-assets")}: $${""}`}</div>
        <div
          className={`user-info__accounts--dropdown${
            openAccounts ? " open" : ""
          }`}
        >
          <div className="user-info__accounts--dropdown-box">
            {storeCtx.accounts ? (
              accountsShowMore ? (
                Object.values(storeCtx.accounts).map((account) => (
                  <AccountMobileTile account={account} />
                ))
              ) : (
                storeCtx.selectedTicker.instId
                  .split("-")
                  ?.map((ccy) => (
                    <AccountMobileTile account={storeCtx.accounts[ccy]} />
                  ))
              )
            ) : (
              <div></div>
            )}
          </div>
          <div
            className="user-info__accounts--dropdown-btn"
            onClick={() => setAccountsShowMore((prev) => !prev)}
          >
            {accountsShowMore ? t("check-all") : t("hide")}
          </div>
        </div>
      </div>
      <div className="user-info__navs">
        <div
          className="user-info__navs--label"
          onMouseEnter={() => openNavsHandler(true)}
          onMouseLeave={() => openNavsHandler(false)}
          onClick={(_) => openNavsHandler()}
        >
          <i class="fa fa-user"></i>
          {storeCtx.memberEmail}
        </div>
        <ul className={`user-info__navs--dropdown${openNav ? " open" : ""}`}>
          <ToggleButton
            option={t("sound")}
            status={openSound}
            onClick={() => setOpenSound((prev) => !prev)}
          />
          <ToggleButton
            option={t("notification")}
            status={openNotification}
            onClick={() => setOpenNotification((prev) => !prev)}
          />
          <li>
            <a href="/accounts" target="_blank">
              <i class="fa fa-key"></i>
              <span>{t("funds")}</span>
            </a>
          </li>
          <li>
            <a href="/settings" target="_blank">
              <i class="fa fa-wrench"></i>
              <span>{t("profile")}</span>
            </a>
          </li>
          <li>
            <a href="/history/orders" target="_blank">
              <i class="fa fa-history"></i>
              <span>{t("_history")}</span>
            </a>
          </li>
          <a href="/signout">
            <i class="fa fa-sign-out"></i>
            <span>{t("logout")}</span>
          </a>
        </ul>
      </div>
    </div>
  );
};

export default UserInfo;
