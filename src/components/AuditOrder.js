import { useTranslation } from "react-i18next";
import SafeMath from "../utils/SafeMath";

const AccountVersionTable = (props) => {
  const { t } = useTranslation();
  return (
    <table className="audit-order__table">
      <thead className="audit-order__header ">Account Versions</thead>
      <tbody className="audit-order__rows ">
        <tr className="audit-order__row audit-order__row--header">
          <th className="audit-order__value">{t("created_at")}</th>
          <th className="audit-order__value">{t("reason")}</th>
          <th className="audit-order__value">{t("balance")}</th>
          <th className="audit-order__value">{t("locked")}</th>
          <th className="audit-order__value">{t("fee")}</th>
          <th className="audit-order__value">{t("modifiable_type")}</th>
        </tr>
        {props.accountVersions.map((accountVersion) => (
          <tr className="audit-order__row">
            <td className="audit-order__value">{accountVersion.created_at}</td>
            <td className="audit-order__value">{accountVersion.reason}</td>
            <td className="audit-order__value">
              {`${accountVersion.balance} ${accountVersion.currency}`}
            </td>
            <td className="audit-order__value">
              {`${accountVersion.locked} ${accountVersion.currency}`}
            </td>
            <td className="audit-order__value">
              {`${accountVersion.fee} ${accountVersion.currency}`}
            </td>
            <td className="audit-order__value">
              {accountVersion.modifiable_type}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const AuditOrder = (props) => {
  const { t } = useTranslation();
  const { auditOrder } = props;
  return (
    <div className="audit-order">
      <table className="audit-order__table">
        <thead div className="audit-order__header">
          <div div className="audit-order__leading">
            {auditOrder.order.baseUnit}|{auditOrder.order.quoteUnit}
          </div>
          <div div className="audit-order__suffix">
            {auditOrder.order.updated_at}
          </div>
        </thead>
        <tbody div className="audit-order__body">
          <tr className="audit-order__row audit-order__row--header">
            <th className="audit-order__value">{t("type")}</th>
            <th className="audit-order__value">{t("state")}</th>
            <th className="audit-order__value">{t("price")}</th>
            <th className="audit-order__value">{t("volume")}</th>
            <th className="audit-order__value">{t("acc_fill_vol")}</th>
            <th className="audit-order__value">{t("origin_locked")}</th>
            <th className="audit-order__value">{t("locked")}</th>
            <th className="audit-order__value">{t("funds_received")}</th>
            <th className="audit-order__value">{t("trades_count")}</th>
          </tr>
          <tr className="audit-order__row audit-order__row--data">
            <td className="audit-order__value">{auditOrder.order.type}</td>
            <td className="audit-order__value">{auditOrder.order.state}</td>
            <td className="audit-order__value">{auditOrder.order.price}</td>
            <td className="audit-order__value">
              {auditOrder.order.origin_volume}
            </td>
            <td className="audit-order__value">
              {SafeMath.minus(
                auditOrder.order.origin_volume,
                auditOrder.order.volume
              )}
            </td>
            <td className="audit-order__value">
              {auditOrder.order.origin_locked}
            </td>
            <td className="audit-order__value">{auditOrder.order.locked}</td>
            <td className="audit-order__value">
              {auditOrder.order.funds_received}
            </td>
            <td className="audit-order__value">
              {auditOrder.order.trades_count}
            </td>
          </tr>
        </tbody>
      </table>
      <AccountVersionTable
        accountVersions={auditOrder.accountVersionsByOrder}
      />
      <table className="audit-order__table">
        <thead className="audit-order__header ">Vouchers</thead>
        <tbody className="audit-order__rows ">
          <tr className="audit-order__row">
            <th className="audit-order__value">{t("created_at")}</th>
            <th className="audit-order__value">{t("trend")}</th>
            <th className="audit-order__value">{t("price")}</th>
            <th className="audit-order__value">{t("volume")}</th>
            <th className="audit-order__value">{t("value")}</th>
            <th className="audit-order__value">{t("ask_fee")}</th>
            <th className="audit-order__value">{t("bid_fee")}</th>
          </tr>
          {auditOrder.vouchers.map((voucher) => (
            <tr className="audit-order__row">
              <td className="audit-order__value">{voucher.created_at}</td>
              <td className="audit-order__value">{voucher.trend}</td>
              <td className="audit-order__value">{`${voucher.price} ${voucher.bid}/${voucher.ask}`}</td>
              <td className="audit-order__value">
                {`${voucher.volume} ${voucher.ask}`}
              </td>
              <td className="audit-order__value">
                {`${voucher.value} ${voucher.bid}`}
              </td>
              <td className="audit-order__value">
                {`${voucher.ask_fee} ${voucher.ask}`}
              </td>
              <td className="audit-order__value">
                {`${voucher.bid_fee} ${voucher.bid}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <AccountVersionTable
        accountVersions={auditOrder.accountVersionsByTrade}
      />
    </div>
  );
};

export default AuditOrder;
