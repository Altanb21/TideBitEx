import React, { useState, useEffect, useCallback, useContext } from "react";
import StoreContext from "../store/store-context";
import { useTranslation } from "react-i18next";
import TableDropdown from "../components/TableDropdown";
import { dateFormatter } from "../utils/Utils";
import SupportedExchange from "../constant/SupportedExchange";
import SafeMath from "../utils/SafeMath";

const exchanges = ["OKEx"];

const CurrentOrders = () => {
  const storeCtx = useContext(StoreContext);
  const [showMore, setShowMore] = useState(false);
  const [isInit, setIsInit] = useState(null);
  const [orders, setOrders] = useState(null);
  const [filterOrders, setFilterOrders] = useState(null);
  const [filterOption, setFilterOption] = useState("all"); //'ask','bid'
  const [filterKey, setFilterKey] = useState("");
  const [filterExchange, setFilterExchange] = useState(exchanges[0]);
  const [ascending, setAscending] = useState(false);
  const { t } = useTranslation();

  const getCurrentOrders = useCallback(
    async (exchange) => {
      const orders = await storeCtx.getOuterPendingOrders(exchange);
      setOrders((prev) => ({ ...prev, exchange: orders }));
      return orders;
    },
    [storeCtx]
  );

  const filter = useCallback(
    async ({ keyword, side, exchange, filterOrders }) => {
      let _option = side || filterOption,
        _keyword = keyword === undefined ? filterKey : keyword,
        _exchange = exchange || filterExchange,
        _orders = filterOrders || orders[_exchange];
      if (side) setFilterOption(side);
      if (exchange) {
        setFilterExchange(exchange);
        if (orders[exchange]) _orders = orders[exchange];
        else _orders = await getCurrentOrders(exchange);
      }
      if (_orders) {
        _orders = _orders.filter((order) => {
          if (_exchange === "ALL")
            if (_option === "all")
              return (
                order.id.includes(_keyword) ||
                order.memberId.includes(_keyword) ||
                order.instId.includes(_keyword) ||
                order.email.includes(_keyword) ||
                order.exchange.includes(_keyword)
              );
            else
              return (
                (order.id.includes(_keyword) ||
                  order.memberId.includes(_keyword) ||
                  order.instId.includes(_keyword) ||
                  order.email.includes(_keyword) ||
                  order.exchange.includes(_keyword)) &&
                order.side === _option
              );
          else if (_option === "all")
            return (
              order.exchange === _exchange &&
              (order.id.includes(_keyword) ||
                order.memberId.includes(_keyword) ||
                order.instId.includes(_keyword) ||
                order.email.includes(_keyword) ||
                order.exchange.includes(_keyword))
            );
          else
            return (
              order.exchange === _exchange &&
              (order.id.includes(_keyword) ||
                order.memberId.includes(_keyword) ||
                order.instId.includes(_keyword) ||
                order.email.includes(_keyword) ||
                order.exchange.includes(_keyword)) &&
              order.side === _option
            );
        });
        setFilterOrders(_orders);
      }
    },
    [filterExchange, filterKey, filterOption, getCurrentOrders, orders]
  );

  const sorting = () => {
    setAscending((prev) => {
      setFilterOrders((prevOrders) =>
        !prev
          ? prevOrders.sort((a, b) => a.ts - b.ts)
          : prevOrders.sort((a, b) => b.ts - a.ts)
      );
      return !prev;
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
              onClick={() => filter({ side: "ask" })}
            >
              {t("bid")}
            </li>
            <li
              className={`screen__display-option${
                filterOption === "bid" ? " active" : ""
              }`}
              onClick={() => filter({ side: "bid" })}
            >
              {t("ask")}
            </li>
          </ul>
        </div>
        <div className="screen__sorting" onClick={sorting}>
          <img src="/img/sorting@2x.png" alt="sorting" />
        </div>
      </div>
      <div className={`screen__table${showMore ? " show" : ""}`}>
        <ul className="screen__table-headers">
          <li className="screen__table-header">{t("date")}</li>
          <li className="screen__table-header">{t("memberId")}</li>
          <li className="screen__table-header">{t("transaction-side")}</li>
          <li className="screen__table-header">{t("exchange")}</li>
          <li className="screen__table-header">{t("match-volume")}</li>
          <li className="screen__table-header">{t("unmatch-volume")}</li>
          <li className="screen__table-header">{t("turnover")}</li>
        </ul>
        <ul className="screen__table-rows">
          {filterOrders &&
            filterOrders.map((order) => (
              <div
                className={`current-orders__tile screen__table-row`}
                key={order.id}
              >
                <div className="current-orders__text screen__table-item">
                  {dateFormatter(order.ts).text}
                </div>
                <div className="current-orders__text screen__table-item">
                  {order.memberId}
                </div>
                <div
                  className={`current-orders__text screen__table-item${
                    order.side === "bid" ? " positive" : " negative"
                  }`}
                >
                  {t(order.side)}
                </div>
                <div className="current-orders__text screen__table-item">
                  {order.exchange}
                </div>
                <div className="current-orders__text screen__table-item">
                  {`${order.accFillSz} / ${order.sz}`}
                </div>
                <div className="current-orders__text screen__table-item">
                  {`${SafeMath.minus(order.sz - order.accFillSz)} / ${
                    order.sz
                  }`}
                </div>
                <div className="current-orders__text screen__table-item">
                  {`${order.fundsReceived} / ${SafeMath(order.sz, order.px)}`}
                </div>
              </div>
            ))}
        </ul>
        <div
          className="screen__table-btn screen__table-text"
          onClick={() => setShowMore((prev) => !prev)}
        >
          {showMore ? t("show-less") : t("show-more")}
        </div>
      </div>
      <div className="screen__floating-box">
        <div
          className="screen__floating-btn"
          onClick={() => {
            const screenSection =
              window.document.querySelector(".screen__section");
            // console.log(screenSection.scrollTop)
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
