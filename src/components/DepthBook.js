import React, { useContext, useEffect, useState } from "react";
import StoreContext from "../store/store-context";
// import SafeMath from "../utils/SafeMath";
import { FixedSizeList as List } from "react-window";
// import { formateDecimal } from "../utils/Utils";
import { useTranslation } from "react-i18next";
import { useViewport } from "../store/ViewportProvider";
import DropDown from "./DropDown";

const BookTile = (props) => {
  const storeCtx = useContext(StoreContext);

  return (
    <li className={`order-book__tile flex-row`} style={props.style}>
      <div
        className={`order-book__tile--bid  ${
          props.bid?.update ? "" : "" /** TODO animation temporary removed */
          // props.book.update ? "update" : ""
        }`}
        onClick={() => {
          storeCtx.depthBookHandler(props.bid.price, props.bid.amount);
        }}
      >
        {props.bid && (
          <>
            <div>{props.bid.value}</div>
            <div>{props.bid.amount}</div>
            <div>{props.bid.price}</div>
            <div
              className="order-book__tile--cover"
              style={{
                width: `${(parseFloat(props.bid.depth) * 100).toFixed(2)}%`,
              }}
            ></div>
          </>
        )}
      </div>
      <div
        className={`order-book__tile--ask  ${
          props.ask?.update ? "" : "" /** TODO animation temporary removed */
          // props.book.update ? "update" : ""
        }`}
        onClick={() => {
          storeCtx.depthBookHandler(props.ask.price, props.ask.amount);
        }}
      >
        {props.ask && (
          <>
            <div>{props.ask.price}</div>
            <div>{props.ask.amount}</div>
            <div>{props.ask.value}</div>
            <div
              className="order-book__tile--cover"
              style={{
                width: `${(parseFloat(props.ask.depth) * 100).toFixed(2)}%`,
              }}
            ></div>
          </>
        )}
      </div>
    </li>
  );
};

const getDecimal = (length) => {
  let num = "0.";
  for (let i = 0; i < length - 1; i++) {
    num += "0";
  }
  num += "1";
  return num;
};

const DepthBook = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  const [range, setRange] = useState("");
  const [rangeOptions, setRangeOptions] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const { width } = useViewport();
  const breakpoint = 428;

  const changeRange = (range) => {
    setRange(range);
    storeCtx.changeRange(range);
  };

  useEffect(() => {
    if (
      (!selectedTicker && storeCtx.selectedTicker) ||
      (selectedTicker &&
        selectedTicker?.instId !== storeCtx.selectedTicker?.instId)
    ) {
      setSelectedTicker(storeCtx.selectedTicker);
      setRange(storeCtx.selectedTicker?.tickSz);
      storeCtx.changeRange(storeCtx.selectedTicker?.tickSz);
      const options = [];
      let fixed =
        storeCtx.selectedTicker?.tickSz?.split(".").length > 1
          ? storeCtx.selectedTicker?.tickSz?.split(".")[1].length
          : 0;

      for (let i = fixed; i > 0; i--) {
        options.push(getDecimal(i));
      }
      options.push(1);
      if (fixed < 2) {
        options.push(10);
      }
      setRangeOptions(options);
    }
  }, [selectedTicker, storeCtx, storeCtx.selectedTicker]);

  return (
    <section className="order-book">
      {/* <div className="order-book__tool-bar">
        <DropDown
          className="order-book__range-options"
          options={rangeOptions}
          selected={range}
          onSelect={changeRange}
          // placeholder={range}
        >
          {(range) => <div>{range}</div>}
        </DropDown>
      </div> */}
      <ul className="order-book__header table__header flex-row">
        <ul className="order-book__header--bids flex-row">
          <li>{t("amount")}</li>
          <li>{t("volume")}</li>
          <li>{t("bid")}</li>
        </ul>
        <ul className="order-book__header--asks flex-row">
          <li>{t("ask")}</li>
          <li>{t("volume")}</li>
          <li>{t("amount")}</li>
        </ul>
      </ul>
      <div className="order-book__table scrollbar-custom">
        <ul className="order-book__panel">
          <List
            innerElementType="ul"
            height={426}
            itemCount={
              storeCtx.books?.bids
                ? Math.max(
                    storeCtx.books.bids.length,
                    storeCtx.books.asks.length
                  )
                : 0
            }
            itemData={storeCtx.books?.bids ? storeCtx.books.bids : []}
            itemSize={18}
            width={`100%`}
          >
            {({ index, style }) => (
              <BookTile
                style={style}
                bid={storeCtx.books.bids[index]}
                ask={storeCtx.books.asks[index]}
                key={`${storeCtx.selectedTicker.instId}-depthbbook-${index}`}
              />
            )}
          </List>
        </ul>
      </div>
    </section>
  );
};

export default DepthBook;
