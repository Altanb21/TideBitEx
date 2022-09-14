import React from "react";
import { useTranslation } from "react-i18next";

import ApexCharts from "react-apexcharts";
const ProfitTrendingChart = (props) => {
  const { t } = useTranslation();
  return (
    <React.Fragment>
      <div className="main-chart__chart">
        <ApexCharts
          // height="65%"
          width="100%"
          type="line"
          options={{
            chart: {
              height: 235,
              type: "line",
              id: "profit-line",
              zoom: {
                enabled: false,
              },
            },
            title: {
              text: "撮合毛利走勢", // ++ TODO t('profit-trend')
            },
            dataLabels: {
              enabled: false,
            },
            stroke: {
              curve: "straight",
            },
            grid: {
              yaxis: {
                lines: {
                  show: false,
                },
              },
              xaxis: {
                lines: {
                  show: false,
                },
              },
              padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              },
            },
            xaxis: {
              type: "datetime",
              labels: {
                show: false,
              },
              axisBorder: {
                show: false,
              },
            },
            yaxis: {
              opposite: true,
              labels: {
                show: false,
              },
            },
          }}
          series={[
            {
              data: props.data ? props.data : [],
              type: "profit-line",
            },
          ]}
        />
        <ApexCharts
          // height="32%"
          width="100%"
          type="bar"
          series={[
            {
              data: props.data ? props.data : [],
              name: "profit-bar",
            },
          ]}
          options={{
            chart: {
              height: 48,
              type: "bar",
              brush: {
                enabled: true,
                target: "profit-line",
              },
              zoom: {
                enabled: false,
              },
            },
            grid: {
              yaxis: {
                lines: {
                  show: false,
                },
              },
              xaxis: {
                lines: {
                  show: true,
                },
              },
              padding: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              },
            },
            dataLabels: {
              enabled: false,
            },
            plotOptions: {
              bar: {
                columnWidth: "80%",
              },
            },
            stroke: {
              width: 0,
            },
            // xaxis: {
            //   type: "datetime",
            //   axisBorder: {
            //     show: true,
            //   },
            //   labels: {
            //     datetimeUTC: true,
            //     datetimeFormatter: {
            //       year: "yyyy",
            //       month: "MMM 'yy",
            //       day: "dd MMM",
            //       hour: "HH:mm",
            //     },
            //   },
            // },
            xaxis: {
              categories: props.categories ? props.categories : [],
            },
            yaxis: {
              labels: {
                show: false,
              },
              opposite: true,
            },
          }}
        />
      </div>
    </React.Fragment>
  );
};

export default ProfitTrendingChart;
