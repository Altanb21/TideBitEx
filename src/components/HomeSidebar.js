import React, { useContext } from "react";
import StoreContext from "../store/store-context";

const HomeSidebar = () => {
  const storeCtx = useContext(StoreContext);
  return <div className="home-sidebar"></div>;
};

export default HomeSidebar;
