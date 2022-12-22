import { useTranslation } from "react-i18next";
import React, { useState, useCallback, useContext } from "react";
import DatePicker from "../components/DatePicker";
import EmailSeacrh from "../components/EmailSeacrh";
import LoadingDialog from "../components/LoadingDialog";
import TableDropdown from "../components/TableDropdown";
import StoreContext from "../store/store-context";
import AuditOrderList from "../components/AuditOrderList";
import DepositList from "../components/DepositList";
import WithdrawList from "../components/WithdrawList";

const MemberBehavior = (props) => {
  // console.log(`MemberBehavior`, props)
  // const { member, asset, assets } = props;
  const storeCtx = useContext(StoreContext);
  const [isLoading, setIsLoading] = useState(false);
  const [member, setMember] = useState(null);
  const [assets, setAssets] = useState([]);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [behaviors, setBehaviors] = useState([]);
  const [dateStart, setDateStart] = useState(new Date());
  const [dateEnd, setDateEnd] = useState(new Date());
  const { t } = useTranslation();

  const searchMemberHandler = useCallback(
    async (email) => {
      setIsLoading(true);
      let result = await storeCtx.getMembers({ email });
      let member = result.members.find((m) => m.email === email);
      let assetsR = await storeCtx.auditorMemberAccounts({
        memberId: member.id,
      });
      let assets = assetsR.accounts ? Object.values(assetsR.accounts) : [];
      setMember(member);
      setAssets(assets);
      setSelectedAsset(assets[0]);
      setIsLoading(false);
    },
    [storeCtx]
  );

  const searchHandler = useCallback(
    async ({ asset, start, end }) => {
      if (member?.id && asset?.currencyId && start && end) {
        setIsLoading(true);
        // https://www.tidebit.com/api/v1/private/audit-member?memberId=35394&currency=2&start=2022-12-09&end=2022-12-10
        try {
          let result = await storeCtx.auditorMemberBehavior({
            memberId: member.id,
            currency: asset.currencyId,
            start: start.toISOString().substring(0, 10),
            end: end.toISOString().substring(0, 10),
          });
          console.log(`searchHandler result`, result);
          setBehaviors(result);
        } catch (error) {
          console.error(`error`, error);
        }
        setIsLoading(false);
      }
    },
    [member.id, storeCtx]
  );

  const dateStartUpdateHandler = useCallback(
    async (date) => {
      setDateStart(date);
      const start = date;
      const end = dateEnd;
      await searchHandler({ asset: selectedAsset, start, end });
    },
    [selectedAsset, dateEnd, searchHandler]
  );

  const dateEndUpdateHandler = useCallback(
    async (date) => {
      setDateStart(date);
      const end = date;
      const start = dateStart;
      await searchHandler({ asset: selectedAsset, start, end });
    },
    [selectedAsset, dateStart, searchHandler]
  );
  
  const updateAssetHandler = useCallback(
    async (currency) => {
      console.log(`currency`, currency);
      let asset = assets.find(
        (asset) => asset.currency.toUpperCase() === currency.toUpperCase()
      );
      console.log(`asset`, asset);
      if (asset) {
        setSelectedAsset(asset);
        const start = dateStart;
        const end = dateEnd;
        await searchHandler({ asset, start, end });
      }
    },
    [assets, dateEnd, dateStart, searchHandler]
  );

  return (
    <>
      <LoadingDialog isLoading={isLoading} />
      <section className="screen__section member-behavior">
        <div className="screen__header">{t("match-behavior")}</div>
        <div className="screen__search-bar">
          <TableDropdown
            className="screen__filter"
            selectHandler={updateAssetHandler}
            options={assets.map((a) => a.currency.toUpperCase())}
            selected={selectedAsset?.currency.toUpperCase()}
          />
          <EmailSeacrh searchMemberHandler={searchMemberHandler} />
        </div>
        <div className="screen__tool-bar">
          <div className="screen__date--range-bar">
            <div className="screen__date--group">
              <label className="screen__date--title">
                {t("another-time")}:
              </label>
              <DatePicker
                date={dateStart}
                setDate={dateStartUpdateHandler}
                maxDate={dateEnd}
              />
            </div>
            <div className="screen__date--group">
              <label className="screen__date--title">{t("to")}:</label>
              <DatePicker
                date={dateEnd}
                setDate={dateEndUpdateHandler}
                minDate={dateStart}
              />
            </div>
          </div>
          {/* <button className="screen__button" onClick={searchHandler}>
            {t("search")}
          </button> */}
        </div>
        <div className="screen__container">
          <div className="screen__table-header screen__table-header--em">
            {member?.email}
          </div>
          <DepositList deposits={behaviors.depositRecords} />
          <WithdrawList withdraws={behaviors.withdrawRecords} />
          <AuditOrderList orders={behaviors.auditedOrders} />
        </div>
      </section>
    </>
  );
};

export default MemberBehavior;
