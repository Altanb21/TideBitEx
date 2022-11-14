import React, { useContext, useEffect } from "react";
import { useViewport } from "../store/ViewportProvider";
import StoreContext from "../store/store-context";
let interval,
  activeIndex = null;
const Slideshow = () => {
  const storeCtx = useContext(StoreContext);
  // const [activeIndex, setActiveIndex] = useState(null);
  const { width } = useViewport();
  const breakpoint = 992;

  useEffect(() => {
    if (!activeIndex && width <= breakpoint) {
      interval = setInterval(() => {
        if (!activeIndex || activeIndex === 4) activeIndex = 1;
        else activeIndex = activeIndex + 1;
      }, 1000);
    } else {
      clearInterval(interval);
      activeIndex = null;
    }
  }, [width]);

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
