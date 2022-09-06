import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { useContext } from "react";
import AdminHeader from "../components/AdminHeader";
import StoreContext from "../store/store-context";

import Manager from "./manager";
import LoadingDialog from "../components/LoadingDialog";

const Admin = () => {
  const storeCtx = useContext(StoreContext);
  const [isInit, setIsInit] = useState(false);
  const [user, setUser] = useState(null);
  const history = useHistory();
  const [activePage, setActivePage] = useState("manager");
  const onSelected = (page) => {
    setActivePage(page);
  };

  const userAbility = (user) => {
    let _user = { ...user };
    if (user.roles?.includes("root")) {
      _user.ability = {
        canNotManage: [],
        canNotRead: [],
      };
    } else if (user.roles?.includes("deposit maker")) {
      _user.ability = {
        canNotManage: ["Deposit"],
        canNotRead: !user.roles?.includes("withdraw checker")
          ? [
              "BankTransaction",
              "BankTransactionRequest",
              "Verify Account",
              "Withdraw",
            ]
          : [`BankTransaction`, `BankTransactionRequest`, "Verify Account"],
      };
    } else if (user.roles?.includes("deposit checker")) {
      _user.ability = {
        canNotManage: [],
        canNotRead: !user.roles?.includes("withdraw checker")
          ? ["Manual Deposit", "Verify Account", "Withdraw"]
          : ["Manual Deposit", "Verify Account"],
      };
    } else if (user.roles?.includes("withdraw checker")) {
      _user.ability = {
        canNotManage: user.roles?.includes("deposit checker")
          ? []
          : ["Deposit"],
        canNotRead:
          user.roles?.includes("deposit checker") ||
          user.roles?.includes("deposit maker") ||
          user.roles?.includes("deposit viewer")
            ? user.roles?.includes("deposit maker")
              ? user.roles?.includes("deposit checker")
                ? ["Verify Account"]
                : [
                    "BankTransaction",
                    "BankTransactionRequest",
                    "Verify Account",
                  ]
              : user.roles?.includes("deposit checker")
              ? ["Verify Account", "Manual Deposit"]
              : [
                  "BankTransaction",
                  "BankTransactionRequest",
                  "Verify Account",
                  "Manual Deposit",
                ]
            : user.roles?.includes("deposit maker")
            ? user.roles?.includes("deposit checker")
              ? ["Verify Account", "Deposit"]
              : [
                  "BankTransaction",
                  "BankTransactionRequest",
                  "Verify Account",
                  "Deposit",
                ]
            : user.roles?.includes("deposit checker")
            ? ["Verify Account", "Manual Deposit", "Deposit"]
            : [
                "BankTransaction",
                "BankTransactionRequest",
                "Verify Account",
                "Manual Deposit",
                "Deposit",
              ],
      };
    } else if (user.roles?.includes("KYC checker")) {
      _user.ability = {
        canNotManage: user.roles?.includes("deposit viewer") ? ["Deposit"] : [],
        canNotRead: user.roles?.includes("deposit viewer")
          ? [
              "BankTransaction",
              "BankTransactionRequest",
              "Manual Deposit",
              "Withdraw",
            ]
          : [
              "BankTransaction",
              "BankTransactionRequest",
              "Manual Deposit",
              "Withdraw",
              "Deposit",
            ],
      };
    } else if (user.roles?.includes("deposit viewer")) {
      _user.ability = {
        canNotManage: ["Deposit"],
        canNotRead: [
          "BankTransaction",
          "BankTransactionRequest",
          "Manual Deposit",
          "Verify Account",
          "Withdraw",
        ],
      };
    } else
      _user.ability = {
        canNotRead: "all",
      };
    return _user;
  };

  useEffect(() => {
    if (!isInit) {
      storeCtx.getUserRoles().then((user) => {
        if (user) {
          let _user = userAbility(user);
          setUser(_user);
          if (_user.ability.canNotRead === "all") {
            history.goBack();
          }
        } else {
          history.goBack();
        }
        setIsInit(true);
      });
    }
  }, [history, isInit, storeCtx]);

  return (
    <>
      {!isInit && <LoadingDialog />}
      <div className="admin">
        <AdminHeader
          activePage={activePage}
          onSelected={onSelected}
          user={user}
        />
        {user && activePage === "manager" && <Manager user={user} />}
      </div>
    </>
  );
};

export default Admin;
