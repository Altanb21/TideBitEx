import React, { useContext } from "react";
import StoreContext from "../store/store-context";

const HomeInfo = () => {
  const storeCtx = useContext(StoreContext);
  return <div className="home-info"></div>;
};

export default HomeInfo;
