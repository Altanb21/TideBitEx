import React from "react";
import DropDown from "./DropDown";

const AdminHeader = (props) => {
  return (
    <header className="admin-header">
      <a className="admin-header__logo-box" href="/">
        <img
          src="/TideBit_White_hk.png"
          alt="TideBit"
          width="125px"
          height="44px"
        />
      </a>
      <div className="admin-header__button-box">
        <div
          className={`admin-header__button${
            props.activePage === "manager" ? " active" : ""
          }`}
          onClick={() => {
            props.onSelected("manager");
          }}
        >
          管理
        </div>
        <div
          className={`admin-header__button${
            props.activePage === "analysis" ? " active" : ""
          }`}
          onClick={() => {
            props.onSelected("analysis");
          }}
        >
          分析
        </div>
        {/* <DropDown
          options={Object.keys(props.languages)}
          selected={props.languageKey}
          onSelect={props.changeLanguage}
          placeholder="Language"
        >
          {(key) => <div>{props.languages[key]}</div>}
        </DropDown> */}
      </div>
    </header>
  );
};

export default AdminHeader;
