import React, {
  useContext,
  useState,
  useEffect,
  useCallback,
  // useRef,
} from "react";
import StoreContext from "../store/store-context";
import { Tabs, Tab, Nav } from "react-bootstrap";
import { convertExponentialToDecimal, formateDecimal } from "../utils/Utils";
import SafeMath from "../utils/SafeMath";
import { useTranslation } from "react-i18next";
import { useViewport } from "../store/ViewportProvider";
import CustomKeyboard from "./CustomKeyboard";

const TradeForm = (props) => {
  const { t } = useTranslation();
  const storeCtx = useContext(StoreContext);
  const [tdMode, setTdMode] = useState("cash");
  const [price, setPrice] = useState("");
  const [volume, setVolume] = useState("");
  const [selectedPct, setSelectedPct] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedTicker, setSelectedTicker] = useState(null);

  const formatValue = useCallback(
    ({ value, precision }) => {
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
      return { formatedValue };
    },
    [props.isMobile]
  );

  const formatPrice = useCallback(
    (value) => {
      setErrorMessage(null);
      let { formatedValue } = formatValue({
        value,
        precision: storeCtx.tickSz,
      });
      // console.log(
      //   `formatedValue:${formatedValue}`)
      setPrice(formatedValue);
      if (SafeMath.lt(formatedValue, storeCtx.selectedTicker?.tickSz)) {
        // console.log(
        //   `tickSz:${storeCtx.selectedTicker?.tickSz}`,
        //   SafeMath.lt(formatedValue, storeCtx.selectedTicker?.tickSz)
        // );
        setErrorMessage(
          `Minimum order price is ${storeCtx.selectedTicker?.tickSz}`
        );
      } else if (
        props.kind === "bid" &&
        SafeMath.gt(
          volume,
          SafeMath.div(
            storeCtx.accounts?.accounts[
              storeCtx.selectedTicker?.quote_unit?.toUpperCase()
            ]?.balance,
            props.ordType === "market"
              ? storeCtx.selectedTicker?.last
              : formatedValue
          )
        )
      ) {
        setErrorMessage(
          `Available ${storeCtx.selectedTicker?.quote_unit?.toUpperCase()} is not enough`
        );
      } else if (
        props.kind === "ask" &&
        SafeMath.gt(
          volume,
          storeCtx.accounts?.accounts[
            storeCtx.selectedTicker?.base_unit?.toUpperCase()
          ]?.balance
        )
      ) {
        setErrorMessage(
          `Available ${storeCtx.selectedTicker?.base_unit?.toUpperCase()} is not enough`
        );
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
        props.ordType === "market" ? storeCtx.selectedTicker?.last : price;
      let { formatedValue } = formatValue({
        value,
        precision: storeCtx.lotSz,
      });
      // console.log(
      //   `formatedValue:${formatedValue}`)
      setVolume(formatedValue);
      if (SafeMath.lt(formatedValue, storeCtx.selectedTicker?.minSz))
        setErrorMessage(`Minimum amount is ${storeCtx.selectedTicker?.minSz}`);
      else if (SafeMath.gt(formatedValue, storeCtx.selectedTicker?.maxSz))
        setErrorMessage(`Maximum amount is ${storeCtx.selectedTicker?.maxSz}`);
      else if (
        SafeMath.gt(
          props.kind === "bid"
            ? SafeMath.mult(_price, formatedValue)
            : formatedValue,
          props.kind === "bid"
            ? storeCtx.accounts?.accounts[
                storeCtx.selectedTicker?.quote_unit?.toUpperCase()
              ]?.balance
            : storeCtx.accounts?.accounts[
                storeCtx.selectedTicker?.base_unit?.toUpperCase()
              ]?.balance
        )
      )
        setErrorMessage(
          `Available ${
            props.kind === "bid"
              ? storeCtx.selectedTicker?.quote_unit?.toUpperCase()
              : storeCtx.selectedTicker?.base_unit?.toUpperCase()
          } is not enough`
        );
      else setErrorMessage(null);
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

  const onSubmit = async (event, kind) => {
    event.preventDefault();
    if (!storeCtx.selectedTicker) return;
    const order = {
      instId: storeCtx.selectedTicker.instId,
      tdMode,
      kind,
      ordType: props.ordType,
      price: props.ordType === "limit" ? price : storeCtx.selectedTicker?.last,
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
      storeCtx.depthBook?.amount
    ) {
      // console.log(`TradePannel useEffect depthBook`, storeCtx.depthBook);
      formatPrice(storeCtx.depthBook.price);
      formatSize(storeCtx.depthBook.amount);
      storeCtx.depthBookHandler(null);
    }
  }, [formatPrice, formatSize, storeCtx]);

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
                      storeCtx.selectedTicker?.quote_unit?.toUpperCase()
                    ]?.balance
                  : storeCtx.accounts?.accounts[
                      storeCtx.selectedTicker?.base_unit?.toUpperCase()
                    ]?.balance,
                { decimalLength: 8 }
              )
            : "--"}
          {props.kind === "bid"
            ? storeCtx.selectedTicker?.quote_unit?.toUpperCase() || "--"
            : storeCtx.selectedTicker?.base_unit?.toUpperCase() || "--"}
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
                {storeCtx.selectedTicker?.quote_unit?.toUpperCase() || "--"}
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
              {storeCtx.selectedTicker?.base_unit?.toUpperCase() || "--"}
            </span>
          </div>
        </div>
      </div>

      <div className="market-trade__input-group input-group">
        <label htmlFor="trade_amount">{t("trade_total")}:</label>
        <div className="market-trade__input-group--box">
          <input
            name="trade_total"
            type="number"
            className="market-trade__input  form-control"
            // placeholder={t("trade_total")}
            value={
              props.ordType === "market"
                ? null
                : price && volume
                ? SafeMath.mult(price, volume)
                : null
            }
            readOnly
          />
          <div className="market-trade__input-group--append input-group-append">
            <span className="input-group-text">
              {storeCtx.selectedTicker?.quote_unit?.toUpperCase() || "--"}
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
          <span
            onClick={() => {
              if (storeCtx.accounts?.accounts && storeCtx.selectedTicker) {
                formatSize(
                  SafeMath.mult(
                    "0.25",
                    props.kind === "bid"
                      ? storeCtx.accounts?.accounts[
                          storeCtx.selectedTicker?.quote_unit?.toUpperCase()
                        ]?.balance
                      : SafeMath.div(
                          storeCtx.accounts?.accounts[
                            storeCtx.selectedTicker?.base_unit?.toUpperCase()
                          ]?.balance,
                          price || storeCtx.selectedTicker?.last
                        )
                  )
                );
              }
            }}
          >
            25%
          </span>
        </li>
        <li className={`${selectedPct === "0.5" ? "active" : ""}`}>
          <span
            onClick={() => {
              if (storeCtx.accounts?.accounts && storeCtx.selectedTicker) {
                formatSize(
                  SafeMath.mult(
                    "0.5",
                    props.kind === "bid"
                      ? storeCtx.accounts?.accounts[
                          storeCtx.selectedTicker?.quote_unit?.toUpperCase()
                        ]?.balance
                      : SafeMath.div(
                          storeCtx.accounts?.accounts[
                            storeCtx.selectedTicker?.base_unit?.toUpperCase()
                          ]?.balance,
                          price || storeCtx.selectedTicker?.last
                        )
                  )
                );
              }
            }}
          >
            50%
          </span>
        </li>
        <li className={`${selectedPct === "0.75" ? "active" : ""}`}>
          <span
            onClick={() => {
              if (storeCtx.accounts?.accounts && storeCtx.selectedTicker) {
                formatSize(
                  SafeMath.mult(
                    "0.75",
                    props.kind === "bid"
                      ? storeCtx.accounts?.accounts[
                          storeCtx.selectedTicker?.quote_unit?.toUpperCase()
                        ]?.balance
                      : SafeMath.div(
                          storeCtx.accounts?.accounts[
                            storeCtx.selectedTicker?.base_unit?.toUpperCase()
                          ]?.balance,
                          price || storeCtx.selectedTicker?.last
                        )
                  )
                );
              }
            }}
          >
            75%
          </span>
        </li>
        <li className={`${selectedPct === "1.0" ? "active" : ""}`}>
          <span
            onClick={() => {
              if (storeCtx.accounts?.accounts && storeCtx.selectedTicker) {
                formatSize(
                  props.kind === "bid"
                    ? storeCtx.accounts?.accounts[
                        storeCtx.selectedTicker?.quote_unit?.toUpperCase()
                      ]?.balance
                    : SafeMath.div(
                        storeCtx.accounts?.accounts[
                          storeCtx.selectedTicker?.base_unit?.toUpperCase()
                        ]?.balance,
                        price || storeCtx.selectedTicker?.last
                      )
                );
              }
            }}
          >
            100%
          </span>
        </li>
      </ul>
      <div style={{ flex: "auto" }}></div>
      {props.isMobile &&
        (storeCtx.focusEl?.name === "price" ||
          storeCtx.focusEl?.name === "amount") && (
          <CustomKeyboard
            inputEl={storeCtx.focusEl}
            onInput={(v) => {
              // console.log(`CustomKeyboard v`, v)
              if (storeCtx.focusEl?.name === "price") {
                formatPrice(v);
              }
              if (storeCtx.focusEl?.name === "amount") {
                formatSize(v);
              }
            }}
          />
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
        {` ${storeCtx.selectedTicker?.base_unit?.toUpperCase() ?? ""}`}
      </button>
    </form>
  );
};

