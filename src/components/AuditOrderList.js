import AuditOrder from "./AuditOrder";

const AuditOrderList = (props) => {
  const component = props.orders?.map((order) => (
    <AuditOrder key={`order-${order.id}`} auditOrder={order} />
  ));
  return (
    <table className="screen__table">
      <thead className="screen__table-header">Audited Orders</thead>
      <tbody className="screen__table-rows audit-order__list">
        {component}
      </tbody>
    </table>
  );
};

export default AuditOrderList;
