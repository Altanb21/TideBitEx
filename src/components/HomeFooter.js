import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import StoreContext from "../store/store-context";
import packageJson from "../../package.json";

const HomeFooter = () => {
  const storeCtx = useContext(StoreContext);
  const year = new Date().getFullYear();
  const { t } = useTranslation();
  return (
    <div className="home-footer">
      <div className="home-footer__container">
        <div className="home-footer__box home-footer__infos">
          <a className="home-footer__brand home-footer__item" href="/">
            <img
              src="/tidebit_footer_logo.svg"
              className="d-inline-block align-top"
              alt="TideBit"
              width="175px"
              height="60px"
            />
          </a>
          {/* <div className="home-footer__items"> */}
          <div className="home-footer__item">
            <div className="home-footer__header">{t("services")}</div>
            <a
              className="home-footer__link"
              href={`/markets/${storeCtx.defaultMarket}`}
            >
              {t("trading")}
            </a>
            <a className="home-footer__link" href="/transfer">
              {t("transfer")}
            </a>
            <a
              className="home-footer__link"
              href="https://tidebit.zendesk.com/hc/zh-tw/articles/360006278834--%E5%85%B6%E4%BB%96-%E6%94%B6%E8%B2%BB%E8%A1%A8FEE-SCHEDULE"
            >
              {t("fee_schedule")}
            </a>
            <a
              className="home-footer__link"
              href="https://tidebit.zendesk.com/hc/zh-tw/sections/115002703848"
            >
              {t("faq")}
            </a>
          </div>
          <div className="home-footer__item">
            <div className="home-footer__header">{t("about_us")}</div>
            <a className="home-footer__link" href="/about">
              {t("about_tidebit")}
            </a>
            <a
              className="home-footer__link"
              href="https://angel.co/tidebit/jobs"
            >
              {t("careers")}
            </a>
            <div className="home-footer__header">{t("legal_terms")}</div>
            <a className="home-footer__link" href="/tos">
              {t("terms_of_services")}
            </a>
            <a className="home-footer__link" href="/privacy">
              {t("privacy")}
            </a>
          </div>
          <div className="home-footer__item">
            <div className="home-footer__header">{t("customer_service")}</div>
            <div className="home-footer__text">
              <span>{`${t("general_enquiries: ")}: `}</span>
              <span>hello@tidebit.com</span>
            </div>
            <div className="home-footer__text">
              <span>{`${t("corporate_enquiries")}: `}</span>
              <span>corporate@tidebit.com</span>
            </div>
            <br />
            <div className="home-footer__text">{t("whatsapp_hotline")}</div>
            <a
              className="home-footer__link"
              href="https://api.whatsapp.com/send?phone=85267356499"
            >
              +852 6735 6499
            </a>
          </div>
          <div className="home-footer__item">
            <div className="home-footer__header">{t("our_address")}</div>
            <div className="home-footer__text">{t("hongkong")}</div>
            <a
              className="home-footer__link"
              target="_blank"
              href="https://www.google.com/maps/place/%E6%9C%83%E5%B1%95%E5%BB%A3%E5%A0%B4%E8%BE%A6%E5%85%AC%E5%A4%A7%E6%A8%93/@22.2809259,114.1718527,17z/data=!3m1!4b1!4m5!3m4!1s0x3404005951a79277:0x82574055bbfad065!8m2!3d22.2809259!4d114.1740414?hl=en-US"
              rel="noreferrer"
            >
              {t("address")}
            </a>
            <div className="home-footer__text">{t("bussiness_hour")}</div>
          </div>
          {/* </div> */}
        </div>
        <div className="home-footer__box home-footer__social-medias">
          <a
            className="home-footer__social-media"
            href="https://t.me/tidebitofficial"
            target="_blank"
            rel="noreferrer"
          >
            <div className="home-footer__icon home-footer__icon--telegram"></div>
          </a>
          <a
            className="home-footer__social-media"
            href="https://www.facebook.com/tidebit"
            target="_blank"
            rel="noreferrer"
          >
            <div className="home-footer__icon home-footer__icon--facebook"></div>
          </a>
          <a
            className="home-footer__social-media"
            href="https://www.linkedin.com/company/tidebit"
            target="_blank"
            rel="noreferrer"
          >
            <div className="home-footer__icon home-footer__icon--linkedin"></div>
          </a>
        </div>
        <div className="home-footer__copyright">
          {`©${year}, TideBit All Rights Reserved. v${packageJson.version}`}
        </div>
      </div>
    </div>
  );
};

export default HomeFooter;
