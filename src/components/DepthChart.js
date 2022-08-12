import React, { useContext, useEffect, useState } from "react";
import StoreContext from "../store/store-context";
import ApexCharts from "react-apexcharts";
import { useTranslation } from "react-i18next";
import SafeMath from "../utils/SafeMath";
import { formateDecimal } from "../utils/Utils";

const DepthChart = (props) => {
  const storeCtx = useContext(StoreContext);
  const [bids, setBids] = useState([]);
  const [asks, setAsks] = useState([]);
  const { t } = useTranslation();
  const [ts, setTs] = useState(0);

  useEffect(() => {
    if (storeCtx.books?.bids && storeCtx.books?.asks) {
      const _ts = Date.now();
      if (_ts - ts <= 1500) return;
      else setTs(_ts);
      const _bids = storeCtx.books.bids
        .map((bid) => ({ ...bid }))
        .sort((a, b) => +a.price - +b.price);
      const _asks = storeCtx.books.asks.map((ask) => ({ ...ask }));
      if (_bids.length > _asks.length) {
        const d = _asks.length - 1;
        for (let i = _asks.length; i < _bids.length; i++) {
          _asks.push({
            price: SafeMath.plus(
              _asks[i - 1]?.price || "0",
              i + 1 > _bids.length - 1
                ? SafeMath.minus(
                    _bids[_bids.length - 1]?.price,
                    _bids[_bids.length - 2]?.price
                  )
                : SafeMath.minus(_bids[i + 1]?.price, _bids[i]?.price)
            ),
            total: _asks[d]?.total || "0",
          });
        }
      } else if (_bids.length < _asks.length) {
        for (let i = _bids.length; i < _asks.length; i++) {
          const d = _bids.length - 1;
          _bids.push({
            price: SafeMath.plus(
              _bids[i - 1]?.price || "0",
              i + 1 > _bids.length - 1
                ? SafeMath.minus(
                    _asks[_asks.length - 1]?.price,
                    _asks[_asks.length - 2]?.price
                  )
                : SafeMath.minus(_asks[i + 1]?.price, _asks[i]?.price)
            ),
            total: _bids[d]?.total || "0",
          });
        }
      }
      const _bs = _bids
        .map((b) => ({
          x: b.price,
          y: b.total,
        }))
        .concat(
          _asks.map((a) => ({
            x: a.price,
            y: null,
          }))
        );
      const _as = _bids
        .map((b) => ({
          x: b.price,
          y: null,
        }))
        .concat(
          _asks.map((a) => ({
            x: a.price,
            y: a.total,
          }))
        );
      setBids(_bs);
      setAsks(_as);
    }
  }, [storeCtx.books?.asks, storeCtx.books?.bids, ts]);
  return (
    <div className="depth-chart">
      <ApexCharts
        height="100%"
        width="100%"
        type="area"
        options={{
          chart: {
            toolbar: {
              show: false,
            },
            animations: {
              enabled: false,
            },
          },
          grid: {
            padding: {
              right: 0,
              top: 0,
              bottom: 0,
              left: 0,
            },
          },
          xaxis: {
            // type: "numeric",
            // floating: true,
            // tickPlacement: "between",
            trim: true,
            tickAmount: 3,
            labels: {
              rotate: 0,
              formatter: function (value) {
                return formateDecimal(value, {
                  maxLength: 2,
                  decimalLength: 4,
                });
              },
              hideOverlappingLabels: true,
              maxHeight: 28,
            },
          },
          yaxis: {
            labels: {
              offsetX: -10,
              formatter: function (value) {
                return value.toFixed(2);
              },
            },
          },
          colors: ["#03a66d", "#cf304a"],
          dataLabels: {
            enabled: false,
          },
          legend: {
            show: false,
          },
        }}
        series={[
          {
            name: t("buy"),
            data: bids,
          },
          {
            name: t("sell"),
            data: asks,
          },
        ]}
      />
    </div>
  );
};

export default DepthChart;
