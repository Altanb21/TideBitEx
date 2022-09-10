import React from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";

const LoadingDialog = (props) => {
  const { t } = useTranslation();
  return (
    <React.Fragment>
      <React.Fragment>
        {ReactDOM.createPortal(
          <div className="modal__backdrop" onClick={() => {}} />,
          document.getElementById("backdrop-root")
        )}
      </React.Fragment>
      {ReactDOM.createPortal(
        <div className="modal__card">
          <div className="modal__icon">
            <div className="lds-spinner">
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
              <div></div>
            </div>
          </div>
          <div className="modal__text">{t('loading')}</div>
        </div>,
        document.getElementById("overlay-root")
      )}
    </React.Fragment>
  );
};

export default LoadingDialog;
