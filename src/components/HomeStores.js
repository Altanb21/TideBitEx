import React, { useContext } from "react";
import StoreContext from "../store/store-context";

const HomeStores = () => {
  const storeCtx = useContext(StoreContext);
  return <div className="home-stores"></div>;
};

export default HomeStores;
