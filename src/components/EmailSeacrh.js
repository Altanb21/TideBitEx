import React, { useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";

const EmailSeacrh = (props) => {
  const { t } = useTranslation();
  const inputRef = useRef();
  const [enableSearchButton, setEnableSearchButton] = useState("");

  const validateEmail = useCallback((email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  }, []);

  const inputHandler = useCallback(() => {
    setEnableSearchButton(
      validateEmail(inputRef.current.value) ? " enabled" : ""
    );
  }, [inputRef, validateEmail]);

  const searchMemberHandler= useCallback(() => {
    props.searchMemberHandler(inputRef.current.value)
  }, [props]);

  return (
    <div className="screen__search-bar">
      <div className="screen__search-box">
        <input
          ref={inputRef}
          type="email"
          inputMode="search"
          className="screen__search-input"
          placeholder={t("search_member_email")} //輸入欲搜尋的關鍵字
          onInput={inputHandler}
        />
        <div
          className={`screen__search-icon${enableSearchButton}`}
          onClick={searchMemberHandler}
        >
          <div className="screen__search-icon--circle"></div>
          <div className="screen__search-icon--rectangle"></div>
        </div>
      </div>
    </div>
  );
};

export default EmailSeacrh;
