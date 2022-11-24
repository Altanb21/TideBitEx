import React, {
  useState,
  useEffect,
  useCallback,
  useContext,
  useRef,
} from "react";
import StoreContext from "../store/store-context";
import { useTranslation } from "react-i18next";
import SafeMath from "../utils/SafeMath";
import LoadingDialog from "../components/LoadingDialog";
import { IoRefresh } from "react-icons/io5";
import { dateFormatter } from "../utils/Utils";
import { useSnackbar } from "notistack";

const MemberAsset = (props) => {
  const { t } = useTranslation();
  const { memberId, asset } = props;
  const disabled = `${
    asset.balance.alert || asset.locked.alert ? " " : " disabled"
  }`;

  const AssetBalance = asset.balance.alert ? (
    <>
      <div className="members__value members__value--wrong">
        {asset.balance.current}
      </div>
      <div className="members__value members__value--expect">
        {asset.balance.shouldBe}
      </div>
    </>
  ) : (
    <div className="members__value">{asset.balance.current}</div>
  );

  const AssetLocked = asset.locked.alert ? (
    <>
      <div className="members__value members__value--wrong">
        {asset.locked.current}
      </div>
      <div className="members__value members__value--expect">
        {asset.locked.shouldBe}
      </div>
    </>
  ) : (
    <div className="members__value">{asset.locked.current}</div>
  );

  const fixAccountHandler = () => {
    props.fixAccountHandler(memberId, asset.accountId);
  };

  return (
    <li className="members__asset">
      <div className="members__item">
        <div className="members__asset--icon">
          <img
            src={`/icons/${asset.currency}.png`}
            alt={asset.currency}
            loading="lazy"
          />
        </div>
        <div>{asset.currency.toUpperCase()}</div>
      </div>
      <div className="members__item">{asset.accountId}</div>
      <div className={`members__item members__item--expand`}>
        {AssetBalance}
      </div>
      <div className={`members__item members__item--expand`}>{AssetLocked}</div>
      <div className="members__item">
        <div
          className={`members__button${disabled}`}
          onClick={fixAccountHandler}
        >
          {t("fixed")}
        </div>
      </div>
    </li>
  );
};
const MemberAssets = (props) => {
  const { memberId, assets, fixAccountHandler } = props;
  const component = assets?.map((asset) => (
    <MemberAsset
      memberId={memberId}
      asset={asset}
      fixAccountHandler={fixAccountHandler}
    />
  ));
  return <ul className="members__values">{component}</ul>;
};

const Member = (props) => {
  const { t } = useTranslation();
  const storeCtx = useContext(StoreContext);
  const [assets, setAssets] = useState([]);
  const activated = `${props.member?.activated ? " member__activated" : ""}`;
  const alert = `${props.member?.alert ? " members__alert" : ""}`;
  const lastestAccountAuditTime = props.member?.lastestAccountAuditTime
    ? dateFormatter(parseInt(props.member.lastestAccountAuditTime)).text
    : "-";
  const lastestActivityTime = props.member?.lastestActivityTime
    ? dateFormatter(parseInt(props.member.lastestActivityTime)).text
    : "-";
  const auditorMemberAccounts = useCallback(async () => {
    try {
      let result = await storeCtx.auditorMemberAccounts({
        memberId: props.member.id,
      });
      setAssets(Object.values(result.accounts));
    } catch (error) {
      console.error(`error`, error);
    }
  }, [props.member.id, storeCtx]);

  const fixAccountHandler = useCallback((memberId, accountId) => {
    // ++TODO #1069
  }, []);

  const openAssetsHandler = useCallback(
    async (e) => {
      if (!assets.length > 0 && e.target.checked) await auditorMemberAccounts();
    },
    [assets.length, auditorMemberAccounts]
  );

  const controllerComponent = props.member?.activated && (
    <input
      className="members__controller"
      type="checkbox"
      id={`member-${props.member.id}-dropdown-btn`}
      onChange={openAssetsHandler}
    />
  );

  return (
    <tr className="members__tile" key={props.key}>
      {controllerComponent}
      <label
        className={`members__label${activated}${alert}`}
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
          <div className="members__info">
            <div className="members__title">
              {t("last_accounts_audit_time")}
            </div>
            <div className="members__value">{lastestAccountAuditTime}</div>
          </div>
          <div className="members__info">
            <div className="members__title">
              {t("last_accounts_activity_time")}
            </div>
            <div className="members__value">{lastestActivityTime}</div>
          </div>
        </div>
        <div className="members__alert--icon">
          <img src="/img/alert@2x.png" alt="alert"></img>
        </div>
      </label>
      <div className="members__assets">
        <div className="members__headers">
          <div className="members__header">{t("currency")}</div>
          <div className="members__header">{t("account_id")}</div>
          <div className="members__header members__header--expand">
            {t("balance")}
          </div>
          <div className="members__header members__header--expand">
            {t("locked")}
          </div>
          <div className="members__header members__header--button">
            <div>{t("force_fixed")}</div>
            <div
              className="members__button-icon"
              onClick={auditorMemberAccounts}
            >
              <IoRefresh />
            </div>
          </div>
        </div>
        <ul className="members__values">
          <MemberAssets
            memberId={props.member.id}
            assets={assets}
            fixAccountHandler={fixAccountHandler}
          />
        </ul>
      </div>
    </tr>
  );
};

const MemberList = (props) => {
  const { members } = props;
  const component = members?.map((member) => (
    <Member key={`member-${member.id}`} member={member} />
  ));
  return (
    <tbody className="screen__table-rows members__list">{component}</tbody>
  );
};

