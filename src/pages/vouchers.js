import React, { useState, useEffect, useCallback, useContext } from "react";
import StoreContext from "../store/store-context";
import TableDropdown from "../components/TableDropdown";
import { convertExponentialToDecimal, dateFormatter } from "../utils/Utils";
import { useTranslation } from "react-i18next";
import SupportedExchange from "../constant/SupportedExchange";
import SafeMath from "../utils/SafeMath";

const exchanges = ["OKEx"];

const Vouchers = () => {
  const storeCtx = useContext(StoreContext);
  const [showMore, setShowMore] = useState(false);
  const [isInit, setIsInit] = useState(null);
  const [trades, setTrades] = useState(null);
  const [profits, setProfits] = useState(null);
  const [filterTrades, setFilterTrades] = useState(null);
  const [filterOption, setFilterOption] = useState("month"); //'month','year'
  const [filterKey, setFilterKey] = useState("");
  const [filterExchange, setFilterExchange] = useState(exchanges[0]);
  const [ascending, setAscending] = useState(false);
  const { t } = useTranslation();
  const [tickers, setTickers] = useState({ ticker: t("ticker") });
  const [filterTicker, setFilterTicker] = useState(t("ticker"));

  const getVouchers = useCallback(
    async (exchange) => {
      const trades = await storeCtx.getOuterTradeFills(exchange);
      setTrades((prev) => {
        let _trades = { ...prev };
        _trades[exchange] = trades;
        return _trades;
      });
      return trades;
    },
    [storeCtx]
  );

  const filter = useCallback(
    async ({ keyword, timeInterval, exchange, filterTrades, ticker }) => {
      let _keyword = keyword === undefined ? filterKey : keyword,
        _exchange = exchange || filterExchange,
        _trades = filterTrades || trades[_exchange],
        ts = Date.now(),
        _timeInterval =
          timeInterval === "month"
            ? 30 * 24 * 60 * 60 * 1000
            : 12 * 30 * 24 * 60 * 60 * 1000,
        _ticker = ticker || filterTicker,
        tickers = { ticker: t("ticker") };
      if (ticker) setFilterTicker(ticker);
      if (timeInterval) setFilterOption(timeInterval);
      if (exchange) {
        setFilterExchange(exchange);
        if (trades[exchange]) _trades = trades[exchange];
        else _trades = await getVouchers(exchange);
      }
      if (_trades) {
        _trades = _trades.filter((trade) => {
          if (!tickers[trade.instId]) tickers[trade.instId] = trade.instId;
          let condition =
            (trade.orderId.includes(_keyword) ||
              trade.instId.includes(_keyword) ||
              trade.email.includes(_keyword) ||
              trade.memberId.includes(_keyword) ||
              trade.exchange.includes(_keyword)) &&
            ts - trade.ts < _timeInterval;
          if (_exchange !== "ALL")
            condition = condition && trade.exchange === _exchange;
          if (_ticker !== t("ticker"))
            condition = condition && trade.instId === ticker;
          return condition;
        });
        console.log(`_trades`,_trades)
        console.log(`ticker`,ticker)
        setFilterTrades(_trades);
        setTickers(tickers);
        // ++ TODO addSum
        let profits = _trades.reduce((prev, trade) => {
          if (trade.fee) {
            if (!prev[trade.feeCcy]) {
              prev[trade.feeCcy] = {
                sum: 0,
                currency: trade.feeCcy,
              };
            }
            prev[trade.feeCcy].sum = SafeMath.plus(
              prev[trade.feeCcy].sum,
              trade.fee
            );
          }
          return prev;
        }, {});
        setProfits(profits);
      }
    },
    [filterExchange, filterKey, filterTicker, getVouchers, t, trades]
  );

  const sorting = () => {
    setAscending((prev) => {
      setFilterTrades((prevTrades) =>
        !prev
          ? prevTrades.sort((a, b) => a.ts - b.ts)
          : prevTrades.sort((a, b) => b.ts - a.ts)
      );
      return !prev;
    });
  };

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        const trades = await getVouchers(exchanges[0]);
        filter({ filterTrades: trades });
        return !prev;
      } else return prev;
    });
  }, [getVouchers, filter]);

  useEffect(() => {
    if (!isInit) {
      init();
    }
  }, [init, isInit]);

  return (
    <section className="screen__section vouchers">
      <div className="screen__header">{t("match-orders")}</div>
      <div className="screen__search-bar">
        <TableDropdown
          className="screen__filter"
          selectHandler={(option) => {
            filter({ exchange: option });
          }}
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
                filterOption === "month" ? " active" : ""
              }`}
              onClick={() => filter({ timeInterval: "month" })}
            >
              {t("recent-month")}
            </li>
            <li
              className={`screen__display-option${
                filterOption === "year" ? " active" : ""
              }`}
              onClick={() => filter({ timeInterval: "year" })}
            >
              {t("recent-year")}
            </li>
          </ul>
        </div>
        <div className="screen__sorting" onClick={sorting}>
          <img src="/img/sorting@2x.png" alt="sorting" />
        </div>
      </div>
      <div className="screen__table--overivew">
        <div className="screen__table-title">{`${t("current-profit")}:`}</div>
        <div className="screen__table--values">
          {profits &&
            Object.values(profits).map((profit) => (
              <div
                className={`screen__table-value${
                  profit?.sum > 0 ? " positive" : " negative"
                }`}
              >{`${convertExponentialToDecimal(profit?.sum) || "--"} ${
                profit?.currency || "--"
              }`}</div>
            ))}
        </div>
      </div>
      <div className={`screen__table${showMore ? " show" : ""}`}>
        <ul className="screen__table-headers">
          <li className="screen__table-header">{t("date")}</li>
          <li className="screen__table-header">{t("memberId_email")}</li>
          <li className="screen__table-header">{t("orderId")}</li>
          {/* <li className="screen__table-header">{t("ticker")}</li> */}
          <TableDropdown
            className="screen__table-header"
            selectHandler={(option) => filter({ ticker: option })}
            options={Object.values(tickers)}
            selected={filterTicker}
          />
          <li className="screen__table-header">{t("exchange")}</li>
          <li className="screen__table-header">{t("transaction-side")}</li>
          <li className="screen__table-header">{t("match-fee")}</li>
          <li className="screen__table-header">{t("external-fee")}</li>
          <li className="screen__table-header">{t("referral")}</li>
          <li className="screen__table-header">{t("revenue")}</li>
        </ul>
        <ul className="screen__table-rows">
          {filterTrades &&
            filterTrades.map((trade) => (
              <div
                className={`vouchers__tile screen__table-row`}
                key={trade.orderId}
              >
                <div className="vouchers__text screen__table-item">
                  {dateFormatter(trade.ts).text}
                </div>
                <div className="vouchers__text screen__table-item">
                  <div>{`${trade.email || "Unknown"}/`}</div>
                  <div>{trade.memberId}</div>
                </div>
                <div className="vouchers__text screen__table-item">
                  {trade.orderId}
                </div>
                <div className="vouchers__text screen__table-item">
                  {trade.instId}
                </div>
                <div className="vouchers__text screen__table-item">
                  {trade.exchange}
                </div>
                <div
                  className={`vouchers__text screen__table-item${
                    trade.side === "buy" ? " positive" : " negative"
                  }`}
                >
                  {t(trade.side)}
                </div>
                <div
                  className={`vouchers__text screen__table-item${
                    trade.fee ? " positive" : ""
                  }`}
                >
                  {trade.fee
                    ? `${convertExponentialToDecimal(trade.fee)} ${
                        trade.feeCcy
                      }`
                    : "Unknown"}
                </div>
                <div
                  className={`vouchers__text screen__table-item${
                    trade.externalFee ? " negative" : ""
                  }`}
                >
                  {trade.externalFee
                    ? `${convertExponentialToDecimal(trade.externalFee)} ${
                        trade.feeCcy
                      }`
                    : "--"}
                </div>
                <div
                  className={`vouchers__text screen__table-item${
                    trade.referral
                      ? trade.referral > 0
                        ? " positive"
                        : " negative"
                      : ""
                  }`}
                >
                  {trade.referral
                    ? `${convertExponentialToDecimal(trade.referral)} ${
                        trade.feeCcy
                      }`
                    : "--"}
                </div>
                <div
                  className={`vouchers__text screen__table-item${
                    trade.revenue
                      ? trade.revenue > 0
                        ? " positive"
                        : " negative"
                      : ""
                  }`}
                >
                  {trade.revenue
                    ? `${convertExponentialToDecimal(trade.revenue)} ${
                        trade.feeCcy
                      }`
                    : "Unknown"}
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

export default Vouchers;
