import React, { useContext } from "react";
import StoreContext from "../store/store-context";
import { dateFormatter, formateDecimal } from "../utils/Utils";
import { useTranslation } from "react-i18next";
// import { FixedSizeList as List } from "react-window";

const TradeTile = React.memo((props) => {
  return (
    <li
      className={`market-history__tile flex-row 
      ${props.update ? "++TODO" : ""}
      `}
      trade-id={props.id}
      style={props.style}
    >
      <div className="market-history__tile--time">
        <span>{dateFormatter(parseInt(props.ts)).time}</span>
        <span>{dateFormatter(parseInt(props.ts)).date}</span>
      </div>
      <div
        className={`market-history__tile--data ${
          props.side === "down" ? "red" : "green"
        }`}
      >
        {formateDecimal(props.price, {
          decimalLength: props.tickSz || 0,
          pad: true,
        })}
      </div>
      <div className="market-history__tile--data">
        {formateDecimal(props.volume, {
          decimalLength: props.lotSz || 0,
          pad: true,
        })}
      </div>
    </li>
  );
});

const MarketHistory = (_) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();

  return (
    <div className="market-history">
      <div className="market-history__header">{t("trades")}</div>
      <ul className="market-history__title flex-row table__header">
        <li>{t("time")}</li>
        <li>{`${t("price")}(${
          storeCtx?.selectedTicker?.quoteUnit?.toUpperCase() || "--"
        })`}</li>
        <li>{`${t("amount")}(${
          storeCtx?.selectedTicker?.baseUnit?.toUpperCase() || "--"
        })`}</li>
      </ul>
      <ul className="market-history__list scrollbar-custom">
        {storeCtx.trades?.length > 0 &&
          storeCtx.trades.map((trade) => (
            <TradeTile
              key={`${trade.market}-${trade.id}`}
              id={trade.id}
              update={trade.update}
              ts={trade.ts}
              side={trade.side}
              price={trade.price}
              volume={trade.volume}
              tickSz={storeCtx.tickSz}
              lotSz={storeCtx.lotSz}
            />
          ))}
        {/* <List
          innerElementType="ul"
          height={393}
          itemCount={storeCtx.trades ? storeCtx.trades.length : 0}
          itemData={storeCtx.trades ? storeCtx.trades : []}
          itemSize={31}
          width={`100%`}
        >
          {({ data, index, style }) => (
            <TradeTile
              key={`${data[index].market}-${data[index].id}`}
              trade={data[index]}
              style={style}
            />
          )}
        </List> */}
      </ul>
    </div>
  );
};
export default MarketHistory;
