// import prod from "./json/prod.config.json";
// import staging from "./json/staging.config.json";
// import dev from "./json/dev.config.json";

// let config = {};
// const WS_PROTOCOL = window.location.protocol === "https:" ? "wss://" : "ws://";

// switch (window.location.hostname) {
//   case "new.tidebit.com":
//     config = { ...prod, WS_PROTOCOL };
//     break;
//   case "staging3.tidebit.network":
//     config = { ...staging, WS_PROTOCOL };
//     break;
//   case "test.tidebit.network":
//     config = { ...dev, WS_PROTOCOL };
//     break;
//   default:
//     config = { ...dev, WS_PROTOCOL };
// }

// export default config;

export const baseUrl = 'test.tidebit.network';
