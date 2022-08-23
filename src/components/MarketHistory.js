import React, { useContext } from "react";
import StoreContext from "../store/store-context";
import { dateFormatter, formateDecimal } from "../utils/Utils";
import { useTranslation } from "react-i18next";

const TradeTile = (props) => {
  const storeCtx = useContext(StoreContext);
  return (
    <li
      className={`market-history__tile flex-row 
      ${props.trade.update ? "++TODO" : ""}
      `}
      trade-id={props.trade.id}
    >
      <div className="market-history__tile--time">
        <span>{dateFormatter(parseInt(props.trade.ts)).time}</span>
        <span>{dateFormatter(parseInt(props.trade.ts)).date}</span>
      </div>
      <div
        className={`market-history__tile--data ${
          props.trade.side === "down" ? "red" : "green"
        }`}
      >
        {formateDecimal(props.trade.price, {
          decimalLength: storeCtx.tickSz || 0,
          pad: true,
        })}
      </div>
      <div className="market-history__tile--data">
        {formateDecimal(props.trade.volume, {
          decimalLength: storeCtx.lotSz || 0,
          pad: true,
        })}
      </div>
    </li>
  );
};

const MarketHistory = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();

  return (
    <div className="market-history">
      <div className="market-history__header">{t("trades")}</div>
      <ul className="market-history__title flex-row table__header">
        <li>{t("time")}</li>
        <li>{`${t("price")}(${
          storeCtx?.selectedTicker?.quote_unit?.toUpperCase() || "--"
        })`}</li>
        <li>{`${t("amount")}(${
          storeCtx?.selectedTicker?.base_unit?.toUpperCase() || "--"
        })`}</li>
      </ul>
      <ul className="market-history__list scrollbar-custom">
        {storeCtx.trades &&
          storeCtx.trades
            .map((trade) => (
              <TradeTile key={`${trade.market}-${trade.id}`} trade={trade} />
            ))}
      </ul>
    </div>
  );
};
export default MarketHistory;