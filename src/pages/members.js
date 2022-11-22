import React, { useState, useEffect, useCallback, useContext } from "react";
import StoreContext from "../store/store-context";
import { useTranslation } from "react-i18next";
import SafeMath from "../utils/SafeMath";
import LoadingDialog from "../components/LoadingDialog";

const MemberAssets = (props) => {
  const { t } = useTranslation();
  const storeCtx = useContext(StoreContext);
  const [assets, setAssets] = useState([]);

  const auditorMemberAccounts = useCallback(async () => {
    let result = await storeCtx.auditorMemberAccounts({
      memberId: props.member.id,
    });
    console.log(`result`, result);
  }, [props.member.id, storeCtx]);
  return (
    <tr className="members__tile" key={props.key}>
      <input
        className="members__controller"
        type="checkbox"
        id={`member-${props.member.id}-dropdown-btn`}
        onChange={async (e) => {
          console.log(e.target.checked);
          auditorMemberAccounts();
        }}
      />
      <label
        className={`members__label${
          props.member.alert ? " members__alert" : ""
        }`}
        htmlFor={`member-${props.member.id}-dropdown-btn`}
      >
        <div className="members__infos">
          <div className="members__icon"></div>
          <div className="members__info">
            <div className="members__title">{t("member_id")}</div>
            <div className="members__value">{props.member.id}</div>
          </div>
          <div className="members__info">
            <div className="members__title">{t("member_email")}</div>
            <div className="members__value">{props.member.email}</div>
          </div>
          {/* <div className="members__info">
            <div className="members__title">
              {t("last_accounts_audit_record")}
            </div>
            <div className="members__value">
              {props.member.lastAccountsAuditTime}
            </div>
          </div> */}
        </div>
        <div className="members__alert--icon">
          <img src="/img/alert@2x.png" alt="alert"></img>
        </div>
      </label>
      <div className="members__assets">
        <div className="members__assets--headers">{/* TODO audit again */}</div>
        <div className="members__assets--data">
          {assets.map((asset) => (
            <div>{asset.currency}</div>
          ))}
        </div>
      </div>
    </tr>
  );
};

const Members = () => {
  const { t } = useTranslation();
  const storeCtx = useContext(StoreContext);
  const [isInit, setIsInit] = useState(null);
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [members, setMembers] = useState({});
  // const [filterKey, setFilterKey] = useState("");
  const [filterOption, setFilterOpstion] = useState("all"); //'all','alert'
  // const [filteredMembers, setFilteredMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // const filter = useCallback(
  //   ({ members, keyword, option }) => {
  //     let _option = option || filterOption,
  //       _keyword = keyword === undefined ? filterKey : keyword,
  //       filteredMembers;
  //     filteredMembers = members.filter((member) => {
  //       let condition =
  //         member.id.includes(_keyword) ||
  //         member.email.includes(_keyword) ||
  //         member.refer.includes(_keyword) ||
  //         member.refer_code.includes(_keyword);
  //       if (_option !== "all") condition = condition && member.alert === true;
  //       return condition;
  //     });
  //     setFilteredMembers(filteredMembers);
  //   },
  //   [filterKey, filterOption]
  // );

  const getMembers = useCallback(
    async ({ offset, limit }) => {
      let members = await storeCtx.getMembers({ offset, limit });
      return members;
    },
    [storeCtx]
  );

  const switchPageHandler = useCallback(
    async (newPage) => {
      setIsLoading(true);
      let newMembers;
      setPage(newPage);
      if (!members[newPage] || !members[newPage]?.length > 0) {
        let result = await getMembers({ offset: (newPage - 1) * limit, limit });
        setMembers((prev) => {
          newMembers = { ...prev };
          newMembers[newPage] = result.members;
          return newMembers;
        });
        console.log(newMembers)
      }
      // filter({ members: memberList });
      setIsLoading(false);
    },
    [members, getMembers, limit]
  );

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        let members;
        setIsLoading(true);
        const result = await getMembers({ offset: (page - 1) * limit, limit });
        if (result.counts) setPages(Math.ceil(result.counts / limit));
        setMembers((prev) => {
          members = { ...prev };
          members[page] = result.members;
          return members;
        });
        // filter({
        //   members: Object.values(members).reduce((prev, curr) => {
        //     prev = [...prev, ...curr];
        //     return prev;
        //   }, []),
        // });
        setIsLoading(false);
        return !prev;
      } else return prev;
    });
  }, [getMembers, limit, page]);

  useEffect(() => {
    if (!isInit) {
      init();
    }
  }, [init, isInit]);
  return (
    <>
      {isLoading && <LoadingDialog />}
      <section className="screen__section members">
        <div className="screen__header">{t("members-assets")}</div>
        <ul className="screen__select-bar"></ul>
        {/* <div className="screen__search-bar">
        <div className="screen__search-box">
          <input
            type="text"
            inputMode="search"
            className="screen__search-input"
            placeholder="輸入欲搜尋的關鍵字"
            onInput={(e) => {
              setFilterKey(e.target.value);
              filter({ keyword: e.target.value });
            }}
          />
          <div className="screen__search-icon">
            <div className="screen__search-icon--circle"></div>
            <div className="screen__search-icon--rectangle"></div>
          </div>
        </div>
      </div> */}
        <div className="screen__tool-bar">
          <div className="screen__display">
            <div className="screen__display-title">顯示：</div>
            <ul className="screen__display-options">
              <li
                className={`screen__display-option${
                  filterOption === "all" ? " active" : ""
                }`}
                // onClick={() => filter("all")}
              >
                全部
              </li>
              {/* <li
              className={`screen__display-option${
                filterOption === "alert" ? " active" : ""
              }`}
              onClick={() => filter("alert")}
            >
              警示
            </li> */}
            </ul>
          </div>
        </div>
        <div className="screen__container">
          <table className="screen__table">
            <tbody className="screen__table-rows members__list">
              {members[page]?.map((member) => (
                <MemberAssets key={`member-${member.id}`} member={member} />
              ))}
            </tbody>
            <tfoot className="screen__table-tools">
              <div
                className={`screen__table-tool${
                  SafeMath.gt(page, 1) ? "" : " disable"
                }`}
                onClick={() => switchPageHandler(page - 1 > 0 ? page - 1 : 1)}
              >
                <div className="screen__table-tool--left"></div>
              </div>
              <div className="screen__page">{`${page}/${pages}`}</div>
              <div
                className={`screen__table-tool${
                  SafeMath.gte(page, Math.ceil(pages)) ? " disable" : ""
                }`}
                onClick={() => switchPageHandler(page + 1)}
              >
                <div className="screen__table-tool--right"></div>
              </div>
            </tfoot>
          </table>
        </div>
      </section>
    </>
  );
};

export default Members;
