import React, { Suspense, lazy } from "react";
import { Switch, Route } from "react-router-dom";
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

const Exchange = lazy(() => import("./exchange"));
const Admin = lazy(() => import("./admin"));

export default function index() {
  return (
    <Suspense
    >
      <Switch>
        <Route exact path="/">
          <Exchange />
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
  );
}
