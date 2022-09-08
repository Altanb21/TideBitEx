import { useTranslation } from "react-i18next";
import React, { useState, useContext, useEffect, useCallback } from "react";
import StoreContext from "../store/store-context";

const roles = {
  // all: "All",
  root: "Root",
  accountant: "Accountant",
  operating: "Operating",
  worker: "Worker",
  supervisor: "Supervisor",
  "withdraw-checker": "Withdraw checker",
  "deposit-checker": "Deposit checker",
  "kyc-checker": "KYC checker",
  "deposit-maker": "Deposit maker",
  "deposit-viewer": "Deposit viewer",
};

const OptionTag = (props) => {
  const { t } = useTranslation();
  return (
    <li
      className={`screen__display-option${
        props.filterOptions.includes(props.option) ? " active" : ""
      }`}
      onClick={() => props.filter({ option: props.option })}
    >
      {t(props.option)}
    </li>
  );
};

const RoleTag = (props) => {
  const { t } = useTranslation();
  return (
    <span
      className={`user-setting__role-tag${props.isSelected}? " selected": ""`}
      data={props.key}
    >
      {t(props.key)}
    </span>
  );
};

const UserDetail = (props) => {
  const [isEdit, setIsEdit] = useState(false);

  return (
    <tr
      className={`screen__table-row user-setting__detail${
        isEdit ? " editing" : ""
      }`}
      key={`${props.user.name}-${props.user.id}`}
    >
      <td className="screen__table-data">{props.user.id}</td>
      <td className="screen__table-data">{props.user.email}</td>
      <td className="screen__table-data user-setting__roles">
        {isEdit
          ? props.user.roles.map((role) => (
              <RoleTag
                key={role.toLowerCase().replace(" ", "-")}
                isSelected={true}
              />
            ))
          : Object.keys(roles).map((key) => (
              <RoleTag
                key={key}
                isSelected={props.user.roles.includes(roles[key])}
              />
            ))}
      </td>
      <td
        className="screen__table-data user-setting__setting-btn"
        onClick={() => setIsEdit(true)}
      >
        <div className="screen__table-data user-setting__setting-icon"></div>
        <div
          className="screen__table-data user-setting__setting-label"
          onClick={() => {
            props.updateUserRole(); //TODO
            setIsEdit(true);
          }}
        >
          儲存設定
        </div>
      </td>
    </tr>
  );
};

const UserSetting = () => {
  const storeCtx = useContext(StoreContext);
  const [showMore, setShowMore] = useState(false);
  const [isInit, setIsInit] = useState(null);
  const [users, setUsers] = useState(null);
  const [filterUsers, setFilterUsers] = useState(null);
  const [filterOptions, setFilterOptions] = useState(["all"]); //'deposit','withdraw','transfer', 'transaction'
  const [filterKey, setFilterKey] = useState("");

  const getAdminUsers = useCallback(async () => {
    const { adminUsers: users } = await storeCtx.getAdminUsers();
    console.log(`getAdminUsers users`, users);
    setUsers(users);
  }, [storeCtx]);

  const filter = useCallback(
    ({ users, option, keyword }) => {
      let index,
        options = [...filterOptions];
      console.log(`filter option`, option);
      if (option) {
        if (option === "all") options = ["all"];
        else {
          if (options.includes(option)) {
            index = options.findIndex((op) => op === option);
            options.splice(index, 1);
          } else {
            index = options.findIndex((op) => op === "all");
            if (index > -1) {
              options.splice(index, 1);
            }
            options.push(option);
          }
        }
        if (options.length === 0) options = ["all"];
        setFilterOptions(options);
      }
      let _users = filterUsers || users,
        _keyword = keyword === undefined ? filterKey : keyword;
      if (_users) {
        // _users = Object.values(_users).filter((user) => {
        //   let condition =  user.roles.some(role=> role.includes(_keyword))
        //   if (options !== "all")
        //     condition = condition && user.roles.some(role=> role.includes(options)) ;
        //     return condition;
        // });
        setFilterUsers(_users);
      }
    },
    [filterKey, filterOptions, filterUsers]
  );

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        const users = await getAdminUsers();
        setUsers(users);
        filter({ users: users });
        return !prev;
      } else return prev;
    });
  }, [getAdminUsers, filter]);

  useEffect(() => {
    if (!isInit) {
      init();
    }
  }, [init, isInit]);

  return (
    <section className="screen__section user-setting">
      <div className="screen__header">管理人員設定</div>
      {/* <ScreenTags
        selectedTag={selectedTag}
        selectTagHandler={selectTagHandler}
        data={currencies}
      /> */}
      <div className="screen__search-bar">
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
      </div>
      <div className="screen__tool-bar">
        <div className="screen__display">
          <div className="screen__display-title">顯示：</div>
          <ul className="screen__display-options">
            {Object.keys(roles).map((role) => (
              <OptionTag
                option={role}
                filterOptions={filterOptions}
                onClick={filter}
              />
            ))}
          </ul>
        </div>
        {/* <div className="screen__sorting">
          <img src="/img/sorting@2x.png" alt="sorting" />
        </div> */}
      </div>
      <table className={`screen__table${showMore ? " show" : ""}`}>
        <tr className="screen__table-title">管理人員名單</tr>
        <thead className="screen__table-headers">
          <th className="screen__table-header">管理人員 ID</th>
          <th className="screen__table-header">E-mail</th>
          <th className="screen__table-header">權限</th>
        </thead>
        <tbody className="screen__table-rows">
          {filterUsers &&
            Object.values(filterUsers)?.map((user) => (
              <UserDetail user={user} />
            ))}
        </tbody>
        <tfoot>
          <tr className="screen__table-tools">
            <div className="screen__table-tool" onClick={() => {}}>
              <div className="screen__table-tool-icon"></div>
            </div>
            <div className="screen__table-tool" onClick={() => {}}>
              <div className="screen__table-tool-icon"></div>
            </div>
          </tr>
          <div
            className="screen__table-btn screen__table-text"
            onClick={() => setShowMore((prev) => !prev)}
          >
            {showMore ? "顯示更少" : "顯示更多"}
          </div>
        </tfoot>
      </table>
      <div className="screen__floating-box">
        <div
          className="screen__floating-btn"
          onClick={() => {
            const screenSection =
              window.document.querySelector(".screen__section");
            // console.log(screenSection.scrollTop)
            screenSection.scroll(0, 0);
          }}
        >
          <img src="/img/floating-btn@2x.png" alt="arrow" />
        </div>
      </div>
    </section>
  );
};

export default UserSetting;
