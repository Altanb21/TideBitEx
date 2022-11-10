import React, { useContext } from "react";
import StoreContext from "../store/store-context";

const HomeFooter = () => {
  const storeCtx = useContext(StoreContext);
  return <div className="home-footer"></div>;
};

export default HomeFooter;
