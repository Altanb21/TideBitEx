import React, { useState, useCallback, useEffect, useContext } from "react";
import Header from "./Header";
import SideBar from "./SideBar";
import { useTranslation } from "react-i18next";
import BottomNavigator from "./BottomNavigator";
import StoreContext from "../store/store-context";

const languages = {
  "en-US": "English",
  "zh-HK": "繁體中文",
  // jp: "日本語",
  "zh-CN": "简体中文",
  // "zh-TW": "繁體中文",
};

// const languages = {
//   "en-US": {
//     value: "English",
//     nameAlis: ["en", "en_us", "en-US", "en-us"],
//   },
//   "zh-HK": {
//     value: "繁體中文",
//     nameAlis: ["zh-HK", "zh_hk", "zh-TW", "zh_tw"],
//   },
//   jp: { value: "日本語", nameAlis: ["jp"] },
//   "zh-CN": { value: "简体中文", nameAlis: ["zh-CN", "zh_cn"] },
// };

const Layout = ({ children }) => {
  const storeCtx = useContext(StoreContext);
  const { i18n } = useTranslation();
  const [isInit, setIsInit] = useState(false);
  // const [languageKey, setLanguageKey] = useState("en");
  const [active, setActive] = useState(false);
  const changeLanguage = useCallback(
    (key) => {
      // await window.cookieStore.set("lang", key);
      // document.cookie = `lang=${key}`;
      storeCtx.setLanguageKey(key);
      i18n.changeLanguage(key);
    },
    [i18n, storeCtx]
  );

  useEffect(() => {
    if (!isInit) {
      const lang = (
        document.cookie
          .split(";")
          .filter((v) => /lang/.test(v))
          .pop()
          ?.split("=")[1] || navigator.language
      ).toLowerCase();
      switch (lang.toLowerCase()) {
        case "en":
        case "en-us":
        case "en_us":
          storeCtx.setLanguageKey("en-US");
          break;
        case "zh-hk":
        case "zh_hk":
        case "zh_tw":
        case "zh-tw":
          storeCtx.setLanguageKey("zh-HK");
          break;
        case "zh_cn":
        case "zh-cn":
          storeCtx.setLanguageKey("zh-CN");
          break;
        // case "jp":
        //   storeCtx.setLanguageKey("jp");
        //   break;
        default:
          storeCtx.setLanguageKey("en-US");
          break;
      }
      setIsInit(true);
    }
    // window.cookieStore.get("lang").then((lang) => {
    //   const key = lang.value;
    //   console.log(`lang`, lang, `key`, key);
    //   storeCtx.setLanguageKey(key);
    // });
  }, [isInit, storeCtx]);

  return (
    <div
      id="layout"
      className="layout layout--pushable"
      onClick={(e) => {
        let elementClass = e.target.getAttribute("class");
        if (elementClass && !elementClass?.includes(`custom-keyboard`))
          storeCtx.setFocusEl(e.target);
      }}
    >
      <SideBar
        languages={languages}
        languageKey={storeCtx.languageKey}
        changeLanguage={changeLanguage}
      />
      <div className={`layout--pusher${active ? " active" : ""}`}>
        <Header
          languages={languages}
          languageKey={storeCtx.languageKey}
          changeLanguage={changeLanguage}
          sidebarHandler={() => setActive((prev) => !prev)}
        />
        {children}
        <BottomNavigator />
        <div className="layout--cover" onClick={() => setActive(false)}></div>
      </div>
    </div>
  );
};

export default Layout;
