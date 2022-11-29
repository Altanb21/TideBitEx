import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";

const ScreenDisplayOption = (props) => {
  const { t } = useTranslation();
  const active = props.selectedOption === props.option ? " active" : "";
  const clickHandler = useCallback(() => {
    props.selectHandler(props.option);
  }, [props]);
  return (
    <li className={`screen__display-option${active}`} onClick={clickHandler}>
      {t(props.option)}
    </li>
  );
};

export default ScreenDisplayOption;
