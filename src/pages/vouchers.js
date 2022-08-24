import React, { useState, useEffect, useCallback, useContext } from "react";
import StoreContext from "../store/store-context";
import TableDropdown from "../components/TableDropdown";
import { dateFormatter } from "../utils/Utils";
import { useTranslation } from "react-i18next";
import SupportedExchange from "../constant/SupportedExchange";

const exchanges = ["OKEx"];

const Vouchers = () => {
  const storeCtx = useContext(StoreContext);
  const [showMore, setShowMore] = useState(false);
  const [isInit, setIsInit] = useState(null);
  const [trades, setTrades] = useState(null);
  const [profit, setProfit] = useState(null);
  const [filterTrades, setFilterTrades] = useState(null);
  const [filterOption, setFilterOption] = useState("month"); //'month','year'
  const [filterKey, setFilterKey] = useState("");
  const [filterExchange, setFilterExchange] = useState("ALL");
  const [ascending, setAscending] = useState(false);
  const { t } = useTranslation();

  const filter = useCallback(
    ({ keyword, timeInterval, exchange, filterTrades }) => {
      if (timeInterval) setFilterOption(timeInterval);
      if (exchange) setFilterExchange(exchange);
      let _trades = filterTrades || trades,
        _keyword = keyword === undefined ? filterKey : keyword,
        _exchange = exchange || filterExchange,
        ts = Date.now(),
        _timeInterval =
          timeInterval === "month"
            ? 30 * 24 * 60 * 60 * 1000
            : 12 * 30 * 24 * 60 * 60 * 1000;

      if (_trades) {
        _trades = Object.values(_trades).filter((order) => {
          if (_exchange === "ALL")
            return (
              (order.orderId.includes(_keyword) ||
                order.memberId.includes(_keyword) ||
                order.exchange.includes(_keyword)) &&
              ts - order.ts < _timeInterval
            );
          else
            return (
              order.exchange === _exchange &&
              (order.orderId.includes(_keyword) ||
                order.memberId.includes(_keyword) ||
                order.exchange.includes(_keyword)) &&
              ts - order.ts < _timeInterval
            );
        });
        setFilterTrades(_trades);
        // ++ TODO addSum
        let sum = 0;
        _trades.forEach((order) => {
          sum += parseFloat(order.revenue);
          console.log(order.revenue);
        });
        setProfit(sum);
      }
    },
    [filterExchange, filterKey, trades]
  );

  const getVouchers = useCallback(async () => {
    const trades = await storeCtx.getOuterTradeFills(SupportedExchange.OKEX);
    return trades
  }, [storeCtx]);

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
        const trades = await getVouchers();
        setTrades(trades);
        console.log(trades);
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
          <div className="screen__display-title">{`${t("show")}：`}</div>
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
        <div className="screen__table-title">{`${t("current-profit")}：`}</div>
        {filterTrades && (
          <div
            className={`screen__table-value${
              profit > 0 ? " positive" : " negative"
            }`}
          >{`${profit} ${filterTrades[0]?.feeCcy}`}</div>
        )}
      </div>
      <div className={`screen__table${showMore ? " show" : ""}`}>
        <ul className="screen__table-headers">
          <li className="screen__table-header">{t("date")}</li>
          <li className="screen__table-header">{t("memberId_email")}</li>
          <li className="screen__table-header">{t("orderId")}</li>
          <li className="screen__table-header">{t("ticker")}</li>
          <li className="screen__table-header">{t("exchange")}</li>
          <li className="screen__table-header">{t("fee")}</li>
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
                  {`${trade.email}/${trade.memberId}`}
                </div>
                <div className="vouchers__text screen__table-item">
                  {trade.orderId}
                </div>
                <div className="vouchers__text screen__table-item">
                  {trade.exchange}
                </div>
                <div className="vouchers__text screen__table-item positive">
                  {trade.fee ? `${trade.fee} ${trade.feeCcy}` : "-"}
                </div>
                <div className="vouchers__text screen__table-item negative">
                  {trade.externalFee
                    ? `${trade.externalFee} ${trade.feeCcy}`
                    : "-"}
                </div>
                <div className="vouchers__text screen__table-item negative">
                  {trade.referral ? `${trade.referral} ${trade.feeCcy}` : "-"}
                </div>
                <div
                  className={`vouchers__text screen__table-item${
                    trade.revenue > 0 ? " positive" : " negative"
                  }`}
                >
                  {trade.revenue ? `${trade.revenue} ${trade.feeCcy}` : "-"}
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