const Members = () => {
  const { t } = useTranslation();
  const storeCtx = useContext(StoreContext);
  const [isInit, setIsInit] = useState(null);
  const [limit, setLimit] = useState(10);
  const [page, setPage] = useState(1);
  const [prevPageIsExit, setPrevPageIsExit] = useState(" disable");
  const [nextPageIsExit, setNextPageIsExit] = useState(" disable");
  const [pages, setPages] = useState(1);
  const [members, setMembers] = useState({});
  // const [filterKey, setFilterKey] = useState("");
  const [filterOption, setFilterOption] = useState("all"); //'all','alert'
  const [filterOptionAll, setFilterOptionAll] = useState(
    `${filterOption === "all" ? " active" : ""}`
  );
  // const [filterOptionAlert, setFilterOptionAlert] = useState(
  //   `${filterOption === "alert" ? " active" : ""}`
  // );
  // const [filteredMembers, setFilteredMembers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [enableSearchButton, setEnableSearchButton] = useState("");
  const inputRef = useRef();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

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

  const validateEmail = useCallback((email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  }, []);

  const inputHandler = useCallback(() => {
    setEnableSearchButton(
      validateEmail(inputRef.current.value) ? " enabled" : ""
    );
  }, [validateEmail]);

  const getMembers = useCallback(
    async ({ email, offset, limit }) => {
      let members = await storeCtx.getMembers({ email, offset, limit });
      return members;
    },
    [storeCtx]
  );

  const switchPageHandler = useCallback(
    async (newPage) => {
      if (SafeMath.gt(newPage, 1)) setPrevPageIsExit("");
      else setPrevPageIsExit(" disable");
      if (SafeMath.lt(newPage, pages)) setNextPageIsExit("");
      else setNextPageIsExit(" disable");
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
        console.log(newMembers);
      }
      // filter({ members: memberList });
      setIsLoading(false);
    },
    [pages, members, getMembers, limit]
  );

  const prevPageHandler = useCallback(() => {
    let newpage = page - 1 > 0 ? page - 1 : 1;
    switchPageHandler(newpage);
  }, [page, switchPageHandler]);

  const nextPageHandler = useCallback(() => {
    let newpage = page + 1;
    switchPageHandler(newpage);
  }, [page, switchPageHandler]);

  const searchMemberHandler = useCallback(async () => {
    setIsLoading(true);
    let newMembers,
      newPage = 1,
      member,
      email = encodeURIComponent(inputRef.current.value);
    while (newPage <= pages && !member) {
      member = members[newPage]?.find((m) => m.email === email);
      if (!member) newPage = newPage + 1;
    }
    if (member) {
      switchPageHandler(newPage);
    } else {
      let result = await getMembers({ email, limit });
      if (result.page) {
        newPage = result.page;
        setMembers((prev) => {
          newMembers = { ...prev };
          newMembers[newPage] = result.members;
          return newMembers;
        });
        console.log(newMembers);
        switchPageHandler(newPage);
      } else {
        // ++TODO show member not found
        enqueueSnackbar(`${t("did_not_find_member")}`, {
          variant: "error",
          anchorOrigin: {
            vertical: "top",
            horizontal: "center",
          },
        });
      }
    }
    // filter({ members: memberList });
    setIsLoading(false);
  }, [pages, members, getMembers, limit, enqueueSnackbar, t]);

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        let members;
        setIsLoading(true);
        const result = await getMembers({ offset: (page - 1) * limit, limit });
        if (result.counts) {
          let pages = Math.ceil(result.counts / limit);
          setPages(pages);
          if (pages > 1) setNextPageIsExit("");
        }
        setMembers((prev) => {
          members = { ...prev };
          members[page] = result.members;
          return members;
        });
        console.log(`members`, members);
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
      <LoadingDialog isLoading={isLoading} />
      <section className="screen__section members">
        <div className="screen__header">{t("members-assets")}</div>
        {/* <ul className="screen__select-bar"></ul> */}
        <div className="screen__search-bar">
          <div className="screen__search-box">
            <input
              ref={inputRef}
              type="email"
              inputMode="search"
              className="screen__search-input"
              placeholder={t("search_member_email")} //輸入欲搜尋的關鍵字
              onInput={inputHandler}
            />
            <div
              className={`screen__search-icon${enableSearchButton}`}
              onClick={searchMemberHandler}
            >
              <div className="screen__search-icon--circle"></div>
              <div className="screen__search-icon--rectangle"></div>
            </div>
          </div>
        </div>
        <div className="screen__tool-bar">
          <div className="screen__display">
            <div className="screen__display-title">顯示：</div>
            <ul className="screen__display-options">
              <li
                className={`screen__display-option${filterOptionAll}`}
                // onClick={filterOptionAllHandler}
              >
                全部
              </li>
              {/* <li
                className={`screen__display-option${filterOptionAlert}`}
                onClick={filterOptionAlertHandler}
              >
                警示
              </li> */}
            </ul>
          </div>
        </div>
        <div className="screen__container">
          <table className="screen__table">
            <MemberList members={members[page]} />
            <tfoot className="screen__table-tools">
              <div
                className={`screen__table-tool${prevPageIsExit}`}
                onClick={prevPageHandler}
              >
                <div className="screen__table-tool--left"></div>
              </div>
              <div className="screen__page">{`${page}/${pages}`}</div>
              <div
                className={`screen__table-tool${nextPageIsExit}`}
                onClick={nextPageHandler}
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
