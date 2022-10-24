import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import { formateDecimal } from "../utils/Utils";
import { FaTrashAlt } from "react-icons/fa";
import SafeMath from "../utils/SafeMath";
import StoreContext from "../store/store-context";

export const OrderTile = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  return (
    <ul
      className="d-flex justify-content-between market-order-item"
      onClick={(_) =>
        props.order.state === "wait" ? props.cancelOrder(props.order) : {}
      }
    >
      <li className={`order-tile__label-box`}>
        <div
          className={`order-tile__label ${
            props.order.kind === "bid"
              ? "order-tile__label--green"
              : "order-tile__label--red"
          }`}
        >
          {props.order.kind === "bid" ? "Bid" : "Ask"}
        </div>
        {props.order.state === "wait" && (
          <div
            className={`order-tile__label ${
              props.order.filled
                ? "order-tile__label--blue"
                : "order-tile__label--grey"
            }`}
          >
            {props.order.filled ? "Partial" : "Total"}
          </div>
        )}
      </li>
      <li>
        {formateDecimal(props.order.price, {
          decimalLength: storeCtx.tickSz || 0,
          pad: true,
        })}
      </li>
      <li>
        {formateDecimal(
          props.order.state === "wait"
            ? props.order.volume
            : props.order.origin_volume,
          {
            decimalLength: storeCtx.lotSz || 0,
            pad: true,
          }
        )}
      </li>
      <li>
        {formateDecimal(
          SafeMath.mult(
            props.order.price,
            props.order.state === "wait"
              ? props.order.volume
              : props.order.origin_volume
          ),
          {
            decimalLength: SafeMath.mult(
              storeCtx.tickSz || 0,
              storeCtx.lotSz || 0
            ),
          }
        )}
      </li>
      {props.order.state === "wait" ? (
        <li>
          <FaTrashAlt />
        </li>
      ) : (
        <li>{t(props.order.state)}</li>
      )}
    </ul>
  );
};

const ClosedOrders = (props) => {
  const storeCtx = useContext(StoreContext);

  const { t } = useTranslation();
  return (
    <div className="closed-orders">
      <ul className="d-flex justify-content-between market-order-item market-order__title">
        <li>Buy/Sell</li>
        <li>{t("price")}</li>
        <li>{t("volume")}</li>
        <li>{t("amount")}</li>
        <li>{t("status")}</li>
      </ul>
      <ul className="order-list scrollbar-custom">
        {!!storeCtx.closeOrders?.length &&
          storeCtx.closeOrders
            .filter((order) => !(order.price === "NaN" || !order.price)) // ++ WORKAROUND
            .map((order) => <OrderTile order={order} />)}
      </ul>
    </div>
  );
};

export default ClosedOrders;