const TradePannel = (props) => {
  const breakpoint = 428;
  const { width } = useViewport();
  const { t } = useTranslation();

  return (
    <div className="market-trade__panel">
      {width <= breakpoint ? (
        <Tabs defaultActiveKey="buy">
          <Tab eventKey="buy" title={t("buy")}>
            <TradeForm
              ordType={props.ordType}
              kind="bid"
              readyOnly={!!props.readyOnly}
              isMobile={true}
            />
          </Tab>
          <Tab eventKey="sell" title={t("sell")}>
            <TradeForm
              ordType={props.ordType}
              kind="ask"
              readyOnly={!!props.readyOnly}
              isMobile={true}
            />
          </Tab>
        </Tabs>
      ) : (
        <>
          <TradeForm
            ordType={props.ordType}
            kind="bid"
            readyOnly={!!props.readyOnly}
          />
          <TradeForm
            ordType={props.ordType}
            kind="ask"
            readyOnly={!!props.readyOnly}
          />
        </>
      )}
    </div>
  );
};

const MarketTrade = () => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  return (
    <div className="market-trade">
      <div className="market-trade__container">
        <div className="market-trade__header">{t("place_order")}</div>
        <Tabs defaultActiveKey="limit">
          <Tab eventKey="limit" title={t("limit")}>
            <TradePannel ordType="limit" />
          </Tab>
          <Tab eventKey="market" title={t("market")}>
            <TradePannel ordType="market" readyOnly={true} />
          </Tab>
          {/* <Tab eventKey="stop-limit" title="Stop Limit">
            <TradePannel ordType="stop-limit" />
          </Tab> */}
          {/* <Tab eventKey="stop-market" title="Stop Market">
            <TradePannel ordType="stop-market" />
          </Tab> */}
        </Tabs>
      </div>
      {storeCtx.isLogin === false && (
        <div className="market-trade__cover flex-row">
          <Nav.Link href="/signin">{t("login")}</Nav.Link>
          <Nav.Link href="/signup">{t("register")}</Nav.Link>
        </div>
      )}
    </div>
  );
};

// const MarketTrade = (props) => {
//   const [key, setKey] = useState("limit");
//   return (
//     <>
//       <div className="market-trade">
//         <Tabs defaultActiveKey="limit" activeKey={key} onSelect={setKey}>
//           <Tab eventKey="limit" title="Limit">
//             {key === "limit" && <TradePannel ordType={key} />}
//           </Tab>
//           <Tab eventKey="market" title="Market">
//             {key === "market" && <TradePannel ordType={key} />}
//           </Tab>
//           <Tab eventKey="stop-limit" title="Stop Limit">
//             {key === "stop-limit" && <TradePannel ordType={key} />}
//           </Tab>
//           <Tab eventKey="stop-market" title="Stop Market">
//             {key === "stop-market" && <TradePannel ordType={key} />}
//           </Tab>
//         </Tabs>
//       </div>
//     </>
//   );
// };
export default MarketTrade;
