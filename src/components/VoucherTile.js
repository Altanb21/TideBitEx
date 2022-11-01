import { convertExponentialToDecimal, dateFormatter } from "../utils/Utils";

const VoucherTile = (props) => {
  const { trade } = props;
  return (
    <td
      className={`vouchers__tile screen__table-row${
        trade.email ? "" : " unknown"
      }`}
      key={`${trade.id}`}
    >
      <div className="vouchers__text screen__table-item">
        {dateFormatter(trade.ts).text}
      </div>
      <div className="vouchers__text screen__table-item">
        <div>{`${trade.email ? trade.email : "Unknown"}`}</div>
        {/* <div>{`${trade.email ? trade.memberId : ""}`}</div> */}
      </div>
      {/* <div className="vouchers__box">
        <div className="vouchers__text screen__table-item">
          {trade.innerTrade?.orderId || "-"}
        </div>
        {trade.outerTrade && (
          <div className="vouchers__text screen__table-item">
            {trade.outerTrade?.orderId || "-"}
          </div>
        )}
      </div> */}
      {/* <div className="vouchers__text screen__table-item">
        {trade.instId}
      </div> */}
      <div className="vouchers__box">
        <div className="vouchers__text screen__table-item">
          {trade.innerTrade?.exchange || "-"}
        </div>
        {trade.outerTrade && (
          <div className="vouchers__text screen__table-item">
            {trade.outerTrade?.exchange || "-"}
          </div>
        )}
      </div>
      <div className="vouchers__box">
        <div
          className={`vouchers__text screen__table-item${
            trade.side === "buy" ? " positive" : " negative"
          }`}
        >
          {`${trade.innerTrade?.price || "-"} / ${
            trade.innerTrade?.fillPrice || "-"
          }`}
        </div>
        {trade.outerTrade && (
          <div
            className={`vouchers__text screen__table-item${
              trade.side === "buy" ? " positive" : " negative"
            }`}
          >
            {`${trade.outerTrade?.price || "-"} / ${
              trade.outerTrade?.fillPrice || "-"
            }`}
          </div>
        )}
      </div>
      <div className="vouchers__box">
        <div
          className={`vouchers__text screen__table-item${
            trade.side === "buy" ? " positive" : " negative"
          }`}
        >
          {`${trade.innerTrade?.volume || "-"} / ${
            trade.innerTrade?.fillVolume || "-"
          }`}
        </div>
        {trade.outerTrade && (
          <div
            className={`vouchers__text screen__table-item${
              trade.side === "buy" ? " positive" : " negative"
            }`}
          >
            {`${trade.outerTrade?.volume || "-"} / ${
              trade.outerTrade?.fillVolume || "-"
            }`}
          </div>
        )}
      </div>
      <div className="vouchers__box">
        <div className={`vouchers__text screen__table-item`}>
          {trade.innerTrade?.fee
            ? `${convertExponentialToDecimal(trade.innerTrade.fee)} ${
                trade.feeCurrency
              }`
            : "-"}
        </div>
        {trade.outerTrade && (
          <div className={`vouchers__text screen__table-item`}>
            {trade.outerTrade?.fee
              ? `${convertExponentialToDecimal(trade.outerTrade.fee)} ${
                  trade.feeCurrency
                }`
              : "-"}
          </div>
        )}
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
          ? `${convertExponentialToDecimal(trade.referral)} ${
              trade?.feeCurrency
            }`
          : "-"}
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
          ? `${convertExponentialToDecimal(trade.profit)} ${trade?.feeCurrency}`
          : "-"}
      </div>
    </td>
  );
};

export default VoucherTile;
