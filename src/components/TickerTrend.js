import React, { useContext } from "react";
import StoreContext from "../store/store-context";
import SafeMath from "../utils/SafeMath";
import { useTranslation } from "react-i18next";
import { formateDecimal } from "../utils/Utils";
import ApexCharts from "react-apexcharts";

const TickerTrendContainer = (props) => {
  const { t } = useTranslation();
  return (
    <a
      className="ticker-trend__container"
      key={props.key}
      href={`/markets/${props.ticker?.market}`}
    >
      <div className="ticker-trend__leading">
        <div className="ticker-trend__ticker">
          <span className="ticker-trend__icon">
            <img
              src={`/icons/${props.ticker?.baseUnit}.png`}
              alt={props.ticker?.baseUnit || "--"}
              loading="lazy"
            />
          </span>
          <span className="ticker-trend__text">
            {props.ticker?.name || "--"}
          </span>
        </div>
        <div
          className={`ticker-trend__change-pct ${
            !props.ticker?.changePct
              ? ""
              : formateDecimal(SafeMath.mult(props.ticker?.changePct, "100"), {
                  decimalLength: 2,
                  pad: true,
                  withSign: true,
                }).includes("-")
              ? "decrease"
              : "increase"
          }`}
        >
          {!props.ticker
            ? "-- %"
            : `${formateDecimal(SafeMath.mult(props.ticker?.changePct, "100"), {
                decimalLength: 2,
                pad: true,
                withSign: true,
              })}%`}
        </div>
      </div>
      <div className="ticker-trend__content">
        <div className="ticker-trend__price">
          {props.ticker
            ? formateDecimal(props.ticker?.last, {
                decimalLength: props.ticker
                  ? props.ticker.tickSz?.split(".").length > 1
                    ? props.ticker.tickSz?.split(".")[1].length
                    : 0
                  : "0",
                pad: true,
              })
            : "--"}
        </div>
        <div className="ticker-trend__volume">
          {`${t("volume")}: ${
            props.ticker
              ? formateDecimal(props.ticker?.volume, {
                  decimalLength: 2,
                  pad: true,
                })
              : "--"
          }`}
        </div>
      </div>
      <div className="ticker-trend__chart"></div>
    </a>
  );
};

const TickerTrend = () => {
  const storeCtx = useContext(StoreContext);
  return (
    <div className="ticker-trend">
      {storeCtx.registerTickers.map((ticker) => (
        <TickerTrendContainer
          ticker={storeCtx.getTicker(ticker)}
          key={ticker}
        />
      ))}
    </div>
  );
};

export default TickerTrend;
