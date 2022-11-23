import React, { useContext, useEffect, useState } from "react";
import { useViewport } from "../store/ViewportProvider";
import StoreContext from "../store/store-context";
let interval,
  activeIndex = null;
const Slideshow = () => {
  const storeCtx = useContext(StoreContext);
  const [href3, setHref3] = useState(
    `${storeCtx.isLogin ? "/circle/transfer_instructions/new" : "/signin"}`
  );
  const [href4, setHref4] = useState(
    `${storeCtx.isLogin ? "/accounts" : "/signin"}`
  );
  const { width } = useViewport();
  const breakpoint = 992;

  useEffect(() => {
    setHref3((prev) => {
      let href3 = storeCtx.isLogin
        ? "/circle/transfer_instructions/new"
        : "/signin";
      if (prev !== href3) return href3;
      else return prev;
    });
    setHref4((prev) => {
      let href4 = storeCtx.isLogin ? "/accounts" : "/signin";
      if (prev !== href4) return href4;
      else return prev;
    });
  }, [storeCtx.isLogin]);

  useEffect(() => {
    if (!activeIndex && width <= breakpoint) {
      interval = setInterval(() => {
        if (!activeIndex || activeIndex === 4) activeIndex = 1;
        else activeIndex = activeIndex + 1;
      }, 1500);
    } else {
      clearInterval(interval);
      activeIndex = null;
    }
  }, [width]);

  return (
    <div className="slideshow">
      <div className="slideshow__container">
        <div
          className={`slideshow__link${activeIndex === 1 ? " active" : ""}`}
          // href="/markets/galahkd"
        >
          <img
            className="slideshow__image"
            src={`/advertisement_${storeCtx.languageKey}-1.png`}
            alt="advertisement_1"
          />
        </div>
        <a
          className={`slideshow__link${activeIndex === 2 ? " active" : ""}`}
          href="/tbt"
        >
          <img
            className="slideshow__image"
            src={`/advertisement_${storeCtx.languageKey}-2.png`}
            alt="advertisement_2"
          />
        </a>
        <a
          className={`slideshow__link${activeIndex === 3 ? " active" : ""}`}
          href={`${href3}`}
        >
          <img
            className="slideshow__image"
            src={`/advertisement_${storeCtx.languageKey}-3.png`}
            alt="advertisement_3"
          />
        </a>
        <a
          className={`slideshow__link${activeIndex === 4 ? " active" : ""}`}
          href={`${href4}`}
        >
          <img
            className="slideshow__image"
            src={`/advertisement_${storeCtx.languageKey}-4.png`}
            alt="advertisement_4"
          />
        </a>
      </div>
    </div>
  );
};

export default Slideshow;
