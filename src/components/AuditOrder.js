import { useTranslation } from "react-i18next";
import { dateFormatter } from "../utils/Utils";
import SafeMath from "../utils/SafeMath";

const AuditOrder = (props) => {
  const { t } = useTranslation();
  const { order } = props;
  return (
    <div className="audit-order">
      <div className="audit-order__row">
        <div div className="audit-order__header">
          {order.baseUnit}|{order.quoteUnit}
        </div>
        <div div className="audit-order__subheader">
          {order.updated_at.toISOString()}
        </div>
      </div>
      <div div className="audit-order__item">
        <div className="audit-order__row">
          <div className="audit-order__value">{t("type")}</div>
          <div className="audit-order__value">{t("state")}</div>
          <div className="audit-order__value">{t("price")}</div>
          <div className="audit-order__value">{t("volume")}</div>
          <div className="audit-order__value">{t("acc_fill_vol")}</div>
          <div className="audit-order__value">{t("origin_locked")}</div>
          <div className="audit-order__value">{t("locked")}</div>
          <div className="audit-order__value">{t("funds_received")}</div>
          <div className="audit-order__value">{t("trades_count")}</div>
        </div>
        <div className="audit-order__row">
          <div className="audit-order__value">{order.type}</div>
          <div className="audit-order__value">{order.state}</div>
          <div className="audit-order__value">{order.price}</div>
          <div className="audit-order__value">{order.origin_volume}</div>
          <div className="audit-order__value">
            {SafeMath.minus(order.origin_volume, order.volume)}
          </div>
          <div className="audit-order__value">{order.origin_locked}</div>
          <div className="audit-order__value">{order.locked}</div>
          <div className="audit-order__value">{order.funds_received}</div>
          <div className="audit-order__value">{order.trades_count}</div>
        </div>
      </div>
      <ul className="audit-order__rows ">
        <div className="audit-order__header ">Vouchers</div>
        <div className="audit-order__row">
          <div className="audit-order__value">{t("created_at")}</div>
          <div className="audit-order__value">{t("trend")}</div>
          <div className="audit-order__value">{t("price")}</div>
          <div className="audit-order__value">{t("volume")}</div>
          <div className="audit-order__value">{t("value")}</div>
          <div className="audit-order__value">{t("ask_fee")}</div>
          <div className="audit-order__value">{t("bid_fee")}</div>
        </div>
        {order.vouchers.map((voucher) => (
          <div className="audit-order__row">
            <div className="audit-order__value">
              {voucher.created_at.toISOString()}
            </div>
            <div className="audit-order__value">{voucher.trend}</div>
            <div className="audit-order__value">{voucher.price}</div>
            <div className="audit-order__value">{voucher.volume}</div>
            <div className="audit-order__value">{voucher.value}</div>
            <div className="audit-order__value">
              {voucher.ask_fee}
              {voucher.ask}
            </div>
            <div className="audit-order__value">
              {voucher.bid_fee}
              {voucher.bid}
            </div>
          </div>
        ))}
      </ul>
      <ul className="audit-order__rows ">
        <div className="audit-order__header ">Account Versions</div>
        <div className="audit-order__row">
          <div className="audit-order__value">{t("created_at")}</div>
          <div className="audit-order__value">{t("modifiable_type")}</div>
          <div className="audit-order__value">{t("balance")}</div>
          <div className="audit-order__value">{t("locked")}</div>
          <div className="audit-order__value">{t("fee")}</div>
          <div className="audit-order__value">{t("reason")}</div>
        </div>
        {order.accountVersions.map((accountVersion) => (
          <div className="audit-order__row">
            <div className="audit-order__value">
              {accountVersion.created_at.toISOString()}
            </div>
            <div className="audit-order__value">
              {accountVersion.modifiable_type}
            </div>
            <div className="audit-order__value">{accountVersion.balance}</div>
            <div className="audit-order__value">{accountVersion.fee}</div>
            <div className="audit-order__value">
              {accountVersion.fee}
              {accountVersion.currency}
            </div>
            <div className="audit-order__value">{accountVersion.reason}</div>
          </div>
        ))}
      </ul>
    </div>
  );
};

export default AuditOrder;
