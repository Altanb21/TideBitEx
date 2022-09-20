import { useTranslation } from "react-i18next";
import React, { useState, useContext, useEffect, useCallback } from "react";
import TableSwitchWithLock from "../components/TableSwitchWithLock";
import TableDropdown from "../components/TableDropdown";
import StoreContext from "../store/store-context";
import Dialog from "../components/Dialog";
import LoadingDialog from "../components/LoadingDialog";
import SafeMath from "../utils/SafeMath";
import { useSnackbar } from "notistack";
import { convertExponentialToDecimal } from "../utils/Utils";

let timer;

const FeeControlDialog = (props) => {
  const { t } = useTranslation();
  const [currency, setCurrency] = useState({});

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
          {props.currency.symbol}
        </div>
        <div className="deposit__dialog-content--body">
          <div className="deposit__dialog-inputs">
            <div className="deposit__dialog-input-group">
              <label
                className="deposit__dialog-input-label"
                htmlFor="deposit-fee"
              >
                {t("deposit-fee")}:
              </label>
              <input
                className="deposit__dialog-input"
                name="deposit-fee"
                type="number"
                inputMode="decimal"
                onChange={(e) => {
                  const value = formatValue(e.target.value);
                  setCurrency((prev) => ({
                    ...prev,
                    depositFee: { ...prev.depositFee, current: value },
                    withdrawFee: { ...prev.withdrawFee },
                  }));
                }}
              />
              <div className="deposit__dialog-input-suffix">%</div>
            </div>
            <div className="deposit__dialog-input-group">
              <label
                className="deposit__dialog-input-label"
                htmlFor="withdraw-fee"
              >
                {t("withdraw-fee")}:
              </label>
              <div className="deposit__dialog-input-box">
                <input
                  className="deposit__dialog-input"
                  name="withdraw-fee"
                  type="number"
                  inputMode="decimal"
                  onChange={(e) => {
                    const value = formatValue(e.target.value);
                    setCurrency((prev) => ({
                      ...prev,
                      depositFee: { ...prev.depositFee },
                      withdrawFee: { ...prev.withdrawFee, current: value },
                    }));
                  }}
                />
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
  const [currencies, setCurrencies] = useState(null);
  const [selectedCurrency, setSelectedCurrency] = useState(null);
  const [filterCurrencies, setFilterCurrencies] = useState(null);
  const [filterOption, setFilterOption] = useState("all"); //'open','close'
  const [filterKey, setFilterKey] = useState("");
  const [active, setActive] = useState(false);
  const [unLocked, setUnLocked] = useState(false);
  const [openFeeControlDialog, setOpenFeeControlDialog] = useState(false);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const sorting = () => {};

  const getCurrencies = useCallback(async () => {
    return Promise.resolve({
      BTC: {
        currency: "Bitcoin",
        symbol: "BTC",
        depositFee: {
          current: "0.0000001",
          external: "0.00000015",
        },
        withdrawFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        alert: true,
        exchange: "OKEx",
        exchanges: ["TideBit", "OKEx"],
        tags: ["Blockchain"],
        status: "open", // 'close'
      },
      ETH: {
        currency: "Ethereum",
        symbol: "ETH",
        depositFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        withdrawFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        alert: false,
        exchange: "TideBit",
        exchanges: ["TideBit", "OKEx"],
        tags: ["Blockchain"],
        status: "open", // 'close'
      },
      XRP: {
        //The purpose of XRP is to serve as an intermediate mechanism of exchange between two currencies or networks—as a sort of temporary settlement layer denomination
        currency: "XRP",
        symbol: "XRP",
        depositFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        withdrawFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        alert: false,
        exchanges: [],
        tags: ["Layer2"],
        status: "close", // 'open'
      },
      USDC: {
        //SD Coin is a service to tokenize US dollars and facilitate their use over the internet and public blockchains.
        currency: "USD Coin",
        symbol: "USDC",
        depositFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        withdrawFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        alert: false,
        exchange: "OKEx",
        exchanges: ["TideBit", "OKEx"],
        tags: ["Defi"],
        status: "close", // 'close'
      },
      USDT: {
        currency: "Tether",
        symbol: "USDT",
        depositFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        withdrawFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        alert: false,
        exchange: "TideBit",
        exchanges: ["TideBit", "OKEx"],
        tags: ["Polkadot"],
        status: "open", // 'close'
      },
      BNB: {
        currency: "Build and Build",
        symbol: "BNB",
        depositFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        withdrawFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        alert: false,
        exchanges: [],
        tags: ["Greyscale"],
        status: "close", // 'open'
      },
      BUSD: {
        currency: "Binance USD",
        symbol: "BUSD",
        depositFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        withdrawFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        alert: false,
        exchanges: [],
        tags: ["Defi"],
        status: "close", // 'open'
      },
      ADA: {
        currency: "Cardano", //Cardano is built by a decentralized community of scientists, engineers, and thought leaders united in a common purpose: to create a technology platform that will ignite the positive change the world needs.
        symbol: "ADA",
        depositFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        withdrawFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        alert: false,
        exchanges: [],
        tags: ["GameFi"],
        status: "close", // 'open'
      },
      SOL: {
        currency: "Solana",
        symbol: "SOL",
        depositFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        withdrawFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        alert: false,
        exchanges: [],
        tags: ["Meme"],
        status: "close", // 'open'
      },
      DOGE: {
        currency: "Dogecoin",
        symbol: "DOGE",
        depositFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        withdrawFee: {
          current: "0.0000001",
          external: "0.0000001",
        },
        alert: false,
        exchanges: [],
        tags: ["NFT"],
        status: "close", // 'open'
      },
    });
  }, []);

  const filter = useCallback(
    ({ filterCurrencies, status, keyword }) => {
      if (status) setFilterOption(status);
      let _option = status || filterOption,
        _keyword = keyword === undefined ? filterKey : keyword,
        _currencies = filterCurrencies || currencies;
      if (_currencies) {
        _currencies = Object.values(_currencies).filter((currency) => {
          if (_option === "all")
            return (
              currency.currency.includes(_keyword) ||
              currency.symbol.includes(_keyword)
            );
          else
            return (
              currency.status === _option &&
              (currency.currency.includes(_keyword) ||
                currency.symbol.includes(_keyword))
            );
        });
        setFilterCurrencies(_currencies);
      }
    },
    [currencies, filterKey, filterOption]
  );

  const updateCurrencyFee = useCallback(
    async (currency) => {
      setOpenFeeControlDialog(false);
      setIsLoading(true);
      const _currency = currencies[currency.symbol];
      if (_currency) {
        try {
          const { currencies: updateCurrencies } =
            await storeCtx.updateCurrencyFee(currency);
          setCurrencies(updateCurrencies);
          // filter({ filterCurrencies: updateCurrencies }); // TODO
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
      } else {
        // ++TODO
      }
    },
    [currencies, enqueueSnackbar, filter, storeCtx, t]
  );

  const switchExchange = useCallback(
    (exchange, symbol) => {
      console.log(`switchExchange`, exchange, symbol);
      const updateCurrencies = { ...currencies };
      updateCurrencies[symbol].exchange = exchange;
      setCurrencies(updateCurrencies);
    },
    [currencies]
  );

  const toggleStatus = useCallback(
    (status, symbol) => {
      console.log(`toggleStatus`, status, symbol);
      const updateCurrencies = { ...currencies };
      updateCurrencies[symbol].status = status === "open" ? "close" : "open";
      setCurrencies(updateCurrencies);
    },
    [currencies]
  );

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        const currencies = await getCurrencies();
        setCurrencies(currencies);
        filter({ filterCurrencies: currencies });
        return !prev;
      } else return prev;
    });
  }, [filter, getCurrencies]);

  useEffect(() => {
    if (!isInit) {
      init();
    }
  }, [init, isInit]);

  return (
    <>
      {isLoading && <LoadingDialog />}
      {openFeeControlDialog && selectedCurrency && (
        <FeeControlDialog
          currency={selectedCurrency}
          onClose={() => setOpenFeeControlDialog(false)}
          onCancel={() => {
            setOpenFeeControlDialog(false);
          }}
          onConfirm={updateCurrencyFee}
        />
      )}
      <section className="screen__section deposit">
        <div className="screen__header">入金管理</div>
        {/* <ScreenTags
        selectedTag={selectedTag}
        selectTagHandler={selectTagHandler}
        currencies={currencies}
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
                  filterOption === "all" ? " active" : ""
                }`}
                onClick={() => filter("all")}
              >
                全部
              </li>
              <li
                className={`screen__display-option${
                  filterOption === "open" ? " active" : ""
                }`}
                onClick={() => filter("open")}
              >
                已開啟
              </li>
              <li
                className={`screen__display-option${
                  filterOption === "close" ? " active" : ""
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
            <li className="screen__table-header">入金交易所</li>
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
                  !Object.values(currencies || {}).some(
                    (currency) => currency.status === "open"
                  )
                    ? "disable"
                    : ""
                }`}
                onClick={() => {
                  if (unLocked) {
                    const updateCurrencies = { ...currencies };
                    Object.values(updateCurrencies).forEach(
                      (currency) => (currency.status = "close")
                    );
                    setCurrencies(updateCurrencies);
                    filter(filterOption, updateCurrencies);
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
                  !Object.values(currencies || {}).some(
                    (currency) => currency.status === "close"
                  )
                    ? "disable"
                    : ""
                }`}
                onClick={() => {
                  if (unLocked) {
                    const updateCurrencies = { ...currencies };
                    Object.values(updateCurrencies).forEach(
                      (currency) => (currency.status = "open")
                    );
                    setCurrencies(updateCurrencies);
                    filter(filterOption, updateCurrencies);
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
            </li>
          </ul>
          <ul className="screen__table-rows">
            {filterCurrencies &&
              filterCurrencies.map((currency) => (
                <div
                  className={`deposit__currency-tile screen__table-row${
                    currency.alert ? " screen__table--alert" : ""
                  }`}
                  key={currency.symbol}
                >
                  <div className="deposit__currency-text screen__table-item">
                    <div className="deposit__currency-alert">
                      <div></div>
                    </div>
                    {currency.currency}
                  </div>
                  <div className="deposit__currency-text screen__table-item">
                    {currency.symbol}
                  </div>
                  <TableDropdown
                    className="screen__table-item"
                    selectHandler={(option) =>
                      switchExchange(option, currency.symbol)
                    }
                    options={currency.exchanges}
                    selected={currency.exchange}
                  />
                  <div className="deposit__currency-text screen__table-item">
                    <div className="screen__table-item--text-box">
                      <div className="screen__table-item--text">
                        <div className="screen__table-item--title">當前：</div>
                        <div
                          className={`screen__table-item--value${
                            currency.alert ? " screen__table--alert" : ""
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
                            currency.alert ? " screen__table--alert" : ""
                          }`}
                        >{`${SafeMath.mult(
                          currency.depositFee?.external,
                          100
                        )}%`}</div>
                      </div>
                    </div>
                    <div className="screen__table-item--icon"></div>
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
                        // if(currency.status === "open"){
                        setOpenFeeControlDialog(true);
                        setSelectedCurrency(currency);
                        // }
                      }}
                    ></div>
                  </div>
                  <TableSwitchWithLock
                    className="screen__table-switch"
                    status={currency.status === "open"}
                    toggleStatus={() =>
                      toggleStatus(currency.status, currency.symbol)
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
