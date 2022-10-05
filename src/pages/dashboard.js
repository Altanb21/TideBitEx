import React, { useCallback, useContext, useEffect, useState } from "react";
import StoreContext from "../store/store-context";
import LoadingDialog from "../components/LoadingDialog";
import SafeMath from "../utils/SafeMath";
import { useTranslation } from "react-i18next";
import { PLATFORM_ASSET } from "../constant/PlatformAsset";
import ApexCharts from "react-apexcharts";

const padZero = (num) => {
  if (parseInt(num) < 10) {
    return `0${num}`;
  } else return `${num}`;
};

const DashboardPannel = (props) => {
  let alertTag;
  switch (props.alertLevel) {
    case PLATFORM_ASSET.WARNING_LEVEL.LEVEL_1:
      alertTag = "normal";
      break;
    case PLATFORM_ASSET.WARNING_LEVEL.LEVEL_2:
      alertTag = "warn";
      break;
    case PLATFORM_ASSET.WARNING_LEVEL.LEVEL_3:
      alertTag = "alert";
      break;
    case PLATFORM_ASSET.WARNING_LEVEL.LEVEL_4:
      alertTag = "alert notice";
      break;
    case PLATFORM_ASSET.WARNING_LEVEL.NULL:
      alertTag = "unset";
      break;
    default:
      break;
  }
  return (
    <div
      className={`dashboard__pannel dashboard__alert${
        !props.active ? " disabled" : " "
      } ${alertTag}`}
      key={props.key}
      onClick={props.onClick}
    >
      <div className="dashboard__alert-icon"></div>
      <div className="dashboard__pannel--title">{`${props.name
        .substring(0, 1)
        .toUpperCase()}${props.name.substring(1)}`}</div>
      <div className="dashboard__progress-bar">
        <div className="dashboard__progress-bar--text">{`${SafeMath.mult(
          props.profitRatio,
          100
        )}%`}</div>
        <div className="dashboard__progress-bar--label-bar"></div>
        <div
          className="dashboard__progress-bar--inner-bar"
          style={{
            transform:
              "rotate(" +
              (45 + SafeMath.mult(props.profitRatio, 100) * 1.8) +
              "deg)",
          }}
        ></div>
      </div>
      <div className="dashboard__pannel--label">{props.label}</div>
      <div className="dashboard__pannel--source">{props.source}</div>
    </div>
  );
};

