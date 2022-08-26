import React, { useState } from "react";
import Sidebar from "../components/AdminSidebar";
import CurrencySetting from "./currency-setting";
import Deposit from "./deposit";
import InfoSetting from "./info-setting";
import PlatformAssets from "./platform-assets";
import UserAssets from "./user-assets";
import SubAccounts from "./sub-accounts";
import TickerSetting from "./ticker-setting";
import Vouchers from "./vouchers";
import CurrentOrders from "./current-orders";

const Manager = () => {
    const [activePage, setActivePage] = useState("ticker-setting");
    const onSelected = (page) => {
        setActivePage(page);
      };
  return <div className="screen manager">
    <Sidebar activePage={activePage} onSelected={onSelected} />
      {activePage === "ticker-setting" && <TickerSetting />}
      {activePage === "currency-setting" && <CurrencySetting />}
      {activePage === "deposit" && <Deposit />}
      {activePage === "sub-account" && <SubAccounts />}
      {activePage === "platform-assets" && <PlatformAssets />}
      {activePage === "user-assets" && <UserAssets />}
      {activePage === "info-setting" && <InfoSetting />}
      {activePage === "match-orders" && <Vouchers />}
      {activePage === "current-orders" && <CurrentOrders />}

  </div>;
};

export default Manager;
