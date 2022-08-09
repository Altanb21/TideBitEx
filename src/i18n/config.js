import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const resources = {
  // en: {
  //   translations: require("./locales/en/translations.json"),
  // },
  // en_us: {
  //   translations: require("./locales/en/translations.json"),
  // },
  "en-US": {
    translations: require("./locales/en/translations.json"),
  },
  // jp: {
  //   translations: require("./locales/jp/translations.json"),
  // },
  // zh_cn: {
  //   translations: require("./locales/zh_CN/translations.json"),
  // },
  "zh-CN": {
    translations: require("./locales/zh_CN/translations.json"),
  },
  "zh-HK": {
    translations: require("./locales/zh_HK/translations.json"),
  },
  // zh_hk: {
  //   translations: require("./locales/zh_HK/translations.json"),
  // },
  "zh-TW": {
    translations: require("./locales/zh_TW/translations.json"),
  },
};

const DETECTION_OPTIONS = {
  order: [
    "querystring",
    "cookie",
    // "sessionStorage",
    // "navigator",
    "htmlTag",
    // "path",
    // "subdomain",
  ],
  lookupQuerystring: "lang",
  lookupCookie: "lang",
  htmlTag: document.documentElement,
  // lookupSessionStorage: "lang",
  caches: ["cookie"],
};

i18n
  .use(initReactI18next)
  .use(LanguageDetector)
  .init({
    detection: DETECTION_OPTIONS,
    resources,
    // fallbackLng: "en-US",
    fallbackLng: (code) => {
      // console.log(`code`, code)
      const lang = (
        code ||
        document.cookie
          .split(";")
          .filter((v) => /lang/.test(v))
          .pop()
          ?.split("=")[1] ||
        navigator.language
      ).toLowerCase();
      //   console.log(` document.cookie
      //   .split(";")
      //   .filter((v) => /lang/.test(v))
      //   .pop()
      //   ?.split("=")[1]`,  document.cookie
      //   .split(";")
      //   .filter((v) => /lang/.test(v))
      //   .pop()
      //   ?.split("=")[1])
      // console.log(`navigator.language`, navigator.language);
      let fallbacks;
      switch (lang) {
        case "en":
        case "en-us":
        case "en_us":
          fallbacks = ["en-US"];
          break;
        case "zh-hk":
        case "zh_hk":
        case "zh_tw":
        case "zh-tw":
          fallbacks = ["zh-HK"];
          break;
        case "zh_cn":
        case "zh-cn":
          fallbacks = ["zh-CN"];
          break;
        // case "jp":
        //   changeLanguage("jp");
        //   break;
        default:
          fallbacks = ["en-US"];
          break;
      }
      return fallbacks;
    },
    ns: ["translations"],
    defaultNS: "translations",
    supportedLngs: ["en-US", "zh-CN", "zh-HK", "zh-TW"],
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
  });

export default i18n;
