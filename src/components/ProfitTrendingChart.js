import React from "react";
import { useTranslation } from "react-i18next";

import ApexCharts from "react-apexcharts";
const ProfitTrendingChart = (props) => {
  const { t } = useTranslation();
  console.log(`ProfitTrendingChart props`, props);
  return (
    <React.Fragment>
      <div className="main-chart__chart">
        <ApexCharts
          height="60%"
          width="100%"
          type="line"
          series={[
            {
              data: props.data ? props.data : [],
              name: "profit-line",
              type: "line",
            },
          ]}
          options={{
            title: {
              text: "撮合毛利走勢", // ++ TODO t('profit-trend')
              align: "left",
              style: {
                fontSize: 20,
                color: "#767676",
              },
            },
            chart: {
              height: 235,
              type: "line",
              zoom: {
                enabled: false,
              },
            },
            toolbar: {
              enabled: false,
            },
            dataLabels: {
              enabled: false,
            },
            stroke: {
              curve: "straight",
            },
            xaxis: {
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
          }}
        />
        <ApexCharts
          height="40%"
          width="100%"
          type="bar"
          series={[
            {
              data: props.data ? props.data : [],
              name: "profit-bar",
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
          }}
        />
      </div>
    </React.Fragment>
  );
};

export default ProfitTrendingChart;
