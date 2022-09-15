import React, { useState, useEffect, useCallback, useContext } from "react";
import StoreContext from "../store/store-context";
import TableDropdown from "../components/TableDropdown";
import { convertExponentialToDecimal, dateFormatter } from "../utils/Utils";
import { useTranslation } from "react-i18next";
import SafeMath from "../utils/SafeMath";
import DatePicker from "../components/DatePicker";
import LoadingDialog from "../components/LoadingDialog";
import ProfitTrendingChart from "../components/ProfitTrendingChart";

const exchanges = ["OKEx"];
const monthInterval = 30 * 24 * 60 * 60 * 1000;

export const TableHeader = (props) => {
  const [ascending, setAscending] = useState(null);
  return (
    <th className="screen__table-header">
      <span
        className="screen__table-header--text"
        onClick={() =>
          setAscending((prev) => {
            props.onClick(!prev);
            return !prev;
          })
        }
      >
        {props.label}
      </span>
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
    </th>
  );
};

let currentDate = new Date();

const Vouchers = () => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);
  const [isInit, setIsInit] = useState(null);
  const [trades, setTrades] = useState(null);
  const [profits, setProfits] = useState(null);
  const [filterTrades, setFilterTrades] = useState(null);
  const [filterOption, setFilterOption] = useState(30); // 30, 365
  const [filterKey, setFilterKey] = useState("");
  const [filterExchange, setFilterExchange] = useState(exchanges[0]);
  const [tickers, setTickers] = useState(null);
  const [filterTicker, setFilterTicker] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [chartData, setChartData] = useState({});
  const [dateStart, setDateStart] = useState(
    new Date(
      `${currentDate.getFullYear()}-${
        currentDate.getMonth() + 1
      }-${currentDate.getDate()} 08:00:00`
    )
  );
  const [dateEnd, setDateEnd] = useState(
    new Date(
      `${currentDate.getFullYear()}-${
        currentDate.getMonth() + 1
      }-${currentDate.getDate()} 08:00:00`
    )
  );

  const getNextDailyBarTime = (barTime) => {
    const date = new Date(barTime);
    date.setDate(date.getDate() + 1);
    return date.getTime();
  };
  const getNextMonthlyBarTime = (barTime) => {
    const date = new Date(barTime);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    let dateLength = new Date(year, month + 1, 0).getDate();
    console.log(`dateLength`, dateLength);
    date.setDate(date.getDate() + dateLength - 1);
    console.log(`date`, date);
    return date.getTime();
  };
  const formateTrades = useCallback((trades) => {
    console.log(`formateTrades trades[${trades.length}]`, trades);
    let chartData = {};
    let _trades = trades.sort((a, b) => a.ts - b.ts); //asce
    let lastDailyBar = new Date(
        `${new Date(_trades[0].ts).toISOString().substring(0, 10)} 00:00:00`
      ),
      nextDailyBarTime = getNextDailyBarTime(lastDailyBar.getTime());
    console.log(
      `formateTrades lastDailyBar`,
      lastDailyBar.toISOString().substring(0, 10)
    );
    console.log(
      `formateTrades nextDailyBarTime${new Date(nextDailyBarTime)
        .toISOString()
        .substring(0, 10)}`,
      nextDailyBarTime
    );
    for (let trade of _trades) {
      if (trade.revenue) {
        console.log(`formateTrades trade`, trade);
        if (trade.ts >= nextDailyBarTime) {
          lastDailyBar = new Date(nextDailyBarTime);
          nextDailyBarTime = getNextDailyBarTime(lastDailyBar.getTime());
        }
        //  else {
        let key = `${lastDailyBar.getFullYear()}-${
          lastDailyBar.getMonth() + 1
        }-${lastDailyBar.getDate()}`;
        console.log(`formateTrades key`, key);
        if (!chartData[key])
          chartData[key] = {
            profits: trade.revenue,
            date: lastDailyBar,
          };
        else
          chartData[key] = {
            ...chartData[key],
            profits: SafeMath.plus(chartData[key].profits, trade.revenue),
          };

        console.log(`formateTrades chartData[key]`, chartData[key]);
        // }
      }
    }
    console.log(`formateTrades chartData`, chartData);
    // if (Object.keys(chartData).length > 24) {
    if (_trades[_trades.length - 1].ts - _trades[0].ts > 3 * monthInterval) {
      chartData = {};
      let lastMonthlyBar = new Date(
          `${new Date(_trades[0].ts).toISOString().substring(0, 10)} 00:00:00`
        ),
        nextMonthlyBarTime = getNextMonthlyBarTime(lastMonthlyBar.getTime());
      console.log(
        `formateTrades lastMonthlyBar`,
        lastMonthlyBar.toISOString().substring(0, 10)
      );
      console.log(
        `formateTrades nextMonthlyBarTime${new Date(nextMonthlyBarTime)
          .toISOString()
          .substring(0, 10)}`,
        nextMonthlyBarTime
      );
      for (let trade of _trades) {
        if (trade.revenue) {
          console.log(
            `formateTrades trade${trade.ts >= nextMonthlyBarTime}`,
            trade
          );
          if (trade.ts >= nextMonthlyBarTime) {
            lastMonthlyBar = new Date(nextMonthlyBarTime);
            nextMonthlyBarTime = getNextDailyBarTime(lastMonthlyBar.getTime());
          }
          //  else {
          let key = `${lastMonthlyBar.getFullYear()}-${
            lastMonthlyBar.getMonth() + 1
          }`;
          console.log(`formateTrades key`, key);
          if (!chartData[key])
            chartData[key] = {
              profits: trade.revenue,
              date: lastMonthlyBar,
            };
          else
            chartData[key] = {
              ...chartData[key],
              profits: SafeMath.plus(chartData[key].profits, trade.revenue),
            };
          // }
          console.log(`formateTrades chartData[${key}}]`, chartData[key]);
        }
      }
    }
    console.log(`formateTrades chartData`, chartData);
    return chartData;
  }, []);

  const getVouchers = useCallback(
    async (exchange, start, end) => {
      // console.log(`getVouchers end`, end);
      // console.log(`getVouchers start`, start);
      // const trades = await storeCtx.getOuterTradeFills(exchange, 365);
      const trades = await storeCtx.getOuterTradeFills(exchange, start, end);
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
      // trade fromate ++ TODO
      const chartData = formateTrades(trades);
      setChartData(chartData);
      return { trades, tickers, ticker: ticker };
    },
    [formateTrades, storeCtx]
  );

  const filter = useCallback(
    async ({ keyword, exchange, filterTrades, ticker }) => {
      let _keyword = keyword === undefined ? filterKey : keyword,
        _exchange = exchange || filterExchange,
        _trades = filterTrades || trades[_exchange],
        _ticker = ticker || filterTicker,
        res;
      if (ticker) setFilterTicker(ticker);
      if (exchange) {
        setFilterExchange(exchange);
        if (trades[exchange]) _trades = trades[exchange];
        else {
          const now = new Date();
          const end = new Date(
            `${now.getFullYear()}-${
              now.getMonth() + 1
            }-${now.getDate()} 08:00:00`
          );
          const startTime = new Date(
            end.getTime() - filterOption * 24 * 60 * 60 * 1000
          );
          const start = new Date(
            `${startTime.getFullYear()}-${
              startTime.getMonth() + 1
            }-${startTime.getDate()} 08:00:00`
          );
          res = await getVouchers(
            exchange,
            start.toISOString().substring(0, 10),
            end.toISOString().substring(0, 10)
          );
          _trades = res.trades;
          _ticker = res.ticker;
        }
      }
      if (_trades) {
        _trades = _trades.filter((trade) => {
          let condition =
            trade.orderId?.includes(_keyword) ||
            trade.instId?.includes(_keyword) ||
            trade.email?.includes(_keyword) ||
            trade.memberId?.includes(_keyword) ||
            trade.exchange?.includes(_keyword);
          // console.log(`timeInterval`, timeInterval);
          // console.log(`filterOption`, filterOption);
          // console.log(
          //   `ts[${ts}] - trade.ts[${trade.ts}] = ${
          //     ts - trade.ts
          //   } < _option[${_option}]`,
          //   ts - trade.ts < _option,
          //   new Date(trade.ts)
          // );
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
    [filterExchange, filterKey, filterOption, filterTicker, getVouchers, trades]
  );

  const updateInterval = useCallback(
    async (option) => {
      setIsLoading(true);
      const now = new Date();
      const end = new Date(
        `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} 08:00:00`
      );
      const startTime = new Date(end.getTime() - option * 24 * 60 * 60 * 1000);
      const start = new Date(
        `${startTime.getFullYear()}-${
          startTime.getMonth() + 1
        }-${startTime.getDate()} 08:00:00`
      );
      const res = await getVouchers(
        exchanges[0],
        start.toISOString().substring(0, 10),
        end.toISOString().substring(0, 10)
      );
      filter({ filterTrades: res.trades, ticker: res.ticker });
      setFilterOption(option);
      setIsLoading(false);
    },
    [filter, getVouchers]
  );

  const dateStartUpdateHandler = useCallback(
    async (date) => {
      // if (date.getTime() <= dateEnd.getTime()) {
      setIsLoading(true);
      setDateStart(date);
      const end = dateEnd.toISOString().substring(0, 10);
      const start = date.toISOString().substring(0, 10);
      const res = await getVouchers(exchanges[0], start, end);
      filter({ filterTrades: res.trades, ticker: res.ticker });
      setIsLoading(false);
      // }
    },
    [dateEnd, filter, getVouchers]
  );

  const dateEndUpdateHandler = useCallback(
    async (date) => {
      // if (date.getTime() >= dateStart.getTime()) {
      setIsLoading(true);
      setDateEnd(date);
      const end = date.toISOString().substring(0, 10);
      const start = dateStart.toISOString().substring(0, 10);
      const res = await getVouchers(exchanges[0], start, end);
      filter({ filterTrades: res.trades, ticker: res.ticker });
      setIsLoading(false);
      // }
    },
    [dateStart, filter, getVouchers]
  );

  const sorting = (key, ascending) => {
    // console.log(`key`, key);
    // console.log(`ascending`, ascending);
    setFilterTrades((prevTrades) => {
      // console.log(`prevTrades`, prevTrades);
      let sortedTrades = prevTrades.map((trade) => ({ ...trade }));
      sortedTrades = ascending
        ? sortedTrades?.sort((a, b) => +a[key] - +b[key])
        : sortedTrades?.sort((a, b) => +b[key] - +a[key]);
      // console.log(`sortedTrades`, sortedTrades);
      return sortedTrades;
    });
  };

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        setIsLoading(true);
        const now = new Date();
        const end = new Date(
          `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()} 08:00:00`
        );
        const startTime = new Date(
          end.getTime() - filterOption * 24 * 60 * 60 * 1000
        );
        const start = new Date(
          `${startTime.getFullYear()}-${
            startTime.getMonth() + 1
          }-${startTime.getDate()} 08:00:00`
        );
        const res = await getVouchers(
          exchanges[0],
          start.toISOString().substring(0, 10),
          end.toISOString().substring(0, 10)
        );
        setIsLoading(false);
        filter({ filterTrades: res.trades, ticker: res.ticker });
        return !prev;
      } else return prev;
    });
  }, [filterOption, getVouchers, filter]);

  useEffect(() => {
    if (!isInit) {
      init();
    }
  }, [init, isInit]);

  return (
    <>
      {isLoading && <LoadingDialog />}
      <section className="screen__section vouchers">
        <ProfitTrendingChart
          categories={Object.keys(chartData)}
          data={Object.values(chartData).map((data) => data.profits)}
        />
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
                  filterOption === 30 ? " active" : ""
                }`}
                onClick={() => updateInterval(30)}
              >
                {t("recent-month")}
              </li>
              <li
                className={`screen__display-option${
                  filterOption === 365 ? " active" : ""
                }`}
                onClick={() => updateInterval(365)}
              >
                {t("recent-year")}
              </li>
            </ul>
          </div>
          <div className="screen__date--range-bar">
            <div className="screen__date--group">
              <label className="screen__date--title">
                {t("another-time")}:
              </label>
              {/* <input
              type="date"
              id="start"
              name="date-start"
              value={new Date().toISOString().substring(0, 10)}
            ></input> */}
              <DatePicker
                date={dateStart}
                setDate={dateStartUpdateHandler}
                maxDate={dateEnd}
              />
            </div>
            <div className="screen__date--group">
              <label className="screen__date--title">{t("to")}:</label>
              {/* <input
              type="date"
              id="end"
              name="date-end"
              value={new Date().toISOString().substring(0, 10)}
            ></input> */}
              <DatePicker
                date={dateEnd}
                setDate={dateEndUpdateHandler}
                minDate={dateStart}
              />
            </div>
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
        <table className={`screen__table${showMore ? " show" : ""}`}>
          <tr className="screen__table-headers">
            {/* <li className="screen__table-header">{t("date")}</li> */}
            <TableHeader
              label={t("date")}
              onClick={(ascending) => sorting("ts", ascending)}
            />
            <th className="screen__table-header">{t("memberId_email")}</th>
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
            <th className="screen__table-header">
              <div className="screen__table-header--text">{t("exchange")}</div>
              <div className="screen__table-header--switch"></div>
            </th>
            {/* <li className="screen__table-header">{t("transaction-side")}</li> */}
            {/* <li className="screen__table-header">{t("transaction-price")}</li> */}
            <TableHeader
              label={t("transaction-price")}
              onClick={(ascending) => sorting("px", ascending)}
            />
            {/* <li className="screen__table-header">{t("transaction-amount")}</li> */}
            <TableHeader
              label={t("transaction-amount")}
              onClick={(ascending) => sorting("fillSz", ascending)}
            />
            {/* <li className="screen__table-header">{t("match-fee")}</li> */}
            <TableHeader
              label={t("match-fee")}
              onClick={(ascending) => sorting("fee", ascending)}
            />
            {/* <li className="screen__table-header">{t("external-fee")}</li> */}
            <TableHeader
              label={t("external-fee")}
              onClick={(ascending) => sorting("externalFee", ascending)}
            />
            {/* <li className="screen__table-header">{t("referral")}</li> */}
            <TableHeader
              label={t("referral")}
              onClick={(ascending) => sorting("referral", ascending)}
            />
            {/* <TableHeader
            label={t("referral")}
            onClick={(ascending) => sorting("referral", ascending)}
          /> */}
            {/* <li className="screen__table-header">{t("revenue")}</li> */}
            <TableHeader
              label={t("revenue")}
              onClick={(ascending) => sorting("revenue", ascending)}
            />
          </tr>
          <tr className="screen__table-rows">
            {filterTrades &&
              filterTrades.map((trade, i) => (
                <td
                  className={`vouchers__tile screen__table-row${
                    trade.email ? "" : " unknown"
                  }`}
                  key={`${i}-${trade.orderId}`}
                >
                  <div className="vouchers__text screen__table-item">
                    {dateFormatter(trade.ts).text}
                  </div>
                  <div className="vouchers__text screen__table-item">
                    <div>{`${
                      trade.email ? trade.email + "/" : "Unknown"
                    }`}</div>
                    <div>{`${trade.email ? trade.memberId : ""}`}</div>
                  </div>
                  <div className="vouchers__text screen__table-item">
                    {trade.orderId || "Unknown"}
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
                    {trade.email
                      ? `${trade.px} / ${trade.fillPx}` || "--"
                      : "Unknown"}
                  </div>
                  <div
                    className={`vouchers__text screen__table-item${
                      trade.side === "buy" ? " positive" : " negative"
                    }`}
                  >
                    {trade.email ? trade.fillSz || "--" : "Unknown"}
                  </div>
                  <div className={`vouchers__text screen__table-item`}>
                    {trade.fee
                      ? `${convertExponentialToDecimal(trade.fee)} ${
                          trade.feeCcy
                        }`
                      : "Unknown"}
                  </div>
                  <div className={`vouchers__text screen__table-item`}>
                    {trade.externalFee
                      ? `${convertExponentialToDecimal(trade.externalFee)} ${
                          trade.feeCcy
                        }`
                      : "--"}
                  </div>
                  <div
                    className={`vouchers__text screen__table-item${
                      trade.referral
                        ? // trade.referral > 0
                          //   ? " positive"
                          // :
                          " negative"
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
                </td>
              ))}
          </tr>
          <tfoot
            className="screen__table-btn screen__table-text"
            onClick={() => setShowMore((prev) => !prev)}
          >
            {showMore ? t("show-less") : t("show-more")}
          </tfoot>
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
    </>
  );
};

export default Vouchers;
