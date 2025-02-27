import React, { useCallback, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import Middleman from "../modal/Middleman";
import StoreContext from "./store-context";
import SafeMath from "../utils/SafeMath";
import Events from "../constant/Events";
import Codes from "../constant/Codes";

let interval,
  depthBookSyncInterval = 500,
  depthBookLastTimeSync = 0,
  tradesSyncInterval = 500,
  tradesLastTimeSync = 0,
  tickersSyncInterval = 500,
  tickersLastTimeSync = 0,
  timer,
  expireTime = 120 * 60 * 1000 * 0.998; // 119.76 mins

const StoreProvider = (props) => {
  const middleman = useMemo(() => new Middleman(), []);
  const { t } = useTranslation();
  const location = useLocation();
  const history = useHistory();
  const { i18n } = useTranslation();
  const [isInit, setIsInit] = useState(null);
  const [defaultMarket, setDefaultMarket] = useState("btcusdt");
  const [disableTrade, setDisableTrade] = useState(false);
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
  const [baseCurrency, setBaseCurrency] = useState("hkd");
  const [registerTickers, setRgisterTickers] = useState(["btcusdt", "ethusdt"]);
  /**
   * [deprecated] 2022/10/28
   */
  const [exchangeRates, setExchangeRates] = useState(null);
  const [tokenExpired, setTokenExpired] = useState(null);

  const changeLanguage = useCallback(
    (key) => {
      // await window.cookieStore.set("lang", key);
      // document.cookie = `lang=${key}`;
      setLanguageKey(key);
      i18n.changeLanguage(key);
    },
    [i18n]
  );

  const countDown = useCallback(() => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      setTokenExpired(true);
      await middleman.logout();
      setIsLogin(middleman.isLogin);
    }, expireTime);
  }, [middleman]);

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
    if (ticker) {
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
    } else {
      console.error(`setPrecision before ticker eixit`);
    }
  };

  const selectMarket = useCallback(
    async (market) => {
      if (!selectedTicker || market !== selectedTicker?.market) {
        history.push({
          pathname: `/markets/${market}`,
        });
        setMarket(market);
        await middleman.selectMarket(market);
        const ticker = middleman.getCurrentTicker();
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

  const getPrice = (currency) => {
    return middleman.getPrice(currency);
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

  const getOuterTradesProfits = useCallback(
    async ({ exchange, ticker, start, end }) => {
      let outerTrades;
      try {
        outerTrades = await middleman.getOuterTradesProfits({
          exchange,
          ticker,
          start,
          end,
        });
      } catch (error) {
        console.log(error);
      }
      return outerTrades;
    },
    [middleman]
  );

  const getOuterTradeFills = useCallback(
    async ({ exchange, instId, start, end, limit, offset }) => {
      let outerTrades;
      try {
        outerTrades = await middleman.getOuterTradeFills({
          exchange,
          instId,
          start,
          end,
          limit,
          offset,
        });
      } catch (error) {
        console.log(error);
      }
      return outerTrades;
    },
    [middleman]
  );

  const getOuterPendingOrders = useCallback(
    async ({ instId, exchange, limit, before, after }) => {
      let pendingOrders;
      try {
        pendingOrders = await middleman.getOuterPendingOrders({
          instId,
          exchange,
          limit,
          before,
          after,
        });
      } catch (error) {
        console.log(error);
      }
      return pendingOrders;
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
        await middleman.postOrder(_order);
        enqueueSnackbar(
          `${order.kind === "bid" ? "Bid" : "Ask"} ${order.volume} ${
            order.instId.split("-")[0]
          } with ${order.kind === "bid" ? "with" : "for"} ${SafeMath.mult(
            order.price,
            order.volume
          )} ${order.instId.split("-")[1]}`,
          { variant: "success", action }
        );
        return true;
      } catch (error) {
        if (error.code !== Codes.USER_IS_LOGOUT) {
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
        } else {
          setDisableTrade(true);
        }
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

  const forceCancelOrder = useCallback(
    async (order) => {
      return await middleman.forceCancelOrder(order);
    },
    [middleman]
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
          if (metaData.data?.isLogin === false) {
            middleman.isLogin = false;
            setIsLogin(middleman.isLogin);
          }
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
          // console.log(`Events.order: data`, metaData.data);
          middleman.orderBook.updateByDifference(
            metaData.data.market,
            metaData.data.difference
          );
          const orders = middleman.getMyOrdersSnapshot();
          // console.log(`Events.order pendingOrders`, orders.pendingOrders);
          setPendingOrders(orders.pendingOrders);
          // console.log(`Events.order closedOrders`, orders.closedOrders);
          setCloseOrders(orders.closedOrders);
          break;
        case Events.tickers:
          middleman.tickerBook.updateByDifference(metaData.data);
          let ticker = middleman.getCurrentTicker();
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
        case Events.publicTrades:
          // console.log(`metaData`, metaData);
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

  const updateBaseCurrency = (baseCurrency) => {
    middleman.setBaseCurrency(baseCurrency);
    setBaseCurrency(baseCurrency);
  };

  /**
   * [deprecated] 2022/10/28
   */
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

  const initLanguage = useCallback(() => {
    const lang = (
      document.cookie
        .split(";")
        .filter((v) => /lang/.test(v))
        .pop()
        ?.split("=")[1] || navigator.language
    ).toLowerCase();
    switch (lang.toLowerCase()) {
      case "en":
      case "en-us":
      case "en_us":
        setLanguageKey("en-US");
        break;
      case "zh-hk":
      case "zh_hk":
      case "zh_tw":
      case "zh-tw":
        setLanguageKey("zh-HK");
        break;
      case "zh_cn":
      case "zh-cn":
        setLanguageKey("zh-CN");
        break;
      // case "jp":
      //   setLanguageKey("jp");
      //   break;
      default:
        setLanguageKey("en-US");
        break;
    }
  }, []);

  const init = useCallback(async () => {
    // console.log(`storeCtx init`);
    initLanguage();
    await middleman.initWs();
    eventListener();
    await middleman.getTickers();
    setTickers(middleman.getTickersSnapshot());
    if (middleman.isLogin) {
      await middleman.getAccounts();
      setIsLogin(middleman.isLogin);
      setAccounts(middleman.getAccountsSnapshot());
      setMemberEmail(middleman.email);
      countDown();
    }
    setIsInit(true);
    // console.log(`storeCtx init end`);
  }, [initLanguage, middleman, eventListener, countDown]);

  const start = useCallback(async () => {
    let market =
      document.cookie
        .split(";")
        .filter((v) => /market_id/.test(v))
        .pop()
        ?.split("=")[1] || location.pathname?.includes("/markets/")
        ? location.pathname?.replace("/markets/", "")
        : "btcusdt";
    if (!location.pathname?.includes("/markets/"))
      history.push({
        pathname: `/markets/${market}`,
      });
    middleman.tickerBook.setCurrentMarket(market);
    setMarket(market);
    setSelectedTicker(middleman.getCurrentTicker());
    setPrecision(middleman.getCurrentTicker());
    if (!isLogin) {
      await middleman.getAccounts();
      setIsLogin(middleman.isLogin);
      if (middleman.isLogin) {
        setAccounts(middleman.getAccountsSnapshot());
        setMemberEmail(middleman.email);
        countDown();
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
    // console.log(`storeCtx start end`);
  }, [countDown, history, isLogin, location.pathname, middleman]);

  const stop = useCallback(() => {
    console.log(`stop`);
    clearInterval(interval);
  }, []);

  const getTicker = (market) => {
    return middleman.getTickerSnapshot(market);
  };

  const registerMarket = async (market) => {
    return await middleman.registerMarket(market);
  };

  const getTradesSnapshot = (market, length, asc) => {
    return middleman.getTradesSnapshot(market, length, asc);
  };

  const getMembers = async ({ email, offset, limit }) => {
    return await middleman.getMembers({ email, offset, limit });
  };

  const auditorMemberAccounts = async ({ memberId, currency }) => {
    return await middleman.auditorMemberAccounts({ memberId, currency });
  };

  const auditorMemberBehavior = async ({ memberId, currency, start, end }) => {
    return await middleman.auditorMemberBehavior({
      memberId,
      currency,
      start,
      end,
    });
  };

  const fixAccountHandler = async (accountId) => {
    return await middleman.fixAccountHandler(accountId);
  };

  return (
    <StoreContext.Provider
      value={{
        defaultMarket,
        isInit,
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
        baseCurrency,
        depthChartData,
        registerTickers,
        /**
         * [deprecated] 2022/10/28
         */
        // exchangeRates,
        getPrice,
        disableTrade,
        tokenExpired,
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
        getOuterTradesProfits,
        getOuterTradeFills,
        getOuterPendingOrders,
        setFocusEl,
        changeRange,
        updateBaseCurrency,
        getAdminUser,
        getAdminUsers,
        addAdminUser,
        deleteAdminUser,
        updateAdminUser,
        // getExchangeRates,
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
        forceCancelOrder,
        getTicker,
        changeLanguage,
        registerMarket,
        getTradesSnapshot,
        getMembers,
        auditorMemberAccounts,
        auditorMemberBehavior,
        fixAccountHandler,
      }}
    >
      {props.children}
    </StoreContext.Provider>
  );
};

export default StoreProvider;
