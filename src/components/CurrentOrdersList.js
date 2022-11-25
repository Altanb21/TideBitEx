import React from "react";
import CurrentOrdersTile from "../pages/CurrentOrdersTile";

const CurrentOrdersList = (props) => {
  const { orders, forceCancelOrder } = props;
  const component =
    orders && orders.length > 0 ? (
      orders.map((order, index) => (
        <CurrentOrdersTile
          order={order}
          index={index}
          forceCancelOrder={forceCancelOrder}
        />
      ))
    ) : (
      <></>
    );
  return component;
};

export default CurrentOrdersList;
