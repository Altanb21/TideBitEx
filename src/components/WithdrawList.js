import { useTranslation } from "react-i18next";
const WithdrawList = (props) => {
  const { t } = useTranslation();
  const component =
    props.withdraws.length > 0 ? (
      props.withdraws?.map((withdraw) => (
        <tr className="audit-order__row" key={`withdraw-${withdraw.id}`}>
          <th className="audit-order__value">{withdraw.created_at}</th>
          <th className="audit-order__value">{withdraw.id}</th>
          <th className="audit-order__value">{withdraw.aasm_state}</th>
          <th className="audit-order__value">{`${withdraw.amount} ${withdraw.currency}`}</th>
          <th className="audit-order__value">{`${withdraw.fee} ${withdraw.currency}`}</th>
          <th className="audit-order__value">{withdraw.updated_at}</th>
        </tr>
      ))
    ) : (
      <tr className="audit-order__row">{t("no-data")}</tr>
    );
  return (
    <table className="screen__table">
      <thead className="screen__table-header">Withdraw Records</thead>
      <tbody className="screen__table-rows deposit__list">
        <tr className="audit-order__row audit-order__row--main">
          <th className="audit-order__value">{t("created_at")}</th>
          <th className="audit-order__value">{t("id")}</th>
          <th className="audit-order__value">{t("aasm_state")}</th>
          <th className="audit-order__value">{t("amount")}</th>
          <th className="audit-order__value">{t("fee")}</th>
          <th className="audit-order__value">{t("updated_at")}</th>
        </tr>
        {component}
      </tbody>
    </table>
  );
};

export default WithdrawList;
