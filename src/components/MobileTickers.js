import React, { useContext, useEffect, useState, useCallback } from "react";
import { Tabs, Tab } from "react-bootstrap";
import StoreContext from "../store/store-context";
import SafeMath from "../utils/SafeMath";
import { useTranslation } from "react-i18next";
import { formateDecimal, getPrecision } from "../utils/Utils";
import { ImCross } from "react-icons/im";
import { IoMdArrowDropdown } from "react-icons/io";

const TickerTile = React.memo((props) => {
  const { t } = useTranslation();
  return (
    <li
      onClick={props.onClick}
      className={`mobile-tickers__tile ${props.active ? "active" : ""} ${
        props.update ? "update" : ""
      }`}
    >
      <div className="mobile-tickers__icon">
        <img src={`/icons/${props.baseUnit}.png`} alt={props.baseUnit} />
      </div>
      <div className="mobile-tickers__detail">
        <div className="mobile-tickers__name">{props.name}</div>
        <div className="mobile-tickers__currency">
          {t(props.baseUnit)?.toUpperCase()}
        </div>
      </div>
      <div className="mobile-tickers__price">
        <div>
          {formateDecimal(props.last, {
            decimalLength: props.tickSz ? getPrecision(props.tickSz) : "0",
            pad: true,
          })}
        </div>
        <div className={SafeMath.gte(props.change, "0") ? "green" : "red"}>
          {`${formateDecimal(SafeMath.mult(props.changePct, "100"), {
            decimalLength: 2,
            pad: true,
            withSign: true,
          })}%`}
        </div>
      </div>
    </li>
  );
});

const TickerList = (props) => {
  const storeCtx = useContext(StoreContext);
  return (
    <ul className="mobile-tickers__list">
      {props.tickers.map((ticker) => (
        <TickerTile
          key={`${ticker.market}`}
          name={ticker.name}
          baseUnit={ticker.baseUnit}
          last={ticker.last}
          tickSz={ticker.tickSz}
          change={ticker.change}
          changePct={ticker.changePct}
          active={ticker.market === storeCtx.market}
          update={ticker.update}
          onClick={() => {
            storeCtx.selectMarket(ticker.market);
            props.closeDialogHandler();
          }}
        />
      ))}
    </ul>
  );
};

const quoteCcies = {
  USDT: ["USDT", "USDX"],
  HKD: ["HKD"],
  // USDX: ["USDC", "USDT", "USDK"],
  INNO: ["INNO"],
  USD: ["USD"],
  ALTS: ["ALTS", "USX"],
};

const MobileTickers = (_) => {
  const { t } = useTranslation();
  const [openDialog, setOpenDialog] = useState(false);
  const [isInit, setIsInit] = useState(false);
  const storeCtx = useContext(StoreContext);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [defaultActiveKey, setDefaultActiveKey] = useState(
    Object.keys(quoteCcies)[0].toLowerCase()
  );
  const [tickers, setTickers] = useState([]);

  useEffect(() => {
    if ((!isInit && storeCtx.tickers?.length > 0) || openDialog) {
      setTickers(storeCtx.tickers);
      if (!isInit) setIsInit(true);
    }
    if (
      (storeCtx.selectedTicker && !selectedTicker) ||
      (storeCtx.selectedTicker &&
        storeCtx.selectedTicker?.instId !== selectedTicker?.instId)
    ) {
      setSelectedTicker(storeCtx.selectedTicker);
      setDefaultActiveKey(storeCtx.selectedTicker?.group);
    }
  }, [
    isInit,
    openDialog,
    selectedTicker,
    storeCtx.selectedTicker,
    storeCtx.tickers,
  ]);

  return (
    <div className="mobile-tickers mobile-tickers__dropdown">
      <div
        className="mobile-tickers__open-btn"
        onClick={() => setOpenDialog(true)}
      >
        <div>
          <div className="left-label">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
              <path d="M345.6 128l51.3 51.3-109.3 109.4-89.6-89.6L32 365.4 63.6 397 198 262.5l89.6 89.7 141.1-141 51.3 51.3V128H345.6z"></path>
            </svg>
          </div>
          {t("market")}
        </div>
        <div>
          <span>{selectedTicker?.name || "--"}</span>
          <IoMdArrowDropdown />
        </div>
      </div>
      {openDialog && (
        <div className="mobile-tickers__container">
          <div className="mobile-tickers__header">
            <div className="mobile-tickers__title">
              {selectedTicker?.name || "--"}
            </div>
            <div
              className="mobile-tickers__close-btn"
              onClick={() => setOpenDialog(false)}
            >
              <ImCross />
            </div>
          </div>
          <Tabs defaultActiveKey={defaultActiveKey}>
            {Object.keys(quoteCcies).map((quoteCcy) => (
              <Tab
                eventKey={quoteCcy.toLowerCase()}
                title={quoteCcy}
                key={`mobile-tickers-tab-${quoteCcy.toLowerCase()}`}
              >
                <TickerList
                  closeDialogHandler={() => setOpenDialog(false)}
                  tickers={tickers?.filter((ticker) => {
                    // if (!ticker.group) console.error(ticker);
                    return quoteCcies[quoteCcy].includes(
                      ticker.group?.toUpperCase()
                    );
                  })}
                />
              </Tab>
            ))}
          </Tabs>
        </div>
      )}
    </div>
  );
};

export default MobileTickers;
