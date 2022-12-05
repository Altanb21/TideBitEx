import React from "react";
import ReactDOM from "react-dom";
import { BrowserRouter, Route } from "react-router-dom";
// import { CookiesProvider } from "react-cookie";
import App from "./App";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "./assets/css/ionicons.min.css";
import "./assets/scss/style.scss";
import "./i18n/config";

const ScrollToTop = () => {
  window.scrollTo(0, 0);
  return null;
};

ReactDOM.render(
  <React.StrictMode>
    {/* <CookiesProvider> */}
      <BrowserRouter>
        <Route component={ScrollToTop} />
        <App />
      </BrowserRouter>
    {/* </CookiesProvider> */}
  </React.StrictMode>,
  document.getElementById("root")
);

// React Router, why useLocation and useHistory might return undefined
// solved: https://flaviocopes.com/react-router-uselocation-usehistory-undefined/
