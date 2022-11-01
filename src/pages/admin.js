import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { useContext } from "react";
import AdminHeader from "../components/AdminHeader";
import Sidebar from "../components/AdminSidebar";
import StoreContext from "../store/store-context";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";

import LoadingDialog from "../components/LoadingDialog";
import Manager from "./manager";
import Dashboard from "./dashboard";

const Admin = () => {
  const storeCtx = useContext(StoreContext);
  const [isInit, setIsInit] = useState(false);
  const [user, setUser] = useState(null);
  const history = useHistory();
  const [activePage, setActivePage] = useState("manager");
  const [openSidebar, setOpenSidebar] = useState(false);
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const onSelected = (page) => {
    setActivePage(page);
  };

  const userAbility = (user) => {
    let _user = {
      ...user,
      ability: {
        canNotManage: [],
        canNotRead: [],
      },
    };
    if (_user.roles?.includes("deposit_maker")) {
      _user.ability.canNotManage = ["Deposit"];
      if (user.roles?.includes("withdraw_checker")) {
        _user.ability.canNotRead = [
          "BankTransaction",
          "BankTransactionRequest",
          "Verify Account",
        ];
      } else {
        _user.ability.canNotRead = [
          "BankTransaction",
          "BankTransactionRequest",
          "Verify Account",
          "Withdraw",
        ];
      }
    } else if (user.roles?.includes("deposit_checker")) {
      if (user.roles?.includes("withdraw_checker")) {
        _user.ability.canNotRead = ["Manual Deposit", "Verify Account"];
      } else {
        _user.ability.canNotRead = [
          "Manual Deposit",
          "Verify Account",
          "Withdraw",
        ];
      }
    } else if (user.roles?.includes("withdraw_checker")) {
      _user.ability.canNotRead = [
        "Deposit",
        "BankTransaction",
        "BankTransactionRequest",
        "Manual Deposit",
        "Verify Account",
      ];
      _user.ability.canNotManage = ["Deposit"];
    } else if (user.roles?.includes("kyc_checker")) {
      _user.ability.canNotRead = [
        "BankTransaction",
        "BankTransactionRequest",
        "Manual Deposit",
        "Withdraw",
        "Deposit",
      ];
      _user.ability.canNotManage = ["Deposit"];
    }
    return _user;
  };

  useEffect(() => {
    if (!isInit) {
      storeCtx.getAdminUser().then((user) => {
        if (!user) {
          enqueueSnackbar(`${t("no-access")}`, {
            variant: "error",
            anchorOrigin: {
              vertical: "top",
              horizontal: "center",
            },
          });
          history.replace({
            pathname: `/signin`,
          });
          window.location.reload();
        } else {
          let _user = userAbility(user);
          setUser(_user);
        }

        setIsInit(true);
      });
    }
  }, [enqueueSnackbar, history, isInit, storeCtx, t]);

  return (
    <>
      {!isInit && <LoadingDialog />}
      <div className="admin">
        <AdminHeader
          activePage={activePage}
          onSelected={onSelected}
          user={user}
          open={openSidebar}
          openSidebar={(open) => setOpenSidebar(open)}
        />
        <Sidebar
          activePage={activePage}
          onSelected={onSelected}
          open={openSidebar}
          openSidebar={(open) => setOpenSidebar(open)}
        />
        {user &&
          user.ability?.canNotRead !== "all" &&
          activePage === "manager" && <Manager user={user} />}
        {user &&
          user.ability?.canNotRead !== "all" &&
          activePage === "dashboard" && <Dashboard user={user} />}
      </div>
    </>
  );
};

export default Admin;
