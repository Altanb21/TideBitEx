import React from "react";
import { BsBackspace } from "react-icons/bs";

const CustomKeyboard = (props) => {
  const handleClick = (e, data) => {
    e.preventDefault();
    // console.log(`CustomKeyboard props.inputEl`, props.inputEl);
    let v,
      value = props.inputEl.value;
    // console.log(`CustomKeyboard value`, value);
    if (data === "bksp") {
      v = value.substring(0, value.length - 1);
    } else if (data === ".") {
      if (!value.includes(".")) {
        if (value.length === 0) v = "0" + data.toString();
        else v = value + data.toString();
      } else v = value;
    } else {
      v = value + data.toString();
    }
    if (v.toString().startsWith("0") && !v.includes(".")) {
      v = v.substring(1);
    }
    // console.log(`CustomKeyboard v`, v);
    props.onInput(v);
  };
  return (
    <div className="custom-keyboard">
      {/* <div
        className="custom-keyboard__close"
        onClick={() => {
          storeCtx.setFocusEl(null);
        }}
      >
        <IoIosCloseCircleOutline size={20}/>
      </div> */}
      {/* <div className="custom-keyboard__container"> */}
      <div className="custom-keyboard__row">
        <div
          className="custom-keyboard__btn"
          data={1}
          onClick={(e) => handleClick(e, 1)}
        >
          <span>1</span>
        </div>
        <div
          className="custom-keyboard__btn"
          data={2}
          onClick={(e) => handleClick(e, 2)}
        >
          <span>2</span>
        </div>
        <div
          className="custom-keyboard__btn"
          data={3}
          onClick={(e) => handleClick(e, 3)}
        >
          <span>3</span>
        </div>
      </div>
      <div className="custom-keyboard__row">
        <div
          className="custom-keyboard__btn"
          data={4}
          onClick={(e) => handleClick(e, 4)}
        >
          <span>4</span>
        </div>
        <div
          className="custom-keyboard__btn"
          data={5}
          onClick={(e) => handleClick(e, 5)}
        >
          <span>5</span>
        </div>
        <div
          className="custom-keyboard__btn"
          data={6}
          onClick={(e) => handleClick(e, 6)}
        >
          <span>6</span>
        </div>
      </div>
      <div className="custom-keyboard__row">
        <div
          className="custom-keyboard__btn"
          data={7}
          onClick={(e) => handleClick(e, 7)}
        >
          <span>7</span>
        </div>
        <div
          className="custom-keyboard__btn"
          data={8}
          onClick={(e) => handleClick(e, 8)}
        >
          <span>8</span>
        </div>
        <div
          className="custom-keyboard__btn"
          data={9}
          onClick={(e) => handleClick(e, 9)}
        >
          <span>9</span>
        </div>
      </div>
      <div className="custom-keyboard__row">
        <div
          className="custom-keyboard__btn custom-keyboard__btn--corner"
          data="."
          onClick={(e) => handleClick(e, ".")}
        >
          <span>.</span>
        </div>
        <div
          className="custom-keyboard__btn"
          data={0}
          onClick={(e) => handleClick(e, 0)}
        >
          <span>0</span>
        </div>
        <div
          className="custom-keyboard__btn custom-keyboard__btn--corner"
          data="bksp"
          onClick={(e) => handleClick(e, "bksp")}
        >
          <span>
            <BsBackspace />
          </span>
        </div>
      </div>
    </div>
    // </div>
  );
};
export default CustomKeyboard;
