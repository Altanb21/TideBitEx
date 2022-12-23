import { useTranslation } from "react-i18next";
import Reason from "../constant/Reason";

const AccountVersionTable = (props) => {
  const { t } = useTranslation();
  return (
    <table className="audit-order__table">
      {/* <thead className="audit-order__header ">Account Versions</thead> */}
      <tbody className="audit-order__rows">
        <tr className="audit-order__row audit-order__row--header">
          <th className="audit-order__value">{t("created_at")}</th>
          <th className="audit-order__value">{t("id")}</th>
          <th className="audit-order__value">{t("reason")}</th>
          <th className="audit-order__value">{t("balance")}</th>
          <th className="audit-order__value">{t("locked")}</th>
          <th className="audit-order__value">{t("fee")}</th>
          <th className="audit-order__value">{t("modifiable_type")}</th>
          <th className="audit-order__value">{t("modifiable_id")}</th>
        </tr>
        {props.accountVersions.map((accountVersion) => (
          <tr className="audit-order__row">
            <td className="audit-order__value">{accountVersion.created_at}</td>
            <td className="audit-order__value">{accountVersion.id}</td>
            <td className="audit-order__value">
              {Reason[accountVersion.reason]}
            </td>
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
            <td className="audit-order__value">
              {accountVersion.modifiable_id}
            </td>
          </tr>
        ))}
        {!props.accountVersions.length > 0 && (
          <tr className="audit-order__row">{t("no-data")}</tr>
        )}
      </tbody>
    </table>
  );
};

