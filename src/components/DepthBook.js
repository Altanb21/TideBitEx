import React, { useContext, useEffect, useState } from "react";
import StoreContext from "../store/store-context";
import SafeMath from "../utils/SafeMath";
import { formateDecimal } from "../utils/Utils";
import { useTranslation } from "react-i18next";
import DropDown from "./DropDown";

const BookTile = (props) => {
  const storeCtx = useContext(StoreContext);
  return (
    <li
      className={`order-book__tile flex-row ${
        props.book.update ? "" : "" /** TODO animation temporary removed */
        // props.book.update ? "update" : ""
      }`}
      data-width={props.dataWidth}
      onClick={props.onClick}
    >
      {props.type === "asks" ? (
        <>
          <div>
            {formateDecimal(props.book.price, {
              // decimalLength: 2,
              decimalLength: storeCtx.tickSz || 0,
              pad: true,
            })}
          </div>
          <div>
            {formateDecimal(props.book.amount, {
              // decimalLength: 4,
              decimalLength: storeCtx.lotSz || 0,
              pad: true,
            })}
          </div>
          <div>
            {formateDecimal(
              SafeMath.mult(props.book.price, props.book.amount),
              {
                // decimalLength: 4,
                decimalLength: amountSz,
                pad: true,
              }
            )}
          </div>
          <div
            className="order-book__tile--cover"
            style={{ width: props.dataWidth }}
          ></div>
        </>
      ) : (
        <>
          <div>
            {formateDecimal(
              SafeMath.mult(props.book.price, props.book.amount),
              {
                decimalLength: Math.min(
                  storeCtx.tickSz || 0,
                  storeCtx.lotSz || 0
                ),
                pad: true,
              }
            )}
          </div>
          <div>
            {formateDecimal(props.book.amount, {
              // decimalLength: 4,
              decimalLength: storeCtx.lotSz || 0,
              pad: true,
            })}
          </div>
          <div>
            {formateDecimal(props.book.price, {
              // decimalLength: 2,
              decimalLength: storeCtx.tickSz || 0,
              pad: true,
            })}
          </div>
          <div
            className="order-book__tile--cover"
            style={{ width: props.dataWidth }}
          ></div>
        </>
      )}
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
      <div className="order-book__tool-bar">
        <DropDown
          className="order-book__range-options"
          options={rangeOptions}
          selected={range}
          onSelect={changeRange}
          // placeholder={range}
        >
          {(range) => <div>{range}</div>}
        </DropDown>
      </div>
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
        <ul className="order-book__panel order-book__panel--bids">
          {storeCtx?.selectedTicker &&
            storeCtx.books?.bids &&
            storeCtx.books.bids
              .filter((book) => book.amount > storeCtx.selectedTicker?.lotSz)
              .map((book) => (
                <BookTile
                  onClick={() => {
                    storeCtx.depthBookHandler(book.price, book.amount);
                  }}
                  type="bids"
                  book={book}
                  key={`bids-${storeCtx.selectedTicker.instId}-${book.price}`}
                  dataWidth={`${parseFloat(
                    SafeMath.mult(
                      SafeMath.div(book.total, storeCtx.books.total),
                      "100"
                    )
                  ).toFixed(2)}%`}
                />
              ))}
        </ul>
        <ul className="order-book__panel order-book__panel--asks">
          {storeCtx?.selectedTicker &&
            storeCtx.books?.asks &&
            storeCtx.books.asks
              .filter((book) => book.amount > storeCtx.selectedTicker?.lotSz)
              .map((book) => (
                <BookTile
                  type="asks"
                  onClick={() => {
                    storeCtx.depthBookHandler(book.price, book.amount);
                  }}
                  book={book}
                  key={`asks-${storeCtx.selectedTicker.instId}-${book.price}`}
                  dataWidth={`${parseFloat(
                    SafeMath.mult(
                      SafeMath.div(book.total, storeCtx.books.total),
                      "100"
                    )
                  ).toFixed(2)}%`}
                />
              ))}
        </ul>
      </div>
    </section>
  );
};

export default DepthBook;
