import React, { useContext } from "react";
import StoreContext from "../store/store-context";

const Slideshow = () => {
  const storeCtx = useContext(StoreContext);
  return <div className="slideshow"></div>;
};

export default Slideshow;
