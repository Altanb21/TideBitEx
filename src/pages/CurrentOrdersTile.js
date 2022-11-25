import React from "react";
import { useTranslation } from "react-i18next";
import { dateFormatter } from "../utils/Utils";
import CurrentOrdersText from "../components/CurrentOrdersText";

const CurrentOrdersTile = (props) => {
  const { t } = useTranslation();
  const { index, order } = props;
  const rowClassName = `current-orders__tile screen__table-row${
    order.email ? "" : " unknown"
  }${order.alert ? " screen__table-row--alert" : ""}`;
  const email = `${order.email ? order.email : "-"}`;
  const innerOrderId = `${
    order.innerOrder?.orderId ? order.innerOrder?.orderId : "-"
  }`;
  const innerOrderExchange = `${
    order.innerOrder?.exchange ? order.innerOrder?.exchange : "-"
  }`;
  const outerOrderExchange = `${
    order.outerOrder?.exchange ? order.outerOrder?.exchange : "-"
  }`;
  const innerOrderState = `${
    order.innerOrder?.state ? t(order.innerOrder?.state) : "-"
  }`;
  const outerOrderState = `${
    order.outerOrder?.state ? t(order.outerOrder?.state) : "-"
  }`;
  const forceCancelOrder = () => props.forceCancelOrder(order);

  return (
    <tr className={rowClassName} key={order.id}>
      <td className="current-orders__text screen__shrink">{index + 1}</td>
      <td className="current-orders__text screen__table-item">
        {dateFormatter(order.ts).text}
      </td>
      <td className="current-orders__text screen__email screen__table-item">
        {email}
        {/* <div>{`${order.email ? order.memberId : ""}`}</div> */}
      </td>
      <td className="screen__box screen__table-item">
        <div className="current-orders__text">{innerOrderExchange}</div>
        <div className="current-orders__text">{outerOrderExchange}</div>
      </td>
      <td
        className={`current-orders__text screen__table-item${
          order.side === "buy" ? " positive" : " negative"
        }`}
      >
        {`${t(order.kind)}${t(order.side)}`}
      </td>
      <td className="current-orders__text screen__table-item">
        {innerOrderId}
      </td>
      <td className="screen__box screen__table-item">
        <div className="current-orders__text">{innerOrderState}</div>
        <div className="current-orders__text">{outerOrderState}</div>
      </td>
      <td className="screen__box screen__table-item screen__expand">
        <CurrentOrdersText
          display={!!order.outerOrder}
          side={order.side}
          value={order.innerOrder?.price}
          expectValue={order.innerOrder?.avgFillPrice}
        />
        <CurrentOrdersText
          display={!!order.outerOrder}
          side={order.side}
          value={order.outerOrder?.price}
          expectValue={order.outerOrder?.avgFillPrice}
        />
      </td>
      <td className="screen__box screen__table-item screen__expand">
        <CurrentOrdersText
          display={!!order.innerOrder}
          side={order.side}
          value={order.innerOrder?.volume}
          expectValue={order.innerOrder?.accFillVolume}
        />
        <CurrentOrdersText
          display={!!order.outerOrder}
          side={order.side}
          value={order.outerOrder?.volume}
          expectValue={order.outerOrder?.accFillVolume}
        />
      </td>
      <td className="screen__box screen__table-item screen__expand">
        <CurrentOrdersText
          display={!!order.innerOrder}
          side={order.side}
          value={order.innerOrder?.expect}
          expectValue={order.innerOrder?.received}
        />
        <CurrentOrdersText
          display={!!order.outerOrder}
          side={order.side}
          value={order.outerOrder?.expect}
          expectValue={order.outerOrder?.received}
        />
      </td>
      <td
        className={`screen__table-item screen__table-item--button${
          !order.email ? " disabled" : ""
        }`}
        onClick={forceCancelOrder}
        disabled={!order.email}
      >
        {t("force_cancel")}
      </td>
    </tr>
  );
};

export default CurrentOrdersTile;
