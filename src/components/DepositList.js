import { useTranslation } from "react-i18next";
const DepositList = (props) => {
  const { t } = useTranslation();
  const component =
    props.deposits?.length > 0 ? (
      props.deposits?.map((deposit) => (
        <tr className="audit-order__row" key={`deposit-${deposit.id}`}>
          <th className="audit-order__value">{deposit.created_at}</th>
          <th className="audit-order__value">{deposit.id}</th>
          <th className="audit-order__value">{deposit.aasm_state}</th>
          <th className="audit-order__value">{`${deposit.amount} ${deposit.currency}`}</th>
          <th className="audit-order__value">{`${deposit.fee} ${deposit.currency}`}</th>
          <th className="audit-order__value">{deposit.updated_at}</th>
        </tr>
      ))
    ) : (
      <tr className="audit-order__row">{t("no-data")}</tr>
    );
  return (
    <table className="screen__table">
      <thead className="screen__table-header">Deposit Records</thead>
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

export default DepositList;
