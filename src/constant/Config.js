import prod from "../../prod.config.json";
import staging from "../../staging.config.json";
import dev from "../../dev.config.json";

let config = {};
const WS_PROTOCOL = window.location.protocol === "https:" ? "wss://" : "ws://";

switch (window.location.hostname) {
  case "new.tidebit.com":
    config = { ...prod, WS_PROTOCOL };
    break;
  case "staging3.tidebit.network":
    config = { ...staging, WS_PROTOCOL };
    break;
  case "test.tidebit.network":
    config = { ...dev, WS_PROTOCOL };
    break;
  default:
    config = { ...dev, WS_PROTOCOL };
}

export default config;
