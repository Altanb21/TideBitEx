import React, { useState, useContext, useEffect, useCallback } from "react";
import StoreContext from "../store/store-context";
import SafeMath from "../utils/SafeMath";
import Dialog from "../components/Dialog";
import LoadingDialog from "../components/LoadingDialog";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { PLATFORM_ASSET } from "../constant/PlatformAsset";

const InputRange = (props) => {
  const [init, setInit] = useState(false);
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
  useEffect(() => {
    if (!init) {
      const newValue = Number(
          ((props.value - props.min) * 100) / (props.max - props.min)
        ),
        newPosition = 16 - newValue * 0.32;
      document.documentElement.style.setProperty(
        `--range-progress-${props.type}`,
        `calc(${newValue}% + (${newPosition}px))`
      );
      setInit(true);
    }
  }, [init, props.max, props.min, props.type, props.value]);
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
  // const [maximun, setMaximun] = useState(null);
  // const [minimun, setMinimun] = useState(null);
  const [MPARatio, setMPARatio] = useState(
    // SafeMath.mult(SafeMath.div(props.asset.MPA, props.asset.sum), 100)
    SafeMath.mult(props.asset.MPARatio, 100)
  );
  const [RRRRatio, setRRRRatio] = useState(
    // SafeMath.mult(SafeMath.div(props.asset.RRR, props.asset.sum), 100)
    SafeMath.mult(props.asset.RRRRatio, 100)
  );

  const onConfirm = useCallback(() => {
    if (
      // maximun || minimun ||
      MPARatio ||
      RRRRatio
    ) {
      props.onConfirm({
        // maximun: maximun ? maximun : props.asset.maximun,
        // minimun: minimun ? minimun : props.asset.minimun,
        MPARatio: MPARatio
          ? // ? SafeMath.mult(SafeMath.div(MPARatio, 100), props.asset.sum)
            SafeMath.div(MPARatio, 100)
          : props.asset.MPARatio,
        RRRRatio: RRRRatio
          ? // ? SafeMath.mult(SafeMath.div(RRRRatio, 100), props.asset.sum)
            SafeMath.div(RRRRatio, 100)
          : props.asset.RRRRatio,
      });
    }
  }, [MPARatio, RRRRatio, props]);

  return (
    <Dialog
      open={props.open}
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
              src={`/icons/${props.asset.code}.png`}
              alt={props.asset.code}
            />
          </div>
          <div className="screen__dialog-content--value">
            {props.asset.code.toUpperCase()}
          </div>
        </div>
        <div className="screen__dialog-content--body">
          <div className="screen__dialog-inputs">
            {/* <div className="screen__dialog-input-group">
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
                  {props.asset.code.toUpperCase()}
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
                  {props.asset.code.toUpperCase()}
                </div>
              </div>
            </div> */}
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
      key={props.asset.key + props.asset.code}
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
              src={`/icons/${props.asset.code}.png`}
              alt={props.asset.code}
            />
          </div>
          <div className="platform-assets__leading--value">
            {props.asset.code.toUpperCase()}
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
                              SafeMath.div(totalBalance, props.asset.sum),
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
                              // SafeMath.div(props.asset.RRR, props.asset.sum),
                              props.asset.RRRRatio,
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
                              // SafeMath.div(props.asset.MPA, props.asset.sum),
                              props.asset.MPARatio,
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
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const filter = useCallback(
    ({ filterAssets, alert, keyword }) => {
      try {
        if (alert !== undefined) setAlertFilter(alert);
        let _assets = filterAssets || assets,
          _option = alert !== undefined ? alert : alertFilter,
          _keyword = keyword === undefined ? filterKey : keyword;
        if (_assets) {
          _assets = Object.values(_assets).filter((asset) => {
            let condition =
              asset.key?.includes(_keyword.toLowerCase()) ||
              asset.code?.includes(_keyword.toLowerCase());
            if (_option)
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
    [alertFilter, assets, filterKey]
  );

  const updatePlatformAsset = useCallback(
    async (id, data) => {
      setIsLoading(true);
      console.log(`updatePlatformAsset`, id, data);
      try {
        const updatedPlatformAssets = await storeCtx.updatePlatformAsset(
          id,
          data
        );
        setAssets(updatedPlatformAssets);
        filter({ filterAssets: updatedPlatformAssets });
        enqueueSnackbar(`${t("success-update")}`, {
          variant: "success",
          anchorOrigin: {
            vertical: "top",
            horizontal: "center",
          },
        });
      } catch (error) {
        enqueueSnackbar(`${t("error-happen")}`, {
          variant: "error",
          anchorOrigin: {
            vertical: "top",
            horizontal: "center",
          },
        });
      }
      setIsLoading(false);
      setOpenSettingDialog(false);
    },
    [enqueueSnackbar, filter, storeCtx, t]
  );

  const getPlatformAssets = useCallback(async () => {
    const platformAssets = await storeCtx.getPlatformAssets();
    console.log(`platformAssets`, platformAssets);
    return platformAssets;
  }, [storeCtx]);

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        setIsLoading(true);
        const assets = await getPlatformAssets();
        setAssets(assets);
        filter({ filterAssets: assets });
        setIsLoading(false);
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
      <LoadingDialog isLoading={isLoading} />
      <AssetSettingDialog
        open={openSettingDialog && selectedAsset}
        asset={selectedAsset}
        onClose={() => setOpenSettingDialog(false)}
        onCancel={() => {
          setOpenSettingDialog(false);
        }}
        onConfirm={(data) => updatePlatformAsset(selectedAsset.id, data)}
      />
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
                onClick={() => filter({ alert: true })}
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
