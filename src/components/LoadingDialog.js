import React from "react";
import ReactDOM from "react-dom";
import { useTranslation } from "react-i18next";
import loadingPath from '../assets/images/loading.json';

const generateSvg = (paths) => {
  var svg = '';
  svg += '<svg width="198px" height="55px" version="1.1" xmlns="http://www.w3.org/2000/svg">\n';

  for(var i in paths) {
    var path = '';
    path += 'M' + paths[i].mx + ' ' + paths[i].my;   // moveTo
    path += ' L ' + paths[i].lx + ' ' + paths[i].ly; // lineTo
    path += ' Z';                                    // closePath
    svg += '<path d="' + path + '"stroke="blue" stroke-width="2"/>\n';
  }

  svg += '</svg>\n';
  console.log(`svg`, svg)
  return svg;
}

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
            {/* {generateSvg(loadingPath)} */}
          </div>
          <div className="modal__text">{t('loading')}</div>
        </div>,
        document.getElementById("overlay-root")
      )}
    </React.Fragment>
  );
};

export default LoadingDialog;
