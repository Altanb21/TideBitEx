import React, { Suspense, lazy, useContext, useEffect, useState } from "react";
import { Switch, Route, useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import StoreContext from "../store/store-context";
import Dialog from "../components/Dialog";
// import Markets from "../pages/markets";
// import Profile from "./profile";
// import Wallet from "./wallet";
// import Settings from "./settings";
// import Login from "./login";
// import Reset from "./reset";
// import OtpVerify from "./otp-verify";
// import OtpNumber from "./otp-number";
// import Lock from "./lock";
// import TermsAndConditions from "./terms-and-conditions";
// import NewsDetails from "./news-details";
// import Signup from "./signup";
// import Notfound from "./notfound";
// import Analysis from "./analysis";s

const Home = lazy(() => import("./home"));
const Exchange = lazy(() => import("./exchange"));
const Admin = lazy(() => import("./admin"));

const Index = () => {
  const storeCtx = useContext(StoreContext);
  const [isInit, setIsInit] = useState(null);
  const history = useHistory();
  const { t } = useTranslation();

  useEffect(() => {
    if (isInit === null) {
      setIsInit(false);
      storeCtx.init().then((_) => setIsInit(true));
    }
    // ++TODO never called
    return () => {
      // storeCtx.stop();
      // clearInterval(interval)
    };
  }, [isInit, storeCtx]);

  return (
    <>
      {storeCtx.tokenExpired && (
        <Dialog
          className="exchange"
          title="Info"
          block={true}
          onConfirm={() => {
            history.replace({
              pathname: `/signin`,
            });
            window.location.reload();
          }}
        >
          <p className="info__text">{t("token_expired")}</p>
        </Dialog>
      )}
      <Suspense fallback={<div></div>}>
        <Switch>
          <Route exact path="/">
            <Home />
          </Route>
          <Route path="/markets">
            <Exchange />
          </Route>
          <Route path="/analysis">
            {/* <Analysis /> */}
            <Admin />
          </Route>
          {/* <Route path="/profile">
        <Profile />
      </Route>
      <Route path="/wallet">
        <Wallet />
      </Route>
      <Route path="/settings">
        <Settings />
      </Route>
      <Route path="/login">
        <Login />
      </Route>
      <Route path="/signup">
        <Signup />
      </Route>
      <Route path="/reset">
        <Reset />
      </Route>
      <Route path="/otp-verify">
        <OtpVerify />
      </Route>
      <Route path="/otp-number">
        <OtpNumber />
      </Route>
      <Route path="/lock">
        <Lock />
      </Route>
      <Route path="/terms-and-conditions">
        <TermsAndConditions />
      </Route>
      <Route path="/news-details">
        <NewsDetails />
      </Route>
      <Route path="/notfound">
        <Notfound />
      </Route> */}
        </Switch>
      </Suspense>
    </>
  );
};

export default Index;
