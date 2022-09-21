import { useTranslation } from "react-i18next";
import React, { useState, useContext, useEffect, useCallback } from "react";
import TableSwitchWithLock from "../components/TableSwitchWithLock";
// import TableDropdown from "../components/TableDropdown";
import StoreContext from "../store/store-context";
import Dialog from "../components/Dialog";
import LoadingDialog from "../components/LoadingDialog";
import SafeMath from "../utils/SafeMath";
import { useSnackbar } from "notistack";
import { convertExponentialToDecimal } from "../utils/Utils";

let timer;

const FeeControlDialog = (props) => {
  const { t } = useTranslation();
  const [currency, setCoinSetting] = useState({});

  const formatValue = useCallback(({ value, precision = 8 }) => {
    let formatedValue = +value < 0 ? "0" : convertExponentialToDecimal(value);
    if (formatedValue.toString().includes(".")) {
      if (formatedValue.toString().split(".")[1].length >= precision) {
        let arr = formatedValue.toString().split(".");
        let decimal = arr[1].substring(0, precision);
        formatedValue = `${arr[0]}.${decimal}`;
      }
      if (formatedValue.toString().startsWith(".")) {
        formatedValue = `0${formatedValue}`;
      }
    } else {
      if (!!formatedValue && !isNaN(parseInt(formatedValue)))
        formatedValue = parseInt(formatedValue).toString();
    }
    return { formatedValue };
  }, []);

  return (
    <Dialog
      className="deposit__dialog"
      title={t("setting")}
      onClose={props.onClose}
      onCancel={props.onCancel}
      onConfirm={() => {
        if (currency.depositFee && currency.withdrawFee) {
          props.onConfirm(currency);
        }
      }}
    >
      <div className="deposit__dialog-content">
        <div className="deposit__dialog-content--title">
          {props.currency.code.toUpperCase()}
        </div>
        <div className="deposit__dialog-content--body">
          <div className="deposit__dialog-inputs">
            <div className="deposit__dialog-input-group">
              <label
                className="deposit__dialog-input-label"
                htmlFor={`${props.type}-current-fee`}
              >
                {t(`${props.type}-current-fee`)}:
              </label>
              <div className="deposit__dialog-input-box">
                <div className="deposit__dialog-input-column">
                  <input
                    className="deposit__dialog-input"
                    name={`${props.type}-current-fee`}
                    type="number"
                    inputMode="decimal"
                    onChange={(e) => {
                      const value = formatValue(e.target.value);
                      const fee = SafeMath.div(value, 100);
                      setCoinSetting((prev) => ({
                        ...prev,
                        depositFee: { ...prev.depositFee, current: fee },
                        withdrawFee: { ...prev.withdrawFee },
                      }));
                    }}
                  />
                  <div className="deposit__dialog-input-caption">{`${t(`${props.type}-current-fee`)}: ${SafeMath.mult(
                    props.currency.depositFee?.current,
                    100
                  )}%`}</div>
                </div>
                <div className="deposit__dialog-input-suffix">%</div>
              </div>
            </div>
            <div className="deposit__dialog-input-group">
              <label
                className="deposit__dialog-input-label"
                htmlFor={`${props.type}-external-fee`}
              >
                {t(`${props.type}-external-fee`)}:
              </label>
              <div className="deposit__dialog-input-box">
                <div className="deposit__dialog-input-column">
                  <input
                    className="deposit__dialog-input"
                    name={`${props.type}-external-fee`}
                    type="number"
                    inputMode="decimal"
                    onChange={(e) => {
                      const value = formatValue(e.target.value);
                      const fee = SafeMath.div(value, 100);
                      setCoinSetting((prev) => ({
                        ...prev,
                        depositFee: { ...prev.depositFee },
                        withdrawFee: { ...prev.withdrawFee, current: fee },
                      }));
                    }}
                  />
                  <div className="deposit__dialog-input-caption">{`${t(
                    `${props.type}-external-fee`
                  )}: ${SafeMath.mult(
                    props.currency.withdrawFee?.current,
                    100
                  )}%`}</div>
                </div>
                <div className="deposit__dialog-input-suffix">%</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

const Deposit = () => {
  const storeCtx = useContext(StoreContext);

  const [showMore, setShowMore] = useState(false);
  const [isInit, setIsInit] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [coinsSettngs, setCoinsSettings] = useState(null);
  const [selectedCoinSetting, setSelectedCoinSetting] = useState(null);
  const [filterCoinsSettings, setFilterCoinsSettings] = useState(null);
  const [isVisible, setIsVisibile] = useState(null); //true, fasle
  const [filterKey, setFilterKey] = useState("");
  const [active, setActive] = useState(false);
  const [unLocked, setUnLocked] = useState(false);
  const [openDepositControlDialog, setOpenDepositControlDialog] =
    useState(false);
  const [openWithdrawControlDialog, setOpenWithdrawControlDialog] =
    useState(false);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const sorting = () => {};

  const getCoinsSettings = useCallback(async () => {
    let coinsSettngs = await storeCtx.getCoinsSettings();
    return coinsSettngs;
  }, [storeCtx]);

  const filter = useCallback(
    ({ filterCoinsSettings, visibile, keyword }) => {
      if (visibile) setIsVisibile(visibile);
      let _option = visibile || isVisible,
        _keyword = keyword === undefined ? filterKey : keyword,
        _coinsSettngs = filterCoinsSettings || coinsSettngs;
      if (_coinsSettngs) {
        _coinsSettngs = _coinsSettngs.filter((currency) => {
          if (_option === null)
            return (
              currency.key.includes(_keyword) ||
              currency.symbol.includes(_keyword)
            );
          else
            return (
              currency.visibile === _option &&
              (currency.key.includes(_keyword) ||
                currency.symbol.includes(_keyword))
            );
        });
        setFilterCoinsSettings(_coinsSettngs);
      }
    },
    [coinsSettngs, filterKey, isVisible]
  );

  const updateDepositSetting = useCallback(
    async (id, fee, externalFee) => {
      setOpenDepositControlDialog(false);
      setIsLoading(true);
      try {
        const { coins: updateCoinsSettings } =
          await storeCtx.updateDepositSetting(id, fee, externalFee);
        setCoinsSettings(updateCoinsSettings);
        filter({ filterCoinsSettings: updateCoinsSettings });
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

  const updateWithdrawSetting = useCallback(
    async (id, fee, externalFee) => {
      setOpenDepositControlDialog(false);
      setIsLoading(true);
      try {
        const { coins: updateCoinsSettings } =
          await storeCtx.updateWithdrawSetting(id, fee, externalFee);
        setCoinsSettings(updateCoinsSettings);
        filter({ filterCoinsSettings: updateCoinsSettings });
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

  // const switchExchange = useCallback(
  //   (exchange, id) => {
  //     console.log(`switchExchange`, exchange, id);
  //     const updateCoinsSettings = coinsSettngs.map((currency) => ({
  //       ...currency,
  //     }));
  //     const index = updateCoinsSettings.findIndex(
  //       (currency) => currency.id.toString() === id.toString()
  //     );
  //     updateCoinsSettings[index].exchange = exchange;
  //     setCoinsSettings(updateCoinsSettings);
  //   },
  //   [coinsSettngs]
  // );

  const toggleStatus = useCallback(
    async (id, visibile) => {
      console.log(`toggleStatus`, id, visibile);
      try {
        const { coins: updateCoinsSettings } = await storeCtx.updateCoinSetting(
          id,
          visibile
        );
        setCoinsSettings(updateCoinsSettings);
        filter({ filterCoinsSettings: updateCoinsSettings });
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
        const coinsSettngs = await getCoinsSettings();
        setCoinsSettings(coinsSettngs);
        filter({ filterCoinsSettings: coinsSettngs });
        return !prev;
      } else return prev;
    });
  }, [filter, getCoinsSettings]);

  useEffect(() => {
    if (!isInit) {
      init();
    }
  }, [init, isInit]);

  return (
    <>
      {isLoading && <LoadingDialog />}
      {openDepositControlDialog && selectedCoinSetting && (
        <FeeControlDialog
          type="deposit"
          currency={selectedCoinSetting}
          onClose={() => setOpenDepositControlDialog(false)}
          onCancel={() => {
            setOpenDepositControlDialog(false);
          }}
          onConfirm={updateDepositSetting}
        />
      )}
      {openWithdrawControlDialog && selectedCoinSetting && (
        <FeeControlDialog
          type="withdraw"
          currency={selectedCoinSetting}
          onClose={() => setOpenWithdrawControlDialog(false)}
          onCancel={() => {
            setOpenWithdrawControlDialog(false);
          }}
          onConfirm={updateWithdrawSetting}
        />
      )}
      <section className="screen__section deposit">
        <div className="screen__header">入金管理</div>
        {/* <ScreenTags
        selectedTag={selectedTag}
        selectTagHandler={selectTagHandler}
        coinsSettngs={coinsSettngs}
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
                  isVisible === null ? " active" : ""
                }`}
                onClick={() => filter("all")}
              >
                全部
              </li>
              <li
                className={`screen__display-option${
                  isVisible === true ? " active" : ""
                }`}
                onClick={() => filter("open")}
              >
                已開啟
              </li>
              <li
                className={`screen__display-option${
                  isVisible === false ? " active" : ""
                }`}
                onClick={() => filter("close")}
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
            <li className="screen__table-header">幣種</li>
            <li className="screen__table-header">代號</li>
            {/* <li className="screen__table-header">入金交易所</li> */}
            <li className="screen__table-header">
              <div className="screen__table-header--text">入金手續費</div>
              <div className="screen__table-header--icon"></div>
            </li>
            <li className="screen__table-header">
              <div className="screen__table-header--text">出金手續費</div>
              <div className="screen__table-header--icon"></div>
            </li>
            <li
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
                  !coinsSettngs.some((currency) => currency.visibile === true)
                    ? "disable"
                    : ""
                }`}
                onClick={async () => {
                  if (unLocked) {
                    // ++TODO
                    try {
                      setIsLoading(true);
                      const { coins: updateCoinsSettings } =
                        await storeCtx.updateCoinsSettings(false);
                      setCoinsSettings(updateCoinsSettings);
                      filter({ filterCoinsSettings: updateCoinsSettings });
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
                  !coinsSettngs.some((currency) => currency.visibile === false)
                    ? "disable"
                    : ""
                }`}
                onClick={async () => {
                  if (unLocked) {
                    // ++TODO
                    try {
                      setIsLoading(true);
                      const { coins: updateCoinsSettings } =
                        await storeCtx.updateCoinsSettings(true);
                      setCoinsSettings(updateCoinsSettings);
                      filter({ filterCoinsSettings: updateCoinsSettings });
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
                    const timer = setTimeout(() => {
                      setUnLocked(false);
                      setActive(false);
                      clearTimeout(timer);
                    }, 500);
                  }
                  }
                }}
              >
                全部開啟
              </button>
            </li>
          </ul>
          <ul className="screen__table-rows">
            {filterCoinsSettings &&
              filterCoinsSettings.map((currency) => (
                <div
                  className={`deposit__currency-tile screen__table-row${
                    currency.alert ? " alert" : ""
                  }`}
                  key={currency.code}
                >
                  <div className="deposit__currency-text screen__table-item">
                    <div className="deposit__currency-alert">
                      <div></div>
                    </div>
                    {`${currency.key
                      .substring(0, 1)
                      .toUpperCase()}${currency.key.substring(1)}`}
                  </div>
                  <div className="deposit__currency-text screen__table-item">
                    {currency.code.toUpperCase()}
                  </div>
                  {/* <TableDropdown
                    className="screen__table-item"
                    selectHandler={(option) =>
                      switchExchange(option, currency.id)
                    }
                    options={currency?.exchanges || []}
                    selected={currency?.exchange || ""}
                  /> */}
                  <div className="deposit__currency-text screen__table-item">
                    <div className="screen__table-item--text-box">
                      <div className="screen__table-item--text">
                        <div className="screen__table-item--title">當前：</div>
                        <div
                          className={`screen__table-item--value${
                            currency.alert ? " alert" : ""
                          }`}
                        >{`${SafeMath.mult(
                          currency.depositFee?.current,
                          100
                        )}%`}</div>
                      </div>
                      <div className="screen__table-item--text">
                        <div className="screen__table-item--title">外部：</div>
                        <div
                          className={`screen__table-item--value${
                            currency.alert ? " alert" : ""
                          }`}
                        >{`${SafeMath.mult(
                          currency.depositFee?.external,
                          100
                        )}%`}</div>
                      </div>
                    </div>
                    <div
                      className="screen__table-item--icon"
                      onClick={() => {
                        // console.log(`currency`, currency);
                        // if(currency.visibilt === true){
                        setSelectedCoinSetting(currency);
                        setOpenDepositControlDialog(true);
                        // }
                      }}
                    ></div>
                  </div>
                  <div className="deposit__currency-text screen__table-item">
                    <div className="screen__table-item--text-box">
                      <div className="screen__table-item--text">
                        <div className="screen__table-item--title">當前：</div>
                        <div className="screen__table-item--value">{`${SafeMath.mult(
                          currency.withdrawFee?.current,
                          100
                        )}%`}</div>
                      </div>
                      <div className="screen__table-item--text">
                        <div className="screen__table-item--title">外部：</div>
                        <div className="screen__table-item--value">{`${SafeMath.mult(
                          currency.withdrawFee?.external,
                          100
                        )}%`}</div>
                      </div>
                    </div>
                    <div
                      className="screen__table-item--icon"
                      onClick={() => {
                        // console.log(`currency`, currency);
                        // if(currency.visibilt === true){
                        setSelectedCoinSetting(currency);
                        setOpenWithdrawControlDialog(true);
                        // }
                      }}
                    ></div>
                  </div>
                  <TableSwitchWithLock
                    className="screen__table-switch"
                    status={currency.visibile}
                    toggleStatus={() =>
                      toggleStatus(currency.id, !currency.visibile)
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

export default Deposit;
