import React, { useContext, useEffect, useState } from "react";
import { useViewport } from "../store/ViewportProvider";
import StoreContext from "../store/store-context";
let interval;
const Slideshow = () => {
  const storeCtx = useContext(StoreContext);
  // const [languageKey, setLanguageKey] = useState(null);
  const [activeIndex, setActiveIndex] = useState(null);
  const { width } = useViewport();
  const breakpoint = 992;

  useEffect(() => {
    if (!activeIndex && width <= breakpoint) {
      clearInterval(interval);
      interval = setInterval(() => {
        setActiveIndex((prev) => {
          let index;
          if (!prev || prev === 4) index = 1;
          else index = prev + 1;
          return index;
        });
      }, 500);
    } else {
      clearInterval(interval);
      setActiveIndex(null)
    }
  }, [activeIndex, width]);

  // useEffect(() => {
  //   if (!languageKey || languageKey !== storeCtx.languageKey) {
  //     document.documentElement.style.setProperty(
  //       `--advertisement-1`,
  //       `../../images/advertisement_${storeCtx.languageKey}-1.png`
  //     );
  //     document.documentElement.style.setProperty(
  //       `--advertisement-2`,
  //       `../../images/advertisement_${storeCtx.languageKey}-2.png`
  //     );
  //     document.documentElement.style.setProperty(
  //       `--advertisement-3`,
  //       `../../images/advertisement_${storeCtx.languageKey}-3.png`
  //     );
  //     document.documentElement.style.setProperty(
  //       `--advertisement-4`,
  //       `../../images/advertisement_${storeCtx.languageKey}-4.png`
  //     );
  //     setLanguageKey(storeCtx.languageKey);
  //   }
  // }, [languageKey, storeCtx.languageKey]);
  return (
    <div className="slideshow">
      <div className="slideshow__container">
        <a
          className={`slideshow__link${activeIndex === 1 ? " active" : ""}`}
          href="/markets/galahkd"
        >
          <img
            className="slideshow__image"
            src={`/advertisement_${storeCtx.languageKey}-1.png`}
            alt="advertisement_1"
          />
        </a>
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
          href={`${
            storeCtx.isLogin ? "/circle/transfer_instructions/new" : "/signin"
          }`}
        >
          <img
            className="slideshow__image"
            src={`/advertisement_${storeCtx.languageKey}-3.png`}
            alt="advertisement_3"
          />
        </a>
        <a
          className={`slideshow__link${activeIndex === 4 ? " active" : ""}`}
          href={`${storeCtx.isLogin ? "/accounts" : "/signin"}`}
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
