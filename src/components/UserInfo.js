import React, { useState, useContext, useCallback } from "react";
import StoreContext from "../store/store-context";

import { useTranslation } from "react-i18next";
import { formateDecimal } from "../utils/Utils";
import { RiKey2Line, RiHistoryFill } from "react-icons/ri";
import { FaWrench, FaUserAlt } from "react-icons/fa";
import { FiLogOut } from "react-icons/fi";

const AccountMobileTile = React.lazy(() => import("./AccountMobileTile"));

const ToggleButton = (props) => {
  const toggleButtonClass = React.useMemo(
    () => `toggle-btn${props.status ? ` on` : ` off`}`,
    [props.status]
  );
  return (
    <div class={toggleButtonClass} onClick={props.onClick}>
      <div class="toggle-btn__container">
        <span class="toggle-btn__handle-on">ON</span>
        <label class="toggle-btn__label">{props.option}</label>
        <span class="toggle-btn__handle-off">OFF</span>
        <input data-size="mini" name="sound-checkbox" type="checkbox" />
      </div>
    </div>
  );
};

const AssetsList = (props) => {
  const component = props.accounts
    .filter((account) => {
      let result = false;
      if (account.currency) result = true;
      else console.error(`account.currency is undefined`, account);
      return result;
    })
    .map((account) => (
      <AccountMobileTile
        withTitle={true}
        showTotal={true}
        showAvailable={false}
        currency={account.currency?.toLowerCase()}
        total={account.total}
        locked={account.locked}
      />
    ));
  return component;
};

const UserAssets = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  const [accountsShowMore, setAccountsShowMore] = useState(false);
  const [hintText, setHintText] = useState(t("hide"));
  const [accounts, setAccounts] = useState([]);
  const [openAccounts, setOpenAccounts] = useState(false);
  const accountsDropdownClass = useCallback(
    () => `user-info__accounts--dropdown${openAccounts ? " open" : ""}`,
    [openAccounts]
  );
  const toggleAccountsHandler = useCallback(
    (open) => {
      if (storeCtx.selectedTicker && storeCtx.accounts?.accounts)
        setOpenAccounts((prev) => (open !== undefined ? open : !prev));
    },
    [storeCtx.accounts?.accounts, storeCtx.selectedTicker]
  );
  const openAccountsHandler = useCallback(
    () => toggleAccountsHandler(true),
    [toggleAccountsHandler]
  );
  const closeAccountsHandler = useCallback(
    () => toggleAccountsHandler(false),
    [toggleAccountsHandler]
  );
  const showMoreHandler = useCallback(() => {
    let showMore = !accountsShowMore;
    if (showMore) {
      setAccounts(Object.values(storeCtx.accounts?.accounts));
      setHintText(t("hide"));
    } else {
      if (storeCtx.selectedTicker.instId) {
        setAccounts(
          storeCtx.selectedTicker.instId
            .split("-")
            ?.map((ccy) => storeCtx.accounts?.accounts[ccy])
        );
      } else setAccounts([]);
      setHintText(t("check-all"));
    }
    setAccountsShowMore(showMore);
  }, [
    accountsShowMore,
    storeCtx.accounts?.accounts,
    storeCtx.selectedTicker.instId,
    t,
  ]);
  const component = props.display ? (
    <div
      className="user-info__accounts"
      onMouseEnter={openAccountsHandler}
      onMouseLeave={closeAccountsHandler}
    >
      <div
        className="user-info__accounts--label"
        onClick={toggleAccountsHandler}
      >{`${t("total-assets")}: $${formateDecimal(storeCtx.accounts?.sum, {
        decimalLength: 2,
      })}`}</div>
      <div className={accountsDropdownClass}>
        <div className="user-info__accounts--dropdown-box">
          <React.Suspense fallback={<div></div>}>
            <AssetsList accounts={accounts} />
          </React.Suspense>
        </div>
        <div
          className="user-info__accounts--dropdown-btn"
          onClick={showMoreHandler}
        >
          {hintText}
        </div>
      </div>
    </div>
  ) : (
    <></>
  );
  return component;
};

const UserSetting = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  const [openSound, setOpenSound] = useState(false);
  const [openNotification, setOpenNotification] = useState(false);
  const [openNav, setOpenNav] = useState(false);
  const settingDropdownClass = useCallback(
    () => `user-info__navs--dropdown${openNav ? " open" : ""}`,
    [openNav]
  );
  const toggleNavsHandler = (open) => {
    setOpenNav((prev) => (open !== undefined ? open : !prev));
  };
  const openNavsHandler = () => toggleNavsHandler(true);
  const closeNavsHandler = () => toggleNavsHandler(false);
  const component = props.display ? (
    <div
      className="user-info__navs"
      onMouseEnter={openNavsHandler}
      onMouseLeave={closeNavsHandler}
    >
      <div className="user-info__navs--label" onClick={toggleNavsHandler}>
        <FaUserAlt />
        <div>{storeCtx.memberEmail}</div>
      </div>
      <ul className={settingDropdownClass}>
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
  ) : (
    <></>
  );
  return component;
};

const UserInfo = (_) => {
  const storeCtx = useContext(StoreContext);
  return (
    <div className="user-info">
      <UserAssets display={!!storeCtx.accounts?.sum} />
      <UserSetting display={!!storeCtx.memberEmail} />
    </div>
  );
};

export default UserInfo;
