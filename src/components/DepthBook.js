import React, { useContext, useEffect, useState } from "react";
import StoreContext from "../store/store-context";
import SafeMath from "../utils/SafeMath";
// import { FixedSizeList as List } from "react-window";
import { formateDecimal } from "../utils/Utils";
import { useTranslation } from "react-i18next";
import { useViewport } from "../store/ViewportProvider";
// import DropDown from "./DropDown";

const BookTile = React.memo((props) => {
  return (
    <li className={`order-book__tile flex-row`} style={props.style}>
      <div
        className={`order-book__tile--bid  ${
          props.bidUpdate ? "" : "" /** TODO animation temporary removed */
          // props.book.update ? "update" : ""
        }`}
        onClick={props.handlebidOrderSelect}
      >
        {props.bidPrice && props.bidAmount && (
          <>
            <div>
              {formateDecimal(SafeMath.mult(props.bidPrice, props.bidAmount), {
                decimalLength: Math.min(props.tickSz || 0, props.lotSz || 0),
                pad: true,
              })}
            </div>
            <div>
              {formateDecimal(props.bidAmount, {
                // decimalLength: 4,
                decimalLength: props.lotSz || 0,
                pad: true,
              })}
            </div>
            <div>
              {formateDecimal(props.bidPrice, {
                // decimalLength: 2,
                decimalLength: props.tickSz || 0,
                pad: true,
              })}
            </div>
            <div
              className="order-book__tile--cover"
              style={{
                width: `${(parseFloat(props.bidDepth) * 100).toFixed(2)}%`,
              }}
            ></div>
          </>
        )}
      </div>
      <div
        className={`order-book__tile--ask  ${
          props.askUpdate ? "" : "" /** TODO animation temporary removed */
          // props.book.update ? "update" : ""
        }`}
        onClick={props.handleAskOrderSelect}
      >
        {props.askPrice && props.askAmount && (
          <>
            <div>
              {formateDecimal(props.askPrice, {
                // decimalLength: 2,
                decimalLength: props.tickSz || 0,
                pad: true,
              })}
            </div>
            <div>
              {formateDecimal(props.askAmount, {
                // decimalLength: 4,
                decimalLength: props.lotSz || 0,
                pad: true,
              })}
            </div>
            <div>
              {formateDecimal(SafeMath.mult(props.askPrice, props.askAmount), {
                decimalLength: Math.min(props.tickSz || 0, props.lotSz || 0),
                pad: true,
              })}
            </div>
            <div
              className="order-book__tile--cover"
              style={{
                width: `${(parseFloat(props.askDepth) * 100).toFixed(2)}%`,
              }}
            ></div>
          </>
        )}
      </div>
    </li>
  );
});

// const getDecimal = (length) => {
//   let num = "0.";
//   for (let i = 0; i < length - 1; i++) {
//     num += "0";
//   }
//   num += "1";
//   return num;
// };

const DepthBook = (_) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();
  // const [range, setRange] = useState("");
  // const [rangeOptions, setRangeOptions] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState(null);
  const { width } = useViewport();
  const breakpoint = 428;

  // const changeRange = (range) => {
  //   setRange(range);
  //   storeCtx.changeRange(range);
  // };

  useEffect(() => {
    if (
      (!selectedTicker && storeCtx.selectedTicker) ||
      (selectedTicker &&
        selectedTicker?.instId !== storeCtx.selectedTicker?.instId)
    ) {
      setSelectedTicker(storeCtx.selectedTicker);
      // setRange(storeCtx.selectedTicker?.tickSz);
      // storeCtx.changeRange(storeCtx.selectedTicker?.tickSz);
      // const options = [];
      // let fixed =
      //   storeCtx.selectedTicker?.tickSz?.split(".").length > 1
      //     ? storeCtx.selectedTicker?.tickSz?.split(".")[1].length
      //     : 0;

      // for (let i = fixed; i > 0; i--) {
      //   options.push(getDecimal(i));
      // }
      // options.push(1);
      // if (fixed < 2) {
      //   options.push(10);
      // }
      // setRangeOptions(options);
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
          {(storeCtx.books?.bids?.length > 0 ||
            storeCtx.books?.asks?.length > 0) &&
            storeCtx.books[
              `${
                storeCtx.books.bids.length >= storeCtx.books.asks.length
                  ? "bids"
                  : "asks"
              }`
            ].map((_, index) => {
              let bid = storeCtx.books.bids[index];
              let ask = storeCtx.books.asks[index];
              return (
                <BookTile
                  key={`depthbbook-${storeCtx.books.bids[index]?.price}?${storeCtx.books.bids[index]?.price}:${storeCtx.books.asks[index]?.price}`}
                  bidUpdate={bid?.update}
                  bidPrice={bid?.price}
                  bidAmount={bid?.amount}
                  bidDepth={bid?.depth}
                  askUpdate={ask?.update}
                  askPrice={ask?.price}
                  askAmount={ask?.amount}
                  askDepth={ask?.depth}
                  isMobile={width <= breakpoint}
                  tickSz={storeCtx.tickSz}
                  lotSz={storeCtx.lotSz}
                  handleAskOrderSelect={() => {
                    if (ask?.price && ask?.amount) {
                      storeCtx.depthBookHandler(ask.price, ask.amount);
                      if (width <= breakpoint)
                        storeCtx.activePageHandler("trade");
                    }
                  }}
                  handlebidOrderSelect={() => {
                    if (bid?.price && bid?.amount) {
                      storeCtx.depthBookHandler(bid.price, bid.amount);
                      if (width <= breakpoint)
                        storeCtx.activePageHandler("trade");
                    }
                  }}
                />
              );
            })}
          {/* <List
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
                key={`depthbbook-${index}`}
                isMobile={width <= breakpoint}
              />
            )}
          </List> */}
        </ul>
      </div>
    </section>
  );
};

export default DepthBook;
