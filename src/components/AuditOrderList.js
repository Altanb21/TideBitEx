import { useState, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import Reason from "../constant/Reason";
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
      console.log(`orders`, orders);
      let headers,
        items = [];
      switch (option) {
        case "orders":
          headers = {
            market: "market",
            created_at: "created at",
            id: "id",
            type: "type",
            side: "side",
            state: "state",
            price: "price",
            volume: "volume",
            origin_volume: "origin volume",
            locked: "locked",
            origin_locked: "origin locked",
            trades_count: "trades count",
            funds_received: "funds received",
          };
          items = orders.map((o) => {
            let order = {
              market: `${o.order.baseUnit}-${o.order.quoteUnit}`,
              created_at: o.order.created_at,
              id: o.order.id,
              type: o.order.ord_type,
              side: o.order.type,
              state: o.order.state,
              price: o.order.price,
              volume: o.order.volume,
              origin_volume: o.order.origin_volume,
              locked: o.order.locked,
              origin_locked: o.order.origin_locked,
              trades_count: o.order.trades_count.real,
              funds_received: o.order.funds_received.real,
            };
            return order;
          });
          break;
        case "vouchers":
          headers = {
            created_at: "created at",
            id: "id",
            trade_id: "trade id",
            member_id: "member id",
            order_id: "order id",
            price: "price",
            volume: "volume",
            value: "value",
            locked: "locked",
            ask: "ask",
            ask_fee: "ask_fee",
            bid: "bid",
            bid_fee: "bid_fee",
          };
          items = orders
            .reduce((acc, curr) => {
              acc = acc.concat(curr.vouchers);
              return acc;
            }, [])
            .map((v) => ({
              created_at: v.created_at,
              id: v.id,
              trade_id: v.trade_id,
              member_id: v.member_id,
              order_id: v.order_id,
              price: v.price,
              volume: v.volume.real,
              value: v.value.real,
              ask: v.ask,
              ask_fee: v.ask_fee,
              bid: v.bid,
              bid_fee: v.bid_fee,
            }));
          break;
        case "account_versions":
          headers = {
            created_at: "created at",
            id: "id",
            account_id: "account id",
            member_id: "member id",
            currency: "currency",
            reason: "reason",
            balance: "balance",
            locked: "locked",
            amount: "amount",
            fee: "fee",
            modifiable_type: "modifiable type",
            modifiable_id: "modifiable id",
          };
          items = orders
            .reduce((acc, curr) => {
              acc = acc.concat(curr.order.accountVersions);
              let tmp = curr.vouchers.reduce((acc, curr) => {
                acc = acc.concat(curr.accountVersions);
                return acc;
              }, []);
              acc = acc.concat(tmp);
              return acc;
            }, [])
            .map((a) => ({
              created_at: a.created_at,
              id: a.id,
              account_id: a.account_id,
              member_id: a.member_id,
              currency: a.currency,
              reason: Reason[a.reason],
              balance: a.balance,
              locked: a.locked,
              amount: a.amount,
              fee: a.fee,
              modifiable_type: a.modifiable_type,
              modifiable_id: a.modifiable_id,
            }));
          break;
        default:
      }
      exportCSVFile(headers, items, option);
    },
    [orders]
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
