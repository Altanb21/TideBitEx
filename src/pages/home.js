import React, { useContext } from "react";
import StoreContext from "../store/store-context";

const Home = () => {
  const storeCtx = useContext(StoreContext);
  return <div className="home"></div>;
};

export default Home;
