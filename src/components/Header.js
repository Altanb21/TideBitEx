import React, { useContext } from "react";
import { Navbar, Nav } from "react-bootstrap";
import StoreContext from "../store/store-context";
import { useTranslation } from "react-i18next";
import DropDown from "./DropDown";

const Header = (props) => {
  const storeCtx = useContext(StoreContext);
  const { t } = useTranslation();

  return (
    <Navbar bg="teal" variant="dark" expand="lg">
      <Navbar.Brand href="/">
        <img
          src="/TideBit_White_hk.png"
          className="d-inline-block align-top"
          alt="TideBit"
          width="125px"
          height="44px"
        />
      </Navbar.Brand>
      <button
        type="button custom"
        aria-label="Toggle navigation"
        className="navbar-toggler"
        onClick={props.sidebarHandler}
      >
        <span class="navbar-toggler-icon"></span>
      </button>
      <Navbar.Collapse>
        <Nav.Link href={`/markets/${storeCtx.defaultMarket}`}>
          {t("trading")}
        </Nav.Link>
        <Nav.Link href="https://tidebit.zendesk.com/hc/zh-tw/articles/360003146914-%E5%A4%A7%E9%A1%8D%E4%BA%A4%E6%98%93Block-Trade-OTC-%E5%B0%88%E5%B1%AC-Whatsapp-852-62871829">
          {t("block_trade")}
        </Nav.Link>
        <Nav.Link href="/digital_staking/plans">
          {t("digital_staking")}
        </Nav.Link>
        <Nav.Link href="/referral">{t("refer_now")}</Nav.Link>
        {(storeCtx.isLogin === false || storeCtx.disableTrade) && (
          <React.Fragment>
            <Nav.Link href="/signin">{t("login")}</Nav.Link>
            <Nav.Link href="/signup">{t("register")}</Nav.Link>
          </React.Fragment>
        )}
        {storeCtx.isLogin && !storeCtx.disableTrade && (
          <React.Fragment>
            <Nav.Link href="/accounts">{t("accounts")}</Nav.Link>
            <Nav.Link href="/signout">{t("logout")}</Nav.Link>
          </React.Fragment>
        )}
        <DropDown
          options={Object.keys(props.languages)}
          selected={props.languageKey}
          onSelect={props.changeLanguage}
          placeholder="Language"
        >
          {(key) => <div>{props.languages[key]}</div>}
        </DropDown>
      </Navbar.Collapse>
    </Navbar>
  );
};

export default Header;
