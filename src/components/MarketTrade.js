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
  // const inputPrice = useRef();
  // const inputAmount = useRef();
  const [tdMode, setTdMode] = useState("cash");
  const [price, setPrice] = useState("");
  const [volume, setVolume] = useState("");
  const [selectedPct, setSelectedPct] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [quoteCcyAvailable, setQuoteCcyAvailable] = useState("0");
  const [baseCcyAvailable, setBaseCcyAvailable] = useState("0");
  const formatPrice = useCallback(
    (value) => {
      setErrorMessage(null);
      let precision,
        arr = storeCtx.selectedTicker?.tickSz.split(".");
      if (arr.length > 1) precision = arr[1].length;
      else precision = 0;
      let _value = convertExponentialToDecimal(+value < 0 ? "0" : value);
      let price,
        vArr = _value.toString().split(".");
      if (
        _value.toString().length > 2 &&
        _value.toString().startsWith("0") &&
        !_value.includes(".")
      ) {
        _value = _value.substring(1);
      }
      if (vArr.length > 1 && vArr[1].length > precision) {
        price = parseFloat(_value).toFixed(precision);
        setErrorMessage(
          `Price precision is ${storeCtx.selectedTicker?.tickSz}`
        );
      } else price = _value;
      setPrice(price);
      if (SafeMath.lt(price, storeCtx.selectedTicker?.tickSz))
        setErrorMessage(
          `Minimum order price is ${storeCtx.selectedTicker?.tickSz}`
        );
      if (
        props.kind === "bid" &&
        SafeMath.gt(
          volume,
          SafeMath.div(
            quoteCcyAvailable,
            props.ordType === "market" ? storeCtx.selectedTicker?.last : price
          )
        )
      ) {
        setErrorMessage(
          `Available ${storeCtx.selectedTicker?.quote_unit?.toUpperCase()} is not enough`
        );
      }
      if (props.kind === "ask" && SafeMath.gt(volume, baseCcyAvailable)) {
        setErrorMessage(
          `Available ${storeCtx.selectedTicker?.base_unit?.toUpperCase()} is not enough`
        );
      } else setErrorMessage(null);
    },
    [
      baseCcyAvailable,
      props.kind,
      props.ordType,
      quoteCcyAvailable,
      storeCtx.selectedTicker?.base_unit,
      storeCtx.selectedTicker?.last,
      storeCtx.selectedTicker?.quote_unit,
      storeCtx.selectedTicker?.tickSz,
      volume,
    ]
  );

  const formatSize = useCallback(
    (value) => {
      setErrorMessage(null);
      let precision,
        arr = storeCtx.selectedTicker?.lotSz.split("."),
        _price =
          props.ordType === "market" ? storeCtx.selectedTicker?.last : price;
      if (arr.length > 1) precision = arr[1].length;
      else precision = 0;
      let _value = convertExponentialToDecimal(+value < 0 ? "0" : value);
      let size,
        vArr = _value.split(".");
      if (
        _value.toString().length > 2 &&
        _value.toString().startsWith("0") &&
        !_value.includes(".")
      ) {
        _value = _value.substring(1);
      }
      if (vArr.length > 1 && vArr[1].length > precision) {
        size = parseFloat(_value).toFixed(precision);
        setErrorMessage(
          `Amount precision is ${storeCtx.selectedTicker?.lotSz}`
        );
      } else size = _value;
      setVolume(size);
      if (SafeMath.lt(size, storeCtx.selectedTicker?.minSz))
        setErrorMessage(`Minimum amount is ${storeCtx.selectedTicker?.minSz}`);
      else if (SafeMath.gt(size, storeCtx.selectedTicker?.maxSz))
        setErrorMessage(`Maximum amount is ${storeCtx.selectedTicker?.maxSz}`);
      else if (
        SafeMath.gt(
          props.kind === "bid" ? SafeMath.mult(_price, size) : size,
          props.kind === "bid" ? quoteCcyAvailable : baseCcyAvailable
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
      baseCcyAvailable,
      price,
      props.kind,
      props.ordType,
      quoteCcyAvailable,
      storeCtx.selectedTicker?.base_unit,
      storeCtx.selectedTicker?.last,
      storeCtx.selectedTicker?.lotSz,
      storeCtx.selectedTicker?.maxSz,
      storeCtx.selectedTicker?.minSz,
      storeCtx.selectedTicker?.quote_unit,
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
    const confirm = window.confirm(`You are going to
          ${order.kind} ${order.volume} ${order.instId.split("-")[0]}
          ${order.kind === "bid" ? "with" : "for"} ${SafeMath.mult(
      props.ordType === "market" ? "market price" : order.price,
      order.volume
    )} ${order.instId.split("-")[1]}
          with price ${
            props.ordType === "market"
              ? storeCtx.selectedTicker.last
              : order.price
          } ${order.instId.split("-")[1]} per ${order.instId.split("-")[0]}`);
    if (confirm) {
      await storeCtx.postOrder(order);
    }
    setVolume("");
    setSelectedPct(null);
  };

  useEffect(() => {
    if (storeCtx.accounts?.accounts) {
      if (
        (storeCtx.selectedTicker && !selectedTicker) ||
        (storeCtx.selectedTicker &&
          storeCtx.selectedTicker.instId !== selectedTicker?.instId) ||
        quoteCcyAvailable !==
          storeCtx.accounts?.accounts[
            storeCtx.selectedTicker?.quote_unit?.toUpperCase()
          ]?.balance ||
        baseCcyAvailable !==
          storeCtx.accounts?.accounts[
            storeCtx.selectedTicker?.base_unit?.toUpperCase()
          ]?.balance
      ) {
        // setMemberId(storeCtx.memberId);
        let quoteCcyAccount =
          storeCtx.accounts?.accounts[
            storeCtx.selectedTicker?.quote_unit?.toUpperCase()
          ];

        if (quoteCcyAccount) {
          setQuoteCcyAvailable(quoteCcyAccount?.balance);
        }
        let baseCcyAccount =
          storeCtx.accounts?.accounts[
            storeCtx.selectedTicker?.base_unit?.toUpperCase()
          ];
        if (baseCcyAccount) {
          setBaseCcyAvailable(baseCcyAccount?.balance);
        }
        setSelectedTicker(storeCtx.selectedTicker);
        if (price) formatPrice(price);
        if (volume) formatSize(volume);
      }
    }
  }, [
    storeCtx.selectedTicker,
    storeCtx.accounts,
    selectedTicker,
    formatPrice,
    price,
    formatSize,
    volume,
    quoteCcyAvailable,
    baseCcyAvailable,
  ]);

  useEffect(() => {
    if (
      storeCtx.depthBook !== null &&
      storeCtx.depthBook?.price &&
      storeCtx.depthBook?.amount
    ) {
      console.log(`TradePannel useEffect depthBook`, storeCtx.depthBook);
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
          {quoteCcyAvailable || baseCcyAvailable
            ? formateDecimal(
                props.kind === "bid" ? quoteCcyAvailable : baseCcyAvailable,
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
            // ref={inputPrice}
            inputMode={props.isMobile ? "none" : "numeric"}
            name="price"
            type={props.isMobile ? null : props.readyOnly ? "text" : "number"}
            className="market-trade__input form-control"
            // placeholder={t("price")}
            value={props.readyOnly ? t("market") : price}
            // onClick={() => {
            //   if (props.isMobile) {
            //     storeCtx.setFocusEl(inputPrice);
            //   }
            // }}
            onChange={(e) => {
              // props.onPxInput(e.target.value);
              formatPrice(e.target.value);
            }}
            required={!props.readyOnly}
            disabled={!!props.readyOnly}
            step={storeCtx.selectedTicker?.tickSz}
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
            // ref={inputAmount}
            inputMode={props.isMobile ? "none" : "numeric"}
            name="amount"
            type={props.isMobile ? null : "number"}
            className="market-trade__input form-control"
            // placeholder={t("trade_amount")}
            value={volume}
            // onClick={() => {
            //   if (props.isMobile) {
            //     storeCtx.setFocusEl(inputAmount);
            //   }
            // }}
            onChange={(e) => {
              // props.onSzInput(e.target.value);
              formatSize(e.target.value);
            }}
            step={storeCtx.selectedTicker?.lotSz}
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
              formatSize(
                formateDecimal(
                  SafeMath.mult(
                    "0.25",
                    props.kind === "bid"
                      ? quoteCcyAvailable
                      : SafeMath.div(
                          baseCcyAvailable,
                          price || storeCtx.selectedTicker?.last
                        )
                  ),
                  {
                    decimalLength: storeCtx?.lotSz ? storeCtx?.lotSz : "0",
                  }
                )
              );
            }}
          >
            25%
          </span>
        </li>
        <li className={`${selectedPct === "0.5" ? "active" : ""}`}>
          <span
            onClick={() => {
              formatSize(
                formateDecimal(
                  SafeMath.mult(
                    "0.5",
                    props.kind === "bid"
                      ? quoteCcyAvailable
                      : SafeMath.div(
                          baseCcyAvailable,
                          price || storeCtx.selectedTicker?.last
                        )
                  ),
                  {
                    decimalLength: storeCtx?.lotSz ? storeCtx?.lotSz : "0",
                  }
                )
              );
            }}
          >
            50%
          </span>
        </li>
        <li className={`${selectedPct === "0.75" ? "active" : ""}`}>
          <span
            onClick={() => {
              formatSize(
                formateDecimal(
                  SafeMath.mult(
                    "0.75",
                    props.kind === "bid"
                      ? quoteCcyAvailable
                      : SafeMath.div(
                          baseCcyAvailable,
                          price || storeCtx.selectedTicker?.last
                        )
                  ),
                  {
                    decimalLength: storeCtx?.lotSz ? storeCtx?.lotSz : "0",
                  }
                )
              );
            }}
          >
            75%
          </span>
        </li>
        <li className={`${selectedPct === "1.0" ? "active" : ""}`}>
          <span
            onClick={() => {
              formatSize(
                formateDecimal(
                  SafeMath.mult(
                    "1",
                    props.kind === "bid"
                      ? quoteCcyAvailable
                      : SafeMath.div(
                          baseCcyAvailable,
                          price || storeCtx.selectedTicker?.last
                        )
                  ),
                  {
                    decimalLength: storeCtx?.lotSz ? storeCtx?.lotSz : "0",
                  }
                )
              );
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
              if (storeCtx.focusEl?.name === "price") {
                // props.onPxInput(v);
                formatPrice(v);
              }
              if (storeCtx.focusEl?.name === "amount") {
                // props.onSzInput(v);
                formatSize(v);
              }
            }}
          />
        )}
      <button
        type="submit"
        className="btn market-trade__button"
        disabled={
          !quoteCcyAvailable ||
          !baseCcyAvailable ||
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
