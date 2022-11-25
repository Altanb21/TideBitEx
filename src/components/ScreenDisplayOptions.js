import React from "react";
import ScreenDisplayOption from "./ScreenDisplayOption";

const ScreenDisplayOptions = (props) => {
  const component =
    props.options?.length > 0 ? (
      props.options.map((option) => (
        <ScreenDisplayOption
          option={option}
          selectedOption={props.selectedOption}
          selectHandler={props.selectHandler}
        />
      ))
    ) : (
      <></>
    );
  return <ul className="screen__display-options">{component}</ul>;
};

export default ScreenDisplayOptions;