const AuditOrder = (props) => {
  const { t } = useTranslation();
  const { auditOrder } = props;
  return (
    <div
      className={`audit-order ${auditOrder.alert ? " audit-order--alert" : ""}`}
    >
      <div div className="audit-order__summary">
        <div div className="audit-order__header">
          <div div className="audit-order__leading">
            <div div className="audit-order__title">
              {auditOrder.order.baseUnit.toUpperCase()}|
              {auditOrder.order.quoteUnit.toUpperCase()}
            </div>
            <div div className="audit-order__decoration">
              <div
                className={`audit-order__decorate ${
                  auditOrder.order.type === "sell" ? "red" : "green"
                }`}
              >
                {auditOrder.order.type}
              </div>
              <div
                div
                className={`audit-order__decorate ${
                  auditOrder.order.state === "wait"
                    ? "blue"
                    : auditOrder.order.state === "canceled"
                    ? "grey"
                    : "black"
                }`}
              >
                {auditOrder.order.state}
              </div>
            </div>
          </div>
          <div div className="audit-order__suffix">
            <div div className="audit-order__suffix--title">
              {t("funds_received")}
            </div>
            <div
              div
              className={`audit-order__suffix--value ${
                auditOrder.order.funds_received.alert
                  ? " audit-order__suffix--error"
                  : ""
              }`}
            >
              {`${auditOrder.order.funds_received.real} ${
                auditOrder.order.type === "sell"
                  ? auditOrder.order.quoteUnit
                  : auditOrder.order.baseUnit
              }`}
            </div>
            {auditOrder.order.funds_received.alert && (
              <div
                div
                className="audit-order__suffix--value audit-order__suffix--alert"
              >
                {`${auditOrder.order.funds_received.expect} ${
                  auditOrder.order.type === "sell"
                    ? auditOrder.order.quoteUnit
                    : auditOrder.order.baseUnit
                }`}
              </div>
            )}
          </div>
        </div>
        {/* <div div className="audit-order__subheader"></div> */}
      </div>
      <table className="audit-order__table">
        <thead className="audit-order__header ">Order</thead>
        <tbody div className="audit-order__container">
          <tr className="audit-order__row audit-order__row--main">
            <th className="audit-order__value">{t("created_at")}</th>
            <th className="audit-order__value">{t("id")}</th>
            <th className="audit-order__value">{t("price")}</th>
            <th className="audit-order__value">{t("volume")}</th>
            <th className="audit-order__value">{t("origin_volume")}</th>
            <th className="audit-order__value">{t("locked")}</th>
            <th className="audit-order__value">{t("origin_locked")}</th>
            <th className="audit-order__value">{t("trades_count")}</th>
          </tr>
          <tr className="audit-order__row audit-order__row--main">
            <td className="audit-order__value">
              {auditOrder.order.created_at}
            </td>
            <td className="audit-order__value">{auditOrder.order.id}</td>
            <td className="audit-order__value">{`${auditOrder.order.price} ${auditOrder.order.baseUnit}/${auditOrder.order.quoteUnit}`}</td>
            <td className="audit-order__value">
              {`${auditOrder.order.volume} ${auditOrder.order.baseUnit}`}
            </td>
            <td className="audit-order__value">
              {`${auditOrder.order.origin_volume} ${auditOrder.order.baseUnit}`}
            </td>
            <td className="audit-order__value">
              {`${auditOrder.order.locked} ${
                auditOrder.order.type === "buy"
                  ? auditOrder.order.quoteUnit
                  : auditOrder.order.baseUnit
              }`}
            </td>
            <td className="audit-order__value">
              {`${auditOrder.order.origin_locked} ${
                auditOrder.order.type === "buy"
                  ? auditOrder.order.quoteUnit
                  : auditOrder.order.baseUnit
              }`}
            </td>
            <td className="audit-order__value">
              <span
                className={`${
                  auditOrder.order.trades_count.alert
                    ? "audit-order__value--error"
                    : ""
                }`}
              >
                {auditOrder.order.trades_count.real}
              </span>
              {auditOrder.order.trades_count.alert && (
                <span className="audit-order__value--alert">
                  {auditOrder.order.trades_count.expect}
                </span>
              )}
            </td>
          </tr>
          <AccountVersionTable
            accountVersions={auditOrder.order.accountVersions}
          />
        </tbody>
      </table>

      <table className="audit-order__table">
        <thead className="audit-order__header ">Vouchers</thead>
        {auditOrder.vouchers.map((voucher) => (
          <>
            <tbody
              className={`audit-order__container ${
                voucher.accountVersions.length > 0
                  ? ""
                  : " audit-order__container--alert"
              }`}
            >
              <tr className="audit-order__row audit-order__row--main">
                <th className="audit-order__value">{t("created_at")}</th>
                <th className="audit-order__value">{t("id")}</th>
                <th className="audit-order__value">{t("trade_id")}</th>
                <th className="audit-order__value">{t("price")}</th>
                <th className="audit-order__value">{t("volume")}</th>
                <th className="audit-order__value">{t("value")}</th>
                <th className="audit-order__value">{t("ask_fee")}</th>
                <th className="audit-order__value">{t("bid_fee")}</th>
              </tr>
              <tr className="audit-order__row audit-order__row--main">
                <td className="audit-order__value">{voucher.created_at}</td>
                <td className="audit-order__value">{voucher.id}</td>
                <td className="audit-order__value">{voucher.trade_id}</td>
                <td className="audit-order__value">{`${voucher.price} ${voucher.bid}/${voucher.ask}`}</td>
                <td className="audit-order__value">
                  <span
                    className={`${
                      voucher.volume.alert ? "audit-order__value--error" : ""
                    }`}
                  >
                    {`${voucher.volume.real} ${voucher.ask}`}
                  </span>
                  {voucher.volume.alert && (
                    <span className="audit-order__value--alert">
                      {`${voucher.volume.expect} ${voucher.ask}`}
                    </span>
                  )}
                </td>
                <td className="audit-order__value">
                  <span
                    className={`${
                      voucher.value.alert ? "audit-order__value--error" : ""
                    }`}
                  >
                    {`${voucher.value.real} ${voucher.bid}`}
                  </span>
                  {voucher.value.alert && (
                    <span className="audit-order__value--alert">
                      {`${voucher.value.expect} ${voucher.bid}`}
                    </span>
                  )}
                </td>
                <td className="audit-order__value">
                  {`${voucher.ask_fee} ${voucher.ask}`}
                </td>
                <td className="audit-order__value">
                  {`${voucher.bid_fee} ${voucher.bid}`}
                </td>
              </tr>
              <AccountVersionTable accountVersions={voucher.accountVersions} />
            </tbody>
          </>
        ))}
      </table>
    </div>
  );
};

export default AuditOrder;
