import React from "react";
import { useTranslation } from "react-i18next";

import ApexCharts from "react-apexcharts";
const ProfitTrendingChart = (props) => {
  const { t } = useTranslation();
  console.log(`ProfitTrendingChart props`, props);
  return (
    <React.Fragment>
      <div className="main-chart__chart">
        <div className="main-chart__chart--title">t("profit-trend")</div>
        <ApexCharts
          height="60%"
          width="100%"
          type="line"
          series={[
            {
              data: props.data ? props.data : [],
              name: t("profit"),
              type: "line",
            },
          ]}
          options={{
            chart: {
              height: 235,
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
            markers: {
              size: 2,
              colors: "#fff",
              strokeColors: "#1F78B4",
              strokeWidth: 2,
              strokeOpacity: 1,
              strokeDashArray: 0,
              fillOpacity: 1,
              discrete: [],
              shape: "circle",
              radius: 2,
              offsetX: 0,
              offsetY: 0,
              onClick: undefined,
              onDblClick: undefined,
              showNullDataPoints: true,
              hover: {
                size: undefined,
                sizeOffset: 3,
              },
            },
            stroke: {
              curve: "straight",
              colors: "#1F78B4",
              width: 2,
            },
            xaxis: {
              axisBorder: { show: false },
              axisTicks: { show: false },
              // categories: props.data.categories ? props.data.categories : [],
              labels: {
                show: false,
              },
              type: props.xaxisType,
            },
            yaxis: {
              opposite: true,
              labels: {
                show: false,
              },
            },
            grid: {
              show: false,
            },
            tooltip: {
              enabled: true,
              y: {
                formatter: function (y) {
                  if (typeof y !== "undefined") {
                    return y.toFixed(8) + " HKD";
                  }
                  return y;
                },
              },
            },
          }}
        />
        <ApexCharts
          height="40%"
          width="100%"
          type="bar"
          series={[
            {
              data: props.data ? props.data : [],
              name: t("profit"),
              type: "bar",
            },
          ]}
          options={{
            chart: {
              height: 48,
              type: "bar",
              zoom: {
                enabled: false,
              },
            },
            toolbar: {
              show: false,
              enabled: false,
            },
            plotOptions: {
              bar: {
                horizontal: false,
                columnWidth: "55%",
                endingShape: "rounded",
              },
            },
            dataLabels: {
              enabled: false,
            },
            xaxis: {
              // categories: props.data.categories ? props.data.categories : [],
              type: props.xaxisType,
            },
            yaxis: {
              opposite: true,
              labels: {
                show: false,
              },
            },
            grid: {
              show: false,
            },
            tooltip: {
              enabled: true,
              y: {
                formatter: function (y) {
                  if (typeof y !== "undefined") {
                    return y.toFixed(8) + " HKD";
                  }
                  return y;
                },
              },
            },
          }}
        />
      </div>
    </React.Fragment>
  );
};

export default ProfitTrendingChart;
