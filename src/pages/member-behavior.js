import { t } from "i18next";
import React, { useState, useEffect, useCallback, useContext } from "react";
import DatePicker from "../components/DatePicker";
import EmailSeacrh from "../components/EmailSeacrh";
import LoadingDialog from "../components/LoadingDialog";
import TableDropdown from "../components/TableDropdown";
import StoreContext from "../store/store-context";
import SafeMath from "../utils/SafeMath";
import { dateFormatter } from "../utils/Utils";

let currentDate = new Date();

const getNextDailyDate = (date) => {
  date.setDate(date.getDate() + 1);
  return new Date(
    `${currentDate.getFullYear()}-${
      currentDate.getMonth() + 1
    }-${currentDate.getDate()}`
  );
};

const AuditOrder = (props) => {
  const { order } = props;
  return (
    <div className="audit-order">
      <div className="audit-order__row">
        <div div className="audit-order__header">
          {order.baseUnit}|{order.quoteUnit}
        </div>
        <div div className="audit-order__subheader">
          {order.updated_at.toISOString()}
        </div>
      </div>
      <div div className="audit-order__item">
        <div className="audit-order__row">
          <div className="audit-order__value">{t("type")}</div>
          <div className="audit-order__value">{t("state")}</div>
          <div className="audit-order__value">{t("price")}</div>
          <div className="audit-order__value">{t("volume")}</div>
          <div className="audit-order__value">{t("acc_fill_vol")}</div>
          <div className="audit-order__value">{t("origin_locked")}</div>
          <div className="audit-order__value">{t("locked")}</div>
          <div className="audit-order__value">{t("funds_received")}</div>
          <div className="audit-order__value">{t("trades_count")}</div>
        </div>
        <div className="audit-order__row">
          <div className="audit-order__value">{order.type}</div>
          <div className="audit-order__value">{order.state}</div>
          <div className="audit-order__value">{order.price}</div>
          <div className="audit-order__value">{order.origin_volume}</div>
          <div className="audit-order__value">
            {SafeMath.minus(order.origin_volume, order.volume)}
          </div>
          <div className="audit-order__value">{order.origin_locked}</div>
          <div className="audit-order__value">{order.locked}</div>
          <div className="audit-order__value">{order.funds_received}</div>
          <div className="audit-order__value">{order.trades_count}</div>
        </div>
      </div>
      <ul className="audit-order__rows ">
        <div className="audit-order__header ">Vouchers</div>
        <div className="audit-order__row">
          <div className="audit-order__value">{t("created_at")}</div>
          <div className="audit-order__value">{t("trend")}</div>
          <div className="audit-order__value">{t("price")}</div>
          <div className="audit-order__value">{t("volume")}</div>
          <div className="audit-order__value">{t("value")}</div>
          <div className="audit-order__value">{t("ask_fee")}</div>
          <div className="audit-order__value">{t("bid_fee")}</div>
        </div>
        {order.vouchers.map((voucher) => (
          <div className="audit-order__row">
            <div className="audit-order__value">
              {voucher.created_at.toISOString()}
            </div>
            <div className="audit-order__value">{voucher.trend}</div>
            <div className="audit-order__value">{voucher.price}</div>
            <div className="audit-order__value">{voucher.volume}</div>
            <div className="audit-order__value">{voucher.value}</div>
            <div className="audit-order__value">
              {voucher.ask_fee}
              {voucher.ask}
            </div>
            <div className="audit-order__value">
              {voucher.bid_fee}
              {voucher.bid}
            </div>
          </div>
        ))}
      </ul>
      <ul className="audit-order__rows ">
        <div className="audit-order__header ">Account Versions</div>
        <div className="audit-order__row">
          <div className="audit-order__value">{t("created_at")}</div>
          <div className="audit-order__value">{t("modifiable_type")}</div>
          <div className="audit-order__value">{t("balance")}</div>
          <div className="audit-order__value">{t("locked")}</div>
          <div className="audit-order__value">{t("fee")}</div>
          <div className="audit-order__value">{t("reason")}</div>
        </div>
        {order.accountVersions.map((accountVersion) => (
          <div className="audit-order__row">
            <div className="audit-order__value">
              {accountVersion.created_at.toISOString()}
            </div>
            <div className="audit-order__value">
              {accountVersion.modifiable_type}
            </div>
            <div className="audit-order__value">{accountVersion.balance}</div>
            <div className="audit-order__value">{accountVersion.fee}</div>
            <div className="audit-order__value">
              {accountVersion.fee}
              {accountVersion.currency}
            </div>
            <div className="audit-order__value">{accountVersion.reason}</div>
          </div>
        ))}
      </ul>
    </div>
  );
};

