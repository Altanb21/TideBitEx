import React from "react";
import { useTranslation } from "react-i18next";
import { convertExponentialToDecimal, dateFormatter } from "../utils/Utils";

const VoucherTile = (props) => {
  const { t } = useTranslation();
  const { trade } = props;
  return (
    <tr
      className={`vouchers__tile screen__table-row${
        trade.email ? "" : " unknown"
      }${trade.alert ? " screen__table-row--alert" : ""}`}
      key={`${trade.id}`}
    >
      <td className="vouchers__text screen__shrink">{props.number}</td>
      <td className="vouchers__text screen__table-item">
        {dateFormatter(trade.ts).text}
      </td>
      <td className="vouchers__text screen__email screen__table-item">
        {`${trade.email ? trade.email : "-"}`}
        {/* <div>{`${trade.email ? trade.memberId : ""}`}</div> */}
      </td>
      <td className="screen__box screen__table-item">
        <div className="vouchers__text">
          {trade.innerTrade?.exchange || "-"}
        </div>
        {trade.outerTrade && (
          <div className="vouchers__text">
            {trade.outerTrade?.exchange || "-"}
          </div>
        )}
      </td>
      <td
        className={`vouchers__text${
          trade.side === "buy" ? " positive" : " negative"
        } screen__table-item`}
      >
        {`${t(trade.kind)}${t(trade.side)}`}
      </td>
      <td className="vouchers__text screen__table-item">
        {trade.innerTrade?.orderId || "-"}
      </td>
      <td className="screen__box screen__table-item">
        <div className="vouchers__text">
          {trade.innerTrade?.state ? t(trade.innerTrade?.state) : "-"}
        </div>
        <div className="vouchers__text">
          {trade.outerTrade.state ? t(trade.outerTrade.state) : "-"}
        </div>
      </td>
      <td className="screen__box screen__table-item screen__expand">
        <div
          className={`vouchers__text${
            trade.side === "buy" ? " positive" : " negative"
          }`}
        >
          {`${trade.innerTrade?.price || "-"} / ${
            trade.innerTrade?.fillPrice || "-"
          }`}
        </div>
        {trade.outerTrade && (
          <div
            className={`vouchers__text${
              trade.side === "buy" ? " positive" : " negative"
            }`}
          >
            {`${trade.outerTrade?.price || "-"} / ${
              trade.outerTrade?.fillPrice || "-"
            }`}
          </div>
        )}
      </td>
      <td className="screen__box screen__table-item screen__expand">
        <div
          className={`vouchers__text${
            trade.side === "buy" ? " positive" : " negative"
          }`}
        >
          {`${trade.innerTrade?.volume || "-"} / ${
            trade.innerTrade?.fillVolume || "-"
          }`}
        </div>
        {trade.outerTrade && (
          <div
            className={`vouchers__text${
              trade.side === "buy" ? " positive" : " negative"
            }`}
          >
            {`${trade.outerTrade?.volume || "-"} / ${
              trade.outerTrade?.fillVolume || "-"
            }`}
          </div>
        )}
      </td>
      <td className="screen__box screen__table-item screen__expand">
        <div className={`vouchers__text`}>
          {trade.innerTrade?.fee
            ? `${convertExponentialToDecimal(trade.innerTrade.fee)} ${
                trade.feeCurrency
              }`
            : "-"}
        </div>
        {trade.outerTrade && (
          <div className={`vouchers__text`}>
            {trade.outerTrade?.fee
              ? `${convertExponentialToDecimal(trade.outerTrade.fee)} ${
                  trade.feeCurrency
                }`
              : "-"}
          </div>
        )}
      </td>
      <td
        className={`vouchers__text screen__table-item${
          trade.referral
            ? // trade.referral > 0
              //   ? " positive"
              // :
              " negative"
            : ""
        } screen__expand`}
      >
        {trade.referral
          ? `${convertExponentialToDecimal(trade.referral)} ${
              trade?.feeCurrency
            }`
          : "-"}
      </td>
      <td
        className={`vouchers__text screen__table-item${
          trade.profit
            ? trade.profit > 0
              ? " "
              : " negative" //" negative negative--em"
            : ""
        } screen__expand`}
      >
        {trade.profit
          ? `${convertExponentialToDecimal(trade.profit)} ${trade?.feeCurrency}`
          : "-"}
      </td>
    </tr>
  );
};

export default VoucherTile;
