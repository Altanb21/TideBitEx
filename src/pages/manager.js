import React, { useState } from "react";
import CurrencySetting from "./currency-setting";
import Deposit from "./deposit";
import InfoSetting from "./info-setting";
import PlatformAssets from "./platform-assets";
import Members from "./members";
import SubAccounts from "./sub-accounts";
import TickerSetting from "./ticker-setting";
import Vouchers from "./vouchers";
import CurrentOrders from "./current-orders";
import UserSetting from "./user-setting";

const Manager = (props) => {
  return (
    <div className="screen manager">
      {props.activeSection === "ticker-setting" && <TickerSetting />}
      {props.activeSection === "currency-setting" && <CurrencySetting />}
      {props.activeSection === "deposit" && (
        <Deposit
          canDeposit={!props.user?.ability?.canNotManage?.includes("Deposit")}
          canManulDeposit={
            !props.user?.ability?.canNotManage?.includes("Manual Deposit")
          }
        />
      )}
      {props.activeSection === "sub-account" && <SubAccounts />}
      {props.activeSection === "platform-assets" && <PlatformAssets />}
      {props.activeSection === "members" && <Members />}
      {props.activeSection === "user-setting" && (
        <UserSetting currentUser={props.user} />
      )}
      {props.activeSection === "info-setting" && <InfoSetting />}
      {props.activeSection === "match-orders" && <Vouchers />}
      {props.activeSection === "current-orders" && <CurrentOrders />}
    </div>
  );
};

export default Manager;
