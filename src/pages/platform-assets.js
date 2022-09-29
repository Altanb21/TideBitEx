import React, { useState, useContext, useEffect, useCallback } from "react";
import StoreContext from "../store/store-context";
import SafeMath from "../utils/SafeMath";
import Dialog from "../components/Dialog";
import LoadingDialog from "../components/LoadingDialog";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { PLATFORMASSET } from "../constant/PlatformAsset";

const InputRange = (props) => {
  const onInput = (e) => {
    const newValue = Number(
        ((e.target.value - props.min) * 100) / (props.max - props.min)
      ),
      newPosition = 16 - newValue * 0.32;
    document.documentElement.style.setProperty(
      `--range-progress-${props.type}`,
      `calc(${newValue}% + (${newPosition}px))`
    );
    props.setValue(newValue);
  };
  return (
    <div className="input-range">
      <input
        type="range"
        className={`input-range__slider input-range__slider--${props.type}`}
        min={props.min}
        max={props.max}
        step="1"
        value={props.value}
        onInput={onInput}
      />
      <label className="input-range__suffix" htmlFor="range">
        <div className="input-range__suffix--value">{props.value}</div>
        <div className="input-range__suffix--icon">%</div>
      </label>
    </div>
  );
};

const AssetSettingDialog = (props) => {
  const { t } = useTranslation();
  const [maximun, setMaximun] = useState(null);
  const [minimun, setMinimun] = useState(null);
  const [MPARatio, setMPARatio] = useState(
    SafeMath.mult(SafeMath.div(props.asset.MPA, props.asset.base), 100)
  );
  const [RRRRatio, setRRRRatio] = useState(
    SafeMath.mult(SafeMath.div(props.asset.RRR, props.asset.base), 100)
  );

  const onConfirm = useCallback(() => {
    if (maximun || minimun || MPARatio || RRRRatio) {
      props.onConfirm({
        maximun: maximun ? maximun : props.asset.maximun,
        minimun: minimun ? minimun : props.asset.minimun,
        MPA: MPARatio
          ? SafeMath.mult(SafeMath.div(MPARatio, 100), props.asset.base)
          : props.asset.MPA,
        RRR: RRRRatio
          ? SafeMath.mult(SafeMath.div(RRRRatio, 100), props.asset.base)
          : props.asset.RRR,
      });
    }
  }, [MPARatio, RRRRatio, maximun, minimun, props]);

  return (
    <Dialog
      className="platform-assets__dialog screen__dialog"
      title={t("setting")}
      onClose={props.onClose}
      onCancel={props.onCancel}
      onConfirm={onConfirm}
    >
      <div className="screen__dialog-content">
        <div className="screen__dialog-content--title">
          <div className="screen__dialog-content--icon">
            <img
              src={`/icons/${props.asset.symbol.toLowerCase()}.png`}
              alt={props.asset.symbol}
            />
          </div>
          <div className="screen__dialog-content--value">
            {props.asset.symbol}
          </div>
        </div>
        <div className="screen__dialog-content--body">
          <div className="screen__dialog-inputs">
            <div className="screen__dialog-input-group">
              <label
                className="screen__dialog-input-label"
                htmlFor={`asset-maximun`}
              >
                {t(`asset-maximun`)}:
              </label>
              <div className="screen__dialog-input-box">
                <div className="screen__dialog-input-column">
                  <input
                    className="screen__dialog-input"
                    name={`asset-maximun`}
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={maximun}
                    onChange={(e) => {
                      const value = Math.abs(e.target.value);
                      setMaximun(value);
                    }}
                  />
                  <div className="screen__dialog-input-caption"></div>
                </div>
                <div className="screen__dialog-input-suffix">
                  {props.asset.symbol}
                </div>
              </div>
            </div>
            <div className="screen__dialog-input-group">
              <label
                className="screen__dialog-input-label"
                htmlFor={`asset-minimun`}
              >
                {t(`asset-minimun`)}:
              </label>
              <div className="screen__dialog-input-box">
                <div className="screen__dialog-input-column">
                  <input
                    className="screen__dialog-input"
                    name={`asset-minimun`}
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={minimun}
                    onChange={(e) => {
                      const value = Math.abs(e.target.value);
                      setMinimun(value);
                    }}
                  />
                  <div className="screen__dialog-input-caption"></div>
                </div>
                <div className="screen__dialog-input-suffix">
                  {props.asset.symbol}
                </div>
              </div>
            </div>
            <div className="screen__dialog-input-group">
              <label className="screen__dialog-input-label" htmlFor="MPA">
                MPA:
              </label>
              <InputRange
                min="0"
                max="100"
                setValue={setMPARatio}
                value={MPARatio}
                type="MPA"
              />
            </div>
            <div className="screen__dialog-input-group">
              <label className="screen__dialog-input-label" htmlFor="RRR">
                RRR:
              </label>
              <InputRange
                min="0"
                max="100"
                setValue={setRRRRatio}
                value={RRRRatio}
                type="RRR"
              />
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

const AssetSettingTile = (props) => {
  return (
    <div
      className={`platform-assets__tile${
        Object.values(props.asset.sources).some(
          (source) => source.alertLevel > 0
        )
          ? " alert"
          : ""
      }`}
      key={props.asset.name + props.asset.symbol}
    >
      <div className="platform-assets__icon platform-assets__icon--alert"></div>
      <div
        className="platform-assets__icon platform-assets__icon--setting"
        onClick={props.settingDialogHandler}
      ></div>
      <div className="platform-assets__detail">
        <div className="platform-assets__leading">
          <div className="platform-assets__leading--icon">
            <img
              src={`/icons/${props.asset.symbol.toLowerCase()}.png`}
              alt={props.asset.symbol}
            />
          </div>
          <div className="platform-assets__leading--value">
            {props.asset.symbol}
          </div>
        </div>
        <div className="platform-assets__sources">
          {Object.keys(props.asset.sources).map((source) => {
            let totalBalance = SafeMath.plus(
              props.asset.sources[source].balance,
              props.asset.sources[source].locked
            );
            let alertTag;
            switch (props.asset.sources[source].alertLevel) {
              case PLATFORMASSET.WARNING_LEVEL.LEVEL_1:
                alertTag = "normal";
                break;
              case PLATFORMASSET.WARNING_LEVEL.LEVEL_2:
                alertTag = "warn";
                break;
              case PLATFORMASSET.WARNING_LEVEL.LEVEL_3:
                alertTag = "alert";
                break;
              case PLATFORMASSET.WARNING_LEVEL.NULL:
                alertTag = "unset";
                break;
              default:
                break;
            }
            return (
              <div className={`platform-assets__source ${alertTag}`}>
                <div className="platform-assets__bar">
                  <div className="platform-assets__inner-text">
                    {totalBalance}
                  </div>
                  <div
                    className="platform-assets__inner-bar"
                    style={{
                      width: `${
                        alertTag !== "unset"
                          ? SafeMath.mult(
                              SafeMath.div(totalBalance, props.asset.base),
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
                              SafeMath.div(props.asset.RRR, props.asset.base),
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
                              SafeMath.div(props.asset.MPA, props.asset.base),
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
                </div>
                <div className="platform-assets__source--label">{`${source
                  .substring(0, 1)
                  .toUpperCase()}${source.substring(1)}`}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const PlatformAssets = () => {
  const storeCtx = useContext(StoreContext);
  const [showMore, setShowMore] = useState(false);
  const [openSettingDialog, setOpenSettingDialog] = useState(false);
  const [isInit, setIsInit] = useState(null);
  const [assets, setAssets] = useState(null);
  const [filterAssets, setFilterAssets] = useState(null);
  const [alertFilter, setAlertFilter] = useState(false);
  const [filterKey, setFilterKey] = useState("");
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const getPlatformAssets = useCallback(async () => {
    return Promise.resolve({
      BTC: {
        symbol: "BTC",
        name: "Bitcoin",
        RRR: "333",
        MPA: "666",
        base: "1222",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      ETH: {
        symbol: "ETH",
        name: "Ethereum",
        RRR: "333",
        MPA: "666",
        base: "1222",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      XRP: {
        symbol: "XRP",
        name: "XRP",
        RRR: "333",
        MPA: "666",
        base: "1222",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      USDC: {
        symbol: "USDC",
        name: "USD Coin",
        RRR: "333",
        MPA: "666",
        base: "1222",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      USDT: {
        symbol: "USDT",
        name: "Tether",
        RRR: "333",
        MPA: "666",
        base: "1222",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      BNB: {
        symbol: "BNB",
        name: "Build and Build",
        RRR: "333",
        MPA: "666",
        base: "1222",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      BUSD: {
        symbol: "BUSD",
        name: "Binance USD",
        RRR: "333",
        MPA: "666",
        base: "1222",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      ADA: {
        symbol: "ADA",
        name: "Cardano",
        RRR: "333",
        MPA: "666",
        base: "1222",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      SOL: {
        symbol: "SOL",
        name: "Solana",
        RRR: "333",
        MPA: "666",
        base: "1222",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      DOGE: {
        symbol: "DOGE",
        name: "Dogecoin",
        RRR: "333",
        MPA: "666",
        base: "1222",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
    });
  }, []);

  const filter = useCallback(
    ({ filterAssets, alert, keyword }) => {
      try {
        if (alert !== undefined) setAlertFilter(alert);
        let _assets = filterAssets || assets,
          _option = alert !== undefined ? alert : filterAssets,
          _keyword = keyword === undefined ? filterKey : keyword;
        if (_assets) {
          _assets = Object.values(_assets).filter((asset) => {
            let condition =
              asset.name?.includes(_keyword) ||
              asset.symbol?.includes(_keyword);
            if (_option !== null && _option !== undefined)
              condition =
                condition &&
                Object.values(asset.sources).some(
                  (source) => source.alertLevel > 0
                );
            return condition;
          });
          setFilterAssets(_assets);
        }
      } catch (e) {
        console.error(e);
      }
    },
    [assets, filterKey]
  );

  const updateAssetSetting = useCallback(() => {}, []);

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        const assets = await getPlatformAssets();
        setAssets(assets);
        filter({ filterAssets: assets });
        return !prev;
      } else return prev;
    });
  }, [getPlatformAssets, filter]);

  useEffect(() => {
    if (!isInit) {
      init();
    }
  }, [init, isInit]);

  return (
    <>
      {isLoading && <LoadingDialog />}
      {openSettingDialog && selectedAsset && (
        <AssetSettingDialog
          asset={selectedAsset}
          onClose={() => setOpenSettingDialog(false)}
          onCancel={() => {
            setOpenSettingDialog(false);
          }}
          onConfirm={(data) => updateAssetSetting(data)}
        />
      )}
      <section className="screen__section platform-assets">
        <div className="screen__header">平台資產總覽</div>
        {/* <ScreenTags
        selectedTag={selectedTag}
        selectTagHandler={selectTagHandler}
        data={currencies}
      /> */}
        <div className="screen__search-bar">
          <div className="screen__search-box">
            <input
              type="text"
              inputMode="search"
              className="screen__search-input"
              placeholder="輸入欲搜尋的關鍵字"
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
            <div className="screen__display-title">顯示：</div>
            <ul className="screen__display-options">
              <li
                className={`screen__display-option${
                  alertFilter === false ? " active" : ""
                }`}
                onClick={() => filter({ alert: false })}
              >
                全部
              </li>
              <li
                className={`screen__display-option${
                  alertFilter === true ? " active" : ""
                }`}
                onClick={() => filter({ option: "deposit" })}
              >
                警示
              </li>
            </ul>
          </div>
          <div className="screen__sorting">
            <img src="/img/sorting@2x.png" alt="sorting" />
          </div>
        </div>
        <div className={`screen__table${showMore ? " show" : ""}`}>
          <div className="platform-assets__rows">
            {filterAssets?.map((asset) => (
              <AssetSettingTile
                asset={asset}
                settingDialogHandler={() => {
                  setSelectedAsset(asset);
                  setOpenSettingDialog(true);
                }}
              />
            ))}
          </div>
          <div
            className="screen__table-btn screen__table-text"
            onClick={() => setShowMore((prev) => !prev)}
          >
            {showMore ? "顯示更少" : "顯示更多"}
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
    </>
  );
};

export default PlatformAssets;
