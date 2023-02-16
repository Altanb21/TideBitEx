import React, { useContext, useMemo } from "react";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SafeMath from "../utils/SafeMath";
import StoreContext from "../store/store-context";
import { OrderTile } from "./ClosedOrders";

const PendingOrders = (_) => {
  const storeCtx = useContext(StoreContext);
  const history = useHistory();

  const cancelOrder = (order) => {
    const text =
      order.kind === "bid"
        ? t("cancel-bid-limit-order-confirm", {
            orderId: order.id,
            totalAmount: order.volume,
            baseUnit: order.instId.split("-")[0],
            totalPrice: SafeMath.mult(order.price, order.volume),
            price: order.price,
            quoteUnit: order.instId.split("-")[1],
          })
        : t("cancel-ask-limit-order-confirm", {
            orderId: order.id,
            totalAmount: order.volume,
            baseUnit: order.instId.split("-")[0],
            totalPrice: SafeMath.mult(order.price, order.volume),
            price: order.price,
            quoteUnit: order.instId.split("-")[1],
          });
    const confirm = window.confirm(text);
    if (confirm) {
      storeCtx.cancelOrder(order);
    }
  };
  
  const cancelOrders = (id, type) => {
    const text =
      type !== "all"
        ? type === "bid"
          ? t("cancel-all-bids-limit-order-confirm", {
              baseUnit: storeCtx.selectedTicker?.baseUnit?.toUpperCase(),
            })
          : t("cancel-all-asks-limit-order-confirm", {
              baseUnit: storeCtx.selectedTicker?.baseUnit?.toUpperCase(),
            })
        : t("cancel-all-limit-order-confirm");
    const confirm = window.confirm(text);
    if (confirm) {
      storeCtx.cancelOrders(id, type);
    }
  };

  const moreOrdersHandler = useMemo(() => {
    history.push({
      pathname: `/history/orders`,
    });
  }, []);

  const { t } = useTranslation();

  return (
    <div className="pending-orders">
      <ul className="d-flex justify-content-between market-order-item market-order__title table__header">
        <li>Buy/Sell</li>
        <li>{t("price")}</li>
        <li>{t("volume")}</li>
        <li>{t("amount")}</li>
        <li>{t("cancel")}</li>
      </ul>
      {/* {!storeCtx.pendingOrders.length && (
                <span className="no-data">
                  <i className="icon ion-md-document"></i>
                  No data
                </span>
              )} */}
      <ul className="order-list scrollbar-custom">
        {!!storeCtx.pendingOrders?.length &&
          storeCtx.pendingOrders
            .filter((order) => !(order.price === "NaN" || !order.price)) // ++ WORKAROUND
            .map((order) => (
              <OrderTile
                id={order.id}
                price={order.price}
                volume={order.volume}
                kind={order.kind}
                state={order.state}
                filled={order.filled}
                tickSz={storeCtx.tickSz}
                lotSz={storeCtx.lotSz}
                cancelOrderHandler={() => cancelOrder(order)}
              />
            ))}
      </ul>
      {storeCtx.selectedTicker?.source === "TideBit" && (
        <div className="pending-orders__box">
          <div onClick={() => cancelOrders(storeCtx.selectedTicker.id, "all")}>
            {t("cancel_all")}
          </div>
          <div onClick={() => cancelOrders(storeCtx.selectedTicker.id, "ask")}>
            {t("cancel_all_asks")}
          </div>
          <div onClick={() => cancelOrders(storeCtx.selectedTicker.id, "bid")}>
            {t("cancel_all_bids")}
          </div>
        </div>
      )}
      <div className="order-list__action" onClick={moreOrdersHandler}>
        {t("show_more")}
      </div>
    </div>
  );
};
export default PendingOrders;
