import AuditOrder from "./AuditOrder";

const AuditOrderList = (props) => {
  const component = props.orders?.map((order) => (
    <AuditOrder key={`order-${order.id}`} auditOrder={order} />
  ));
  return (
    <tbody className="screen__table-rows audit-order__list">{component}</tbody>
  );
};

export default AuditOrderList;
