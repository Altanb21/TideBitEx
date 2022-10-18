/**
 * [deprecated] 2022/10/14
 */

// import React, { useState } from "react";
// import CurrenciesView from "../components/CurrenciesView";

// const Analysis = (props) => {
//   const [activePage, setActivePage] = useState("assets-view");

//   return (
//     <div className="analysis">
//       <div className="analysis__header">
//         <div className="analysis__header--leading">TideBit Exhcange</div>
//         <ul className="analysis__header--list">
//           <li
//             className={`analysis__header--item${
//               activePage === "tickers-setting" ? " active" : ""
//             }`}
//             onClick={() => setActivePage("tickers-setting")}
//           >
//             交易對設定
//           </li>
//           <li
//             className={`analysis__header--item${
//               activePage === "currencies-setting" ? " active" : ""
//             }`}
//             onClick={() => setActivePage("currencies-setting")}
//           >
//             支援幣種設定
//           </li>
//           <li
//             className={`analysis__header--item${
//               activePage === "exchange-deposit" ? " active" : ""
//             }`}
//             onClick={() => setActivePage("external-exchange-deposit")}
//           >
//             外部交易所入金
//           </li>
//           <li
//             className={`analysis__header--item${
//               activePage === "sub-account-view" ? " active" : ""
//             }`}
//             onClick={() => setActivePage("sub-account-view")}
//           >
//             子帳號管理（顯示）
//           </li>
//           <li
//             className={`analysis__header--item${
//               activePage === "sub-account-setting" ? " active" : ""
//             }`}
//             onClick={() => setActivePage("sub-account-setting")}
//           >
//             子帳號管理（設定）
//           </li>
//           <li
//             className={`analysis__header--item${
//               activePage === "assets-view" ? " active" : ""
//             }`}
//             onClick={() => setActivePage("assets-view")}
//           >
//             資產總覽（顯示）
//           </li>
//           <li
//             className={`analysis__header--item${
//               activePage === "assets-setting" ? " active" : ""
//             }`}
//             onClick={() => setActivePage("assets-setting")}
//           >
//             資產總覽（設定）
//           </li>
//         </ul>
//       </div>
//       {activePage === "tickers-setting" && (
//         <div className="tickers-setting">tickers-setting</div>
//       )}
//       {activePage === "currencies-setting" && (
//         <div className="currencies-setting">currencies-setting</div>
//       )}
//       {activePage === "external-exchange-deposit" && (
//         <div className="external-exchange-deposit">
//           external-exchange-deposit
//         </div>
//       )}
//       {activePage === "sub-account-view" && (
//         <div className="sub-account-view">sub-account-view</div>
//       )}
//       {activePage === "sub-account-setting" && (
//         <div className="sub-account-setting">sub-account-setting</div>
//       )}
//       {activePage === "assets-view" && <CurrenciesView />}
//       {activePage === "assets-setting" && (
//         <div className="assets-setting">assets-setting</div>
//       )}
//     </div>
//   );
// };

// export default Analysis;