const AuditOrderList = (props) => {
  const component = props.orders?.map((order) => (
    <AuditOrder key={`order-${order.id}`} order={order} />
  ));
  return (
    <tbody className="screen__table-rows members__list">{component}</tbody>
  );
};

const MemberBehavior = (props) => {
  // console.log(`MemberBehavior`, props)
  // const { member, asset, assets } = props;
  const storeCtx = useContext(StoreContext);
  const [isLoading, setIsLoading] = useState(false);
  const [member, setMember] = useState(null);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [behaviors, setBehaviors] = useState([]);
  const [date, setDate] = useState(
    new Date(
      `${currentDate.getFullYear()}-${
        currentDate.getMonth() + 1
      }-${currentDate.getDate()}`
    )
  );

  const updateDateHandler = useCallback((date) => {
    setDate(date);
  }, []);

  const searchMemberHandler = useCallback(
    async (email) => {
      setIsLoading(true);
      let result = await storeCtx.getMembers({ email });
      let member = result.members.find((m) => m.email === email);
      let assetsR = await storeCtx.auditorMemberAccounts({
        memberId: member.id,
      });
      let assets = assetsR.accounts || [];
      setMember(member);
      setAssets(assets);
      setSelectedAsset(assets[0]);
      setIsLoading(false);
    },
    [storeCtx]
  );

  const searchHandler = useCallback(async () => {
    if (member?.id && selectedAsset?.currencyId && date) {
      // https://www.tidebit.com/api/v1/private/audit-member?memberId=35394&currency=2&start=2022-12-09&end=2022-12-10
      try {
        let result = await storeCtx.auditorMemberAccounts({
          memberId: member.id,
          currency: selectedAsset.currencyId,
          start: date.toISOString().substring(0, 10),
          end: getNextDailyDate(date).toISOString().substring(0, 10),
        });
        setBehaviors(result);
      } catch (error) {
        console.error(`error`, error);
      }
    }
  }, [member?.id, selectedAsset?.currencyId, date, storeCtx]);

  return (
    <>
      <LoadingDialog isLoading={isLoading} />
      <section className="screen__section member-behavior">
        <div className="screen__header">{t("match-behavior")}</div>
        <div className="screen__search-bar">
          <EmailSeacrh searchMemberHandler={searchMemberHandler} />
          <div className="screen__title">{member?.email}</div>
          <TableDropdown
            className="screen__filter"
            selectHandler={() => {}}
            options={assets.map((a) => a.currency)}
            selected={selectedAsset?.currency}
          />
          <DatePicker date={date} setDate={updateDateHandler} maxDate={date} />
          <button className="screen__btn" onClick={searchHandler}>
            {t("search")}
          </button>
        </div>
        <div className="screen__container">
          <table className="screen__table">
            {/* <DepositList behaviors={behaviors.depositRecords}/>
            <WithdrawList behaviors={behaviors.withdrawRecords}/> */}
            <AuditOrderList orders={behaviors.auditedOrders} />
          </table>
        </div>
      </section>
    </>
  );
};

export default MemberBehavior;
