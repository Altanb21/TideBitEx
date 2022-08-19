import React, { useContext } from "react";
import { Tabs, Tab } from "react-bootstrap";
import StoreContext from "../store/store-context";
import SafeMath from "../utils/SafeMath";
import { formateDecimal } from "../utils/Utils";
import { FaTrashAlt } from "react-icons/fa";
import { useTranslation } from "react-i18next";
import { BiLock } from "react-icons/bi";

export const OrderTile = (props) => {
  const storeCtx = useContext(StoreContext);
  return (
    <ul
      className="d-flex justify-content-between market-order-item"
      onClick={(_) =>
        props.order.state === "wait" ? props.cancelOrder(props.order) : {}
      }
    >
      {/* <li>{dateFormatter(parseInt(props.order.cTime)).text}</li>
      <li>{props.order.instId.replace("-", "/")}</li>
      <li>{props.order.instType}</li>*/}
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
      {/* <li>{props.order.fillSz}</li> */}
      {/* <li>{SafeMath.minus(props.order.volume, props.order.fillSz)}</li> */}
      {props.order.state === "wait" ? (
        <li>
          <FaTrashAlt />
        </li>
      ) : (
        <li>{props.order.state_text}</li>
      )}
    </ul>
  );
};

const AccountTile = (props) => {
  return (
    <ul className="d-flex justify-content-between market-order-item market-balance">
      {/* <li>{dateFormatter(parseInt(props.account.uTime)).text}</li> */}
      <li>{props.account.currency || "--"}</li>
      {/* <li>{props.account.eq || "--"}</li>
      <li>{props.account.cashBal || "--"}</li>*/}
      <li>{formateDecimal(props.account.total, { decimalLength: 8 })}</li>
      <li>{formateDecimal(props.account.balance, { decimalLength: 8 })}</li>
      <li>{formateDecimal(props.account.locked, { decimalLength: 8 })}</li>
      {/* -- TODO: check api return object */}
      {/* <li>{props.account.interest || "--"}</li> */}
    </ul>
  );
};

export const AccountMobileTile = (props) => {
  return (
    <li className="mobile-account__tile">
      <div className="mobile-account__leading">
        <div className="mobile-account__icon">
          <img
            src={`/icons/${props.account.currency.toLowerCase()}.png`}
            alt={props.account?.currency.toLowerCase()}
          />
        </div>
        <div>{props.account.currency}</div>
      </div>
      <div className="mobile-account__subtitle">
        <div className="mobile-account__balance">
          {formateDecimal(props.account?.balance, { decimalLength: 8 })}
        </div>
        <div className="mobile-account__locked">
          <BiLock />
          {formateDecimal(props.account?.locked, { decimalLength: 8 })}
        </div>
      </div>
    </li>
  );
};

export const AccountList = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  return (
    <div className="account-list">
      <ul className="d-flex justify-content-between market-order-item market-order__title market-balance">
        <li>{t("currency")}</li>
        <li>{t("totalBal")}</li>
        <li>{t("availBal")}</li>
        <li>{t("frozenBal")}</li>
      </ul>

      {/* {!storeCtx.accounts?.length && (
              <span className="no-data">
                <i className="icon ion-md-document"></i>
                No data
              </span>
            )} */}
      <ul className="order-list scrollbar-custom">
        {storeCtx.selectedTicker && storeCtx.accounts ? (
          storeCtx.selectedTicker.instId
            ?.split("-")
            ?.map((ccy) => <AccountTile account={storeCtx.accounts[ccy]} />)
        ) : (
          <div></div>
        )}
      </ul>
    </div>
  );
};

export const PendingOrders = (props) => {
  const storeCtx = useContext(StoreContext);
  const cancelOrder = (order) => {
    const confirm = window.confirm(`You are going to cancel order: ${order.id}
    ${order.kind} ${order.volume} ${order.instId.split("-")[0]}
    ${order.kind === "bid" ? "with" : "for"} ${SafeMath.mult(
      order.price,
      order.volume
    )} ${order.volume} ${order.instId.split("-")[1]}
    with price ${order.price} ${order.instId.split("-")[1]} per ${
      order.instId.split("-")[0]
    }`);
    if (confirm) {
      storeCtx.cancelOrder(order);
    }
  };
  const cancelOrders = (instId, type) => {
    const confirm = window.confirm(
      `You are going to cancel all ${type === "all" ? "" : type} orders`
    );
    if (confirm) {
      storeCtx.cancelOrders(instId, type);
    }
  };
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
              <OrderTile order={order} cancelOrder={cancelOrder} />
            ))}
      </ul>
      {storeCtx.selectedTicker?.source === "TideBit" && (
        <div className="pending-orders__box">
          <div
            onClick={() => cancelOrders(storeCtx.selectedTicker.instId, "all")}
          >
            {t("cancel_all")}
          </div>
          <div
            onClick={() => cancelOrders(storeCtx.selectedTicker.instId, "ask")}
          >
            {t("cancel_all_asks")}
          </div>
          <div
            onClick={() => cancelOrders(storeCtx.selectedTicker.instId, "bid")}
          >
            {t("cancel_all_bids")}
          </div>
        </div>
      )}
    </div>
  );
};

export const ClosedOrders = (props) => {
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
      {/* {!storeCtx.closeOrders.length && (
              <span className="no-data">
                <i className="icon ion-md-document"></i>
                No data
              </span>
            )} */}
      <ul className="order-list scrollbar-custom">
        {!!storeCtx.closeOrders?.length &&
          storeCtx.closeOrders
            .filter((order) => !(order.price === "NaN" || !order.price)) // ++ WORKAROUND
            .map((order) => <OrderTile order={order} />)}
      </ul>
    </div>
  );
};

const HistoryOrder = () => {
  const { t } = useTranslation();
  return (
    <>
      <div className="market-order">
        <div className="market-order__header">{t("my_orders")}</div>
        <Tabs defaultActiveKey="open-orders">
          <Tab eventKey="open-orders" title={t("open_orders")}>
            <PendingOrders />
          </Tab>
          <Tab eventKey="closed-orders" title={t("close_orders")}>
            <ClosedOrders />
          </Tab>
          <Tab eventKey="balance" title={t("balance")}>
            <AccountList />
          </Tab>
        </Tabs>
      </div>
    </>
  );
};

export default HistoryOrder;
