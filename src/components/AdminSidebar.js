import React, { useState } from "react";

const DropDownMenu = (props) => {
  const [openDropDown, setOpenDropDown] = useState(false);
  const selectPageHandler = (page) => {
    props.selectPageHandler(page);
    if (props.options.some((option) => option.page === page)) {
      setOpenDropDown(true);
    } else {
      setOpenDropDown(false);
    }
  };

  return (
      <div className="btn btn--dropdown admin-dropdown">
        <input
          className="admin-dropdown__controller"
          type="checkbox"
          id="dropdown-btn"
          checked={
            openDropDown ||
            props.options.some((option) => option.page === props.activePage)
          }
          readOnly
        />
        <label
          className="admin-dropdown__label admin-sidebar__btn"
          htmlFor="admin-dropdown-btn"
          onClick={() => setOpenDropDown((prev) => !prev)}
        >
          <div className="admin-sidebar__text admin-dropdown__text">
            {props.label}
          </div>
          <div className="admin-dropdown__icon"></div>
        </label>
        <ul className="admin-dropdown__options">
          {props.options.map((option) => (
            <div key={option.page}>
              <div
                className={`admin-sidebar__text admin-dropdown__option${
                  props.activePage === option.page ? " active" : ""
                }`}
                onClick={() => selectPageHandler(option.page)}
              >
                {option.text}
              </div>
            </div>
          ))}
        </ul>
      </div>
  );
};

const Sidebar = (props) => {
  return (
    <section className="admin-sidebar">
      <DropDownMenu
        label="交易管理"
        selectPageHandler={(page) => props.onSelected(page)}
        activePage={props.activePage}
        options={[
          {
            page: "ticker-setting",
            text: "交易對設定",
          },
          {
            page: "currency-setting",
            text: "支援幣種設定",
          },
        ]}
      />
      <div
        className={`btn admin-sidebar__btn${
          props.activePage === "deposit" ? " active" : ""
        }`}
        onClick={() => props.onSelected("deposit")}
      >
        <div className="admin-sidebar__text">入金管理</div>
      </div>
      <div
        className={`btn admin-sidebar__btn${
          props.activePage === "sub-account" ? " active" : ""
        }`}
        onClick={() => props.onSelected("sub-account")}
      >
        <div className="admin-sidebar__text">子帳號管理</div>
      </div>
      <DropDownMenu
        label="資產總覽"
        selectPageHandler={(page) => props.onSelected(page)}
        activePage={props.activePage}
        options={[
          {
            page: "platform-assets",
            text: "平台資產總覽",
          },
          {
            page: "user-assets",
            text: "用戶資產總覽",
          },
        ]}
      />
      <DropDownMenu
        label="管理人員"
        selectPageHandler={(page) => props.onSelected(page)}
        activePage={props.activePage}
        options={[
          {
            page: "user-setting",
            text: "管理人員設定",
          },
          {
            page: "info-setting",
            text: "通知設定",
          },
        ]}
      />
      <DropDownMenu
        label="營收管理"
        selectPageHandler={(page) => props.onSelected(page)}
        activePage={props.activePage}
        options={[
          {
            page: "match-orders",
            text: "撮合成交記錄查詢",
          },
          {
            page: "current-orders",
            text: "當前掛單記錄查詢",
          },
        ]}
      />
    </section>
  );
};

export default Sidebar;
