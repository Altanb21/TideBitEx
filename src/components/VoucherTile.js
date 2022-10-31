import { convertExponentialToDecimal, dateFormatter } from "../utils/Utils";

const VoucherTile = (props) => {
  const { trade } = props;
  return (
    <td
      className={`vouchers__tile screen__table-row${
        trade.email ? "" : " unknown"
      }`}
      key={`${trade.orderId}`}
    >
      <div className="vouchers__text screen__table-item">
        {dateFormatter(trade.ts).text}
      </div>
      <div className="vouchers__text screen__table-item">
        <div>{`${trade.email ? trade.email : "Unknown"}`}</div>
        {/* <div>{`${trade.email ? trade.memberId : ""}`}</div> */}
      </div>
      <div className="vouchers__box">
        <div className="vouchers__text screen__table-item">
          {trade.orderId || "Unknown"}
        </div>
        <div className="vouchers__text screen__table-item">
          {trade.orderId || "Unknown"}
        </div>
      </div>
      {/* <div className="vouchers__text screen__table-item">
        {trade.instId}
      </div> */}
      <div className="vouchers__box">
        <div className="vouchers__text screen__table-item">
          {trade.exchange}
        </div>
        <div className="vouchers__text screen__table-item">
          {trade.exchange}
        </div>
      </div>
      <div className="vouchers__box">
        <div
          className={`vouchers__text screen__table-item${
            trade.side === "buy" ? " positive" : " negative"
          }`}
        >
          {trade.email ? `${trade.px} / ${trade.fillPx}` || "--" : "Unknown"}
        </div>
      </div>
      <div className="vouchers__box">
        <div
          className={`vouchers__text screen__table-item${
            trade.side === "buy" ? " positive" : " negative"
          }`}
        >
          {trade.email ? `${trade.sz} / ${trade.fillSz}` || "--" : "Unknown"}
        </div>
      </div>
      <div className="vouchers__box">
        <div className={`vouchers__text screen__table-item`}>
          {trade.fee
            ? `${convertExponentialToDecimal(trade.fee)} ${trade.feeCcy}`
            : "Unknown"}
        </div>
        <div className={`vouchers__text screen__table-item`}>
          {trade.externalFee
            ? `${convertExponentialToDecimal(trade.externalFee)} ${
                trade.feeCcy
              }`
            : "--"}
        </div>
      </div>
      <div
        className={`vouchers__text screen__table-item${
          trade.referral
            ? // trade.referral > 0
              //   ? " positive"
              // :
              " negative"
            : ""
        }`}
      >
        {trade.referral
          ? `${convertExponentialToDecimal(trade.referral)} ${trade.feeCcy}`
          : "--"}
      </div>
      <div
        className={`vouchers__text screen__table-item${
          trade.profit
            ? trade.profit > 0
              ? " "
              : " negative negative--em"
            : ""
        }`}
      >
        {trade.profit
          ? `${convertExponentialToDecimal(trade.profit)} ${trade.feeCcy}`
          : "Unknown"}
      </div>
    </td>
  );
};

export default VoucherTile;
