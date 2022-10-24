import React, { Suspense, lazy } from "react";
import { Tabs, Tab } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { useViewport } from "../store/ViewportProvider";

const TradeForm = lazy(() => import("./TradeForm"));

const TradePannel = (props) => {
  const breakpoint = 428;
  const { width } = useViewport();
  const { t } = useTranslation();

  return (
    <div className="market-trade__panel">
      {width <= breakpoint ? (
        <Tabs defaultActiveKey="buy">
          <Suspense fallback={<div></div>}>
            <Tab eventKey="buy" title={t("buy")}>
              <TradeForm
                ordType={props.ordType}
                kind="bid"
                readyOnly={!!props.readyOnly}
                isMobile={true}
              />
            </Tab>
            <Tab eventKey="sell" title={t("sell")}>
              <TradeForm
                ordType={props.ordType}
                kind="ask"
                readyOnly={!!props.readyOnly}
                isMobile={true}
              />
            </Tab>
          </Suspense>
        </Tabs>
      ) : (
        <>
          <TradeForm
            ordType={props.ordType}
            kind="bid"
            readyOnly={!!props.readyOnly}
          />
          <TradeForm
            ordType={props.ordType}
            kind="ask"
            readyOnly={!!props.readyOnly}
          />
        </>
      )}
    </div>
  );
};

export default TradePannel;
