import { useTranslation } from "react-i18next";
import React, { useState, useContext, useEffect, useCallback } from "react";
import StoreContext from "../store/store-context";
import Dialog from "../components/Dialog";
import LoadingDialog from "../components/LoadingDialog";

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
      className={`user-setting__role-tag${props.isSelected ? " selected" : ""}`}
      data={props.roleKey}
      key={props.roleKey}
      onClick={props.onClick}
    >
      {t(props.roleKey)}
    </span>
  );
};

const AddUserDialog = (props) => {
  const { t } = useTranslation();
  const [user, setUser] = useState({});
  return (
    <Dialog
      className="user-setting__dialog-add"
      title="Add Administrator"
      onClose={props.onClose}
      onCancel={props.onCancel}
      onConfirm={() => {
        if (user.id && user.email && user.roles?.length > 0)
          props.onConfirm(user);
      }}
    >
      <>
        <div className="user-setting__dialog-inputs">
          <div className="user-setting__dialog-input-group">
            <label
              className="user-setting__dialog-input-label"
              htmlFor="user-setting-add-user-id"
            >
              {t("id")}:
            </label>
            <input
              className="user-setting__dialog-input-label"
              name="user-setting-add-user-id"
              type="number"
              inputMode="numeric"
              onChange={(e) => {
                setUser((prev) => ({ ...prev, id: e.target.value }));
              }}
            />
          </div>
          <div className="user-setting__dialog-input-group">
            <label
              className="user-setting__dialog-input-label"
              htmlFor="user-setting-add-user-email"
            >
              {t("email")}:
            </label>
            <input
              className="user-setting__dialog-input-label"
              name="user-setting-add-user-email"
              type="number"
              inputMode="numeric"
              onChange={(e) => {
                setUser((prev) => ({ ...prev, email: e.target.value }));
              }}
            />
          </div>
        </div>
        <div className="user-setting__dialog-content">
          <div className="user-setting__dialog-content--title">
            {t("permission")}:
          </div>
          <div className="user-setting__dialog-content--roles">
            {Object.keys(roles).map((key) => {
              return (
                <RoleTag
                  roleKey={key}
                  isSelected={user.roles?.includes(key)}
                  onClick={() => {
                    setUser((prev) => {
                      if (!prev.roles) prev.roles = [];
                      if (prev.roles.includes(key)) {
                        prev.roles = prev.roles.filter((role) => role !== key);
                      } else {
                        prev.roles = [...prev.roles, key];
                      }
                      console.log(`setUser prev`, prev);
                      return { ...prev };
                    });
                  }}
                />
              );
            })}
          </div>
        </div>
      </>
    </Dialog>
  );
};

const DeleteUserDialog = (props) => {
  const { t } = useTranslation();
  return (
    <Dialog
      className="user-setting__dialog-delete"
      title="Confirm"
      onClose={props.onClose}
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
    >
      <>
        <div className="user-setting__dialog--title">
          {t("remove-user-confirm")}
        </div>
        <div className="user-setting__dialog--content">
          <div className="user-setting__user-info">
            <div>{props.user.id}</div>
            <div>{props.user.email}</div>
          </div>
          <div className="user-setting__user-roles">
            {props.user.roles.map((role) => {
              return (
                <RoleTag
                  roleKey={role.toLowerCase().replace(" ", "-")}
                  isSelected={true}
                  onClick={() => {}}
                />
              );
            })}
          </div>
        </div>
      </>
    </Dialog>
  );
};

const UserDetail = (props) => {
  const { t } = useTranslation();
  const [isEdit, setIsEdit] = useState(false);
  const [updateRoles, setUpdateRoles] = useState([...props.user.roles]);

  const handleOnClick = (key) => {
    console.log(`updateRoles`, updateRoles);
    console.log(`handleOnClick key`, key);
    let _updateRoles,
      role = key.toLowerCase().replace("-", " ");
    if (Object.keys(roles).includes(role)) {
      _updateRoles = updateRoles.filter((_role) => _role !== role);
    } else {
      _updateRoles = updateRoles.concat(role);
    }
    console.log(`handleOnClick _updateRoles`, _updateRoles);
    setUpdateRoles(_updateRoles);
  };

  return (
    <tr
      className={`screen__table-row user-setting__detail${
        isEdit ? " editing" : ""
      }${props.selectedUser?.email === props.user.email ? " selected" : ""}`}
      key={`${props.user.name}-${props.user.id}`}
      onClick={props.onSelect}
    >
      <td className="screen__table-data">{props.user.id}</td>
      <td className="screen__table-data">{props.user.email}</td>
      <td className="screen__table-data user-setting__roles">
        {!isEdit
          ? props.user.roles.map((role) => {
              return (
                <RoleTag
                  roleKey={role.toLowerCase().replace(" ", "-")}
                  isSelected={true}
                  onClick={() => {}}
                />
              );
            })
          : Object.keys(roles).map((key) => {
              return (
                <RoleTag
                  roleKey={key}
                  isSelected={updateRoles.includes(roles[key].toLowerCase())}
                  onClick={() => handleOnClick(key)}
                />
              );
            })}
      </td>
      {isEdit === null && <div>{t("loading")}</div>}
      {isEdit !== null && (
        <td
          className="screen__table-data user-setting__setting-btn"
          onClick={() => {
            if (props.currentUser.roles.includes("root")) setIsEdit(true);
          }}
        >
          <div className="user-setting__setting-icon"></div>
          <div
            className="user-setting__setting-label"
            onClick={async () => {
              setIsEdit(null);
              let result = await props.editUser(props.user, roles); //TODO
              setIsEdit(false);
              if (!result) setUpdateRoles(props.user.roles);
            }}
          >
            儲存設定
          </div>
        </td>
      )}
    </tr>
  );
};

