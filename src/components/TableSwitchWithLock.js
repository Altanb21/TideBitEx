import React, { useState } from "react";

let timer;
const TableSwitchWithLock = (props) => {
  const [active, setActive] = useState(false);
  const [unLocked, setUnLocked] = useState(false);
  return (
    <td
      className={`switch ${props.className ? props.className : ""}${
        active ? " active" : ""
      }${unLocked ? " unLocked" : ""}`}
      onClick={() => {
        setActive(true);
        timer = setTimeout(() => {
          setUnLocked(false);
          setActive(false);
          clearTimeout(timer);
        }, 3000);
        if (active) {
          clearTimeout(timer);
          setUnLocked(true);
          props.toggleStatus();
          timer = setTimeout(() => {
            setUnLocked(false);
            setActive(false);
            clearTimeout(timer);
          }, 500);
        }
      }}
    >
      <div className="switch__lock"></div>
      <div className="switch__box">
        <input
          className="switch__controller"
          type="checkbox"
          id="switch-btn"
          checked={props.status}
          readOnly
        />
        <div className="switch__btn"></div>
      </div>
    </td>
  );
};

export default TableSwitchWithLock;
