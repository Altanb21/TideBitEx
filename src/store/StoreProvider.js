import React, { useCallback, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useSnackbar } from "notistack";
import Middleman from "../modal/Middleman";
import StoreContext from "./store-context";
import SafeMath from "../utils/SafeMath";
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
  const [defaultMarket, setDefaultMarket] = useState("btcusdt");
  const [market, setMarket] = useState(null);
  const [isLogin, setIsLogin] = useState(null);
  const [memberEmail, setMemberEmail] = useState(false);
  const [tickers, setTickers] = useState([]);
  const [books, setBooks] = useState(null);
  const [depthChartData, setDepthChartData] = useState(null);
  const [trades, setTrades] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [closeOrders, setCloseOrders] = useState([]);
  const [accounts, setAccounts] = useState(null);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [tickSz, setTickSz] = useState(null);
  const [lotSz, setLotSz] = useState(null);
  const [activePage, setActivePage] = useState("market");
  const [depthBook, setDepthbook] = useState(null);
  const [languageKey, setLanguageKey] = useState(null);
  const [focusEl, setFocusEl] = useState(null);
  const [fiatCurrency, setFiatCurrency] = useState("usd");
  const [exchangeRates, setExchangeRates] = useState(null);

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
  };

  const selectMarket = useCallback(
    async (market) => {
      if (!selectedTicker || market !== selectedTicker?.market) {
        history.push({
          pathname: `/markets/${market}`,
        });
        setMarket(market);
        await middleman.selectMarket(market);
        const ticker = middleman.getTickerSnapshot();
        setSelectedTicker(ticker);
        setPrecision(ticker);
        setTrades(middleman.getTradesSnapshot(market));
        setBooks(middleman.getDepthBooksSnapshot(market));
        const orders = middleman.getMyOrdersSnapshot(market);
        setPendingOrders(orders.pendingOrders);
        setCloseOrders(orders.closedOrders);
      }
    },
    [selectedTicker, history, middleman]
  );

  /**
   * [deprecated] 2022/10/14
   */
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

  const getAdminUser = async () => {
    return await middleman.getAdminUser();
  };

  const getAdminUsers = async () => {
    return await middleman.getAdminUsers();
  };

  const addAdminUser = async (newUser) => {
    return await middleman.addAdminUser(newUser);
  };
  const deleteAdminUser = async (user) => {
    return await middleman.deleteAdminUser(user);
  };
  const updateAdminUser = async (updateUser) => {
    return await middleman.updateAdminUser(updateUser);
  };

  const getCoinsSettings = async () => {
    return await middleman.getCoinsSettings();
  };

  const updateCoinsSettings = async (visible) => {
    return await middleman.updateCoinsSettings(visible);
  };
  const updateCoinSetting = async (id, visible) => {
    return await middleman.updateCoinSetting(id, visible);
  };

  const updateDepositSetting = async (id, type, data) => {
    return await middleman.updateDepositSetting(id, type, data);
  };

  const updateWithdrawSetting = async (id, type, data) => {
    return await middleman.updateWithdrawSetting(id, type, data);
  };

  const getTickersSettings = async () => {
    return await middleman.getTickersSettings();
  };

  const getPlatformAssets = async () => {
    return await middleman.getPlatformAssets();
  };

  const updatePlatformAsset = async (id, data) => {
    return await middleman.updatePlatformAsset(id, data);
  };

  const updateTickerSetting = async (id, type, data) => {
    return await middleman.updateTickerSetting(id, type, data);
  };

  const getDashboardData = async () => {
    return await middleman.getDashboardData();
  };

  /**
   * [deprecated] 2022/10/14
   */
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
    async (exchange, start, end) => {
      let exAccounts = {};
      try {
        exAccounts = await middleman.getOuterTradeFills(exchange, start, end);
      } catch (error) {
        console.log(error);
      }
      return exAccounts;
    },
    [middleman]
  );

  const getOuterPendingOrders = useCallback(
    async (exchange, limit, offset) => {
      let exAccounts = {};
      try {
        exAccounts = await middleman.getOuterPendingOrders(
          exchange,
          limit,
          offset
        );
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
    [action, enqueueSnackbar, middleman]
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
    async (id, type) => {
      const _options = {
        type,
        id,
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

  const eventListener = useCallback(() => {
    middleman.tbWebSocket.onmessage = (msg) => {
      let metaData = JSON.parse(msg.data);
      // console.log(metaData);
      const time = Date.now();
      switch (metaData.type) {
        case Events.userStatusUpdate:
          if (metaData.data?.isLogin === false) middleman.isLogin = false;
          setIsLogin(middleman.isLogin);
          break;
        case Events.account:
          middleman.accountBook.updateByDifference(metaData.data);
          const accounts = middleman.getAccountsSnapshot();
          setAccounts(accounts);
          break;
        case Events.update:
          middleman.depthBook.updateAll(metaData.data.market, metaData.data);
          if (time - depthBookLastTimeSync > depthBookSyncInterval) {
            const books = middleman.getDepthBooksSnapshot(market);
            setBooks(books);
            setDepthChartData(middleman.getDepthChartData(books));
            depthBookLastTimeSync = time;
          }
          break;
        case Events.order:
          middleman.orderBook.updateByDifference(
            metaData.data.market,
            metaData.data.difference
          );
          const orders = middleman.getMyOrdersSnapshot();
          setPendingOrders(orders.pendingOrders);
          setCloseOrders(orders.closedOrders);
          break;
        case Events.tickers:
          middleman.tickerBook.updateByDifference(metaData.data);
          let ticker = middleman.getTickerSnapshot();
          if (ticker) setPrecision(ticker);
          // if (time - tickersLastTimeSync > tickersSyncInterval) {
          setSelectedTicker(ticker);
          setTickers(middleman.getTickersSnapshot());
          tickersLastTimeSync = time;
          // }
          break;
        case Events.trades:
          middleman.tradeBook.updateAll(
            metaData.data.market,
            metaData.data.trades
          );
          // if (time - tradesLastTimeSync > tradesSyncInterval) {
          setTrades(middleman.getTradesSnapshot());
          tradesLastTimeSync = time;
          // }
          break;
        case Events.trade:
          middleman.tradeBook.updateByDifference(
            metaData.data.market,
            metaData.data.difference
          );
          setTrades(middleman.getTradesSnapshot());
          break;
        default:
      }
    };
  }, [market, middleman]);

  const updateFiatCurrency = (fiatCurrency) => {
    middleman.setFiatCurrency(fiatCurrency);
    setFiatCurrency(fiatCurrency);
  };

  const getExchangeRates = useCallback(async () => {
    let _exchangeRates = exchangeRates;
    if (!_exchangeRates) {
      try {
        _exchangeRates = await middleman.getExchangeRates();
        setExchangeRates(_exchangeRates);
      } catch (error) {
        console.error(`getExchangeRates`, error);
      }
    }
    return _exchangeRates;
  }, [exchangeRates, middleman]);

  const init = useCallback(async () => {
    // console.log(`storeCtx init`);
    await middleman.initWs();
    eventListener();
    await middleman.getTickers();
    setTickers(middleman.getTickersSnapshot());
    if (middleman.isLogin) {
      await middleman.getAccounts();
      setIsLogin(middleman.isLogin);
      setAccounts(middleman.getAccountsSnapshot());
      setMemberEmail(middleman.email);
    }
    // console.log(`storeCtx init end`);
  }, [eventListener, middleman]);

  const start = useCallback(async () => {
    let market =
      document.cookie
        .split(";")
        .filter((v) => /market_id/.test(v))
        .pop()
        ?.split("=")[1] || location.pathname?.includes("/markets/")
        ? location.pathname?.replace("/markets/", "")
        : "";
    if (market) {
      middleman.tickerBook.setCurrentMarket(market);
      setMarket(market);
      setSelectedTicker(middleman.getTickerSnapshot());
      setPrecision(middleman.getTickerSnapshot());
      if (!isLogin) {
        await middleman.getAccounts();
        setIsLogin(middleman.isLogin);
        if (middleman.isLogin) {
          setAccounts(middleman.getAccountsSnapshot());
          setMemberEmail(middleman.email);
        }
      }
      await middleman.selectMarket(market);
      // console.log(
      //   `middleman.getDepthBooksSnapshot(${market})`,
      //   middleman.getDepthBooksSnapshot(market)
      // );
      setBooks(middleman.getDepthBooksSnapshot(market));
      // console.log(
      //   `middleman.getTradesSnapshot(${market})`,
      //   middleman.getTradesSnapshot(market)
      // );
      setTrades(middleman.getTradesSnapshot(market));
      if (middleman.isLogin) {
        // console.log(
        //   `middleman.getMyOrdersSnapshot(${market})`,
        //   middleman.getMyOrdersSnapshot(market)
        // );
        const orders = middleman.getMyOrdersSnapshot(market);
        setPendingOrders(orders.pendingOrders);
        setCloseOrders(orders.closedOrders);
      }
    }
    // console.log(`storeCtx start end`);
  }, [isLogin, location.pathname, middleman]);

  const stop = useCallback(() => {
    console.log(`stop`);
    clearInterval(interval);
  }, []);

  return (
    <StoreContext.Provider
      value={{
        defaultMarket,
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
        fiatCurrency,
        depthChartData,
        exchangeRates,
        setIsLogin,
        // sync,
        init,
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
        updateFiatCurrency,
        getAdminUser,
        getAdminUsers,
        addAdminUser,
        deleteAdminUser,
        updateAdminUser,
        getExchangeRates,
        getTickersSettings,
        getCoinsSettings,
        updateCoinSetting,
        updateCoinsSettings,
        updateDepositSetting,
        updateWithdrawSetting,
        updateTickerSetting,
        getPlatformAssets,
        updatePlatformAsset,
        getDashboardData,
      }}
    >
      {props.children}
    </StoreContext.Provider>
  );
};

export default StoreProvider;
