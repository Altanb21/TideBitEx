import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";

const DownloadOption = (props) => {
  const { t } = useTranslation();
  const clickHandler = useCallback(() => {
    props.downloadHandler(props.option);
  }, [props]);
  return (
    <li className="screen__display-option active" onClick={clickHandler}>
      {t(props.option)}
    </li>
  );
};

const DownloadOptions = (props) => {
  const component =
    props.options?.length > 0 ? (
      props.options.map((option) => (
        <DownloadOption
          option={option}
          downloadHandler={props.downloadHandler}
        />
      ))
    ) : (
      <></>
    );
  return (
    <div className="screen__display">
      <div className="screen__display-title">{`${props.title}:`}</div>
      <ul className="screen__display-options">{component}</ul>
    </div>
  );
};

export default DownloadOptions;
