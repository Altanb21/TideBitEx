import React, { useState, useEffect, useCallback, useContext } from "react";
import StoreContext from "../store/store-context";
import { useTranslation } from "react-i18next";
import TableDropdown from "../components/TableDropdown";
import LoadingDialog from "../components/LoadingDialog";
import { convertExponentialToDecimal, dateFormatter } from "../utils/Utils";
import { TableHeader } from "./vouchers";

const exchanges = ["OKEx"];
const tickers = {
  "BTC-USDT": "BTC-USDT",
  "ETH-USDT": "ETH-USDT",
  "LTC-USDT": "LTC-USDT",
};
const CurrentOrders = () => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  // const [showMore, setShowMore] = useState(false);
  const [limit, setLimit] = useState(10);
  // const [offset, setOffset] = useState(0);
  const [oldestOrderId, setOldestOrderId] = useState(null); // ordId
  const [isInit, setIsInit] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState(null);
  const [filterOrders, setFilterOrders] = useState(null);
  const [filterOption, setFilterOption] = useState("all"); //'ask','bid'
  const [filterKey, setFilterKey] = useState("");
  const [filterExchange, setFilterExchange] = useState(exchanges[0]);
  // const [tickers, setTickers] = useState({ ticker: t("ticker") });
  const [filterTicker, setFilterTicker] = useState(Object.values(tickers)[0]);

  const getCurrentOrders = useCallback(
    async ({ exchange, ticker, limit, after }) => {
      if (exchange && ticker) {
        const res = await storeCtx.getOuterPendingOrders({
          instId: ticker,
          exchange,
          limit,
          after,
        });
        const pendingOrders = res.pendingOrders;
        const oldestOrderId = res.oldestOrderId;
        let updatedOrders;
        setOldestOrderId(oldestOrderId);
        setOrders((prev) => {
          let updatedOrders = { ...prev },askOrders=[],bidOrders=[];
          if (!updatedOrders[exchange]) updatedOrders[exchange] = {};
          if (!updatedOrders[exchange][ticker])
            updatedOrders[exchange][ticker] = [];
          updatedOrders[exchange][ticker] = [
            ...updatedOrders[exchange][ticker],
            ...pendingOrders,
          ];
          for(let o of updatedOrders){
            if (o.side === 'buy')
              bidOrders = [...bidOrders, o];
            else askOrders = [...askOrders, o];
          }
          askOrders.sort((a, b) => a.price - b.price);
          bidOrders.sort((a, b) => b.price - a.price);
          updatedOrders = bidOrders.concat(askOrders);
          return updatedOrders;
        });
        return updatedOrders[exchange][ticker];
      }
    },
    [storeCtx]
  );

  const filter = useCallback(
    async ({ newOrders, keyword, side, exchange, ticker }) => {
      let _option = side || filterOption,
        _keyword = keyword === undefined ? filterKey : keyword,
        _exchange = exchange || filterExchange,
        _orders = newOrders || [],
        // _orders = filterOrders || orders[_exchange],
        _ticker = ticker || filterTicker;
      if (side) setFilterOption(side);
      if (ticker) setFilterTicker(ticker);
      if (exchange) setFilterExchange(exchange);
      if (
        !newOrders &&
        orders &&
        orders[_exchange] &&
        orders[_exchange][_ticker]
      )
        _orders = orders[_exchange][_ticker];
      _orders = orders.filter((order) => {
        let condition =
          order.id.includes(_keyword) ||
          order.memberId.includes(_keyword) ||
          order.instId.includes(_keyword) ||
          order.email.includes(_keyword) ||
          order.exchange.includes(_keyword);
        if (_ticker) condition = condition && order.instId === _ticker;
        if (_option !== "all") condition = condition && order.side === _option;
        if (_exchange !== "ALL")
          condition = condition && order.exchange === _exchange;
        return condition;
      });
      setFilterOrders(_orders);
    },
    [filterExchange, filterKey, filterOption, filterTicker, orders]
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

  const selectTickerHandler = useCallback(
    async (ticker) => {
      setIsLoading(true);
      const orders = await getCurrentOrders({
        exchange: filterExchange,
        ticker,
        limit,
      });
      filter({ newOrders: orders });
      setIsLoading(false);
    },
    [filter, filterExchange, getCurrentOrders, limit]
  );

  const showMoreHandler = useCallback(async () => {
    let newOrders;
    setIsLoading(true);
    if (oldestOrderId) {
      await getCurrentOrders({
        ticker: filterTicker,
        exchange: exchanges[0],
        after: oldestOrderId,
        limit: limit,
      });
      // setOffset((prev) => (prev + 1) * limit);
    }
    filter(newOrders, {});
    setIsLoading(false);
  }, [oldestOrderId, getCurrentOrders, filterTicker, limit, filter]);

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        setIsLoading(true);
        const orders = await getCurrentOrders({
          exchange: exchanges[0],
          ticker: filterTicker,
          limit,
        });
        filter({ newOrders: orders });
        setIsLoading(false);
        return !prev;
      } else return prev;
    });
  }, [getCurrentOrders, filterTicker, limit, filter]);

  useEffect(() => {
    if (!isInit) {
      init();
    }
  }, [init, isInit]);

  return (
    <>
      {isLoading && <LoadingDialog />}
      <section className="screen__section current-orders">
        <div className="screen__header">{t("current-orders")}</div>
        <div className="screen__search-bar">
          <TableDropdown
            className="screen__filter"
            selectHandler={(ticker) => selectTickerHandler(ticker)}
            options={tickers ? Object.values(tickers) : []}
            selected={filterTicker}
          />
          <div className="screen__search-box">
            <input
              type="text"
              inputMode="search"
              className="screen__search-input"
              placeholder={t("search-keywords")}
              onInput={(e) => {
                setFilterKey(e.target.value);
                if (
                  orders &&
                  orders[filterExchange] &&
                  orders[filterExchange][filterTicker]
                )
                  filter(orders[filterExchange][filterTicker], {
                    keyword: e.target.value,
                  });
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
                  filterOption === "buy" ? " active" : ""
                }`}
                onClick={() => filter({ side: "buy" })}
              >
                {t("bid")}
              </li>
              <li
                className={`screen__display-option${
                  filterOption === "sell" ? " active" : ""
                }`}
                onClick={() => filter({ side: "sell" })}
              >
                {t("ask")}
              </li>
            </ul>
          </div>
          {/* <div className="screen__sorting" onClick={sorting}>
          <img src="/img/sorting@2x.png" alt="sorting" />
        </div> */}
        </div>
        <div className="screen__container">
          <table className={`screen__table`}>
            <tr className="screen__table-headers">
              <th className="screen__table-header screen__shrink">#</th>
              <TableHeader
                label={t("date")}
                onClick={(ascending) => sorting("ts", ascending)}
              />
              <th className="screen__table-header screen__email">
                {t("member_email")}
              </th>
              <th className="screen__table-header">
                <div className="screen__table-header--text">
                  {t("exchange")}
                </div>
                <div className="screen__table-header--switch"></div>
              </th>
              <th className="screen__table-header">{t("transaction-side")}</th>
              <TableHeader
                label={t("orderId")}
                onClick={(ascending) => sorting("orderId", ascending)}
              />
              <TableHeader
                className="screen__expand"
                label={t("transaction-price")}
                onClick={(ascending) => sorting("price", ascending)}
              />
              <TableHeader
                className="screen__expand"
                label={t("transaction-amount")}
                onClick={(ascending) => sorting("volume", ascending)}
              />
              <TableHeader
                label={t("funds-receive")}
                onClick={(ascending) => sorting("fundsReceived", ascending)}
              />
            </tr>
            <tr className="screen__table-rows">
              {filterOrders &&
                filterOrders.map((order, index) => (
                  <tr
                    className={`current-orders__tile screen__table-row${
                      order.email ? "" : " unknown"
                    }${order.alert ? " screen__table-row--alert" : ""}`}
                    key={order.id}
                  >
                    <td className="vouchers__text screen__shrink">
                      {index + 1}
                    </td>
                    <td className="current-orders__text screen__table-item">
                      {dateFormatter(order.ts).text}
                    </td>
                    <td className="current-orders__text screen__email screen__table-item">
                      {`${order.email ? order.email : "-"}`}
                      {/* <div>{`${order.email ? order.memberId : ""}`}</div> */}
                    </td>
                    <td className="screen__box screen__table-item">
                      <div className="current-orders__text">
                        {order.innerOrder?.exchange || "-"}
                      </div>
                      {order.outerOrder && (
                        <div className="current-orders__text">
                          {order.outerOrder?.exchange || "-"}
                        </div>
                      )}
                    </td>
                    <td
                      className={`current-orders__text screen__table-item${
                        order.side === "buy" ? " positive" : " negative"
                      }`}
                    >
                      {`${t(order.kind)}${t(order.side)}`}
                    </td>
                    <td className="current-orders__text screen__table-item">
                      {order.innerOrder?.orderId || "-"}
                    </td>
                    <td className="screen__box screen__table-item screen__expand">
                      <div
                        className={`"current-orders__text${
                          order.side === "buy" ? " positive" : " negative"
                        }`}
                      >
                        {`${
                          order.innerOrder?.price
                            ? convertExponentialToDecimal(
                                order.innerOrder?.price
                              )
                            : "-"
                        } / ${
                          order.innerOrder?.avgFillPrice
                            ? convertExponentialToDecimal(
                                order.innerOrder?.avgFillPrice
                              )
                            : "-"
                        }`}
                      </div>
                      {order.outerOrder && (
                        <div
                          className={`"current-orders__text${
                            order.side === "buy" ? " positive" : " negative"
                          }`}
                        >
                          {`${
                            order.outerOrder?.price
                              ? convertExponentialToDecimal(
                                  order.outerOrder?.price
                                )
                              : "-"
                          } / ${
                            order.outerOrder?.avgFillPrice
                              ? convertExponentialToDecimal(
                                  order.outerOrder?.avgFillPrice
                                )
                              : "-"
                          }`}
                        </div>
                      )}
                    </td>
                    <td className="screen__box screen__table-item screen__expand">
                      <div
                        className={`"current-orders__text${
                          order.side === "buy" ? " positive" : " negative"
                        }`}
                      >
                        {`${
                          order.innerOrder?.volume
                            ? convertExponentialToDecimal(
                                order.innerOrder?.volume
                              )
                            : "-"
                        } / ${
                          order.innerOrder?.accFillVolume
                            ? convertExponentialToDecimal(
                                order.innerOrder?.accFillVolume
                              )
                            : "-"
                        }`}
                      </div>
                      {order.outerOrder && (
                        <div
                          className={`"current-orders__text${
                            order.side === "buy" ? " positive" : " negative"
                          }`}
                        >
                          {`${
                            order.outerOrder?.volume
                              ? convertExponentialToDecimal(
                                  order.outerOrder?.volume
                                )
                              : "-"
                          } / ${
                            order.outerOrder?.accFillVolume
                              ? convertExponentialToDecimal(
                                  order.outerOrder?.accFillVolume
                                )
                              : "-"
                          }`}
                        </div>
                      )}
                    </td>
                    <td className="screen__box screen__table-item screen__expand">
                      <div
                        className={`"current-orders__text${
                          order.side === "buy" ? " positive" : " negative"
                        }`}
                      >
                        {`${
                          order.innerOrder?.expect
                            ? convertExponentialToDecimal(
                                order.innerOrder?.expect
                              )
                            : "-"
                        } / ${
                          order.innerOrder?.received
                            ? convertExponentialToDecimal(
                                order.innerOrder?.received
                              )
                            : "-"
                        }`}
                      </div>
                      {order.outerOrder && (
                        <div
                          className={`"current-orders__text${
                            order.side === "buy" ? " positive" : " negative"
                          }`}
                        >
                          {`${
                            order.outerOrder?.expect
                              ? convertExponentialToDecimal(
                                  order.outerOrder?.expect
                                )
                              : "-"
                          } / ${
                            order.outerOrder?.received
                              ? convertExponentialToDecimal(
                                  order.outerOrder?.received
                                )
                              : "-"
                          }`}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
            </tr>
            <tfoot
              className="screen__table-btn screen__table-text"
              onClick={showMoreHandler}
            >
              {/* {showMore ? t("show-less") : t("show-more")} */}
              {t("show-more")}
            </tfoot>
          </table>
        </div>
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
    </>
  );
};

export default CurrentOrders;