const UserSetting = (props) => {
  const storeCtx = useContext(StoreContext);
  const [showMore, setShowMore] = useState(false);
  const [isInit, setIsInit] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState(null);
  const [filteredAdminUsers, setFilteredAdminUsers] = useState(null);
  const [filterOptions, setFilterOptions] = useState(["all"]);
  const [filterKey, setFilterKey] = useState("");
  const [openAddUserDialog, setOpenAddUserDialog] = useState(true);
  const [openDeleteUserDialog, setOpenDeleteUserDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const editUser = useCallback(
    async (user, roles) => {
      console.log(`editUser user`, user);
      console.log(`editUser roles`, roles);
      let updateUser = { ...user };
      let index = adminUsers.findIndex(
        (adminUser) => adminUser.email === user.email
      );
      console.log(`editUser index`, index);
      if (index !== -1) {
        updateUser.roles = roles;
        const { result } = await storeCtx.updateAdminUser(
          props.currentUser,
          updateUser
        );
        console.log(`updateAdminUser result`, result);
        if (result) {
          let updateUsers = [...adminUsers];
          updateUsers[index] = updateUser;
          setAdminUsers(updateUsers);
        }
        return true;
      }
      return false;
    },
    [adminUsers, props.currentUser, storeCtx]
  );

  const getAdminUsers = useCallback(async () => {
    const { adminUsers: users } = await storeCtx.getAdminUsers();
    setAdminUsers(users);
    return users;
  }, [storeCtx]);

  const filter = useCallback(
    ({ users, option, keyword }) => {
      console.log(`filter option`, option);
      console.log(`filter keyword`, keyword);
      let _keyword = keyword === undefined ? filterKey : keyword,
        _users = users || filteredAdminUsers,
        _options = [...filterOptions];
      console.log(`filter _users`, _users);
      console.log(`filter _keyword`, _keyword);
      if (option) {
        if (option === "all") {
          _options = ["all"];
        } else {
          if (filterOptions.includes("all")) _options = [option];
          else {
            if (_options.includes(option)) {
              _options = _options.filter((_option) => _option !== option);
            } else {
              _options = _options.concat(option);
            }
          }
        }
        setFilterOptions(_options);
        console.log(`filter _options`, _options);
      }
      if (_users) {
        _users = _users.filter((user) => {
          if (option || keyword) console.log(`filter user`, user);
          let condition =
            user.email.includes(_keyword) ||
            user.id.includes(_keyword) ||
            user.name.includes(_keyword) ||
            user.roles.some((role) => role.includes(_keyword));
          if (option || keyword) console.log(`filter condition`, condition);
          if (!_options.includes("all"))
            condition =
              condition &&
              user.roles.some((role) =>
                _options.includes(role.replace("-", " "))
              );
          if (option || keyword) console.log(`filter condition`, condition);
          return condition;
        });
      }
      setFilteredAdminUsers(_users);
    },
    [filterKey, filterOptions, filteredAdminUsers]
  );

  const init = useCallback(() => {
    setIsInit(async (prev) => {
      if (!prev) {
        const users = await getAdminUsers();
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
    <>
      {isLoading && <LoadingDialog />}
      {openAddUserDialog && (
        <AddUserDialog
          onClose={() => setOpenAddUserDialog(false)}
          onCancel={() => {
            setOpenAddUserDialog(false);
          }}
          onConfirm={async (user) => {
            setOpenAddUserDialog(false);
            setIsLoading(true);
            await storeCtx.addAdminUser(user);
            setIsLoading(false);
          }}
        />
      )}
      {openDeleteUserDialog && (
        <DeleteUserDialog
          user={selectedUser}
          onClose={() => setOpenDeleteUserDialog(false)}
          onCancel={() => {
            setOpenDeleteUserDialog(false);
          }}
          onConfirm={async () => {
            setOpenDeleteUserDialog(false);
            setIsLoading(true);
            await storeCtx.deleteAdminUser(selectedUser);
            setIsLoading(false);
          }}
        />
      )}
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
              {["all", ...Object.keys(roles)].map((key) => (
                <OptionTag
                  option={key}
                  filterOptions={filterOptions}
                  filter={filter}
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
            <th className="screen__table-header"></th>
          </thead>
          <tbody className="screen__table-rows">
            {filteredAdminUsers &&
              Object.values(filteredAdminUsers)?.map((user) => (
                <UserDetail
                  user={user}
                  currentUser={props.currentUser}
                  editUser={editUser}
                  selectedUser={selectedUser}
                  onSelect={() => {
                    console.log(user);
                    setSelectedUser(user);
                  }}
                />
              ))}
          </tbody>
          <tfoot>
            <tr className="screen__table-tools">
              <div
                className="screen__table-tool"
                onClick={() => {
                  console.log(`selectedUser`, selectedUser);
                  if (selectedUser) {
                    console.log(`setOpenDeleteUserDialog true`);
                    setOpenDeleteUserDialog(true);
                  }
                }}
              >
                <div className="screen__table-tool-icon"></div>
              </div>
              <div
                className="screen__table-tool"
                onClick={() => {
                  console.log(`setOpenAddUserDialog true`);
                  setOpenAddUserDialog(true);
                }}
              >
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
    </>
  );
};

export default UserSetting;
