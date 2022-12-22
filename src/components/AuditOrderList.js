import { useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import AuditOrder from "./AuditOrder";
import ScreenDisplayOptions from "./ScreenDisplayOptions";

const AuditOrderList = (props) => {
  const { t } = useTranslation();
  const [side, setSide] = useState("all");
  const [state, setState] = useState("all");
  const [orders, setOrders] = useState(props.orders);

  const filterHandler = useMemo(
    (side, state) => {
      let orders = props.orders.filter((o) => {
        let condition = true;
        if (side !== "all") condition = condition && o.side === side;
        if (state !== "all") condition = condition && o.state === state;
        return condition;
      });
      setOrders(orders);
    },
    [props.orders]
  );

  const displaySideHandler = useCallback(
    (option) => {
      setSide(option);
      filterHandler(option, state);
    },
    [filterHandler, state]
  );

  const displayStateHandler = useCallback(
    (option) => {
      setState(option);
      filterHandler(side, option);
    },
    [filterHandler, side]
  );
  const component = orders?.map((order) => (
    <AuditOrder key={`order-${order.id}`} auditOrder={order} />
  ));
  return (
    <table className="screen__table">
      <thead className="screen__table-head">
        <div className="screen__table-header">Audited Orders</div>
        <div className="screen__tool-bar">
          <ScreenDisplayOptions
            title={t("side")}
            options={["all", "buy", "sell"]}
            selectedOption={side}
            selectHandler={displaySideHandler}
          />
          <ScreenDisplayOptions
            title={t("state")}
            options={["all", "wait", "done", "canceled"]}
            selectedOption={state}
            selectHandler={displayStateHandler}
          />
        </div>
      </thead>
      <tbody className="screen__table-rows audit-order__list">
        {component}
      </tbody>
    </table>
  );
};

export default AuditOrderList;
