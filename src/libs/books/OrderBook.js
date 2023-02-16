// import SafeMath from "../../utils/SafeMath";
import { ORDER_STATE, STATE } from "../../constant/OrderState";
import BookBase from "../BookBase";

class OrderBook extends BookBase {
  constructor() {
    super();
    this.name = `OrderBook`;
    this._config = { remove: false, add: true, update: true };
    return this;
  }

  _trim(data) {
    const pendingOrders = [];
    const closedOrders = [];
    data
      .sort((a, b) => +b.at - +a.at)
      .forEach((d) => {
        if (pendingOrders.length >= 1000 && closedOrders.length >= 1000) return;
        if (d.state === STATE.WAIT && pendingOrders.length < 1000)
          pendingOrders.push(d);
        if (
          (d.state === STATE.CANCELED || d.state === STATE.DONE) &&
          closedOrders.length < 1000
        )
          closedOrders.push(d);
      });
    return pendingOrders.concat(closedOrders);
  }

  getSnapshot(market) {
    const pendingOrders = [];
    const closedOrders = [];
    this._snapshot[market]?.forEach((order) => {
      if (order.state === "wait") pendingOrders.push(order);
      if (order.state === "canceled" || order.state === "done")
        closedOrders.push(order);
    });
    return {
      // market,
      pendingOrders,
      closedOrders,
    };
  }
}

export default OrderBook;
