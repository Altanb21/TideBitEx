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
  return (
    <div className="screen__display">
      <div className="screen__display-title">{`${props.title}:`}</div>
      <ul className="screen__display-options">{component}</ul>
    </div>
  );
};

export default ScreenDisplayOptions;
