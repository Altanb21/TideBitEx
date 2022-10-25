import React from "react";
import { formateDecimal } from "../utils/Utils";
import { useTranslation } from "react-i18next";

const AccountMobileTile = (props) => {
  const { t } = useTranslation();
  return (
    <li className="mobile-account__tile">
      <div className="mobile-account__leading">
        <div className="mobile-account__icon">
          <img
            src={`/icons/${props.currency}.png`}
            alt={props.currency}
            loading="lazy"
          />
        </div>
        <div>{props.currency.toUpperCase()}</div>
      </div>
      <div className="mobile-account__subtitle">
        {props.showTotal && (
          <div className="mobile-account__balance">
            {props.withTitle && <div>{`${t("amount")}:`}</div>}
            {formateDecimal(props.total, { decimalLength: 8 })}
          </div>
        )}
        {props.showAvailable && (
          <div className="mobile-account__balance">
            {props.withTitle && <div>{`${t("amount")}:`}</div>}
            {formateDecimal(props.balance, { decimalLength: 8 })}
          </div>
        )}
        <div className="mobile-account__locked">
          {props.withTitle && <div>{`${t("locked")}:`}</div>}
          {formateDecimal(props.locked, { decimalLength: 8 })}
        </div>
      </div>
    </li>
  );
};

export default AccountMobileTile;
