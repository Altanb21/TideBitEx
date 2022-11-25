import React, { useState, useEffect, useCallback, useContext } from "react";
import StoreContext from "../store/store-context";
import { useTranslation } from "react-i18next";
import TableDropdown from "../components/TableDropdown";
import LoadingDialog from "../components/LoadingDialog";
import { TableHeader } from "./vouchers";
import SafeMath from "../utils/SafeMath";
import { useSnackbar } from "notistack";
import ScreenDisplayOptions from "../components/ScreenDisplayOptions";
import CurrentOrdersTile from "./CurrentOrdersTile";

const exchanges = ["OKEx"];
const tickers = {
  "BTC-USDT": "BTC-USDT",
  "ETH-USDT": "ETH-USDT",
};
const defaultOrders = {
  OKEx: {
    "BTC-USDT": [],
    "ETH-USDT": [],
  },
};

const compareFunction = (leftValue, rightValue) => {
  return leftValue?.id !== rightValue?.id;
};
const onlyInLeft = (left, right) =>
  left.filter(
    (leftValue) =>
      !right.some((rightValue) => compareFunction(leftValue, rightValue))
  );

const CurrentOrders = () => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  const [limit, setLimit] = useState(10);
  const [newestOrderId, setNewestOrderId] = useState(null); // ordId
  const [oldestOrderId, setOldestOrderId] = useState(null); // ordId
  const [isInit, setIsInit] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterOrders, setFilterOrders] = useState(null);
  const [filterOption, setFilterOption] = useState("all"); //'ask','bid'
  const [filterKey, setFilterKey] = useState("");
  const [filterTicker, setFilterTicker] = useState(Object.values(tickers)[0]);
  const [filterExchange, setFilterExchange] = useState(exchanges[0]);
  const [orders, setOrders] = useState(defaultOrders);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [prevPageIsExit, setPrevPageIsExit] = useState(" disable");
  const [nextPageIsExit, setNextPageIsExit] = useState(" disable");
  const { enqueueSnackbar } = useSnackbar();

  const getCurrentOrders = useCallback(
    async ({ exchange, ticker, limit, before, after }) => {
      let newOrders = [],
        newestOrder,
        oldestOrder,
        // totalCounts,
        pendingOrders;
      if (exchange && ticker) {
        let result = await storeCtx.getOuterPendingOrders({
          instId: ticker,
          exchange,
          limit: 100,
          before,
          after,
        });
        // totalCounts = result.totalCounts;
        pendingOrders = result.pendingOrders;
        let updatedOrders = {},
          askOrders = [],
          bidOrders = [];
        setOrders((prev) => {
          updatedOrders = { ...prev };
          if (!updatedOrders[exchange]) updatedOrders[exchange] = {};
          if (!updatedOrders[exchange][ticker])
            updatedOrders[exchange][ticker] = [];
          if (pendingOrders.length > 0) {
            let onlyInNewOrders = onlyInLeft(
              pendingOrders,
              updatedOrders[exchange][ticker]
            );
            console.log(
              `onlyInNewOrders[:${onlyInNewOrders.length}]`,
              updatedOrders
            );
            updatedOrders[exchange][ticker] =
              updatedOrders[exchange][ticker].concat(onlyInNewOrders);
            for (let o of updatedOrders[exchange][ticker]) {
              if (!newestOrder) newestOrder = { ...o };
              if (o.ts > newestOrder.ts) newestOrder = { ...o };
              if (!oldestOrder) oldestOrder = { ...o };
              if (o?.ts < oldestOrder?.ts) oldestOrder = { ...o };
              if (o.side === "buy") bidOrders = [...bidOrders, o];
              else askOrders = [...askOrders, o];
            }
            askOrders.sort((a, b) => a.price - b.price);
            bidOrders.sort((a, b) => b.price - a.price);
            updatedOrders[exchange][ticker] = bidOrders.concat(askOrders);
            if (newestOrder) setNewestOrderId(newestOrder.id);
            if (oldestOrder) setOldestOrderId(oldestOrder.id);
            // setTotalCounts(updatedOrders[exchange][ticker].length);
            setPages(Math.ceil(updatedOrders[exchange][ticker].length / limit));
          } else {
            setPages(1);
          }
          return updatedOrders;
        });
        console.log(`updatedOrders`, updatedOrders);
        newOrders = updatedOrders[exchange][ticker];
        console.log(`updatedOrders[${exchange}][${ticker}]`, newOrders);
      }
      return newOrders;
    },
    [storeCtx]
  );

  const filter = useCallback(
    async ({ orders, keyword, side }) => {
      let _option = side || filterOption,
        _keyword = keyword === undefined ? filterKey : keyword,
        filteredOrders;
      if (side) setFilterOption(side);
      filteredOrders = orders.filter((order) => {
        let condition =
          order.id.includes(_keyword) ||
          order.memberId.includes(_keyword) ||
          order.instId.includes(_keyword) ||
          order.email.includes(_keyword) ||
          order.exchange.includes(_keyword);
        if (_option !== "all") condition = condition && order.side === _option;
        return condition;
      });
      setFilterOrders(filteredOrders);
    },
    [filterKey, filterOption]
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
      setFilterTicker(ticker);
      const orders = await getCurrentOrders({
        exchange: filterExchange,
        ticker,
        limit,
      });
      filter({ orders: orders });
      setIsLoading(false);
    },
    [filter, filterExchange, getCurrentOrders, limit]
  );

  const switchPageHandler = useCallback(
    async (newPage) => {
      let newOrders,
        arr = [];
      setPage(newPage);
      if (SafeMath.gt(newPage, 1)) setPrevPageIsExit("");
      else setPrevPageIsExit(" disable");
      if (SafeMath.lt(newPage, pages)) setNextPageIsExit("");
      else setNextPageIsExit(" disable");
      setIsLoading(true);
      if (
        orders &&
        orders[filterExchange] &&
        orders[filterExchange][filterTicker]
      ) {
        newOrders = orders[filterExchange][filterTicker]
          .map((o) => ({ ...o }))
          .sort((a, b) => b.ts - a.ts);
        arr = newOrders.slice((page - 1) * limit, page * limit);
        console.log(
          `arr[:${arr.length}] (page - 1) * limit[${
            (page - 1) * limit
          }] page * limit[${page * limit}] page[${page}] limit[:limit]`
        );
      }
      if (arr.length < limit && oldestOrderId) {
        newOrders = await getCurrentOrders({
          ticker: filterTicker,
          exchange: exchanges[0],
          after: oldestOrderId,
          limit: limit,
        });
      }
      filter({ orders: newOrders });
      setIsLoading(false);
    },
    [
      filter,
      filterExchange,
      filterTicker,
      getCurrentOrders,
      limit,
      oldestOrderId,
      orders,
      page,
      pages,
    ]
  );

  const prevPageHandler = useCallback(async () => {
    let newPage = page - 1 > 0 ? page - 1 : 1;
    await switchPageHandler(newPage);
  }, [switchPageHandler, page]);

  const nextPageHandler = useCallback(async () => {
    let newPage = page + 1;
    await switchPageHandler(newPage);
  }, [switchPageHandler, page]);

  const displayOptionHandler = useCallback(
    (option) => {
      filter({
        orders: orders[filterExchange][filterTicker],
        side: option,
      });
    },
    [filter, filterExchange, filterTicker, orders]
  );

  const inputHandler = useCallback(
    (e) => {
      setFilterKey(e.target.value);
      filter({ orders: filterOrders, keyword: e.target.value });
    },
    [filter, filterOrders]
  );

  const flowbackHandler = useCallback(() => {
    const screenSection = window.document.querySelector(".screen__section");
    screenSection.scroll(0, 0);
  }, []);

  const forceCancelOrder = useCallback(
    async (order) => {
      if (order.email) {
        setIsLoading(true);
        const confirm = window.confirm(
          t("force_cancel_confirm", {
            orderId: order.innerOrder?.orderId,
          })
        );
        if (confirm) {
          try {
            await storeCtx.forceCancelOrder(order);
            enqueueSnackbar(
              `${t("force_cancel_order_success", {
                orderId: order.innerOrder?.orderId,
              })}`,
              {
                variant: "success",
                anchorOrigin: {
                  vertical: "top",
                  horizontal: "center",
                },
              }
            );
            const orders = await getCurrentOrders({
              exchange: exchanges[0],
              ticker: filterTicker,
              limit,
            });
            filter({ orders: orders });
          } catch (error) {
            enqueueSnackbar(`${t("error-happen")}`, {
              variant: "error",
              anchorOrigin: {
                vertical: "top",
                horizontal: "center",
              },
            });
          }
          setIsLoading(false);
        }
      }
    },
    [
      enqueueSnackbar,
      filter,
      filterTicker,
      getCurrentOrders,
      limit,
      storeCtx,
      t,
    ]
  );

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        setIsLoading(true);
        const orders = await getCurrentOrders({
          exchange: exchanges[0],
          ticker: filterTicker,
          limit,
        });
        filter({ orders: orders });
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
      <LoadingDialog isLoading={isLoading} />
      <section className="screen__section current-orders">
        <div className="screen__header">{t("current-orders")}</div>
        <div className="screen__search-bar">
          <TableDropdown
            className="screen__filter"
            selectHandler={selectTickerHandler}
            options={Object.values(tickers)}
            selected={filterTicker}
          />
          <div className="screen__search-box">
            <input
              type="text"
              inputMode="search"
              className="screen__search-input"
              placeholder={t("search-keywords")}
              onInput={inputHandler}
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
            <ScreenDisplayOptions
              options={["all", "bid", "ask"]}
              selectedOption={filterOption}
              selectHandler={displayOptionHandler}
            />
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
              <th className="screen__table-header">{t("state")}</th>
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
                className="screen__expand"
                label={t("funds-receive")}
                onClick={(ascending) => sorting("fundsReceived", ascending)}
              />
              <th className="screen__table-header">{t("force_cancel")}</th>
            </tr>
            <tr className="screen__table-rows">
              {filterOrders &&
                filterOrders
                  .slice((page - 1) * limit, page * limit)
                  .map((order, index) => (
                    <CurrentOrdersTile
                      order={order}
                      index={index}
                      forceCancelOrder={forceCancelOrder}
                    />
                  ))}
            </tr>
            <tfoot className="screen__table-tools">
              <div
                className={`screen__table-tool${prevPageIsExit}`}
                onClick={prevPageHandler}
              >
                <div className="screen__table-tool--left"></div>
              </div>
              <div className="screen__page">{`${page}/${pages}`}</div>
              <div
                className={`screen__table-tool${nextPageIsExit}`}
                onClick={nextPageHandler}
              >
                <div className="screen__table-tool--right"></div>
              </div>
            </tfoot>
          </table>
        </div>
        <div className="screen__floating-box">
          <div className="screen__floating-btn" onClick={flowbackHandler}>
            <img src="/img/floating-btn@2x.png" alt="arrow" />
          </div>
        </div>
      </section>
    </>
  );
};

export default CurrentOrders;
