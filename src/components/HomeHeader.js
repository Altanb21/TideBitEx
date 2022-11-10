import React, { useContext } from "react";
import StoreContext from "../store/store-context";

const HomeHeader = () => {
  const storeCtx = useContext(StoreContext);
  return (
    <div className="home-header">
      <a className="home-header__brand" href="/">
        <img
          src="/TideBit_White_hk.png"
          className="d-inline-block align-top"
          alt="TideBit"
          width="175px"
          height="60px"
        />
      </a>
      <div className="home-header__collapse">
        <div className="home-header__dropdown">
          <input
            className="home-header__dropdown--input"
            type="radio"
            name="home-header-dropdown"
          />
          <label className="home-header__dropdown--label"></label>
          <div className="home-header__dropdown--options"></div>
        </div>
      </div>
    </div>
  );
};

export default HomeHeader;
