import React, { useCallback, useContext, useEffect, useState } from "react";
import StoreContext from "../store/store-context";
import SafeMath from "../utils/SafeMath";
import { useTranslation } from "react-i18next";
import { formateDecimal } from "../utils/Utils";
import ApexCharts from "react-apexcharts";

const TickerTrendContainer = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  const [isInit, setIsInit] = useState(false);

  const init = useCallback(async () => {
    if (props.ticker?.market) {
      setIsInit(async (prev) => {
        if (!prev) {
          await storeCtx.registerMarket(props.ticker?.market);
          return !prev;
        } else return prev;
      });
    }
  }, [props.ticker?.market, storeCtx]);

  useEffect(() => {
    if (!isInit) {
      init();
    }
  }, [init, isInit]);

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
          className={`ticker-trend__change-pct${
            !props.ticker?.changePct
              ? ""
              : props.ticker?.changePct.includes("-")
              ? " decrease"
              : " increase"
          }${props.ticker?.increase === true ? " green-highlight" : ""}${
            props.ticker?.increase === false ? " red-highlight" : ""
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
      <div className="ticker-trend__chart">
        <ApexCharts
          height="100%"
          width="100%"
          type="line"
          series={[
            {
              data: props.ticker?.market
                ? storeCtx
                    .getTradesSnapshot(props.ticker.market, 100, true)
                    .map((d) => ({ x: d.ts, y: parseFloat(d.price) }))
                : [],
              type: "line",
            },
          ]}
          options={{
            chart: {
              type: "line",
              zoom: {
                enabled: false,
              },
            },
            toolbar: {
              show: false,
              enabled: false,
            },
            dataLabels: {
              enabled: false,
            },
            stroke: {
              curve: "straight",
              colors: "#fff",
              width: 1.2,
            },
            xaxis: {
              axisBorder: { show: false },
              axisTicks: { show: false },
              labels: {
                show: false,
              },
              type: "numeric",
            },
            yaxis: {
              axisBorder: { show: false },
              axisTicks: { show: false },
              labels: {
                show: false,
              },
            },
            grid: {
              show: false,
            },
            tooltip: {
              enabled: false,
            },
          }}
        />
      </div>
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
