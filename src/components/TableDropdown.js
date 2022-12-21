import React, { useState } from "react";

const TableDropdown = (props) => {
  const [openDropDown, setOpenDropDown] = useState(false);
  const onSelect = (option) => {
    props.selectHandler(option);
    setOpenDropDown(false);
  };
  return (
    <div
      className={`admin-dropdown admin-dropdown--float ${
        props.className ? props.className : ""
      }`}
    >
      <input
        className="admin-dropdown__controller"
        type="checkbox"
        id="admin-dropdown-btn"
        checked={openDropDown}
        readOnly
      />
      <label
        className="admin-dropdown__label"
        htmlFor="admin-dropdown-btn"
        onClick={() => setOpenDropDown((prev) => !prev)}
      >
        <div className="admin-dropdown__text">{props.selected || "-"}</div>
        {props.options?.length > 0 && <div className="admin-dropdown__icon"></div>}
      </label>
      <ul className="admin-dropdown__options">
        {props.options?.map((option) => (
          <div
            className={`admin-dropdown__option${
              props.activePage === "ticker-setting" ? " active" : ""
            }`}
            onClick={() => onSelect(option)}
            key={`admin-dropdown-${option}`}
          >
            {option}
          </div>
        ))}
      </ul>
    </div>
  );
};

export default TableDropdown;
