import React from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";

const Dialog = (props) => {
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
        <div className={`modal__dialog modal__card${props.className}`}>
          <div className="modal__header">
            <div className="modal__title">{props.title}</div>
            <div className="modal__close-btn"  onClick={props.onClose}></div>
          </div>
          <div className="modal__content">{props.children}</div>
          <div className="modal__footer">
            <div
              className="modal__btn modal__cancel-btn"
              onClick={props.onCancel}
            >
              {t("cancel")}
            </div>
            <div
              className="modal__btn modal__confirm-btn"
              onClick={props.onConfirm}
            >
              {t("confirm")}
            </div>
          </div>
        </div>,
        document.getElementById("overlay-root")
      )}
    </React.Fragment>
  );
};

export default Dialog;
