import React, { useCallback, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useSnackbar } from "notistack";
import Middleman from "../modal/Middleman";
import StoreContext from "./store-context";
import SafeMath from "../utils/SafeMath";
import { wait } from "../utils/Utils";
import Events from "../constant/Events";

let interval,
  depthBookSyncInterval = 500,
  depthBookLastTimeSync = 0,
  tradesSyncInterval = 500,
  tradesLastTimeSync = 0,
  tickersSyncInterval = 500,
  tickersLastTimeSync = 0;

const StoreProvider = (props) => {
  const middleman = useMemo(() => new Middleman(), []);
  const location = useLocation();
  const history = useHistory();
  const [isLogin, setIsLogin] = useState(false);
  const [memberId, setMemberId] = useState(false);
  const [memberEmail, setMemberEmail] = useState(false);
  const [tickers, setTickers] = useState([]);
  const [books, setBooks] = useState(null);
  const [trades, setTrades] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [closeOrders, setCloseOrders] = useState([]);
  // const [orderHistories, setOrderHistories] = useState([]);
  const [accounts, setAccounts] = useState(null);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [tickSz, setTickSz] = useState(null);
  const [lotSz, setLotSz] = useState(null);
  const [activePage, setActivePage] = useState("market");
  const [depthBook, setDepthbook] = useState(null);
  const [languageKey, setLanguageKey] = useState(null);
  const [focusEl, setFocusEl] = useState(null);

  const action = useCallback(
    (key) => (
      <React.Fragment>
        <div
          onClick={() => {
            closeSnackbar(key);
          }}
        >
          Dismiss
        </div>
      </React.Fragment>
    ),
    [closeSnackbar]
  );

  const setPrecision = (ticker) => {
    const tickSz =
      ticker.tickSz?.split(".").length > 1
        ? ticker.tickSz?.split(".")[1].length
        : 0;
    const lotSz =
      ticker.lotSz?.split(".").length > 1
        ? ticker.lotSz?.split(".")[1].length
        : 0;
    setTickSz(tickSz);
    setLotSz(lotSz);
    // console.log(`selectMarket ticker`, ticker);
    // console.log(`selectMarket tickSz`, tickSz);
    // console.log(`selectMarket lotSz`, lotSz);
  };

  const selectMarket = useCallback(
    async (market) => {
      // console.log(`selectedTicker`, selectedTicker, !selectedTicker);
      // console.log(`ticker`, ticker, ticker.market !== selectedTicker?.market);
      if (!selectedTicker || market !== selectedTicker?.market) {
        history.push({
          pathname: `/markets/${market}`,
        });
        await middleman.selectMarket(market);
        const ticker = middleman.getTicker();
        setSelectedTicker(ticker);
        setPrecision(ticker);
        setTrades(middleman.getTrades());
        setBooks(middleman.getDepthBooks());
        const orders = middleman.getMyOrders();
        setPendingOrders(orders.pendingOrders);
        setCloseOrders(orders.closedOrders);
      }
      // console.log(`****^^^^**** selectTickerHandler [END] ****^^^^****`);
    },
    [selectedTicker, history, middleman]
  );

  const getExAccounts = useCallback(
    async (exchange) => {
      let exAccounts = {};
      try {
        exAccounts = await middleman.getExAccounts(exchange);
      } catch (error) {
        console.log(error);
      }
      return exAccounts;
    },
    [middleman]
  );

  const changeRange = (range) => {
    middleman.depthBook.changeRange(range);
  };

  const getUsersAccounts = useCallback(async () => {
    let usersAccounts = {};
    try {
      usersAccounts = await middleman.getUsersAccounts();
    } catch (error) {
      console.log(error);
    }
    return usersAccounts;
  }, [middleman]);

  const getOuterTradeFills = useCallback(
    async (exchange, days) => {
      let exAccounts = {};
      try {
        exAccounts = await middleman.getOuterTradeFills(exchange, days);
      } catch (error) {
        console.log(error);
      }
      return exAccounts;
    },
    [middleman]
  );

  const getOuterPendingOrders = useCallback(
    async (exchange) => {
      let exAccounts = {};
      try {
        exAccounts = await middleman.getOuterPendingOrders(exchange);
      } catch (error) {
        console.log(error);
      }
      return exAccounts;
    },
    [middleman]
  );

  // TODO get latest snapshot of orders, trades, accounts
  const postOrder = useCallback(
    async (order) => {
      const _order = {
        ...order,
      };
      try {
        const result = await middleman.postOrder(_order);
        let amount, updateQuoteAccount, updateBaseAccount;
        if (order.kind === "bid") {
          updateQuoteAccount = { ...accounts[selectedTicker?.quote_unit] };
          amount = SafeMath.mult(order.price, order.volume);
          if (updateQuoteAccount) {
            updateQuoteAccount.balance = SafeMath.minus(
              accounts[selectedTicker?.quote_unit].balance,
              amount
            );
            updateQuoteAccount.locked = SafeMath.plus(
              accounts[selectedTicker?.quote_unit].locked,
              amount
            );
            const updateAccounts = accounts.map((account) => ({ ...account }));
            updateAccounts[selectedTicker?.quote_unit] = updateQuoteAccount;
            middleman.updateAccounts(updateQuoteAccount);
            setAccounts(updateAccounts);
          }
        } else {
          updateBaseAccount = { ...accounts[selectedTicker?.base_unit] };
          amount = order.volume;
          if (updateBaseAccount) {
            updateBaseAccount.balance = SafeMath.minus(
              accounts[selectedTicker?.base_unit].balance,
              amount
            );
            updateBaseAccount.locked = SafeMath.plus(
              accounts[selectedTicker?.base_unit].locked,
              amount
            );
            const updateAccounts = accounts.map((account) => ({ ...account }));
            updateAccounts[selectedTicker?.base_unit] = updateBaseAccount;
            middleman.updateAccounts(updateBaseAccount);
            setAccounts(updateAccounts);
          }
        }
        enqueueSnackbar(
          `${order.kind === "bid" ? "Bid" : "Ask"} ${order.volume} ${
            order.instId.split("-")[0]
          } with ${order.kind === "bid" ? "with" : "for"} ${SafeMath.mult(
            order.price,
            order.volume
          )} ${order.instId.split("-")[1]}`,
          { variant: "success", action }
        );
        return result;
      } catch (error) {
        enqueueSnackbar(
          `${error?.message}. Failed to post order:
           ${order.kind === "buy" ? "Bid" : "Ask"} ${order.volume} ${
            order.instId.split("-")[0]
          } with ${order.kind === "buy" ? "with" : "for"} ${SafeMath.mult(
            order.price,
            order.volume
          )} ${order.instId.split("-")[1]}
          `,
          {
            variant: "error",
            action,
          }
        );
      }
    },
    [
      accounts,
      action,
      enqueueSnackbar,
      middleman,
      selectedTicker?.base_unit,
      selectedTicker?.quote_unit,
    ]
  );

  // TODO get latest snapshot of orders, trades, accounts
  const cancelOrder = useCallback(
    async (order) => {
      const _order = {
        ...order,
        // "X-CSRF-Token": token,
      };
      try {
        const result = await middleman.cancelOrder(_order);
        enqueueSnackbar(
          `You have canceled order id(${order.id}): ${
            order.kind === "bid" ? "Bid" : "Ask"
          } ${order.volume} ${order.instId.split("-")[0]} with ${
            order.kind === "bid" ? "with" : "for"
          } ${SafeMath.mult(order.price, order.volume)} ${
            order.instId.split("-")[1]
          }`,
          { variant: "success", action }
        );
        return result;
      } catch (error) {
        enqueueSnackbar(
          `${error?.message || "Some went wrong"}. Failed to cancel order(${
            order.id
          }): ${order.kind === "bid" ? "Bid" : "Ask"} ${order.volume} ${
            order.instId.split("-")[0]
          } with ${order.kind === "bid" ? "with" : "for"} ${SafeMath.mult(
            order.price,
            order.volume
          )} ${order.instId.split("-")[1]}`,
          {
            variant: "error",
            action,
          }
        );
        return false;
      }
    },
    [action, enqueueSnackbar, middleman]
  );

  // TODO get latest snapshot of orders, trades, accounts
  const cancelOrders = useCallback(
    async (instId, type) => {
      const _options = {
        type,
        instId,
        // "X-CSRF-Token": token,
      };
      try {
        const result = await middleman.cancelOrders(_options);
        enqueueSnackbar(`Your orders have canceled `, {
          variant: "success",
          action,
        });
        return result;
      } catch (error) {
        console.error(`cancelOrders error`, error);
        enqueueSnackbar(
          `${error?.message || "Some went wrong"}. Failed to cancel orders`,
          {
            variant: "error",
            action,
          }
        );
        return false;
      }
    },
    [action, enqueueSnackbar, middleman]
  );

  const activePageHandler = (page) => {
    setActivePage(page);
  };

  const depthBookHandler = useCallback((price, amount) => {
    setDepthbook({ price, amount });
  }, []);

  // ++ TODO1: verify function works properly
  // const sync = useCallback(async () => {
  //   // const startTime = performance.now();
  //   const time = Date.now();
  //   // console.log(`sync time`,time);
  //   // console.time('UniquetLabelName')

  //   if (time - accountTs > accountInterval) {
  //     const accounts = middleman.getAccounts();
  //     // console.log(`middleman.accounts`, accounts);
  //     setIsLogin(middleman.isLogin);
  //     setAccounts(accounts);
  //   }
  //   if (time - tickerTs > tickerInterval) {
  //     let ticker = middleman.getTicker();
  //     if (ticker) setPrecision(ticker);
  //     setSelectedTicker(middleman.getTicker());
  //   }
  //   if (time - depthTs > depthInterval) {
  //     // console.log(`middleman.getDepthBooks()`, middleman.getDepthBooks());
  //     setBooks(middleman.getDepthBooks());
  //   }
  //   if (time - tradeTs > tradeInterval) {
  //     // console.log(`middleman.getTrades()`, middleman.getTrades());
  //     setTrades(middleman.getTrades());
  //   }
  //   if (time - tickersTs > tickersInterval) {
  //     setTickers(middleman.getTickers());
  //   }
  //   // // TODO orderBook is not completed
  //   if (time - orderTs > orderInterval) {
  //     // console.log(`middleman.getMyOrders()`, middleman.getMyOrders());
  //     const orders = middleman.getMyOrders();
  //     setPendingOrders(orders.pendingOrders);
  //     setCloseOrders(orders.closedOrders);
  //   }
  //   // const duration = performance.now() - startTime;
  //   // console.log(`someMethodIThinkMightBeSlow took ${duration}ms`);
  //   // console.timeEnd('UniqueLabelName')
  //   await wait(500);
  //   sync();
  // }, [middleman]);

  const eventListener = useCallback(() => {
    middleman.tbWebSocket.onmessage = (msg) => {
      let metaData = JSON.parse(msg.data);
      // console.log(metaData);
      const time = Date.now();
      switch (metaData.type) {
        case Events.account:
          middleman.accountBook.updateByDifference(metaData.data);
          const accounts = middleman.getAccounts();
          setAccounts(accounts);
          break;
        case Events.update:
          middleman.depthBook.updateAll(metaData.data.market, metaData.data);
          // console.log(
          //   `~~ time[${time}] - depthBookLastTimeSync[${depthBookLastTimeSync}] > depthBookSyncInterval[${depthBookSyncInterval}]`,
          //   time - depthBookLastTimeSync > depthBookSyncInterval
          // );
          if (time - depthBookLastTimeSync > depthBookSyncInterval) {
            // console.log(`sync depthbook`);
            setBooks(middleman.getDepthBooks());
            depthBookLastTimeSync = time;
          }
          break;
        case Events.order:
          middleman.orderBook.updateByDifference(
            metaData.data.market,
            metaData.data.difference
          );
          const orders = middleman.getMyOrders();
          setPendingOrders(orders.pendingOrders);
          setCloseOrders(orders.closedOrders);
          break;
        case Events.tickers:
          middleman.tickerBook.updateByDifference(metaData.data);
          let ticker = middleman.getTicker();
          if (ticker) setPrecision(ticker);
          if (time - tickersLastTimeSync > tickersSyncInterval) {
            setSelectedTicker(middleman.getTicker());
            setTickers(middleman.getTickers());
            tickersLastTimeSync = time;
          }
          break;
        case Events.trades:
          middleman.tradeBook.updateAll(
            metaData.data.market,
            metaData.data.trades
          );
          if (time - tradesLastTimeSync > tradesSyncInterval) {
            setTrades(middleman.getTrades());
            tradesLastTimeSync = time;
          }
          break;
        case Events.trade:
          middleman.tradeBook.updateByDifference(
            metaData.data.market,
            metaData.data.difference
          );
          setTrades(middleman.getTrades());
          tradesLastTimeSync = time;
          break;
        default:
      }
    };
  }, [middleman]);

  const sync = useCallback(async () => {
    await middleman.sync();
    setIsLogin(middleman.isLogin);
    setMemberId(middleman.memberId);
    setMemberEmail(middleman.email);
    setAccounts(middleman.getAccounts());
    const orders = middleman.getMyOrders();
    setPendingOrders(orders.pendingOrders);
    setCloseOrders(orders.closedOrders);
    // --- WORKAROUND---
    await wait(1 * 60 * 1000);
    sync();
  }, [middleman]);

  const start = useCallback(async () => {
    if (location.pathname.includes("/markets")) {
      let market;
      market = location.pathname.includes("/markets/")
        ? location.pathname.replace("/markets/", "")
        : "ethhkd";
      history.push({
        pathname: `/markets/${market}`,
      });
      await middleman.start(market);
      eventListener();
      setSelectedTicker(middleman.getTicker());
      setTickers(middleman.getTickers());
      setTrades(middleman.getTrades());
      setBooks(middleman.getDepthBooks());
      setIsLogin(middleman.isLogin);
      setMemberEmail(middleman.email);
      setMemberId(middleman.memberId);
      setAccounts(middleman.getAccounts());
      const orders = middleman.getMyOrders();
      setPendingOrders(orders.pendingOrders);
      setCloseOrders(orders.closedOrders);
      // await sync();
    }
  }, [history, location.pathname, middleman, eventListener]);

  const stop = useCallback(() => {
    console.log(`stop`);
    clearInterval(interval);
  }, []);

  return (
    <StoreContext.Provider
      value={{
        isLogin,
        tickers,
        books,
        trades,
        pendingOrders,
        closeOrders,
        accounts,
        selectedTicker,
        activePage,
        depthBook,
        languageKey,
        focusEl,
        tickSz,
        lotSz,
        memberEmail,
        setIsLogin,
        // sync,
        start,
        stop,
        depthBookHandler,
        setLanguageKey,
        selectMarket,
        postOrder,
        cancelOrder,
        cancelOrders,
        activePageHandler,
        getExAccounts,
        getUsersAccounts,
        getOuterTradeFills,
        getOuterPendingOrders,
        setFocusEl,
        changeRange,
      }}
    >
      {props.children}
    </StoreContext.Provider>
  );
};

export default StoreProvider;
