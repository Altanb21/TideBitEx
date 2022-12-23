import React, { useState, useEffect, useCallback, useContext } from "react";
import StoreContext from "../store/store-context";
import { useTranslation } from "react-i18next";
import TableDropdown from "../components/TableDropdown";
import LoadingDialog from "../components/LoadingDialog";
import { TableHeader } from "./vouchers";
import SafeMath from "../utils/SafeMath";
import { useSnackbar } from "notistack";
import ScreenDisplayOptions from "../components/ScreenDisplayOptions";
import CurrentOrdersList from "../components/CurrentOrdersList";

const exchanges = ["OKEx"];
const tickers = {
  "BTC-USDT": "BTC-USDT",
  "ETH-USDT": "ETH-USDT",
};
const defaultOrders = {
  OKEx: {
    "BTC-USDT": {
      orders: [],
      pages: 1,
    },
    "ETH-USDT": {
      orders: [],
      pages: 1,
    },
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
  const [isInit, setIsInit] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filterOrders, setFilterOrders] = useState(null);
  const [filterOption, setFilterOption] = useState("all"); //'buy','sell'
  const [filterKey, setFilterKey] = useState("");
  const [filterTicker, setFilterTicker] = useState(Object.values(tickers)[0]);
  const [filterExchange, setFilterExchange] = useState(exchanges[0]);
  const [orders, setOrders] = useState(defaultOrders);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [prevPageIsExit, setPrevPageIsExit] = useState(" disable");
  const [nextPageIsExit, setNextPageIsExit] = useState(" disable");
  const { enqueueSnackbar } = useSnackbar();

  const updatePage = useCallback(
    (newPage, newPages) => {
      let _pages = newPages || pages;
      setPage(newPage);
      setPages(_pages);
      if (SafeMath.gt(newPage, 1)) setPrevPageIsExit("");
      else setPrevPageIsExit(" disable");
      if (SafeMath.lt(newPage, _pages)) setNextPageIsExit("");
      else setNextPageIsExit(" disable");
    },
    [pages]
  );

  const getCurrentOrders = useCallback(
    async ({ exchange, ticker }) => {
      let updatedOrders = { ...orders },
        askOrders = [],
        bidOrders = [],
        pendingOrders;
      if (exchange && ticker) {
        pendingOrders = await storeCtx.getOuterPendingOrders({
          instId: ticker,
          exchange,
        });
        if (!updatedOrders[exchange]) updatedOrders[exchange] = {};
        if (!updatedOrders[exchange][ticker])
          updatedOrders[exchange][ticker] = {
            orders: [],
            pages: 1,
          };
        let onlyInNewOrders = onlyInLeft(
          pendingOrders,
          updatedOrders[exchange][ticker].orders
        );
        updatedOrders[exchange][ticker].orders =
          updatedOrders[exchange][ticker].orders.concat(onlyInNewOrders);
        for (let o of updatedOrders[exchange][ticker].orders) {
          if (o.side === "buy") bidOrders = [...bidOrders, o];
          else askOrders = [...askOrders, o];
        }
        askOrders.sort((a, b) => a.price - b.price);
        bidOrders.sort((a, b) => b.price - a.price);
        updatedOrders[exchange][ticker].orders = bidOrders.concat(askOrders);
        let // newPage = 1,
          pages = Math.ceil(
            updatedOrders[exchange][ticker].orders.length / limit
          );
        pages = pages > 0 ? pages : 1;
        updatedOrders[exchange][ticker].pages = pages;
        // console.log(
        //   `updatedOrders[exchange][ticker]`,
        //   updatedOrders[exchange][ticker]
        // );
        // console.log(`pages`, pages);
        // updatePage(newPage, pages);
        setOrders(updatedOrders);
      }
      return updatedOrders;
    },
    [limit, orders, storeCtx]
  );

  const filterHandler = useCallback(
    async ({ updateOrders, newPage, updateTicker, keyword, option }) => {
      let _option = option || filterOption,
        _page = newPage || page,
        _keyword = keyword === undefined ? filterKey : keyword,
        _orders = updateOrders || orders,
        _ticker = updateTicker || filterTicker,
        filteredOrders;
      // console.log(`filterHandler _orders`, orders)
      filteredOrders =
        _orders &&
        _orders[filterExchange] &&
        _orders[filterExchange][_ticker] &&
        _orders[filterExchange][_ticker].orders
          ? _orders[filterExchange][_ticker].orders
              // .slice((_page - 1) * limit, _page * limit)
              .filter((order) => {
                let condition =
                  order.id.includes(_keyword) ||
                  order.memberId.includes(_keyword) ||
                  order.instId.includes(_keyword) ||
                  order.email === null ||
                  order.email?.includes(_keyword) ||
                  order.exchange.includes(_keyword);
                if (_option !== "all")
                  condition = condition && order.side === _option;
                return condition;
              })
          : [];
      let pages = Math.ceil(filteredOrders.length / limit);
      pages = pages > 0 ? pages : 1;
      if (_page > pages) _page = 1;
      updatePage(_page, pages);
      setFilterOrders(filteredOrders.slice((_page - 1) * limit, _page * limit));
    },
    [
      filterExchange,
      filterKey,
      filterOption,
      filterTicker,
      limit,
      orders,
      page,
      updatePage,
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

  const selectTickerHandler = useCallback(
    async (ticker) => {
      setIsLoading(true);
      setFilterTicker(ticker);
      const orders = await getCurrentOrders({
        exchange: filterExchange,
        ticker,
      });
      filterHandler({ updateOrders: orders, newPage: 1, updateTicker: ticker });
      setIsLoading(false);
    },
    [filterExchange, filterHandler, getCurrentOrders]
  );

  const switchPageHandler = useCallback(
    async (newPage) => {
      updatePage(newPage);
      setIsLoading(true);
      filterHandler({ newPage });
      setIsLoading(false);
    },
    [filterHandler, updatePage]
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
      setFilterOption(option);
      filterHandler({ option, newPage: 1 });
    },
    [filterHandler]
  );

  const inputHandler = useCallback(
    (e) => {
      setFilterKey(e.target.value);
      filterHandler({ keyword: e.target.value, newPage: 1 });
    },
    [filterHandler]
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
            });
            filterHandler({ updateOrders: orders, newPage: 1 });
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
      filterHandler,
      filterTicker,
      getCurrentOrders,
      storeCtx,
      t,
    ]
  );

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        setIsLoading(true);
        // console.log(`call getCurrentOrders`);
        const orders = await getCurrentOrders({
          exchange: exchanges[0],
          ticker: filterTicker,
        });
        filterHandler({ updateOrders: orders, newPage: 1 });
        setIsLoading(false);
        return !prev;
      } else return prev;
    });
  }, [getCurrentOrders, filterTicker, filterHandler]);

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
          <ScreenDisplayOptions
            title={t("show")}
            options={["all", "buy", "sell"]}
            selectedOption={filterOption}
            selectHandler={displayOptionHandler}
          />
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
              <CurrentOrdersList
                orders={filterOrders}
                forceCancelOrder={forceCancelOrder}
              />
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
