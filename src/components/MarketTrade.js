import React, { useContext, useState, useEffect, useCallback } from "react";
import StoreContext from "../store/store-context";
import { Tabs, Tab, Nav } from "react-bootstrap";
import { formateDecimal } from "../utils/Utils";
import SafeMath from "../utils/SafeMath";
import { useTranslation } from "react-i18next";
import { useViewport } from "../store/ViewportProvider";

const TradeForm = (props) => {
  const { t } = useTranslation();
  const storeCtx = useContext(StoreContext);
  return (
    <form
      onSubmit={(e) => {
        props.onSubmit(e, props.kind);
      }}
      className={`market-trade__form ${
        props.kind === "bid" ? "market-trade--buy" : "market-trade--sell"
      }`}
    >
      <p className="market-trade__text">
        {t("available")}:
        <span>
          {props.quoteCcyAvailable || props.baseCcyAvailable
            ? formateDecimal(
                props.kind === "bid"
                  ? props.quoteCcyAvailable
                  : props.baseCcyAvailable,
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
            name="price"
            type={props.readyOnly ? "text" : "number"}
            className="market-trade__input form-control"
            // placeholder={t("price")}
            value={props.readyOnly ? t("market") : props.price}
            onInput={(e) => props.onPxInput(e.target.value)}
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
            name="trade_amount"
            type="number"
            className="market-trade__input form-control"
            // placeholder={t("trade_amount")}
            value={props.volume}
            onInput={(e) => props.onSzInput(e.target.value)}
            required
            step={storeCtx.selectedTicker?.lotSz}
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
              props.price && props.volume
                ? SafeMath.mult(props.price, props.volume)
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
        {props.errorMessage && (
          <p
            className={`market-trade__error-message ${
              SafeMath.lt(props.volume, storeCtx.selectedTicker?.minSz)
                ? "show"
                : ""
            }`}
          >
            {props.errorMessage}
          </p>
        )}
      </div>
      <ul className="market-trade__amount-controller">
        <li className={`${props.selectedPct === "0.25" ? "active" : ""}`}>
          <span onClick={() => props.percentageHandler("0.25", props.price)}>
            25%
          </span>
        </li>
        <li className={`${props.selectedPct === "0.5" ? "active" : ""}`}>
          <span onClick={() => props.percentageHandler("0.5", props.price)}>
            50%
          </span>
        </li>
        <li className={`${props.selectedPct === "0.75" ? "active" : ""}`}>
          <span onClick={() => props.percentageHandler("0.75", props.price)}>
            75%
          </span>
        </li>
        <li className={`${props.selectedPct === "1.0" ? "active" : ""}`}>
          <span onClick={() => props.percentageHandler("1.0", props.price)}>
            100%
          </span>
        </li>
      </ul>
      <div style={{ flex: "auto" }}></div>
      <button
        type="submit"
        className="btn market-trade__button"
        disabled={
          !props.quoteCcyAvailable ||
          !props.baseCcyAvailable ||
          !storeCtx.selectedTicker ||
          SafeMath.gt(
            props.volume,
            props.kind === "bid"
              ? SafeMath.div(props.quoteCcyAvailable, props.price)
              : props.baseCcyAvailable
          ) ||
          SafeMath.lte(props.volume, "0") ||
          SafeMath.lt(props.volume, storeCtx.selectedTicker?.minSz) ||
          SafeMath.lt(props.price, storeCtx.selectedTicker?.tickSz) ||
          SafeMath.gt(
            props.volume,
            props.orderType === "market"
              ? storeCtx.selectedTicker?.maxMktSz
              : props.orderType === "limit"
              ? storeCtx.selectedTicker?.maxLmtSz
              : "99999"
          )
        }
      >
        {props.kind === "bid" ? t("buy") : t("sell")}
        {` ${storeCtx.selectedTicker?.base_unit?.toUpperCase() ?? ""}`}
      </button>
    </form>
  );
};

const TradePannel = (props) => {
  const { width } = useViewport();
  const breakpoint = 414;
  const storeCtx = useContext(StoreContext);
  const [limitBuyPx, setLimitBuyPx] = useState(null);
  const [limitSellPx, setLimitSellPx] = useState(null);
  const [marketBuySz, setMarketBuySz] = useState(null);
  const [marketSellSz, setMarketSellSz] = useState(null);
  const [limitBuySz, setLimitBuySz] = useState(null);
  const [limitSellSz, setLimitSellSz] = useState(null);
  const [tdMode, setTdMode] = useState("cash");
  const [selectedLimitSellPct, setSelectedLimitSellPct] = useState(null);
  const [selectedMarketBuyPct, setSelectedMarketBuyPct] = useState(null);
  const [selectedLimitBuyPct, setSelectedLimitBuyPct] = useState(null);
  const [selectedMarketSellPct, setSelectedMarketSellPct] = useState(null);
  const [buyErrorMessage, setBuyErrorMessage] = useState(null);
  const [sellErrorMessage, setSellErrorMessage] = useState(null);
  const { t } = useTranslation();

  const limitBuyPxHandler = useCallback(
    (value) => {
      // console.trace(`limitBuyPxHandler`, value);
      let _value = +value < 0 ? "0" : value;
      setLimitBuyPx(_value);
      if (SafeMath.lt(value, storeCtx.selectedTicker?.tickSz))
        setBuyErrorMessage(
          `Minimum order price is ${storeCtx.selectedTicker?.tickSz}`
        );
      else setBuyErrorMessage(null);
    },
    [storeCtx.selectedTicker?.tickSz]
  );

  const limitSellPxHandler = useCallback(
    (value) => {
      let _value = +value < 0 ? "0" : value;
      setLimitSellPx(_value);
      if (SafeMath.lt(value, storeCtx.selectedTicker?.tickSz))
        setSellErrorMessage(
          `Minimum order price is ${storeCtx.selectedTicker?.tickSz}`
        );
      else setBuyErrorMessage(null);
    },
    [storeCtx.selectedTicker?.tickSz]
  );

  const buySzHandler = useCallback(
    (orderType, value) => {
      let _value = SafeMath.lt(value, "0")
        ? "0"
        : SafeMath.gt(props.quoteCcyAvailable, "0") &&
          SafeMath.gte(
            SafeMath.mult(
              value,
              orderType === "market"
                ? storeCtx.selectedTicker?.last
                : limitBuyPx
            ),
            props.quoteCcyAvailable
          )
        ? formateDecimal(
            SafeMath.div(
              props.quoteCcyAvailable,
              orderType === "market"
                ? storeCtx.selectedTicker?.last
                : limitBuyPx
            ),
            { decimalLength: 8 }
          )
        : value;
      if (orderType === "market") setMarketBuySz(_value);
      else setLimitBuySz(_value);
      if (SafeMath.gt(value, "0")) {
        if (
          !!storeCtx.selectedTicker?.minSz &&
          SafeMath.lt(value, storeCtx.selectedTicker?.minSz)
        )
          setBuyErrorMessage(
            `Minimum order size is ${storeCtx.selectedTicker?.minSz}`
          );
        else if (
          SafeMath.gt(
            value,
            orderType === "market"
              ? storeCtx.selectedTicker?.maxMktSz
              : orderType === "limit"
              ? storeCtx.selectedTicker?.maxLmtSz
              : "99999"
          )
        )
          setBuyErrorMessage(
            `Maximum order size is ${
              orderType === "market"
                ? storeCtx.selectedTicker?.maxMktSz
                : orderType === "limit"
                ? storeCtx.selectedTicker?.maxLmtSz
                : "99999"
            }`
          );
        else setBuyErrorMessage(null);
        if (
          SafeMath.gt(
            SafeMath.mult(
              value,
              orderType === "market"
                ? storeCtx.selectedTicker?.last
                : limitBuyPx
            ),
            props.quoteCcyAvailable
          )
        ) {
          setBuyErrorMessage(
            `Available ${storeCtx.selectedTicker?.quote_unit?.toUpperCase()} is not enough`
          );
        } else setBuyErrorMessage(null);
      } else {
        setBuyErrorMessage(null);
      }
    },
    [
      props.quoteCcyAvailable,
      storeCtx.selectedTicker?.last,
      storeCtx.selectedTicker?.minSz,
      storeCtx.selectedTicker?.maxMktSz,
      storeCtx.selectedTicker?.maxLmtSz,
      storeCtx.selectedTicker?.quote_unit,
      limitBuyPx,
    ]
  );
  const sellSzHandler = useCallback(
    (orderType, value) => {
      let _value = SafeMath.lt(value, "0")
        ? "0"
        : SafeMath.gt(props.baseCcyAvailable, "0") &&
          SafeMath.gte(value, props.baseCcyAvailable)
        ? props.baseCcyAvailable
        : value;
      if (orderType === "market") setMarketSellSz(_value);
      else setLimitSellSz(_value);

      if (SafeMath.gt(value, "0")) {
        if (
          !!storeCtx.selectedTicker?.minSz &&
          SafeMath.lt(value, storeCtx.selectedTicker?.minSz)
        )
          setSellErrorMessage(
            `Minimum order size is ${storeCtx.selectedTicker?.minSz}`
          );
        else if (
          SafeMath.gt(
            value,
            orderType === "market"
              ? storeCtx.selectedTicker?.maxMktSz
              : orderType === "limit"
              ? storeCtx.selectedTicker?.maxLmtSz
              : "99999"
          )
        )
          setSellErrorMessage(
            `Maximum order size is ${
              orderType === "market"
                ? storeCtx.selectedTicker?.maxMktSz
                : orderType === "limit"
                ? storeCtx.selectedTicker?.maxLmtSz
                : "99999"
            }`
          );
        else setBuyErrorMessage(null);
        if (SafeMath.gt(value, props.baseCcyAvailable)) {
          setSellErrorMessage(
            `Available ${storeCtx.selectedTicker?.base_unit?.toUpperCase()} is not enough`
          );
        } else setSellErrorMessage(null);
      } else {
        setSellErrorMessage(null);
      }
    },
    [
      props.baseCcyAvailable,
      storeCtx.selectedTicker?.base_unit,
      storeCtx.selectedTicker?.maxLmtSz,
      storeCtx.selectedTicker?.maxMktSz,
      storeCtx.selectedTicker?.minSz,
    ]
  );

  const buyPctHandler = useCallback(
    (orderType, pct, buyPx, availBal) => {
      let size = "0";
      if (SafeMath.gt(props.quoteCcyAvailable, 0))
        size = formateDecimal(
          SafeMath.div(SafeMath.mult(pct, props.quoteCcyAvailable), buyPx),
          { decimalLength: storeCtx.selectedTicker?.lotSz || "0" }
        );
      else if (SafeMath.gt(availBal, 0))
        size = formateDecimal(
          SafeMath.div(SafeMath.mult(pct, availBal), buyPx),
          { decimalLength: storeCtx.selectedTicker?.lotSz || "0" }
        );
      if (orderType === "market") {
        setMarketBuySz(size);
        setSelectedMarketBuyPct(pct);
      } else {
        setLimitBuySz(size);
        setSelectedLimitBuyPct(pct);
      }
      if (SafeMath.lt(size, storeCtx.selectedTicker?.minSz))
        setSellErrorMessage(
          `Minimum order size is ${storeCtx.selectedTicker?.minSz}`
        );
      else if (
        SafeMath.gt(
          size,
          orderType === "market"
            ? storeCtx.selectedTicker?.maxMktSz
            : orderType === "limit"
            ? storeCtx.selectedTicker?.maxLmtSz
            : "99999"
        )
      )
        setSellErrorMessage(
          `Maximum order size is ${
            orderType === "market"
              ? storeCtx.selectedTicker?.maxMktSz
              : orderType === "limit"
              ? storeCtx.selectedTicker?.maxLmtSz
              : "99999"
          }`
        );
      else setBuyErrorMessage(null);
    },
    [
      props.quoteCcyAvailable,
      storeCtx.selectedTicker?.lotSz,
      storeCtx.selectedTicker?.maxLmtSz,
      storeCtx.selectedTicker?.maxMktSz,
      storeCtx.selectedTicker?.minSz,
    ]
  );

  const sellPctHandler = useCallback(
    (orderType, pct, availBal) => {
      let size = "0";
      if (SafeMath.gt(props.baseCcyAvailable, 0))
        size = formateDecimal(SafeMath.mult(pct, props.baseCcyAvailable), {
          decimalLength: storeCtx.selectedTicker?.lotSz || "0",
        });
      else if (SafeMath.gt(availBal, 0))
        size = formateDecimal(SafeMath.mult(pct, availBal), {
          decimalLength: storeCtx.selectedTicker?.lotSz || "0",
        });
      if (orderType === "market") {
        setMarketSellSz(size);
        setSelectedMarketSellPct(pct);
      } else {
        setLimitSellSz(size);
        setSelectedLimitSellPct(pct);
      }
      if (SafeMath.lt(size, storeCtx.selectedTicker?.minSz))
        setSellErrorMessage(
          `Minimum order size is ${storeCtx.selectedTicker?.minSz}`
        );
      else if (
        SafeMath.gt(
          size,
          orderType === "market"
            ? storeCtx.selectedTicker?.maxMktSz
            : orderType === "limit"
            ? storeCtx.selectedTicker?.maxLmtSz
            : "99999"
        )
      )
        setSellErrorMessage(
          `Maximum order size is ${
            orderType === "market"
              ? storeCtx.selectedTicker?.maxMktSz
              : orderType === "limit"
              ? storeCtx.selectedTicker?.maxLmtSz
              : "99999"
          }`
        );
      else setBuyErrorMessage(null);
    },
    [
      props.baseCcyAvailable,
      storeCtx.selectedTicker?.lotSz,
      storeCtx.selectedTicker?.maxLmtSz,
      storeCtx.selectedTicker?.maxMktSz,
      storeCtx.selectedTicker?.minSz,
    ]
  );

  const onSubmit = async (event, kind) => {
    event.preventDefault();
    if (!storeCtx.selectedTicker) return;
    const order =
      props.orderType === "limit"
        ? kind === "bid"
          ? {
              instId: storeCtx.selectedTicker.instId,
              tdMode,
              kind,
              ordType: props.orderType,
              price: limitBuyPx,
              volume: limitBuySz,
              market: storeCtx.selectedTicker.market,
            }
          : {
              instId: storeCtx.selectedTicker.instId,
              tdMode,
              kind,
              ordType: props.orderType,
              price: limitSellPx,
              volume: limitSellSz,
              market: storeCtx.selectedTicker.market,
            }
        : {
            instId: storeCtx.selectedTicker.instId,
            tdMode,
            kind,
            ordType: props.orderType,
            price: storeCtx.selectedTicker?.last,
            volume: kind === "bid" ? marketBuySz : marketSellSz,
            market: storeCtx.selectedTicker.market,
          };
    const confirm = window.confirm(`You are going to
          ${order.kind} ${order.volume} ${order.instId.split("-")[0]}
          ${order.kind === "bid" ? "with" : "for"} ${SafeMath.mult(
      props.orderType === "market" ? storeCtx.selectedTicker.last : order.price,
      order.volume
    )} ${order.instId.split("-")[1]}
          with price ${
            props.orderType === "market"
              ? storeCtx.selectedTicker.last
              : order.price
          } ${order.instId.split("-")[1]} per ${order.instId.split("-")[0]}`);
    if (confirm) {
      await storeCtx.postOrder(order);
      props.setRefresh(true);
    }
    if (kind === "bid") {
      if (props.orderType === "market") {
        setMarketBuySz("0");
        setSelectedMarketBuyPct(null);
      } else {
        setSelectedLimitBuyPct(null);
        setLimitBuySz("0");
      }
      // buyPctHandler(props.orderType, "0.25", selectedTicker.last);
    } else {
      if (props.orderType === "market") {
        setMarketSellSz("0");
        setSelectedMarketSellPct(null);
      } else {
        setLimitSellSz("0");
        setSelectedLimitSellPct(null);
      }

      // sellPctHandler(props.orderType, "0.25", selectedTicker.last);
    }
  };

  useEffect(() => {
    if (
      storeCtx.depthBook !== null &&
      storeCtx.depthBook?.price &&
      storeCtx.depthBook?.amount
    ) {
      console.log(`TradePannel useEffect depthBook`, storeCtx.depthBook);
      limitBuyPxHandler(storeCtx.depthBook.price);
      limitSellPxHandler(storeCtx.depthBook.price);
      buySzHandler("market", storeCtx.depthBook.amount);
      sellSzHandler("market", storeCtx.depthBook.amount);
      buySzHandler("limit", storeCtx.depthBook.amount);
      sellSzHandler("limit", storeCtx.depthBook.amount);
      storeCtx.depthBookHandler(null);
    }
  }, [
    buySzHandler,
    limitBuyPxHandler,
    limitSellPxHandler,
    sellSzHandler,
    storeCtx,
  ]);

  return (
    <div className="market-trade__panel">
      {width <= breakpoint ? (
        <Tabs defaultActiveKey="buy">
          <Tab eventKey="buy" title={t("buy")}>
            <TradeForm
              ordType={props.orderType}
              price={
                props.orderType === "market"
                  ? storeCtx.selectedTicker?.last
                  : limitBuyPx
              }
              volume={props.orderType === "market" ? marketBuySz : limitBuySz}
              quoteCcyAvailable={props.quoteCcyAvailable}
              baseCcyAvailable={props.baseCcyAvailable}
              selectedPct={
                props.orderType === "market"
                  ? selectedMarketBuyPct
                  : selectedLimitBuyPct
              }
              onPxInput={limitBuyPxHandler}
              onSzInput={(value) => buySzHandler(props.orderType, value)}
              percentageHandler={(pct, buyPx) =>
                buyPctHandler(props.orderType, pct, buyPx)
              }
              onSubmit={onSubmit}
              kind="bid"
              readyOnly={!!props.readyOnly}
              errorMessage={buyErrorMessage}
            />
          </Tab>
          <Tab eventKey="sell" title={t("sell")}>
            <TradeForm
              ordType={props.orderType}
              price={
                props.orderType === "market"
                  ? storeCtx.selectedTicker?.last
                  : limitSellPx
              }
              volume={props.orderType === "market" ? marketSellSz : limitSellSz}
              quoteCcyAvailable={props.quoteCcyAvailable}
              baseCcyAvailable={props.baseCcyAvailable}
              selectedPct={
                props.orderType === "market"
                  ? selectedMarketSellPct
                  : selectedLimitSellPct
              }
              onPxInput={limitSellPxHandler}
              onSzInput={(value) => sellSzHandler(props.orderType, value)}
              percentageHandler={(pct, buyPx) =>
                sellPctHandler(props.orderType, pct, buyPx)
              }
              onSubmit={onSubmit}
              kind="ask"
              readyOnly={!!props.readyOnly}
              errorMessage={sellErrorMessage}
            />
          </Tab>
        </Tabs>
      ) : (
        <>
          <TradeForm
            ordType={props.orderType}
            price={
              props.orderType === "market"
                ? storeCtx.selectedTicker?.last
                : limitBuyPx
            }
            volume={props.orderType === "market" ? marketBuySz : limitBuySz}
            quoteCcyAvailable={props.quoteCcyAvailable}
            baseCcyAvailable={props.baseCcyAvailable}
            selectedPct={
              props.orderType === "market"
                ? selectedMarketBuyPct
                : selectedLimitBuyPct
            }
            onPxInput={limitBuyPxHandler}
            onSzInput={(value) => buySzHandler(props.orderType, value)}
            percentageHandler={(pct, buyPx) =>
              buyPctHandler(props.orderType, pct, buyPx)
            }
            onSubmit={onSubmit}
            kind="bid"
            readyOnly={!!props.readyOnly}
            errorMessage={buyErrorMessage}
          />
          <TradeForm
            ordType={props.orderType}
            price={
              props.orderType === "market"
                ? storeCtx.selectedTicker?.last
                : limitSellPx
            }
            volume={props.orderType === "market" ? marketSellSz : limitSellSz}
            quoteCcyAvailable={props.quoteCcyAvailable}
            baseCcyAvailable={props.baseCcyAvailable}
            selectedPct={
              props.orderType === "market"
                ? selectedMarketSellPct
                : selectedLimitSellPct
            }
            onPxInput={limitSellPxHandler}
            onSzInput={(value) => sellSzHandler(props.orderType, value)}
            percentageHandler={(pct) => sellPctHandler(props.orderType, pct)}
            onSubmit={onSubmit}
            kind="ask"
            readyOnly={!!props.readyOnly}
            errorMessage={sellErrorMessage}
          />
        </>
      )}
    </div>
  );
};

const MarketTrade = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [quoteCcyAvailable, setQuoteCcyAvailable] = useState("0");
  const [baseCcyAvailable, setBaseCcyAvailable] = useState("0");
  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    if (
      (storeCtx.accounts?.length > 0 &&
        ((storeCtx.selectedTicker && !selectedTicker) ||
          (storeCtx.selectedTicker &&
            storeCtx.selectedTicker.instId !== selectedTicker?.instId))) ||
      refresh
    ) {
      let quoteCcyAccount = storeCtx.accounts?.find((account) => {
        return (
          account.currency ===
          storeCtx.selectedTicker?.quote_unit?.toUpperCase()
        );
      });

      if (quoteCcyAccount) {
        setQuoteCcyAvailable(quoteCcyAccount?.balance);
      }
      let baseCcyAccount = storeCtx.accounts?.find(
        (account) =>
          account.currency === storeCtx.selectedTicker?.base_unit?.toUpperCase()
      );
      if (baseCcyAccount) {
        setBaseCcyAvailable(baseCcyAccount?.balance);
      }
      setSelectedTicker(storeCtx.selectedTicker);
    }
  }, [storeCtx.selectedTicker, storeCtx.accounts, selectedTicker, refresh]);
  return (
    <div className="market-trade">
      <div className="market-trade__container">
        <div className="market-trade__header">{t("place_order")}</div>
        <Tabs defaultActiveKey="limit">
          <Tab eventKey="limit" title={t("limit")}>
            <TradePannel
              orderType="limit"
              quoteCcyAvailable={quoteCcyAvailable}
              baseCcyAvailable={baseCcyAvailable}
              setRefresh={setRefresh}
            />
          </Tab>
          <Tab eventKey="market" title={t("market")}>
            <TradePannel
              orderType="market"
              readyOnly={true}
              quoteCcyAvailable={quoteCcyAvailable}
              baseCcyAvailable={baseCcyAvailable}
              setRefresh={setRefresh}
            />
          </Tab>
          {/* <Tab eventKey="stop-limit" title="Stop Limit">
            <TradePannel orderType="stop-limit" />
          </Tab> */}
          {/* <Tab eventKey="stop-market" title="Stop Market">
            <TradePannel orderType="stop-market" />
          </Tab> */}
        </Tabs>
      </div>
      {!storeCtx.isLogin && (
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
//             {key === "limit" && <TradePannel orderType={key} />}
//           </Tab>
//           <Tab eventKey="market" title="Market">
//             {key === "market" && <TradePannel orderType={key} />}
//           </Tab>
//           <Tab eventKey="stop-limit" title="Stop Limit">
//             {key === "stop-limit" && <TradePannel orderType={key} />}
//           </Tab>
//           <Tab eventKey="stop-market" title="Stop Market">
//             {key === "stop-market" && <TradePannel orderType={key} />}
//           </Tab>
//         </Tabs>
//       </div>
//     </>
//   );
// };
export default MarketTrade;
