import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import { formateDecimal } from "../utils/Utils";
import StoreContext from "../store/store-context";

const AccountTile = React.memo((props) => {
  return (
    <ul className="d-flex justify-content-between market-order-item market-balance">
      <li>{props?.currency || "--"}</li>
      <li>{formateDecimal(props?.total, { decimalLength: 8 })}</li>
      <li>{formateDecimal(props?.balance, { decimalLength: 8 })}</li>
      <li>{formateDecimal(props?.locked, { decimalLength: 8 })}</li>
    </ul>
  );
});

const AccountList = (_) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  return (
    <div className="account-list">
      <ul className="d-flex justify-content-between market-order-item market-order__title market-balance">
        <li>{t("currency")}</li>
        <li>{t("totalBal")}</li>
        <li>{t("availBal")}</li>
        <li>{t("frozenBal")}</li>
      </ul>
      <ul className="order-list scrollbar-custom">
        {storeCtx.selectedTicker?.instId && storeCtx.accounts?.accounts ? (
          storeCtx.selectedTicker.instId.split("-")?.map((ccy) => {
            let account = storeCtx.accounts.accounts[ccy];
            return (
              <AccountTile
                currency={account?.currency}
                total={account?.total}
                balance={account?.balance}
                locked={account?.locked}
              />
            );
          })
        ) : (
          <div></div>
        )}
      </ul>
    </div>
  );
};

export default AccountList;
