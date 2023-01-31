import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { exportCSVFile } from "../utils/Utils";
import AuditOrder from "./AuditOrder";
import DownloadOptions from "./DownloadOptions";
import ScreenDisplayOptions from "./ScreenDisplayOptions";

const AuditOrderList = (props) => {
  const { t } = useTranslation();
  const [side, setSide] = useState("all");
  const [state, setState] = useState("all");
  const [orders, setOrders] = useState(props.orders);

  const filterHandler = useCallback(
    ({ side, state }) => {
      if (props.orders?.length > 0) {
        let orders = props.orders?.filter((o) => {
          // console.log(`side:${side}, $state:{state}`)
          let condition = true;
          if (side !== "all") condition = condition && o.order.type === side;
          if (state !== "all") condition = condition && o.order.state === state;
          return condition;
        });
        setOrders(orders);
      }
    },
    [props.orders]
  );

  const downloadHandler = useCallback(
    (option) => {
      console.log(`option`, option);
      console.log(`props.orders`, props.orders);
      exportCSVFile(
        {
          created_at: "created at",
          id: "id",
          price: "price",
          volume: "volume",
          origin_volume: "origin volume",
          locked: "locked",
          origin_locked: "origin locked",
        },
        [
          {
            created_at: "2023-01-31",
            id: "20230131",
            price: "1000",
            volume: "0",
            origin_volume: "1",
            locked: "0",
            origin_locked: "1",
          },
        ],
        option
      );
    },
    [props.orders]
  );

  const displaySideHandler = useCallback(
    (option) => {
      setSide(option);
      filterHandler({ side: option, state });
    },
    [filterHandler, state]
  );

  const displayStateHandler = useCallback(
    (option) => {
      setState(option);
      filterHandler({ side, state: option });
    },
    [filterHandler, side]
  );

  useEffect(() => {
    if (props.orders?.length > 0) filterHandler({ side: "all", state: "all" });
  }, [filterHandler, props.orders?.length]);

  const component = orders?.map((order) => (
    <AuditOrder key={`order-${order.id}`} auditOrder={order} />
  ));
  return (
    <table className="screen__table">
      <thead className="screen__table-head">
        <div className="screen__table--box">
          <div className="screen__table-header">Audited Orders</div>
          <DownloadOptions
            title={t("download")}
            options={["orders", "vouchers", "account_versions"]}
            downloadHandler={downloadHandler}
          />
        </div>
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
