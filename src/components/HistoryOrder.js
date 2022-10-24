import React, { Suspense } from "react";
import { Tabs, Tab } from "react-bootstrap";
import { useTranslation } from "react-i18next";

const PendingOrders = React.lazy(() => import("./PendingOrders"));
const ClosedOrders = React.lazy(() => import("./ClosedOrders"));
const AccountList = React.lazy(() => import("./AccountList"));

const HistoryOrder = () => {
  const { t } = useTranslation();
  return (
    <>
      <div className="market-order">
        <div className="market-order__header">{t("my_orders")}</div>
        <Tabs defaultActiveKey="open-orders">
          <Suspense fallback={<div></div>}>
            <Tab eventKey="open-orders" title={t("open_orders")}>
              <PendingOrders />
            </Tab>
            <Tab eventKey="closed-orders" title={t("close_orders")}>
              <ClosedOrders />
            </Tab>
            <Tab eventKey="balance" title={t("balance")}>
              <AccountList />
            </Tab>
          </Suspense>
        </Tabs>
      </div>
    </>
  );
};

export default HistoryOrder;
