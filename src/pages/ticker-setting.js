import { useTranslation } from "react-i18next";
import React, { useState, useContext, useEffect, useCallback } from "react";
import StoreContext from "../store/store-context";
import TableSwitchWithLock from "../components/TableSwitchWithLock";
import TableDropdown from "../components/TableDropdown";
import SafeMath from "../utils/SafeMath";
import Dialog from "../components/Dialog";
import LoadingDialog from "../components/LoadingDialog";
import { useSnackbar } from "notistack";
import {
  TICKER_SETTING_FEE_SIDE,
  TICKER_SETTING_TYPE,
} from "../constant/TickerSetting";

// let timer;

const groups = {
  HKD: ["HKD"],
  USDX: ["USDC", "USDT", "USDK"],
  INNO: ["INNO"],
  USD: ["USD"],
  ALTS: ["USX"],
  OTHERS: ["BTC"],
};

const FeeControlDialog = (props) => {
  const { t } = useTranslation();
  const [defaultFee, setDefaultFee] = useState(null);
  const [vipFee, setVIPFee] = useState(null);
  const [heroFee, setHeroFee] = useState(null);

  const onConfirm = useCallback(() => {
    if (defaultFee || vipFee || heroFee) {
      props.onConfirm({
        side: props.side,
        fee: {
          defaultFee: defaultFee || props.ticker[props.side].fee,
          vipFee: vipFee || props.ticker[props.side].vipFee,
          heroFee: heroFee || props.ticker[props.side].heroFee,
        },
      });
    }
  }, [defaultFee, heroFee, props, vipFee]);

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
          {props.ticker.name}
        </div>
        <div className="screen__dialog-content--body">
          <div className="screen__dialog-inputs">
            <div className="screen__dialog-input-group">
              <label
                className="screen__dialog-input-label"
                htmlFor={`${props.side}-default-fee`}
              >
                {t(`${props.side}-default-fee`)}:
              </label>
              <div className="screen__dialog-input-box">
                <div className="screen__dialog-input-column">
                  <input
                    className="screen__dialog-input"
                    name={`${props.side}-default-fee`}
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={defaultFee ? SafeMath.mult(defaultFee, 100) : null}
                    onChange={(e) => {
                      const value = Math.abs(e.target.value);
                      const fee = SafeMath.div(value, 100);
                      setDefaultFee(fee);
                    }}
                  />
                  <div className="screen__dialog-input-caption">{`${t(
                    `current-${props.side}-default-fee`
                  )}: ${SafeMath.mult(
                    props.ticker[props.side].fee,
                    100
                  )}%`}</div>
                </div>
                <div className="screen__dialog-input-suffix">%</div>
              </div>
            </div>
            <div className="screen__dialog-input-group">
              <label
                className="screen__dialog-input-label"
                htmlFor={`${props.side}-vip-fee`}
              >
                {t(`${props.side}-vip-fee`)}:
              </label>
              <div className="screen__dialog-input-box">
                <div className="screen__dialog-input-column">
                  <input
                    className="screen__dialog-input"
                    name={`${props.side}-vip-fee`}
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={vipFee ? SafeMath.mult(vipFee, 100) : null}
                    onChange={(e) => {
                      const value = Math.abs(e.target.value);
                      const fee = SafeMath.div(value, 100);
                      setVIPFee(fee);
                    }}
                  />
                  <div className="screen__dialog-input-caption">{`${t(
                    `current-${props.side}-vip-fee`
                  )}: ${SafeMath.mult(
                    props.ticker[props.side].fee,
                    100
                  )}%`}</div>
                </div>
                <div className="screen__dialog-input-suffix">%</div>
              </div>
            </div>
            <div className="screen__dialog-input-group">
              <label
                className="screen__dialog-input-label"
                htmlFor={`${props.side}-hero-fee`}
              >
                {t(`${props.side}-hero-fee`)}:
              </label>
              <div className="screen__dialog-input-box">
                <div className="screen__dialog-input-column">
                  <input
                    className="screen__dialog-input"
                    name={`${props.side}-hero-fee`}
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={heroFee ? SafeMath.mult(heroFee, 100) : null}
                    onChange={(e) => {
                      const value = Math.abs(e.target.value);
                      const fee = SafeMath.div(value, 100);
                      setHeroFee(fee);
                    }}
                  />
                  <div className="screen__dialog-input-caption">{`${t(
                    `current-${props.side}-hero-fee`
                  )}: ${SafeMath.mult(
                    props.ticker[props.side].fee,
                    100
                  )}%`}</div>
                </div>
                <div className="screen__dialog-input-suffix">%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

const TickerSetting = () => {
  const storeCtx = useContext(StoreContext);
  const [showMore, setShowMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInit, setIsInit] = useState(null);
  const [tickers, setTickers] = useState(null);
  const [filterTickers, setFilterTickers] = useState(null);
  const [isVisible, setIsVisible] = useState(null); //true, fasle
  const [filterKey, setFilterKey] = useState("");
  const [group, setGroup] = useState(Object.keys(groups)[0]);
  const [selectedTickerSetting, setSelectedTickerSetting] = useState(null);
  const [side, setSide] = useState(null);
  // const [active, setActive] = useState(false);
  // const [unLocked, setUnLocked] = useState(false);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [openFeeControlDialog, setOpenFeeControlDialog] = useState(false);

  const { t } = useTranslation();

  const filter = useCallback(
    ({ keyword, visible, filterGroup, filterTickers }) => {
      // console.log(`keyword`, keyword);
      // console.log(`visible`, visible);
      // console.log(`filterGroup`, filterGroup);
      // console.log(`filterTickers`, filterTickers);
      if (visible !== undefined) setIsVisible(visible);
      if (filterGroup) setGroup(filterGroup);
      let _tickers = filterTickers || tickers,
        _option = visible !== undefined ? visible : isVisible,
        _keyword = keyword === undefined ? filterKey : keyword,
        _group = filterGroup || group;
      if (_tickers) {
        _tickers = Object.values(_tickers).filter((ticker) => {
          // console.log(`ticker`, ticker);
          // console.log(`groups[${_group}]`, ticker.group);
          // console.log(`_option[${_option}]`, ticker.visible);
          let condition =
            ticker.name.includes(_keyword) &&
            _group === ticker.group.toUpperCase();
          if (_option !== null)
            condition = condition && ticker.visible === _option;
          return condition;
        });
        setFilterTickers(_tickers);
      }
    },
    [filterKey, group, isVisible, tickers]
  );

  const getTickersSettings = useCallback(async () => {
    let tickersSettings = await storeCtx.getTickersSettings();
    return tickersSettings;
  }, [storeCtx]);

  const sorting = () => {};

  const updateTickerSetting = useCallback(
    async (id, type, data) => {
      setIsLoading(true);
      console.log(`updateTickerSetting`, type, id, data);
      try {
        let updateTickersSettings = await storeCtx.updateTickerSetting(id, {
          type,
          data,
        });
        setTickers(updateTickersSettings);
        filter({ filterTickers: updateTickersSettings });
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
    },
    [enqueueSnackbar, filter, storeCtx, t]
  );

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        const tickers = await getTickersSettings();
        setTickers(tickers);
        filter({ filterTickers: tickers });
        return !prev;
      } else return prev;
    });
  }, [getTickersSettings, filter]);

  useEffect(() => {
    if (!isInit) {
      init();
    }
  }, [init, isInit]);

  return (
    <>
      {isLoading && <LoadingDialog />}
      {openFeeControlDialog && selectedTickerSetting && side && (
        <FeeControlDialog
          side={side}
          ticker={selectedTickerSetting}
          onClose={() => setOpenFeeControlDialog(false)}
          onCancel={() => {
            setOpenFeeControlDialog(false);
          }}
          onConfirm={(data) =>
            updateTickerSetting(
              selectedTickerSetting.id,
              TICKER_SETTING_TYPE.FEE,
              data
            )
          }
        />
      )}
      <section className="screen__section admin-ticker">
        <div className="screen__header">交易對設定</div>
        <div className="screen__search-bar">
          <TableDropdown
            className="screen__filter"
            selectHandler={(option) => filter({ filterGroup: option })}
            options={Object.keys(groups)}
            selected={group}
          />
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
                  isVisible === null ? " active" : ""
                }`}
                onClick={() => filter({ visible: null })}
              >
                全部
              </li>
              <li
                className={`screen__display-option${
                  isVisible === true ? " active" : ""
                }`}
                onClick={() => filter({ visible: true })}
              >
                已開啟
              </li>
              <li
                className={`screen__display-option${
                  isVisible === false ? " active" : ""
                }`}
                onClick={() => filter({ visible: false })}
              >
                未開啟
              </li>
            </ul>
          </div>
          <div className="screen__sorting">
            <img src="/img/sorting@2x.png" alt="sorting" />
          </div>
        </div>
        <div className={`screen__table${showMore ? " show" : ""}`}>
          <ul className="screen__table-headers">
            <li className="screen__table-header">交易對</li>
            <li className="screen__table-header">24h 成交量</li>
            <li className="screen__table-header">24h 漲跌</li>
            <li className="screen__table-header">交易所</li>
            <li className="screen__table-header">
              <div className="screen__table-header--text">Ask 手續費</div>
              <div className="screen__table-header--icon"></div>
            </li>
            <li className="screen__table-header">
              <div className="screen__table-header--text">Bid 手續費</div>
              <div className="screen__table-header--icon"></div>
            </li>
            {/* <li
            className={`screen__table-header-btn${active ? " active" : ""}${
              unLocked ? " unLocked" : ""
            }`}
            onClick={() => {
              setActive(true);
              timer = setTimeout(() => {
                setUnLocked(false);
                setActive(false);
                clearTimeout(timer);
              }, 3000);
            }}
          >
            <div
              className="screen__table-header-btn--lock"
              onClick={() => {
                if (active) {
                  clearTimeout(timer);
                  setUnLocked(true);
                  timer = setTimeout(() => {
                    setUnLocked(false);
                    setActive(false);
                    clearTimeout(timer);
                  }, 3000);
                }
              }}
            ></div>
            <button
              disabled={`${
                !Object.values(tickers || {}).some(
                  (ticker) => ticker.visible === true
                )
                  ? "disable"
                  : ""
              }`}
              onClick={() => {
                if (unLocked) {
                  const updateTickers = { ...tickers };
                  Object.values(updateTickers).forEach(
                    (ticker) => (ticker.visible = false)
                  );
                  setTickers(updateTickers);
                  const timer = setTimeout(() => {
                    setUnLocked(false);
                    setActive(false);
                    clearTimeout(timer);
                  }, 500);
                }
              }}
            >
              全部關閉
            </button>
            /
            <button
              disabled={`${
                !Object.values(tickers || {}).some(
                  (ticker) => ticker.visible === false
                )
                  ? "disable"
                  : ""
              }`}
              onClick={() => {
                if (unLocked) {
                  const updateTickers = { ...tickers };
                  Object.values(updateTickers).forEach(
                    (ticker) => (ticker.visible = true)
                  );
                  setTickers(updateTickers);
                  const timer = setTimeout(() => {
                    setUnLocked(false);
                    setActive(false);
                    clearTimeout(timer);
                  }, 500);
                }
              }}
            >
              全部開啟
            </button>
          </li> */}
            <li className="screen__table-header">
              <div className="screen__table-header--text">{`${t("show")}`}</div>
            </li>
          </ul>
          <ul className="screen__table-rows">
            {filterTickers &&
              filterTickers.map((ticker) => (
                <div
                  className={`admin-ticker__tile screen__table-row${
                    ticker.change > 0 ? " increase" : " descrease"
                  }${ticker.alert ? " screen__table--alert" : ""}`}
                  key={ticker.id}
                >
                  <div className="admin-ticker__text screen__table-item">
                    <div className="admin-ticker__alert">
                      <div></div>
                    </div>
                    {ticker.name}
                  </div>
                  <div className="admin-ticker__text screen__table-item">
                    {ticker.volume}
                  </div>
                  <div className="admin-ticker__text screen__table-item">
                    {`${(ticker.changePct * 100).toFixed(2)}%`}
                  </div>
                  <TableDropdown
                    className="screen__table-item"
                    selectHandler={(option) =>
                      updateTickerSetting(
                        ticker.id,
                        TICKER_SETTING_TYPE.SOURCE,
                        { source: option }
                      )
                    }
                    options={ticker.exchanges}
                    selected={ticker.source}
                  />
                  <div className="admin-ticker__text screen__table-item">
                    <div className="screen__table-item--text-box">
                      <div className="screen__table-item--text">
                        <div className="screen__table-item--title">
                          Default:
                        </div>
                        <div className="screen__table-item--value">{`${SafeMath.mult(
                          ticker.ask?.fee,
                          100
                        )}%`}</div>
                      </div>
                      <div className="screen__table-item--text">
                        <div className="screen__table-item--title">VIP:</div>
                        <div className="screen__table-item--value">{`${SafeMath.mult(
                          ticker.ask?.vipFee,
                          100
                        )}%`}</div>
                      </div>
                      <div className="screen__table-item--text">
                        <div className="screen__table-item--title">Hero:</div>
                        <div className="screen__table-item--value">{`${SafeMath.mult(
                          ticker.ask?.heroFee,
                          100
                        )}%`}</div>
                      </div>
                    </div>
                    <div
                      className="screen__table-item--icon"
                      onClick={() => {
                        setSide(TICKER_SETTING_FEE_SIDE.ASK);
                        setSelectedTickerSetting(ticker);
                        setOpenFeeControlDialog(true);
                      }}
                    ></div>
                  </div>
                  <div className="admin-ticker__text screen__table-item">
                    <div className="screen__table-item--text-box">
                      <div className="screen__table-item--text">
                        <div className="screen__table-item--title">
                          Default:
                        </div>
                        <div className="screen__table-item--value">{`${SafeMath.mult(
                          ticker.bid?.fee,
                          100
                        )}%`}</div>
                      </div>
                      <div className="screen__table-item--text">
                        <div className="screen__table-item--title">VIP:</div>
                        <div className="screen__table-item--value">{`${SafeMath.mult(
                          ticker.bid?.vipFee,
                          100
                        )}%`}</div>
                      </div>
                      <div className="screen__table-item--text">
                        <div className="screen__table-item--title">Hero:</div>
                        <div className="screen__table-item--value">{`${SafeMath.mult(
                          ticker.bid?.heroFee,
                          100
                        )}%`}</div>
                      </div>
                    </div>
                    <div
                      className="screen__table-item--icon"
                      onClick={() => {
                        setSide(TICKER_SETTING_FEE_SIDE.BID);
                        setSelectedTickerSetting(ticker);
                        setOpenFeeControlDialog(true);
                      }}
                    ></div>
                  </div>
                  <TableSwitchWithLock
                    className="screen__table-switch"
                    status={ticker.visible}
                    toggleStatus={() =>
                      updateTickerSetting(
                        ticker.id,
                        TICKER_SETTING_TYPE.SOURCE,
                        { visible: !ticker.visible }
                      )
                    }
                  />
                </div>
              ))}
          </ul>
          <div
            className="screen__table-btn screen__table-text"
            onClick={() => setShowMore((prev) => !prev)}
          >
            {showMore ? t("show-less") : t("show-more")}
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

export default TickerSetting;
