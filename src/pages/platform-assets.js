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
      "--range-progress",
      `calc(${newValue}% + (${newPosition}px))`
    );
    props.setValue(newValue);
  };
  return (
    <div className="input-range">
      <input
        id="range"
        type="range"
        className="input-range__slider"
        min={props.min}
        max={props.max}
        step="1"
        value={props.value}
        onInput={onInput}
      />
      <label className="input-range__suffix" htmlFor="range">
        <div id="tooltip" className="input-range__suffix--value">
          {props.value}
        </div>
        <div className="input-range__suffix--icon">%</div>
      </label>
    </div>
  );
};

const AssetSettingDialog = (props) => {
  const { t } = useTranslation();
  const [maximun, setMaximun] = useState(null);
  const [minimun, setMinimun] = useState(null);
  const [MPA, setMPA] = useState(SafeMath.mult(props.asset.MPA, 100));
  const [RRR, setRRR] = useState(SafeMath.mult(props.asset.RRR, 100));

  const onConfirm = useCallback(() => {
    if (maximun || minimun || MPA || RRR) {
      props.onConfirm({
        maximun: maximun ? maximun : props.asset.maximun,
        minimun: minimun ? minimun : props.asset.minimun,
        MPA: MPA ? SafeMath.div(MPA, 100) : props.asset.MPA,
        RRR: RRR ? SafeMath.div(RRR, 100) : props.asset.RRR,
      });
    }
  }, [MPA, RRR, maximun, minimun, props]);

  return (
    <Dialog
      className="screen__dialog"
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
                  {props.ticker.symbol}
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
                  {props.ticker.symbol}
                </div>
              </div>
            </div>
            <div className="screen__dialog-input-group">
              <label className="screen__dialog-input-label" htmlFor="MPA">
                MPA:
              </label>
              <InputRange min="0" max="100" setValue={setMPA} value={MPA} />
            </div>
            <div className="screen__dialog-input-group">
              <label className="screen__dialog-input-label" htmlFor="MPA">
                RRR:
              </label>
              <InputRange min="0" max="100" setValue={setRRR} value={RRR} />
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
      className={`platform-assets__tile${Object.values(
        props.asset.sources
      ).some((source) => (source.alertLevel > 0 ? " alert" : ""))}`}
    >
      <div className="platform-assets__icon platform-assets__icon--alert"></div>
      <div className="platform-assets__icon platform-assets__icon--setting"></div>
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
            return (
              <div className="platform-assets__source">
                <div className="platform-assets__bar">
                  {/* <div className="platform-assets__inner-bar" style={{
                    width: 
                  }}></div> */}
                </div>
                <div className="platform-assets__source--label">{source}</div>
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
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      ETH: {
        symbol: "ETH",
        name: "Ethereum",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      XRP: {
        symbol: "XRP",
        name: "XRP",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      USDC: {
        symbol: "USD Coin",
        name: "Bitcoin",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      USDT: {
        symbol: "USDT",
        name: "Tether",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      BNB: {
        symbol: "BNB",
        name: "Build and Build",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      BUSD: {
        symbol: "BUSD",
        name: "Binance USD",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      ADA: {
        symbol: "ADA",
        name: "Cardano",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      SOL: {
        symbol: "SOL",
        name: "Solana",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
        },
      },
      DOGE: {
        symbol: "DOGE",
        name: "Dogecoin",
        sources: {
          tidebit: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          okex: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_1,
          },
          exchange01: {
            balance: "0",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.NULL,
          },
          exchange02: {
            balance: "568.39572",
            locked: "0",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_2,
          },
          exchange03: {
            balance: "62.4576",
            locked: "37.9344",
            RRR: "333",
            MPA: "666",
            alertLevel: PLATFORMASSET.WARNING_LEVEL.LEVEL_3,
          },
          exchange04: {
            balance: "862.46132",
            locked: "137.9344",
            RRR: "333",
            MPA: "666",
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
          <div className="currency-settings__rows">
            {filterAssets?.map((asset) => (
              <div
                className="currency-dropdown admin-dropdown"
                key={asset.name + asset.symbol}
              >
                <AssetSettingTile
                  asset={asset}
                  settingDialogHandler={(open) => {
                    setSelectedAsset(asset);
                    setOpenSettingDialog(open);
                  }}
                />
              </div>
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
