import React from "react";
import ReactDOM from "react-dom";

const LoadingDialog = (props) => {
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
          <div className="modal__text">Loading...</div>
        </div>,
        document.getElementById("overlay-root")
      )}
    </React.Fragment>
  );
};

export default LoadingDialog;
