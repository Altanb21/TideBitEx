import React, { useState, useContext } from "react";
import StoreContext from "../store/store-context";

import { useTranslation } from "react-i18next";
import { formateDecimal } from "../utils/Utils";
import { RiKey2Line, RiHistoryFill } from "react-icons/ri";
import { FaWrench, FaUserAlt } from "react-icons/fa";
import { FiLogOut } from "react-icons/fi";

const AccountMobileTile = React.lazy(() => import("./AccountMobileTile"));

const ToggleButton = (props) => {
  return (
    <div
      class={`toggle-btn${props.status ? ` on` : ` off`}`}
      onClick={props.onClick}
    >
      <div class="toggle-btn__container">
        <span class="toggle-btn__handle-on">ON</span>
        <label class="toggle-btn__label">{props.option}</label>
        <span class="toggle-btn__handle-off">OFF</span>
        <input data-size="mini" name="sound-checkbox" type="checkbox" />
      </div>
    </div>
  );
};

const UserInfo = (_) => {
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
      {storeCtx.accounts?.sum && (
        <div
          className="user-info__accounts"
          onMouseEnter={() => openAccountsHandler(true)}
          onMouseLeave={() => openAccountsHandler(false)}
        >
          <div
            className="user-info__accounts--label"
            onClick={(_) => openAccountsHandler()}
          >{`${t("total-assets")}: $${
            storeCtx.accounts?.sum
              ? formateDecimal(storeCtx.accounts?.sum, { decimalLength: 2 })
              : ""
          }`}</div>
          <div
            className={`user-info__accounts--dropdown${
              openAccounts ? " open" : ""
            }`}
          >
            <div className="user-info__accounts--dropdown-box">
              <React.Suspense fallback={<div></div>}>
                {storeCtx.selectedTicker && storeCtx.accounts?.accounts ? (
                  accountsShowMore ? (
                    Object.values(storeCtx.accounts?.accounts).map(
                      (account) => (
                        <AccountMobileTile
                          withTitle={true}
                          showTotal={true}
                          showAvailable={false}
                          currency={account.currency.toLowerCase()}
                          total={account.total}
                          locked={account.locked}
                        />
                      )
                    )
                  ) : (
                    storeCtx.selectedTicker.instId.split("-")?.map((ccy) => {
                      let account = storeCtx.accounts?.accounts[ccy];
                      return (
                        <AccountMobileTile
                          withTitle={true}
                          showTotal={true}
                          showAvailable={false}
                          currency={account.currency.toLowerCase()}
                          total={account.total}
                          locked={account.locked}
                        />
                      );
                    })
                  )
                ) : (
                  <div></div>
                )}
              </React.Suspense>
            </div>
            <div
              className="user-info__accounts--dropdown-btn"
              onClick={() => setAccountsShowMore((prev) => !prev)}
            >
              {!accountsShowMore ? t("check-all") : t("hide")}
            </div>
          </div>
        </div>
      )}
      {storeCtx.memberEmail && (
        <div
          className="user-info__navs"
          onMouseEnter={() => openNavsHandler(true)}
          onMouseLeave={() => openNavsHandler(false)}
        >
          <div
            className="user-info__navs--label"
            onClick={(_) => openNavsHandler()}
          >
            <FaUserAlt />
            <div>{storeCtx.memberEmail}</div>
          </div>
          <ul className={`user-info__navs--dropdown${openNav ? " open" : ""}`}>
            {!storeCtx.disableTrade && (
              <>
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
                <li className="user-info__navs-item">
                  <a
                    href="/accounts"
                    target="_blank"
                    className="user-info__navs-link"
                  >
                    <RiKey2Line size={20} />
                    {/* <FontAwesomeIcon icon={["fal", "coffee"]} /> */}
                    <span>{t("funds")}</span>
                  </a>
                </li>
                <li className="user-info__navs-item">
                  <a
                    href="/settings"
                    target="_blank"
                    className="user-info__navs-link"
                  >
                    {/* <i class="fa fa-wrench"></i> */}
                    <FaWrench size={16} />
                    <span>{t("profile")}</span>
                  </a>
                </li>
                <li className="user-info__navs-item">
                  <a
                    href="/history/orders"
                    target="_blank"
                    className="user-info__navs-link"
                  >
                    {/* <i class="fa fa-history"></i> */}
                    <RiHistoryFill size={16} />
                    <span>{t("_history")}</span>
                  </a>
                </li>
              </>
            )}
            <li className="user-info__navs-item">
              <a href="/signout" className="user-info__navs-link">
                {/* <i class="fa fa-sign-out"></i> */}
                <FiLogOut size={16} />
                {storeCtx.disableTrade ? (
                  <span>{t("login")}</span>
                ) : (
                  <span>{t("logout")}</span>
                )}
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default UserInfo;
