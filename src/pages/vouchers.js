import React, { useState, useEffect, useCallback, useContext } from "react";
import StoreContext from "../store/store-context";
import TableDropdown from "../components/TableDropdown";
import { convertExponentialToDecimal, dateFormatter } from "../utils/Utils";
import { useTranslation } from "react-i18next";
import SafeMath from "../utils/SafeMath";

const exchanges = ["OKEx"];

export const TableHeader = (props) => {
  const [ascending, setAscending] = useState(null);
  return (
    <li className="screen__table-header">
      <span className="screen__table-header--text">{props.label}</span>
      <span
        className={`screen__table-header--btns${
          ascending === true
            ? " ascending"
            : ascending === false
            ? " descending"
            : ""
        }`}
      >
        <span
          className="screen__table-header--btn screen__table-header--btn-up"
          onClick={() => {
            setAscending(true);
            console.log(`props.sorting(true)`,props.sorting(true))
            props.onClick(true);
          }}
        ></span>
        <span
          className="screen__table-header--btn screen__table-header--btn-down"
          onClick={() => {
            setAscending(false);
            props.onClick(false);
          }}
        ></span>
      </span>
    </li>
  );
};

const Vouchers = () => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);
  const [isInit, setIsInit] = useState(null);
  const [trades, setTrades] = useState(null);
  const [profits, setProfits] = useState(null);
  const [filterTrades, setFilterTrades] = useState(null);
  const [filterOption, setFilterOption] = useState("30"); //'30','365'
  const [filterKey, setFilterKey] = useState("");
  const [filterExchange, setFilterExchange] = useState(exchanges[0]);
  const [tickers, setTickers] = useState(null);
  const [filterTicker, setFilterTicker] = useState(null);

  const getVouchers = useCallback(
    async (exchange) => {
      const trades = await storeCtx.getOuterTradeFills(exchange, filterOption);
      setTrades((prev) => {
        let _trades = { ...prev };
        _trades[exchange] = trades;
        return _trades;
      });
      let tickers = {},
        ticker;
      for (let trade of trades) {
        if (!tickers[trade.instId]) tickers[trade.instId] = trade.instId;
      }
      setTickers(tickers);
      if (Object.values(tickers).length > 0) {
        ticker = Object.values(tickers)[0];
        setFilterTicker(ticker);
      }
      return { trades, tickers, ticker: ticker };
    },
    [filterOption, storeCtx]
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
        res;
      if (ticker) setFilterTicker(ticker);
      if (timeInterval) setFilterOption(timeInterval);
      if (exchange) {
        setFilterExchange(exchange);
        if (trades[exchange]) _trades = trades[exchange];
        else {
          res = await getVouchers(exchange);
          _trades = res.trades;
          _ticker = res.ticker;
        }
      }
      if (_trades) {
        _trades = _trades.filter((trade) => {
          let condition =
            (trade.orderId?.includes(_keyword) ||
              trade.instId?.includes(_keyword) ||
              trade.email?.includes(_keyword) ||
              trade.memberId?.includes(_keyword) ||
              trade.exchange?.includes(_keyword)) &&
            ts - trade.ts < _timeInterval;
          if (_exchange !== "ALL")
            condition = condition && trade.exchange === _exchange;
          if (_ticker) condition = condition && trade.instId === _ticker;
          return condition;
        });
        setFilterTrades(_trades);
        let profits = _trades.reduce((prev, trade) => {
          if (trade.revenue) {
            if (!prev[trade.feeCcy]) {
              prev[trade.feeCcy] = {
                sum: 0,
                currency: trade.feeCcy,
              };
            }
            prev[trade.feeCcy].sum = SafeMath.plus(
              prev[trade.feeCcy].sum,
              trade.revenue
            );
          }
          return prev;
        }, {});
        setProfits(profits);
      }
    },
    [filterExchange, filterKey, filterTicker, getVouchers, trades]
  );

  const sorting = (key, ascending) => {
    console.log(`key`, key);
    console.log(`ascending`, ascending);
    setFilterTrades((prevTrades) => {
      console.log(`prevTrades`, prevTrades);
      return ascending
        ? prevTrades?.sort((a, b) => {
          console.log(`a[${key}]`, a[key])
            return a[key] - b[key];
          })
        : prevTrades?.sort((a, b) => b[key] - a[key]);
    });
  };

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        const res = await getVouchers(exchanges[0]);
        filter({ filterTrades: res.trades, ticker: res.ticker });
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
          selectHandler={(ticker) => {
            filter({ ticker });
          }}
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
                filterOption === "30" ? " active" : ""
              }`}
              onClick={() => filter({ timeInterval: "30" })}
            >
              {t("recent-month")}
            </li>
            <li
              className={`screen__display-option${
                filterOption === "365" ? " active" : ""
              }`}
              onClick={() => filter({ timeInterval: "365" })}
            >
              {t("recent-year")}
            </li>
          </ul>
        </div>
        {/* <div className="screen__sorting" onClick={sorting}>
          <img src="/img/sorting@2x.png" alt="sorting" />
        </div> */}
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
          {/* <li className="screen__table-header">{t("date")}</li> */}
          <TableHeader
            label={t("date")}
            onClick={(ascending) => sorting("ts", ascending)}
          />
          <li className="screen__table-header">{t("memberId_email")}</li>
          {/* <li className="screen__table-header">{t("orderId")}</li> */}
          <TableHeader
            label={t("orderId")}
            onClick={(ascending) => sorting("orderId", ascending)}
          />
          {/* <li className="screen__table-header">{t("ticker")}</li> */}
          {/* <TableDropdown
            className="screen__table-header"
            selectHandler={(option) => filter({ ticker: option })}
            options={Object.values(tickers)}
            selected={filterTicker}
          /> */}
          <li className="screen__table-header">
            <div className="screen__table-header--text">{t("exchange")}</div>
            <div className="screen__table-header--switch"></div>
          </li>
          {/* <li className="screen__table-header">{t("transaction-side")}</li> */}
          {/* <li className="screen__table-header">{t("transaction-price")}</li> */}
          <TableHeader
            label={t("transaction-price")}
            onClick={(ascending) => sorting("price", ascending)}
          />
          {/* <li className="screen__table-header">{t("transaction-amount")}</li> */}
          <TableHeader
            label={t("transaction-amount")}
            onClick={(ascending) => sorting("amount", ascending)}
          />
          {/* <li className="screen__table-header">{t("match-fee")}</li> */}
          <TableHeader
            label={t("match-fee")}
            onClick={(ascending) => sorting("fee", ascending)}
          />
          {/* <li className="screen__table-header">{t("external-fee")}</li> */}
          <TableHeader
            label={t("external-fee")}
            onClick={(ascending) => sorting("fee", ascending)}
          />
          {/* <li className="screen__table-header">{t("referral")}</li> */}
          {/* <TableHeader
            label={t("referral")}
            onClick={(ascending) => sorting("referral", ascending)}
          /> */}
          {/* <li className="screen__table-header">{t("revenue")}</li> */}
          <TableHeader
            label={t("revenue")}
            onClick={(ascending) => sorting("revenue", ascending)}
          />
        </ul>
        <ul className="screen__table-rows">
          {filterTrades &&
            filterTrades.map((trade, i) => (
              <div
                className={`vouchers__tile screen__table-row${
                  trade.email ? "" : " unknown"
                }`}
                key={`${i}-${trade.orderId}`}
              >
                <div className="vouchers__text screen__table-item">
                  {dateFormatter(trade.ts).text}
                </div>
                <div className="vouchers__text screen__table-item">
                  <div>{`${trade.email ? trade.email + "/" : "Unknown"}`}</div>
                  <div>{`${trade.email ? trade.memberId : ""}`}</div>
                </div>
                <div className="vouchers__text screen__table-item">
                  {trade.orderId}
                </div>
                {/* <div className="vouchers__text screen__table-item">
                  {trade.instId}
                </div> */}
                <div className="vouchers__text screen__table-item">
                  {trade.exchange}
                </div>
                <div
                  className={`vouchers__text screen__table-item${
                    trade.side === "buy" ? " positive" : " negative"
                  }`}
                >
                  {`${trade.px} / ${trade.fillPx}` || "--"}
                </div>
                <div
                  className={`vouchers__text screen__table-item${
                    trade.side === "buy" ? " positive" : " negative"
                  }`}
                >
                  {trade.fillSz || "--"}
                </div>
                <div className={`vouchers__text screen__table-item`}>
                  {trade.fee
                    ? `${convertExponentialToDecimal(trade.fee)} ${
                        trade.feeCcy
                      }`
                    : "Unknown"}
                </div>
                <div className={`vouchers__text screen__table-item}`}>
                  {trade.externalFee
                    ? `${convertExponentialToDecimal(trade.externalFee)} ${
                        trade.feeCcy
                      }`
                    : "--"}
                </div>
                {/* <div
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
                </div> */}
                <div
                  className={`vouchers__text screen__table-item${
                    trade.revenue
                      ? trade.revenue > 0
                        ? " "
                        : " negative negative--em"
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
