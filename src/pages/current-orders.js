import React, { useState, useEffect, useCallback, useContext } from "react";
import StoreContext from "../store/store-context";
import { useTranslation } from "react-i18next";
import TableDropdown from "../components/TableDropdown";
import { convertExponentialToDecimal, dateFormatter } from "../utils/Utils";
import SafeMath from "../utils/SafeMath";
import { TableHeader } from "./vouchers";

const exchanges = ["OKEx"];

const CurrentOrders = () => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);
  const [isInit, setIsInit] = useState(null);
  const [orders, setOrders] = useState(null);
  const [filterOrders, setFilterOrders] = useState(null);
  const [filterOption, setFilterOption] = useState("all"); //'ask','bid'
  const [filterKey, setFilterKey] = useState("");
  const [filterExchange, setFilterExchange] = useState(exchanges[0]);
  const [tickers, setTickers] = useState({ ticker: t("ticker") });
  const [filterTicker, setFilterTicker] = useState(t("ticker"));

  const getCurrentOrders = useCallback(
    async (exchange) => {
      const orders = await storeCtx.getOuterPendingOrders(exchange);
      setOrders((prev) => {
        let _orders = { ...prev };
        _orders[exchange] = orders;
        return _orders;
      });
      let tickers = {},
        ticker;
      for (let order of orders) {
        if (!tickers[order.instId]) tickers[order.instId] = order.instId;
      }
      setTickers(tickers);
      if (Object.values(tickers).length > 0) {
        ticker = Object.values(tickers)[0];
        setFilterTicker(ticker);
      }
      return { orders, tickers, ticker: ticker };
    },
    [storeCtx]
  );

  const filter = useCallback(
    async ({ keyword, side, exchange, filterOrders, ticker }) => {
      let _option = side || filterOption,
        _keyword = keyword === undefined ? filterKey : keyword,
        _exchange = exchange || filterExchange,
        _orders = filterOrders || orders[_exchange],
        _ticker = ticker || filterTicker,
        res;
      if (ticker) setFilterTicker(ticker);
      if (side) setFilterOption(side);
      if (exchange) {
        setFilterExchange(exchange);
        if (orders[exchange]) _orders = orders[exchange];
        else {
          res = await getCurrentOrders(exchange);
          _orders = res.orders;
          _ticker = res.ticker;
        }
      }
      if (_orders) {
        _orders = _orders.filter((order) => {
          let condition =
            order.id.includes(_keyword) ||
            order.memberId.includes(_keyword) ||
            order.instId.includes(_keyword) ||
            order.email.includes(_keyword) ||
            order.exchange.includes(_keyword);
          if (_ticker) condition = condition && order.instId === _ticker;
          if (_option !== "all")
            condition = condition && order.side === _option;
          if (_exchange !== "ALL")
            condition = condition && order.exchange === _exchange;
          return condition;
        });
        setFilterOrders(_orders);
      }
    },
    [
      filterExchange,
      filterKey,
      filterOption,
      filterTicker,
      getCurrentOrders,
      orders,
    ]
  );

  const sorting = (key, ascending) => {
    setFilterOrders((prevOrders) => {
      let sortedOrders = prevOrders.map((order) => ({ ...order }));
      sortedOrders = ascending
        ? sortedOrders?.sort((a, b) => +a[key] - +b[key])
        : sortedOrders?.sort((a, b) => +b[key] - +a[key]);
      return sortedOrders;
    });
  };

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        const orders = await getCurrentOrders(exchanges[0]);
        filter({ filterOrders: orders });
        return !prev;
      } else return prev;
    });
  }, [getCurrentOrders, filter]);

  useEffect(() => {
    if (!isInit) {
      init();
    }
  }, [init, isInit]);

  useEffect(() => {
    if (!isInit) {
      init();
    }
  }, [init, isInit]);

  return (
    <section className="screen__section current-orders">
      <div className="screen__header">{t("current-orders")}</div>
      <div className="screen__search-bar">
        <TableDropdown
          className="screen__filter"
          selectHandler={(option) => filter({ exchange: option })}
          options={exchanges}
          selected={filterExchange}
        />
        <div className="screen__search-box">
          <input
            type="text"
            inputMode="search"
            className="screen__search-input"
            placeholder={t("search-keywords")}
            onInput={(e) => {
              setFilterKey(e.target.value);
              filter({ keyword: e.target.value });
            }}
          />
          <div className="screen__search-icon">
            <div className="screen__search-icon--circle"></div>
            <div className="screen__search-icon--rectangle"></div>
          </div>
        </div>
      </div>
      <div className="screen__tool-bar">
        <div className="screen__display">
          <div className="screen__display-title">{`${t("show")}:`}</div>
          <ul className="screen__display-options">
            <li
              className={`screen__display-option${
                filterOption === "all" ? " active" : ""
              }`}
              onClick={() => filter({ side: "all" })}
            >
              {t("all")}
            </li>
            <li
              className={`screen__display-option${
                filterOption === "ask" ? " active" : ""
              }`}
              onClick={() => filter({ side: "sell" })}
            >
              {t("bid")}
            </li>
            <li
              className={`screen__display-option${
                filterOption === "bid" ? " active" : ""
              }`}
              onClick={() => filter({ side: "buy" })}
            >
              {t("ask")}
            </li>
          </ul>
        </div>
        {/* <div className="screen__sorting" onClick={sorting}>
          <img src="/img/sorting@2x.png" alt="sorting" />
        </div> */}
      </div>
      <table className={`screen__table${showMore ? " show" : ""}`}>
        <tr className="screen__table-headers">
          {/* <li className="screen__table-header">{t("date")}</li> */}
          <TableHeader
            label={t("date")}
            onClick={(ascending) => sorting("ts", ascending)}
          />
          <th className="screen__table-header">{t("memberId_email")}</th>
          <th className="screen__table-header">{t("transaction-side")}</th>
          {/* <TableDropdown
            className="screen__table-header"
            selectHandler={(option) => filter({ ticker: option })}
            options={Object.values(tickers)}
            selected={filterTicker}
          /> */}
          <th className="screen__table-header">
            <div className="screen__table-header--text">{t("exchange")}</div>
            <div className="screen__table-header--switch"></div>
          </th>
          {/* <li className="screen__table-header">{t("match-volume")}</li> */}
          <TableHeader
            label={t("match-volume")}
            onClick={(ascending) => sorting("accFillSz", ascending)}
          />
          {/* <li className="screen__table-header">{t("unmatch-volume")}</li> */}
          <TableHeader
            label={t("unmatch-volume")}
            onClick={(ascending) => sorting("unFillSz", ascending)}
          />
          {/* <li className="screen__table-header">{t("funds-receive")}</li> */}
          <TableHeader
            label={t("funds-receive")}
            onClick={(ascending) => sorting("fundsReceived", ascending)}
          />
        </tr>
        <tr className="screen__table-rows">
          {filterOrders &&
            filterOrders.map((order) => (
              <td
                className={`current-orders__tile screen__table-row${
                  order.email ? "" : " unknown"
                }`}
                key={order.id}
              >
                <div className="current-orders__text screen__table-item">
                  {dateFormatter(order.ts).text}
                </div>
                <div className="current-orders__text screen__table-item">
                  <div>{`${order.email ? order.email + "/" : "Unknown"}`}</div>
                  <div>{`${order.email ? order.memberId : ""}`}</div>
                </div>
                <div
                  className={`current-orders__text screen__table-item${
                    order.side === "buy" ? " positive" : " negative"
                  }`}
                >
                  {t(order.side)}
                </div>
                {/* <div className="current-orders__text screen__table-item">
                  {order.instId}
                </div> */}
                <div className="current-orders__text screen__table-item">
                  {order.exchange}
                </div>
                <div className="current-orders__text screen__table-item">
                  {`${convertExponentialToDecimal(
                    order.accFillSz
                  )} / ${convertExponentialToDecimal(order.sz)}`}
                </div>
                <div className="current-orders__text screen__table-item">
                  {`${convertExponentialToDecimal(
                    order.unFillSz
                  )} / ${convertExponentialToDecimal(order.sz)}`}
                </div>
                <div className="current-orders__text screen__table-item">
                  {`${convertExponentialToDecimal(
                    order.fundsReceived
                  )} / ${convertExponentialToDecimal(
                    SafeMath.mult(order.sz, order.px)
                  )}`}
                </div>
              </td>
            ))}
        </tr>
        <div
          className="screen__table-btn screen__table-text"
          onClick={() => setShowMore((prev) => !prev)}
        >
          {showMore ? t("show-less") : t("show-more")}
        </div>
      </table>
      <div className="screen__floating-box">
        <div
          className="screen__floating-btn"
          onClick={() => {
            const screenSection =
              window.document.querySelector(".screen__section");
            screenSection.scroll(0, 0);
          }}
        >
          <img src="/img/floating-btn@2x.png" alt="arrow" />
        </div>
      </div>
    </section>
  );
};

export default CurrentOrders;
