import React, { useState, useContext } from "react";
import Header from "./Header";
import SideBar from "./SideBar";
import BottomNavigator from "./BottomNavigator";
import StoreContext from "../store/store-context";

const Layout = ({ children }) => {
  const storeCtx = useContext(StoreContext);
  const [active, setActive] = useState(false);

  return (
    <div
      id="layout"
      className="layout layout--pushable scrollbar-custom"
      onClick={(e) => {
        let elementClass = e.target.getAttribute("class");
        if (
          !elementClass ||
          (elementClass && !elementClass?.includes(`custom-keyboard`))
        )
          storeCtx.setFocusEl(e.target);
      }}
    >
      {active && <SideBar />}
      <div className={`layout--pusher${active ? " active" : ""}`}>
        <Header sidebarHandler={() => setActive((prev) => !prev)} />
        {children}
        <BottomNavigator />
        <div className="layout--cover" onClick={() => setActive(false)}></div>
      </div>
    </div>
  );
};

export default Layout;
