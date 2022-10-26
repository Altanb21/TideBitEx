import React, { useContext, useState, useEffect, useCallback } from "react";
import StoreContext from "../store/store-context";
import { convertExponentialToDecimal, formateDecimal } from "../utils/Utils";
import SafeMath from "../utils/SafeMath";
import { useTranslation } from "react-i18next";

const CustomKeyboard = React.lazy(() => import("./CustomKeyboard"));

const TradeForm = (props) => {
  const { t } = useTranslation();
  const storeCtx = useContext(StoreContext);
  const [tdMode, setTdMode] = useState("cash");
  const [cursorPosition, setCursorPosition] = useState("cash");
  const [price, setPrice] = useState("");
  const [volume, setVolume] = useState("");
  const [total, setTotal] = useState("");
  const [selectedPct, setSelectedPct] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedTicker, setSelectedTicker] = useState(null);

  const formatValue = useCallback(({ value, precision }) => {
    // console.log(`value: ${+value < 0 }`, value);
    let formatedValue = +value < 0 ? "0" : convertExponentialToDecimal(value);
    // if (props.isMobile && formatedValue.match(/\./g).length > 1) {
    //   formatedValue = formatedValue.substring(0, formatedValue.length - 1);
    // }
    // console.log(
    //   `formatedValue[includes('.')?${formatedValue.toString().includes(".")}]`,
    //   formatedValue
    // );
    if (formatedValue.toString().includes(".")) {
      if (formatedValue.toString().split(".")[1].length >= precision) {
        let arr = formatedValue.toString().split(".");
        let decimal = arr[1].substring(0, precision);
        formatedValue = `${arr[0]}.${decimal}`;
        // console.log(
        //   `formatedValue[('.')length?${
        //     formatedValue.toString().split(".")[1]
        //   }]`,
        //   formatedValue
        // );
      }
      if (formatedValue.toString().startsWith(".")) {
        // console.log(`formatedValue='0${formatedValue}'`);
        formatedValue = `0${formatedValue}`;
      }
    } else {
      if (!!formatedValue && !isNaN(parseInt(formatedValue)))
        formatedValue = parseInt(formatedValue).toString();
      // console.log(`formatedValue`, formatedValue);
    }
    return formatedValue;
  }, []);

  const formatPrice = useCallback(
    (value) => {
      setErrorMessage(null);
      let formatedValue = formatValue({
        value,
        precision: storeCtx.tickSz,
      });
      let price, balance, total;
      price =
        props.ordType === "limit"
          ? formatedValue
          : props.kind === "bid"
          ? SafeMath.mult(storeCtx.selectedTicker?.last, 1.05)
          : SafeMath.mult(storeCtx.selectedTicker?.last, 0.95);
      setPrice(formatedValue);
      if (SafeMath.lt(formatedValue, storeCtx.selectedTicker?.tickSz)) {
        setErrorMessage(
          `Minimum order price is ${storeCtx.selectedTicker?.tickSz}`
        );
      } else if (SafeMath.gt(volume, 0)) {
        total = SafeMath.mult(price, volume);
        setTotal(total);
        if (props.kind === "bid") {
          balance =
            storeCtx.accounts?.accounts[
              storeCtx.selectedTicker?.quoteUnit?.toUpperCase()
            ]?.balance;
          if (SafeMath.gt(total, balance))
            setErrorMessage(
              `Available ${storeCtx.selectedTicker?.quoteUnit?.toUpperCase()} is not enough`
            );
        } else if (props.kind === "ask") {
          balance =
            storeCtx.accounts?.accounts[
              storeCtx.selectedTicker?.baseUnit?.toUpperCase()
            ]?.balance;
          if (SafeMath.gt(volume, balance))
            setErrorMessage(
              `Available ${storeCtx.selectedTicker?.baseUnit?.toUpperCase()} is not enough`
            );
        } else setErrorMessage(null);
      } else setErrorMessage(null);
    },
    [
      formatValue,
      props.kind,
      props.ordType,
      storeCtx.accounts?.accounts,
      storeCtx.selectedTicker,
      storeCtx.tickSz,
      volume,
    ]
  );

  const formatSize = useCallback(
    (value) => {
      setErrorMessage(null);
      let _price =
        props.ordType === "market"
          ? props.kind === "bid"
            ? SafeMath.mult(storeCtx.selectedTicker?.last, 1.05)
            : SafeMath.mult(storeCtx.selectedTicker?.last, 0.95)
          : price;
      let formatedValue = formatValue({
        value,
        precision: storeCtx.lotSz,
      });
      setVolume(formatedValue);
      if (SafeMath.lt(formatedValue, storeCtx.selectedTicker?.minSz))
        setErrorMessage(`Minimum amount is ${storeCtx.selectedTicker?.minSz}`);
      else if (SafeMath.gt(formatedValue, storeCtx.selectedTicker?.maxSz))
        setErrorMessage(`Maximum amount is ${storeCtx.selectedTicker?.maxSz}`);
      else if (SafeMath.gt(formatValue, 0)) {
        let balance;
        if (props.kind === "ask") {
          balance =
            storeCtx.accounts?.accounts[
              storeCtx.selectedTicker?.baseUnit?.toUpperCase()
            ]?.balance;
          if (SafeMath.gt(formatedValue, balance))
            // setErrorMessage(
            //   `Available ${storeCtx.selectedTicker?.baseUnit?.toUpperCase()} is not enough`
            // );
            setVolume(balance);
        } else if (props.kind === "bid") {
          if (SafeMath.gt(_price, 0)) {
            let total = SafeMath.mult(_price, formatedValue);
            setTotal(total);
            balance =
              storeCtx.accounts?.accounts[
                storeCtx.selectedTicker?.quoteUnit?.toUpperCase()
              ]?.balance;
            if (SafeMath.gt(total, balance))
              setErrorMessage(
                `Available ${storeCtx.selectedTicker?.quoteUnit?.toUpperCase()} is not enough`
              );
          }
        } else setErrorMessage(null);
      } else setErrorMessage(null);
    },
    [
      storeCtx.accounts?.accounts,
      storeCtx.selectedTicker,
      storeCtx.lotSz,
      props.ordType,
      props.kind,
      price,
      formatValue,
    ]
  );

  const totalAmountHandler = useCallback(
    (value) => {
      if (storeCtx.accounts?.accounts && storeCtx.selectedTicker?.baseUnit) {
        let formatedValue = formatValue({
          value,
          precision: Math.min(storeCtx.tickSz, storeCtx.lotSz),
        });
        setTotal(formatedValue);
        let _price, balance, volume;
        switch (props.ordType) {
          case "limit":
            if (price) _price = price;
            else _price = storeCtx.selectedTicker.last;
            break;
          case "market":
            if (props.kind === "bid")
              _price = SafeMath.mult(storeCtx.selectedTicker?.last, 1.05);
            else _price = SafeMath.mult(storeCtx.selectedTicker?.last, 0.95);
            break;
          default:
            break;
        }
        setPrice(
          formatValue({
            value: _price,
            precision: storeCtx.tickSz,
          })
        );
        volume = SafeMath.div(formatedValue, _price);
        setVolume(
          formatValue({
            value: volume,
            precision: storeCtx.lotSz,
          })
        );
        if (props.kind === "ask") {
          balance =
            storeCtx.accounts?.accounts[
              storeCtx.selectedTicker?.baseUnit?.toUpperCase()
            ]?.balance;
          if (SafeMath.gt(volume, balance))
            setErrorMessage(
              `Available ${storeCtx.selectedTicker?.baseUnit?.toUpperCase()} is not enough`
            );
        } else {
          balance =
            storeCtx.accounts?.accounts[
              storeCtx.selectedTicker?.quoteUnit?.toUpperCase()
            ]?.balance;
          if (SafeMath.gt(formatedValue, balance))
            setErrorMessage(
              `Available ${storeCtx.selectedTicker?.quoteUnit?.toUpperCase()} is not enough`
            );
        }
      }
    },
    [
      formatValue,
      price,
      props.ordType,
      props.kind,
      storeCtx.accounts?.accounts,
      storeCtx.lotSz,
      storeCtx.selectedTicker?.baseUnit,
      storeCtx.selectedTicker?.last,
      storeCtx.selectedTicker?.quoteUnit,
      storeCtx.tickSz,
    ]
  );

  const percentageHandler = useCallback(
    (percentage) => {
      console.log(`percentageHandler percentage`, percentage);
      if (storeCtx.accounts?.accounts && storeCtx.selectedTicker?.baseUnit) {
        let _price, balance, available, volume;
        if (props.kind === "ask") {
          balance =
            storeCtx.accounts?.accounts[
              storeCtx.selectedTicker?.baseUnit?.toUpperCase()
            ]?.balance;
          console.log(
            `percentageHandler[props.kind=${
              props.kind
            }] balance(${storeCtx.selectedTicker?.baseUnit?.toUpperCase()})`,
            balance
          );
          volume = SafeMath.mult(balance, percentage);
        } else {
          switch (props.ordType) {
            case "limit":
              if (price) _price = price;
              else _price = storeCtx.selectedTicker.last;
              break;
            case "market":
              _price = SafeMath.mult(storeCtx.selectedTicker?.last, 1.05);
              break;
            default:
              break;
          }
          console.log(
            `percentageHandler[props.ordType=${props.ordType}] _price(${storeCtx.selectedTicker.last})`,
            _price
          );
          setPrice(
            formatValue({
              value: _price,
              precision: storeCtx.tickSz,
            })
          );
          balance =
            storeCtx.accounts?.accounts[
              storeCtx.selectedTicker?.quoteUnit?.toUpperCase()
            ]?.balance;
          console.log(
            `percentageHandler[props.kind=${
              props.kind
            }] balance(${storeCtx.selectedTicker?.quoteUnit?.toUpperCase()})`,
            balance
          );
          available = SafeMath.mult(balance, percentage);
          volume = SafeMath.div(available, _price);
        }
        setVolume(
          formatValue({
            value: volume,
            precision: storeCtx.lotSz,
          })
        );
      }
    },
    [
      formatValue,
      price,
      props.ordType,
      props.kind,
      storeCtx.accounts?.accounts,
      storeCtx.lotSz,
      storeCtx.selectedTicker?.baseUnit,
      storeCtx.selectedTicker?.last,
      storeCtx.selectedTicker?.quoteUnit,
      storeCtx.tickSz,
    ]
  );

  const onSubmit = async (event, kind) => {
    event.preventDefault();
    if (!storeCtx.selectedTicker) return;
    const order = {
      id: storeCtx.selectedTicker.id,
      instId: storeCtx.selectedTicker.instId,
      tdMode,
      kind,
      ordType: props.ordType,
      price:
        props.ordType === "limit"
          ? price
          : props.kind === "bid"
          ? SafeMath.mult(storeCtx.selectedTicker?.last, 1.05)
          : SafeMath.mult(storeCtx.selectedTicker?.last, 0.95),
      volume,
      market: storeCtx.selectedTicker.market,
    };
    const text =
      props.ordType === "market"
        ? order.kind === "bid"
          ? t("bid-market-order-confirm", {
              totalAmount: order.volume,
              baseUnit: order.instId.split("-")[0],
              quoteUnit: order.instId.split("-")[1],
            })
          : t("ask-market-order-confirm", {
              totalAmount: order.volume,
              baseUnit: order.instId.split("-")[0],
              quoteUnit: order.instId.split("-")[1],
            })
        : order.kind === "bid"
        ? t("bid-limit-order-confirm", {
            totalAmount: order.volume,
            baseUnit: order.instId.split("-")[0],
            totalPrice: SafeMath.mult(order.price, order.volume),
            price: order.price,
            quoteUnit: order.instId.split("-")[1],
          })
        : t("ask-limit-order-confirm", {
            totalAmount: order.volume,
            baseUnit: order.instId.split("-")[0],
            totalPrice: SafeMath.mult(order.price, order.volume),
            price: order.price,
            quoteUnit: order.instId.split("-")[1],
          });
    const confirm = window.confirm(text);
    if (confirm) {
      await storeCtx.postOrder(order);
    }
    setVolume("");
    setSelectedPct(null);
  };

  useEffect(() => {
    if (
      (storeCtx.selectedTicker && !selectedTicker) ||
      (storeCtx.selectedTicker &&
        storeCtx.selectedTicker.instId !== selectedTicker?.instId)
    ) {
      setSelectedTicker(storeCtx.selectedTicker);
      if (price) formatPrice(price);
      if (volume) formatSize(volume);
    }
  }, [
    storeCtx.selectedTicker,
    storeCtx.accounts,
    selectedTicker,
    formatPrice,
    price,
    formatSize,
    volume,
  ]);

  useEffect(() => {
    if (
      storeCtx.depthBook !== null &&
      storeCtx.depthBook?.price &&
      storeCtx.depthBook?.price !== price &&
      storeCtx.depthBook?.amount &&
      storeCtx.depthBook?.amount !== volume
    ) {
      // console.log(`TradePannel useEffect depthBook`, storeCtx.depthBook);
      formatPrice(storeCtx.depthBook.price);
      formatSize(storeCtx.depthBook.amount);
      storeCtx.depthBookHandler(null);
    }
  }, [formatPrice, formatSize, price, volume, storeCtx]);

  return (
    <form
      onSubmit={(e) => {
        onSubmit(e, props.kind);
      }}
      className={`market-trade__form ${
        props.kind === "bid" ? "market-trade--buy" : "market-trade--sell"
      }`}
    >
      <p className="market-trade__text">
        {t("available")}:
        <span>
          {storeCtx.accounts?.accounts && storeCtx.selectedTicker
            ? formateDecimal(
                props.kind === "bid"
                  ? storeCtx.accounts?.accounts[
                      storeCtx.selectedTicker?.quoteUnit?.toUpperCase()
                    ]?.balance
                  : storeCtx.accounts?.accounts[
                      storeCtx.selectedTicker?.baseUnit?.toUpperCase()
                    ]?.balance,
                { decimalLength: 8 }
              )
            : "--"}
          {props.kind === "bid"
            ? storeCtx.selectedTicker?.quoteUnit?.toUpperCase() || "--"
            : storeCtx.selectedTicker?.baseUnit?.toUpperCase() || "--"}
          {/* = 0 USD */}
        </span>
      </p>
      <div className="market-trade__input-group input-group">
        <label htmlFor="price">{t("price")}:</label>
        <div className="market-trade__input-group--box">
          <input
            inputMode={props.isMobile ? "none" : "decimal"}
            // inputMode="decimal"
            name="price"
            type={props.isMobile ? null : props.readyOnly ? "text" : "number"}
            // type="number"
            className="market-trade__input form-control"
            // placeholder={t("price")}
            onMouseUp={(e) => {
              // console.log(`input[mouseUp] e.target.selectionStart`, e.target.selectionStart);
              setCursorPosition(e.target.selectionStart);
            }}
            value={props.readyOnly ? t("market") : price}
            onChange={(e) => {
              if (!props.isMobile) formatPrice(e.target.value);
            }}
            required={!props.readyOnly}
            disabled={!!props.readyOnly}
            step={
              storeCtx.selectedTicker?.tickSz
                ? storeCtx.selectedTicker?.tickSz
                : "any"
            }
          />
          {!props.readyOnly && (
            <div className="market-trade__input-group--append input-group-append">
              <span className="input-group-text">
                {storeCtx.selectedTicker?.quoteUnit?.toUpperCase() || "--"}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="market-trade__input-group input-group">
        <label htmlFor="trade_amount">{t("trade_amount")}:</label>
        <div className="market-trade__input-group--box">
          <input
            // inputMode="decimal"
            inputMode={props.isMobile ? "none" : "decimal"}
            name="amount"
            type={props.isMobile ? null : "number"}
            // type="number"
            className="market-trade__input form-control"
            // placeholder={t("trade_amount")}
            onMouseUp={(e) => setCursorPosition(e.target.selectionStart)}
            value={volume}
            onChange={(e) => {
              if (!props.isMobile) formatSize(e.target.value);
            }}
            step={
              storeCtx.selectedTicker?.lotSz
                ? storeCtx.selectedTicker?.lotSz
                : "any"
            }
            required
          />
          <div className="market-trade__input-group--append input-group-append">
            <span className="input-group-text">
              {storeCtx.selectedTicker?.baseUnit?.toUpperCase() || "--"}
            </span>
          </div>
        </div>
      </div>

      <div className="market-trade__input-group input-group">
        <label htmlFor="trade_amount">{t("trade_total")}:</label>
        <div className="market-trade__input-group--box">
          <input
            inputMode={props.isMobile ? "none" : "decimal"}
            name="total"
            type={props.isMobile ? null : "number"}
            className="market-trade__input  form-control"
            // placeholder={t("trade_total")}
            onMouseUp={(e) => setCursorPosition(e.target.selectionStart)}
            value={total}
            onChange={(e) => {
              if (!props.isMobile) totalAmountHandler(e.target.value);
            }}
          />
          <div className="market-trade__input-group--append input-group-append">
            <span className="input-group-text">
              {storeCtx.selectedTicker?.quoteUnit?.toUpperCase() || "--"}
            </span>
          </div>
        </div>
      </div>
      <div className="market-trade__error-message--container">
        <p
          className={`market-trade__error-message ${
            errorMessage ? "show" : ""
          }`}
        >
          {errorMessage}
        </p>
      </div>
      <ul className="market-trade__amount-controller">
        <li className={`${selectedPct === "0.25" ? "active" : ""}`}>
          <span onClick={() => percentageHandler(0.25)}>25%</span>
        </li>
        <li className={`${selectedPct === "0.5" ? "active" : ""}`}>
          <span onClick={() => percentageHandler(0.5)}>50%</span>
        </li>
        <li className={`${selectedPct === "0.75" ? "active" : ""}`}>
          <span onClick={() => percentageHandler(0.75)}>75%</span>
        </li>
        <li className={`${selectedPct === "1.0" ? "active" : ""}`}>
          <span onClick={() => percentageHandler(1)}>100%</span>
        </li>
      </ul>
      <div style={{ flex: "auto" }}></div>
      {props.isMobile &&
        (storeCtx.focusEl?.name === "price" ||
          storeCtx.focusEl?.name === "amount") && (
          <React.Suspense fallback={<div></div>}>
            <CustomKeyboard
              cursorPosition={cursorPosition}
              setCursorPosition={setCursorPosition}
              inputEl={storeCtx.focusEl}
              onInput={(v) => {
                // console.log(`CustomKeyboard v`, v)
                if (storeCtx.focusEl?.name === "price") {
                  formatPrice(v);
                }
                if (storeCtx.focusEl?.name === "amount") {
                  formatSize(v);
                }
                if (storeCtx.focusEl?.name === "total") {
                  totalAmountHandler(v);
                }
              }}
            />
          </React.Suspense>
        )}
      <button
        type="submit"
        className="btn market-trade__button"
        disabled={
          !storeCtx.accounts?.accounts ||
          !storeCtx.selectedTicker ||
          !!errorMessage ||
          (props.ordType === "limit" && !price) ||
          !volume
        }
      >
        {props.kind === "bid" ? t("buy") : t("sell")}
        {` ${storeCtx.selectedTicker?.baseUnit?.toUpperCase() ?? ""}`}
      </button>
    </form>
  );
};

export default TradeForm;
