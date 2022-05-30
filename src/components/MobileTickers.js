import React, { useContext, useEffect, useState } from "react";
import { Tabs, Tab } from "react-bootstrap";
import StoreContext from "../store/store-context";
import SafeMath from "../utils/SafeMath";
import { useTranslation } from "react-i18next";
import { formateDecimal } from "../utils/Utils";
import { ImCross } from "react-icons/im";
import { IoMdArrowDropdown } from "react-icons/io";

const TickerTile = (props) => {
  const { t } = useTranslation();
  return (
    <li
      onClick={props.onClick}
      className={`mobile-tickers__tile ${props.active ? "active" : ""} ${
        props.update ? "update" : ""
      }`}
    >
      <div className="mobile-tickers__icon">
        <img
          src={`/icons/${props.ticker.base_unit}.png`}
          alt={props.ticker.base_unit}
        />
      </div>
      <div className="mobile-tickers__detail">
        <div className="mobile-tickers__name">{props.ticker.name}</div>
        <div className="mobile-tickers__currency">
          {t(props.ticker?.base_unit)?.toUpperCase()}
        </div>
      </div>
      <div className="mobile-tickers__price">
        <div>{formateDecimal(props.ticker?.last, { decimalLength: 2 })}</div>
        <div
          className={SafeMath.gte(props.ticker?.change, "0") ? "green" : "red"}
        >
          {`${SafeMath.gte(props.ticker?.change, "0") ? "+" : "-"}${parseFloat(
            SafeMath.mult(props.ticker?.changePct, "100")
          ).toFixed(2)}%`}
        </div>
      </div>
    </li>
  );
};

const TickerList = (props) => {
  const storeCtx = useContext(StoreContext);
  return (
    <ul className="mobile-tickers__list">
      {props.tickers.map((ticker) => (
        <TickerTile
          key={`${ticker.market}`}
          ticker={ticker}
          active={ticker.active}
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
  HKD: ["HKD"],
  USDX: ["USDC", "USDT", "USDK"],
  INNO: ["INNO"],
  USD: ["USD"],
  ALTS: ["USX"],
};

const MobileTickers = (props) => {
  const { t } = useTranslation();
  const [openDialog, setOpenDialog] = useState(false);
  const storeCtx = useContext(StoreContext);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const [defaultActiveKey, setDefaultActiveKey] = useState("hkd");

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
                  tickers={storeCtx.tickers.filter(
                    (ticker) => ticker.group === quoteCcy.toLowerCase()
                  )}
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
