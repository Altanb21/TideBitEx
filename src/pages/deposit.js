import { useTranslation } from "react-i18next";
import React, { useState, useContext, useEffect, useCallback } from "react";
import TableSwitchWithLock from "../components/TableSwitchWithLock";
// import TableDropdown from "../components/TableDropdown";
import StoreContext from "../store/store-context";
import Dialog from "../components/Dialog";
import LoadingDialog from "../components/LoadingDialog";
import SafeMath from "../utils/SafeMath";
import { useSnackbar } from "notistack";
import { COIN_SETTING_TYPE } from "../constant/CoinSetting";

// let timer;

const FeeControlDialog = (props) => {
  const { t } = useTranslation();
  const [fee, setFee] = useState(null);

  const onConfirm = useCallback(() => {
    if (fee) {
      props.onConfirm(props.currency.id, COIN_SETTING_TYPE.FEE, {
        fee,
      });
    }
  }, [fee, props]);

  return (
    <Dialog
      className="deposit__dialog"
      title={t("setting")}
      onClose={props.onClose}
      onCancel={props.onCancel}
      onConfirm={onConfirm}
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
                // htmlFor={`${props.type}-current-fee`}
                htmlFor={`${props.type}-fee`}
              >
                {/* {t(`${props.type}-current-fee`)}: */}
                {t(`${props.type}-fee`)}:
              </label>
              <div className="deposit__dialog-input-box">
                <div className="deposit__dialog-input-column">
                  <input
                    className="deposit__dialog-input"
                    // name={`${props.type}-current-fee`}
                    name={`${props.type}-fee`}
                    type="number"
                    min="0"
                    inputMode="decimal"
                    value={fee ? SafeMath.mult(fee, 100) : null}
                    onChange={(e) => {
                      const value = Math.abs(e.target.value);
                      const fee = SafeMath.div(value, 100);
                      setFee(fee);
                    }}
                  />
                  <div className="deposit__dialog-input-caption">{`${t(
                    // `${props.type}-current-fee`
                    `${props.type}-fee`
                  )}: ${SafeMath.mult(
                    // props.currency.depositFee?.current,
                    props.type === COIN_SETTING_TYPE.DEPOSIT
                      ? props.currency.depositFee
                      : props.currency.withdrawFee,
                    100
                  )}%`}</div>
                </div>
                <div className="deposit__dialog-input-suffix">%</div>
              </div>
            </div>
            {/* <div className="deposit__dialog-input-group">
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
                    min="0"
                    value={externalFee ? SafeMath.mult(externalFee, 100) : null}
                    onChange={(e) => {
                      const value = Math.abs(e.target.value);
                      const fee = SafeMath.div(value, 100);
                      setExternalFee(fee);
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
            </div> */}
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
  const [isVisible, setIsVisible] = useState(null); //true, fasle
  const [filterKey, setFilterKey] = useState("");
  // const [active, setActive] = useState(false);
  // const [unLocked, setUnLocked] = useState(false);
  const [openDepositControlDialog, setOpenDepositControlDialog] =
    useState(false);
  const [openWithdrawControlDialog, setOpenWithdrawControlDialog] =
    useState(false);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const sorting = () => {};

  const getCoinsSettings = useCallback(async () => {
    let { coins: coinsSettngs } = await storeCtx.getCoinsSettings();
    console.log(coinsSettngs);
    return coinsSettngs;
  }, [storeCtx]);

  const filter = useCallback(
    ({ filterCoinsSettings, visible, keyword }) => {
      if (visible) setIsVisible(visible);
      let _option = visible || isVisible,
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
              currency.visible === _option &&
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
    async (id, type, data) => {
      setOpenDepositControlDialog(false);
      setIsLoading(true);
      try {
        const { coins: updateCoinsSettings } =
          await storeCtx.updateDepositSetting(id, type, data);
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
    async (id, type, data) => {
      setOpenDepositControlDialog(false);
      setIsLoading(true);
      try {
        const { coins: updateCoinsSettings } =
          await storeCtx.updateWithdrawSetting(id, type, data);
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

  // const updateCoinsSettings = useCallback(
  //   async (visible) => {
  //     try {
  //       setIsLoading(true);
  //       const { coins: updateCoinsSettings } =
  //         await storeCtx.updateCoinsSettings(visible);
  //       setCoinsSettings(updateCoinsSettings);
  //       filter({ filterCoinsSettings: updateCoinsSettings });
  //       enqueueSnackbar(`${t("success-update")}`, {
  //         variant: "success",
  //         anchorOrigin: {
  //           vertical: "top",
  //           horizontal: "center",
  //         },
  //       });
  //     } catch (error) {
  //       enqueueSnackbar(`${t("error-happen")}`, {
  //         variant: "error",
  //         anchorOrigin: {
  //           vertical: "top",
  //           horizontal: "center",
  //         },
  //       });
  //     }
  //     setIsLoading(false);
  //     const timer = setTimeout(() => {
  //       setUnLocked(false);
  //       setActive(false);
  //       clearTimeout(timer);
  //     }, 500);
  //   },
  //   [enqueueSnackbar, filter, storeCtx, t]
  // );

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
    async (type, id, value) => {
      console.log(`toggleStatus`, type, id, value);
      let result, updateCoinsSettings;
      try {
        switch (type) {
          case COIN_SETTING_TYPE.VISIBLE:
            result = await storeCtx.updateCoinSetting(id, value);
            break;
          case COIN_SETTING_TYPE.DEPOSIT:
            result = await storeCtx.updateDepositSetting(
              id,
              COIN_SETTING_TYPE.DEPOSIT,
              {
                disable: value,
              }
            );
            break;
          case COIN_SETTING_TYPE.WITHDRAW:
            result = await storeCtx.updateWithdrawSetting(
              id,
              COIN_SETTING_TYPE.WITHDRAW,
              {
                disable: value,
              }
            );
            break;
          default:
        }
        updateCoinsSettings = result.coins;
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
          type={COIN_SETTING_TYPE.DEPOSIT}
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
          type={COIN_SETTING_TYPE.WITHDRAW}
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
            <div className="screen__display-title">{`${t("show")}:`}</div>
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
        <table className={`screen__table${showMore ? " show" : ""}`}>
          <tr className="screen__table-headers">
            <th className="screen__table-header">幣種</th>
            <th className="screen__table-header">代號</th>
            {/* <th className="screen__table-header">入金交易所</th> */}
            <th className="screen__table-header">
              <div className="screen__table-header--text">入金手續費</div>
              <div className="screen__table-header--icon"></div>
            </th>
            <th className="screen__table-header">
              <div className="screen__table-header--text">出金手續費</div>
              <div className="screen__table-header--icon"></div>
            </th>
            {/* <th
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
                  !coinsSettngs?.some((currency) => currency.visible === true)
                    ? "disable"
                    : ""
                }`}
                onClick={async () => {
                  if (unLocked) {
                    updateCoinsSettings(false);
                  }
                }}
              >
                全部關閉
              </button>
              /
              <button
                disabled={`${
                  !coinsSettngs?.some((currency) => currency.visible === false)
                    ? "disable"
                    : ""
                }`}
                onClick={async () => {
                  if (unLocked) {
                    updateCoinsSettings(true);
                  }
                }}
              >
                全部開啟
              </button>
            </th> */}
            <th className="screen__table-header">
              <div className="screen__table-header--text">{`${t("show")}`}</div>
            </th>
            <th className="screen__table-header">
              <div className="screen__table-header--text">{t("deposit")}</div>
            </th>
            <th className="screen__table-header">
              <div className="screen__table-header--text">{t("withdraw")}</div>
            </th>
          </tr>
          <tbody className="screen__table-rows">
            {filterCoinsSettings &&
              filterCoinsSettings.map((currency) => (
                <tr
                  className={`deposit__currency-tile screen__table-row${
                    currency.alert ? " screen__table--alert" : ""
                  }`}
                  key={currency.code}
                >
                  <td className="deposit__currency-text screen__table-item">
                    <div className="deposit__currency-alert">
                      <div></div>
                    </div>
                    {`${currency.key
                      .substring(0, 1)
                      .toUpperCase()}${currency.key.substring(1)}`}
                  </td>
                  <td className="deposit__currency-text screen__table-item">
                    {currency.code.toUpperCase()}
                  </td>
                  {/* <TableDropdown
                    className="screen__table-item"
                    selectHandler={(option) =>
                      switchExchange(option, currency.id)
                    }
                    options={currency?.exchanges || []}
                    selected={currency?.exchange || ""}
                  /> */}
                  <td className="deposit__currency-text screen__table-item">
                    <div className="screen__table-item--text-box">
                      <div className="screen__table-item--text">
                        {/* <div className="screen__table-item--title">當前：</div> */}
                        <div
                          className={`screen__table-item--value${
                            currency.alert ? " alert" : ""
                          }`}
                        >{`${SafeMath.mult(
                          // currency.depositFee?.current,
                          currency.depositFee,
                          100
                        )}%`}</div>
                      </div>
                      {/* <div className="screen__table-item--text">
                        <div className="screen__table-item--title">外部：</div>
                        <div
                          className={`screen__table-item--value${
                            currency.alert ? " alert" : ""
                          }`}
                        >{`${SafeMath.mult(
                          currency.depositFee?.external,
                          100
                        )}%`}</div>
                      </div> */}
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
                  </td>
                  <td className="deposit__currency-text screen__table-item">
                    <div className="screen__table-item--text-box">
                      <div className="screen__table-item--text">
                        {/* <div className="screen__table-item--title">當前：</div> */}
                        <div className="screen__table-item--value">{`${SafeMath.mult(
                          // currency.withdrawFee?.current,
                          currency.withdrawFee,
                          100
                        )}%`}</div>
                      </div>
                      {/* <div className="screen__table-item--text">
                        <div className="screen__table-item--title">外部：</div>
                        <div className="screen__table-item--value">{`${SafeMath.mult(
                          currency.withdrawFee?.external,
                          100
                        )}%`}</div>
                      </div> */}
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
                  </td>
                  <TableSwitchWithLock
                    className="screen__table-switch"
                    status={currency.visible}
                    toggleStatus={() =>
                      toggleStatus(
                        COIN_SETTING_TYPE.VISIBLE,
                        currency.id,
                        !currency.visible
                      )
                    }
                  />
                  <TableSwitchWithLock
                    className="screen__table-switch"
                    status={currency.deposit}
                    toggleStatus={() =>
                      toggleStatus(
                        COIN_SETTING_TYPE.DEPOSIT,
                        currency.id,
                        !!currency.deposit
                      )
                    }
                  />
                  <TableSwitchWithLock
                    className="screen__table-switch"
                    status={currency.withdraw}
                    toggleStatus={() =>
                      toggleStatus(
                        COIN_SETTING_TYPE.WITHDRAW,
                        currency.id,
                        !!currency.withdraw
                      )
                    }
                  />
                </tr>
              ))}
          </tbody>
          <tfoot
            className="screen__table-btn screen__table-text"
            onClick={() => setShowMore((prev) => !prev)}
          >
            {showMore ? t("show-less") : t("show-more")}
          </tfoot>
        </table>
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
