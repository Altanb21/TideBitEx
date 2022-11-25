import React from "react";
import { convertExponentialToDecimal } from "../utils/Utils";

const CurrentOrdersText = (props) => {
  const { display, side, value, expectValue } = props;
  const textStyle = side ? (side === "buy" ? " positive" : " negative") : "";
  const _value = value ? convertExponentialToDecimal(value) : "-";
  const _expectValue = expectValue
    ? convertExponentialToDecimal(expectValue)
    : "-";
  const component = display ? (
    <div className={`"current-orders__text${textStyle}`}>
      {`${_value} / ${_expectValue}`}
    </div>
  ) : (
    <></>
  );
  return component;
};

export default CurrentOrdersText;
