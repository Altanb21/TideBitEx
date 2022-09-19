import React, { useEffect, useState, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { useContext } from "react";
import AdminHeader from "../components/AdminHeader";
import StoreContext from "../store/store-context";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";

import Manager from "./manager";
import LoadingDialog from "../components/LoadingDialog";
import { languages } from "../components/Layout";

const Admin = () => {
  const storeCtx = useContext(StoreContext);
  const [isInit, setIsInit] = useState(false);
  const [user, setUser] = useState(null);
  const history = useHistory();
  const [activePage, setActivePage] = useState("manager");
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { t } = useTranslation();

  const onSelected = (page) => {
    setActivePage(page);
  };

  const changeLanguage = useCallback(
    (key) => {
      // await window.cookieStore.set("lang", key);
      // document.cookie = `lang=${key}`;
      storeCtx.setLanguageKey(key);
      i18n.changeLanguage(key);
    },
    [i18n, storeCtx]
  );

  const userAbility = (user) => {
    let _user = user ? { ...user } : {};
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
      storeCtx.getAdminUser().then((user) => {
        if (!user || userAbility(user).ability.canNotRead === "all") {
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
          languages={languages}
          languageKey={storeCtx.languageKey}
          changeLanguage={changeLanguage}
        />
        {user &&
          user.ability?.canNotRead !== "all" &&
          activePage === "manager" && <Manager user={user} />}
      </div>
    </>
  );
};

export default Admin;