const Dashboard = (props) => {
  const storeCtx = useContext(StoreContext);
  const [isInit, setIsInit] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState(null);
  const [totalAssets, setTotalAssets] = useState(null);
  const [totalDeposit, setTotalDeposit] = useState(null);
  const [totalWithdraw, setTotalWithdraw] = useState(null);
  const [totalProfit, setTotalProfit] = useState(null);
  const [currency, setCurrency] = useState(null);
  const [alertAssets, setAlertAssets] = useState([]);
  const [alertTickers, setAlertTickers] = useState([]);
  const [alertCoins, setAlertCoins] = useState([]);
  const { t } = useTranslation();
  // ++ TODO SILDER pannel-container

  const getDashboardData = useCallback(async () => {
    setIsLoading(true);
    let data = await storeCtx.getDashboardData();
    setTotalAssets(data.totalAssets);
    setTotalDeposit(data.totalDeposit);
    setTotalWithdraw(data.totalWithdraw);
    setTotalProfit(data.totalProfit);
    setCurrency(data.currency);
    setAlertAssets(data.alertAssets);
    setAlertTickers(data.alertTickers);
    setAlertCoins(data.alertCoins);
    setIsLoading(false);
  }, [storeCtx]);

  //   const sync = useCallback(() => {
  //     setInterval(async () => await getDashboardData(), 1 * 60 * 60 * 1000);
  //   }, [getDashboardData]);

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        await getDashboardData();
        // sync();
        return !prev;
      } else return prev;
    });
  }, [getDashboardData]);

  useEffect(() => {
    if (!isInit) {
      init();
    }
  }, [init, isInit]);
  return (
    <>
      {isLoading && <LoadingDialog />}
      <div className="dashboard">
        <div className="dashboard__header">Dashboard</div>
        <div className="dashboard__tool-bar">
          {/* https://css-tricks.com/snippets/sass/placing-items-circle/ */}
          <div className="dashboard__tool-bar--label">
            {lastCheckedTime
              ? `${t(
                  "last-checked-time"
                )}: ${lastCheckedTime.getFullYear()}-${padZero(
                  lastCheckedTime.getMonth() + 1
                )}-${lastCheckedTime.getDate()} ${padZero(
                  lastCheckedTime.getHours()
                )}:${padZero(lastCheckedTime.getMinutes())}:${padZero(
                  lastCheckedTime.getSeconds()
                )}`
              : `${t("last-checked-time")}: --`}
          </div>
          <button
            className="dashboard__btn dashboard__tool-bar--btn"
            onClick={() => setLastCheckedTime(new Date())}
          >
            {t("check")}
          </button>
        </div>
        <div className="dashboard__content dashboard__content--column">
          <div className="dashboard__content dashboard__content--row">
            <div className="dashboard__card dashboard__overview">
              <div className="dashboard__card--title">平台資產管理</div>
              <div className="dashboard__summary">
                <div className="dashboard__summary--header dashboard__alert">
                  <div className="dashboard__alert-icon"></div>
                  <div className="dashboard__summary--header-icon"></div>
                  <div className="dashboard__summary--header-content">
                    <div className="dashboard__summary--header-label">
                      平台總資產
                    </div>
                    <div className="dashboard__summary--header-value">
                      {`${totalAssets || "--"} ${currency || ""}`}
                    </div>
                  </div>
                </div>
                <div className="dashboard__summary--header">
                  <div className="dashboard__alert-icon"></div>
                  <div className="dashboard__summary--header-icon"></div>
                  <div className="dashboard__summary--header-content">
                    <div className="dashboard__summary--header-label">
                      平台出金數
                    </div>
                    <div className="dashboard__summary--header-value">
                      {`${totalWithdraw || "--"} ${currency || ""}`}
                    </div>
                  </div>
                </div>
                <div className="dashboard__summary--header">
                  <div className="dashboard__alert-icon"></div>
                  <div className="dashboard__summary--header-icon"></div>
                  <div className="dashboard__summary--header-content">
                    <div className="dashboard__summary--header-label">
                      平台入金數
                    </div>
                    <div className="dashboard__summary--header-value">
                      {`${totalDeposit || "--"} ${currency || ""}`}
                    </div>
                  </div>
                </div>
              </div>
              <div className="dashboard__chart">
                <ApexCharts
                  height="100%"
                  width="100%"
                  type="bar"
                  series={[
                    {
                      data: currency
                        ? [totalAssets, totalWithdraw, totalDeposit]
                        : [],
                      type: "bar",
                    },
                  ]}
                  options={{
                    chart: {
                      type: "bar",
                      zoom: {
                        enabled: false,
                      },
                    },
                    colors: ["#3190ff", "#ff719d", "#ffe471"],
                    title: {
                      text: t("platform-assets"),
                      align: 'center',
                      offsetY: -352,
                      style: {
                        fontSize:  '18px',
                        fontWeight:  'bold',
                        // fontFamily:  undefined,
                        color:  '#333333'
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
                      labels: {
                        show: false,
                      },
                      categories: ["平台總資產", "平台出金數", "平台入金數"],
                      colors: ["#3190ff", "#ff719d", "#ffe471"],
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
                      x: {
                        show: false,
                      },
                      y: {
                        formatter: function (y) {
                          if (typeof y !== "undefined") {
                            return y + ` ${currency || "--"}`;
                          }
                          return y;
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>
            <div className="dashboard__container dashboard__content dashboard__content--column dashboard__cards">
              <div className="dashboard__card">
                <div className="dashboard__card--title">交易對管理</div>
                <div className="dashboard__card--tool">前往交易對設定</div>
                <div className="dashboard__pannels">
                  <div className="dashboard__pannel-container">
                    {alertTickers.map((alertTicker) => {
                      return (
                        <DashboardPannel
                          key={`ticker-${alertTicker.id}`}
                          active={alertTicker.visible}
                          name={alertTicker.name}
                          profitRatio={alertTicker.profitRatio}
                          targetRatio={alertTicker.targetRatio}
                          alertLevel={alertTicker.alertLevel}
                          label={
                            alertTicker.visible
                              ? t("profit-ratio")
                              : t("ticker-close")
                          }
                          source={alertTicker.source}
                          onClick={() => {}}
                        />
                      );
                    })}
                  </div>
                  <div className="dashboard__pannel-container--btn"></div>
                </div>
              </div>
              <div className="dashboard__card">
                <div className="dashboard__card--title">出入金手續費管理</div>
                <div className="dashboard__card--tool">前往入金管理</div>
                <div className="dashboard__pannels">
                  <div className="dashboard__pannel-container">
                    {alertCoins.map((alertCoin) => {
                      return (
                        <DashboardPannel
                          key={`coin-${alertCoin.id}`}
                          active={alertCoin.deposit}
                          name={alertCoin.key}
                          profitRatio={alertCoin.profitRatio}
                          targetRatio={alertCoin.targetRatio}
                          alertLevel={alertCoin.alertLevel}
                          label={
                            alertCoin.deposit
                              ? t("profit-ratio")
                              : t("coin-close")
                          }
                          source={alertCoin.source}
                          onClick={() => {}}
                        />
                      );
                    })}
                  </div>
                  <div className="dashboard__pannel-container--btn"></div>
                </div>
              </div>
            </div>
          </div>
          <div className="dashboard__card">
            <div className="dashboard__card--title">資產水位管理</div>
            <div className="dashboard__card--tool">前往資產總覽</div>
            <table className="dashboard__table">
              <thead className="dashboard__table--header">
                <th className="dashboard__table--title">{t("currency")}</th>
                <th className="dashboard__table--title">{`${t("exchange")}/${t(
                  "sub-account"
                )}`}</th>
                <th className="dashboard__table--title">
                  {t("asset-balance")}
                </th>
              </thead>
              <tbody className="dashboard__table--rows">
                {alertAssets.map((alertAsset) => {
                  let alertTag,
                    totalBalance = SafeMath.plus(
                      alertAsset.balance,
                      alertAsset.locked
                    );
                  switch (alertAsset.alertLevel) {
                    case PLATFORM_ASSET.WARNING_LEVEL.LEVEL_1:
                      alertTag = "normal";
                      break;
                    case PLATFORM_ASSET.WARNING_LEVEL.LEVEL_2:
                      alertTag = "warn";
                      break;
                    case PLATFORM_ASSET.WARNING_LEVEL.LEVEL_3:
                      alertTag = "alert";
                      break;
                    case PLATFORM_ASSET.WARNING_LEVEL.LEVEL_4:
                      alertTag = "alert notice";
                      break;
                    case PLATFORM_ASSET.WARNING_LEVEL.NULL:
                      alertTag = "unset";
                      break;
                    default:
                      break;
                  }
                  return (
                    <tr
                      className={`dashboard__table--row ${alertTag} ${
                        alertTag !== "unset" ? " dashboard__alert" : ""
                      }`}
                    >
                      <td className="dashboard__table--data platform-assets__leading">
                        <div className="dashboard__alert-icon"></div>
                        <div className="platform-assets__leading--icon">
                          <img
                            src={`/icons/${alertAsset.code}.png`}
                            alt={alertAsset.code}
                          />
                        </div>
                        <div className="platform-assets__leading--value">
                          {`${alertAsset.key
                            .substring(0, 1)
                            .toUpperCase()}${alertAsset.key.substring(1)}`}
                        </div>
                      </td>
                      <td className="platform-assets__source--label dashboard__table--data">
                        {alertAsset.source}
                      </td>
                      <td className="platform-assets__bar dashboard__table--data">
                        <div className="platform-assets__inner-text">
                          {totalBalance}
                        </div>
                        <div
                          className="platform-assets__inner-bar"
                          style={{
                            width: `${
                              alertTag !== "unset"
                                ? SafeMath.mult(
                                    SafeMath.div(totalBalance, alertAsset.sum),
                                    100
                                  )
                                : "0"
                            }%`,
                          }}
                        ></div>
                        <div
                          className="platform-assets__warning-bar"
                          style={{
                            left: `${
                              alertTag !== "unset"
                                ? SafeMath.mult(
                                    // SafeMath.div(alertAsset.RRR, alertAsset.sum),
                                    alertAsset.RRRRatio,
                                    100
                                  )
                                : "0"
                            }%`,
                          }}
                        >
                          <div className="platform-assets__warning-bar--line"></div>
                          <div className="platform-assets__warning-bar--label">
                            RRR
                          </div>
                        </div>
                        <div
                          className="platform-assets__warning-bar"
                          style={{
                            left: `${
                              alertTag !== "unset"
                                ? SafeMath.mult(
                                    // SafeMath.div(alertAsset.MPA, alertAsset.sum),
                                    alertAsset.MPARatio,
                                    100
                                  )
                                : "0"
                            }%`,
                          }}
                        >
                          <div className="platform-assets__warning-bar--line"></div>
                          <div className="platform-assets__warning-bar--label">
                            MPA
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
