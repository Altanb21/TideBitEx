import React, {
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { Tabs, Tab } from "react-bootstrap";
import StoreContext from "../store/store-context";
import SafeMath from "../utils/SafeMath";
import { IoSearch } from "react-icons/io5";
import { useTranslation } from "react-i18next";
import { formateDecimal } from "../utils/Utils";

const TickerTile = (props) => {
  const storeCtx = useContext(StoreContext);
  return (
    <li
      onClick={(_) => storeCtx.selectTickerHandler(props.ticker)}
      className={`market-tile ${
        props.ticker.instId === storeCtx?.selectedTicker?.instId ? "active" : ""
      } ${props.ticker.update ? "update" : ""}`}
    >
      <div>{props.ticker.name}</div>
      <div>{formateDecimal(props.ticker.last, 8)}</div>
      <div className={SafeMath.gte(props.ticker.change, "0") ? "green" : "red"}>
        {SafeMath.gte(props.ticker.change, "0")
          ? `+${formateDecimal(
              SafeMath.mult(props.ticker?.changePct, "100"),
              3
            )}%`
          : `${formateDecimal(
              SafeMath.mult(props.ticker?.changePct, "100"),
              3
            )}%`}
      </div>
      <div>{formateDecimal(props.ticker.volume, 8)}</div>
      <div>{formateDecimal(props.ticker.high, 8)}</div>
      <div>{formateDecimal(props.ticker.low, 8)}</div>
    </li>
  );
};

const TickerList = (props) => {
  return (
    <ul className="ticker-list">
      {props.tickers.map((ticker, index) => (
        <TickerTile
          ticker={ticker}
          index={index}
          key={`${ticker.instId}-${ticker.instType}-${index}-star`}
        />
      ))}
    </ul>
  );
};

const TickersHeader = (props) => {
  const { t } = useTranslation();
  return (
    <ul className="header">
      <li>{t("tickers")}</li>
      <li>{t("unit_price")}</li>
      <li>{t("change")}</li>
      <li>{t("volume")}</li>
      <li>{t("high")}</li>
      <li>{t("low")}</li>
    </ul>
  );
};
const quoteCcies = {
  BTC: ["BTC"],
  // ETH: ["ETH"],
  HKD: ["HKD"],
  USDX: ["USDC", "USDT", "USDK"],
  INNO: ["INNO"],
  USD: ["USD"],
  ALTS: ["USX"],
};
const MarketTickers = (props) => {
  const storeCtx = useContext(StoreContext);
  const inputRef = useRef();
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [defaultActiveKey, setDefaultActiveKey] = useState("hkd");
  const [filteredTickers, setFilteredTickers] = useState([]);

  const filterTickers = useCallback(() => {
    const tickers = storeCtx.tickers.filter(
      (ticker) =>
        !inputRef.current ||
        ticker.instId
          ?.toLowerCase()
          .includes(inputRef.current.value.toLowerCase())
    );
    setFilteredTickers(tickers);
  }, [storeCtx.tickers]);

  useEffect(() => {
    filterTickers();
    return () => {};
  }, [filterTickers]);

  useEffect(() => {
    if (
      (storeCtx.selectedTicker && !selectedTicker) ||
      (storeCtx.selectedTicker &&
        storeCtx.selectedTicker?.instId !== selectedTicker?.instId)
    ) {
      setSelectedTicker(storeCtx.selectedTicker);
      setDefaultActiveKey(storeCtx.selectedTicker?.group);
    }
  }, [selectedTicker, storeCtx.selectedTicker]);

  return (
    <div className="market-tickers">
      <div className="input-group">
        <div className="input-group-prepend">
          <span className="input-group-text" id="inputGroup-sizing-sm">
            <IoSearch />
          </span>
        </div>
        <input
          type="text"
          className="form-control"
          placeholder="Search"
          aria-describedby="inputGroup-sizing-sm"
          ref={inputRef}
          onChange={filterTickers}
        />
      </div>
      <Tabs defaultActiveKey={defaultActiveKey}>
        {Object.keys(quoteCcies).map((quoteCcy) => (
          <Tab
            eventKey={quoteCcy.toLowerCase()}
            title={quoteCcy}
            key={`market-tab-${quoteCcy.toLowerCase()}`}
          >
            <TickersHeader />
            <TickerList
              tickers={filteredTickers.filter(
                (ticker) => ticker.group === quoteCcy.toLowerCase()
              )}
            />
          </Tab>
        ))}
      </Tabs>
    </div>
  );
};

export default MarketTickers;
