import React, { useContext } from "react";
import StoreContext from "../store/store-context";
import ApexCharts from "react-apexcharts";
import { useTranslation } from "react-i18next";

import { formateDecimal } from "../utils/Utils";

const DepthChart = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();

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
            data: storeCtx.depthChartData?.bids
              ? storeCtx.depthChartData?.bids
              : [],
          },
          {
            name: t("sell"),
            data: storeCtx.depthChartData?.asks
              ? storeCtx.depthChartData?.asks
              : [],
          },
        ]}
      />
    </div>
  );
};

export default DepthChart;
