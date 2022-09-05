import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useContext } from "react";
import AdminHeader from "../components/AdminHeader";
import StoreContext from "../store/store-context";

import Manager from "./manager";
import LoadingDialog from "../components/LoadingDialog";
const Admin = () => {
  const storeCtx = useContext(StoreContext);
  const [isInit, setIsInit] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState("manager");
  const onSelected = (page) => {
    setActivePage(page);
  };

  useEffect(() => {
    if (!isInit) {
      storeCtx.getUserRoles().then((user) => {
        if (user) setUser(user);
        else {
          navigate(-1);
        }
      });
      setIsInit(true);
    }
  }, [isInit, navigate, storeCtx]);

  return (
    <>
      {!isInit && <LoadingDialog />}
      <div className="admin">
        <AdminHeader activePage={activePage} onSelected={onSelected} />
        {user && activePage === "manager" && <Manager />}
      </div>
    </>
  );
};

export default Admin;
