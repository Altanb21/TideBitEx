import React, { useContext, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import StoreContext from "../store/store-context";
import OrderTile from "./OrderTile";

const ClosedOrders = (_) => {
  const storeCtx = useContext(StoreContext);
  const [closeOrders, setCloseOrders] = useState(null);
  const { t } = useTranslation();

  useEffect(() => {
    // console.log(`ClosedOrders storeCtx.closeOrders`, storeCtx.closeOrders)
    setCloseOrders([...storeCtx.closeOrders]);
  }, [storeCtx.closeOrders]);

  return (
    <div className="closed-orders">
      <ul className="d-flex justify-content-between market-order-item market-order__title table__header">
        <li>Buy/Sell</li>
        <li>{t("price")}</li>
        <li>{t("volume")}</li>
        <li>{t("amount")}</li>
        <li>{t("status")}</li>
      </ul>
      <ul className="order-list scrollbar-custom">
        {!!closeOrders?.length &&
          closeOrders
            .filter((order) => !(order.price === "NaN" || !order.price)) // ++ WORKAROUND
            .map((order) => (
              <OrderTile
                id={order.id}
                price={order.price}
                volume={order.origin_volume}
                kind={order.kind}
                state={order.state}
                filled={order.filled}
                tickSz={storeCtx.tickSz}
                lotSz={storeCtx.lotSz}
                cancelOrderHandler={() => {}}
              />
            ))}
      </ul>
      <a className="order-list__action" href="/history/orders" target="_blank">
        {t("show-more")}
      </a>
    </div>
  );
};

export default ClosedOrders;
