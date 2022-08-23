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
import { formateDecimal, getPrecision } from "../utils/Utils";
import { FixedSizeList as List } from "react-window";

const TickerTile = (props) => {
  // const storeCtx = useContext(StoreContext);
  return (
    <li
      onClick={props.onClick}
      className={`market-tile ${props.active ? "active" : ""} ${
        props.update ? "" : ""
      }`}
      style={props.style}
    >
      <div>{props.ticker.name}</div>
      <div>
        {formateDecimal(props.ticker.last, {
          decimalLength: props.ticker?.tickSz
            ? getPrecision(props.ticker?.tickSz)
            : "0",
          pad: true,
        })}
      </div>
      <div className={SafeMath.gte(props.ticker.change, "0") ? "green" : "red"}>
        {`${formateDecimal(SafeMath.mult(props.ticker?.changePct, "100"), {
          decimalLength: 2,
          pad: true,
          withSign: true,
        })}%`}
      </div>
      <div>
        {formateDecimal(props.ticker.volume, {
          decimalLength: getPrecision(props.ticker?.lotSz),
          pad: true,
        })}
      </div>
      <div>
        {formateDecimal(props.ticker.high, {
          decimalLength: props.ticker?.tickSz
            ? getPrecision(props.ticker?.tickSz)
            : "0",
          pad: true,
        })}
      </div>
      <div>
        {formateDecimal(props.ticker.low, {
          decimalLength: props.ticker?.tickSz
            ? getPrecision(props.ticker?.tickSz)
            : "0",
          pad: true,
        })}
      </div>
    </li>
  );
};

const TickerList = (props) => {
  const storeCtx = useContext(StoreContext);
  return (
    <ul className="ticker-list">
      <List
        innerElementType="ul"
        height={405}
        itemCount={props.tickers ? props.tickers.length : 0}
        itemData={props.tickers ? props.tickers : []}
        itemSize={31}
        width={585}
      >
        {({ data, index, style }) => (
          <TickerTile
            key={`${data[index].market}`}
            ticker={data[index]}
            active={data[index].active}
            update={data[index].update}
            onClick={() => {
              storeCtx.selectMarket(data[index].market);
              props.openTickerListHandler(false);
            }}
            style={style}
          />
        )}
      </List>
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
  HKD: ["HKD"],
  USDX: ["USDC", "USDT", "USDK"],
  INNO: ["INNO"],
  USD: ["USD"],
  ALTS: ["USX"],
};
const DesktopTickers = (props) => {
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
              openTickerListHandler={props.openTickerListHandler}
            />
          </Tab>
        ))}
      </Tabs>
    </div>
  );
};

export default DesktopTickers;
