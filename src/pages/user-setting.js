import { useTranslation } from "react-i18next";
import React, { useState, useContext, useEffect, useCallback } from "react";
import { useSnackbar } from "notistack";
import StoreContext from "../store/store-context";
import Dialog from "../components/Dialog";
import LoadingDialog from "../components/LoadingDialog";
import ROLES from "../constant/Roles";

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
  const [hasError, setHasError] = useState(false);
  const validateEmail = (email) => {
    return String(email)
      .toLowerCase()
      .match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
      );
  };
  return (
    <Dialog
      open={props.open}
      className="user-setting__dialog-add"
      title="Add Administrator"
      onClose={props.onClose}
      onCancel={props.onCancel}
      onConfirm={() => {
        if (user.name && user.email && user.roles?.length > 0) {
          const isValid = validateEmail(user.email);
          if (isValid) props.onConfirm(user);
          else setHasError(true);
        }
      }}
    >
      <>
        <div className="user-setting__dialog-inputs">
          <div className="user-setting__dialog-input-group">
            <label
              className="user-setting__dialog-input-label"
              htmlFor="user-setting-add-user-id"
            >
              {t("name")}:
            </label>
            <input
              className="user-setting__dialog-input"
              name="user-setting-add-user-id"
              type="text"
              inputMode="text"
              onChange={(e) => {
                setUser((prev) => ({ ...prev, name: e.target.value }));
              }}
            />
          </div>
          <div
            className={`user-setting__dialog-input-group${
              hasError ? " error" : ""
            }`}
          >
            <label
              className="user-setting__dialog-input-label"
              htmlFor="user-setting-add-user-email"
            >
              {t("email")}:
            </label>
            <input
              className="user-setting__dialog-input"
              name="user-setting-add-user-email"
              type="text"
              inputmode="email"
              onChange={(e) => {
                if (hasError) setHasError(false);
                setUser((prev) => ({ ...prev, email: e.target.value.trim() }));
              }}
            />
            <div className="user-setting__dialog-input-message">
              {t("invail-email")}
            </div>
          </div>
        </div>
        <div className="user-setting__dialog-content">
          <div className="user-setting__dialog-content--title">
            {t("permission")}:
          </div>
          <div className="user-setting__dialog-content--roles">
            {Object.keys(ROLES).map((key) => {
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
      open={props.open}
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
            <div>{props.user?.id}</div>
            <div>{props.user?.email}</div>
          </div>
          <div className="user-setting__user-roles">
            {props.user?.roles?.map((role) => {
              return (
                <RoleTag roleKey={role} isSelected={true} onClick={() => {}} />
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
  const [isUpdate, setIsUpdate] = useState(false);
  const [updateRoles, setUpdateRoles] = useState([...props.user.roles]);

  const handleOnClick = (key) => {
    // console.log(`updateRoles`, updateRoles);
    // console.log(`handleOnClick key`, key);
    let _updateRoles;
    if (updateRoles.some((role) => role === key)) {
      _updateRoles = updateRoles.filter((_role) => _role !== key);
    } else {
      _updateRoles = updateRoles.concat(key);
    }
    // console.log(`handleOnClick _updateRoles`, _updateRoles);
    setUpdateRoles(_updateRoles);
    setIsUpdate(true);
  };

  return (
    <tr
      className={`screen__table-row user-setting__detail${
        isEdit === true ? " editing" : ""
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
                <RoleTag roleKey={role} isSelected={true} onClick={() => {}} />
              );
            })
          : Object.keys(ROLES).map((key) => {
              return (
                <RoleTag
                  roleKey={key}
                  isSelected={updateRoles.some((role) => role === key)}
                  onClick={() => handleOnClick(key)}
                />
              );
            })}
      </td>
      {isEdit === null && (
        <td className="screen__table-data user-setting__setting-btn">
          {t("loading")}
        </td>
      )}
      {isEdit !== null && (
        <td className="screen__table-data user-setting__setting-btn">
          <div
            className={`user-setting__setting-icon${
              props.currentUser.roles.includes("root") ? "" : " disabled"
            }`}
            onClick={() => {
              if (props.currentUser.roles.includes("root")) setIsEdit(true);
            }}
          ></div>
          <div
            className="user-setting__setting-label"
            onClick={async () => {
              if (isUpdate) {
                setIsEdit(null);
                let result = await props.editUser(props.user, updateRoles); //TODO
                if (!result) setUpdateRoles(props.user.roles);
                setIsUpdate(false);
              }
              setIsEdit(false);
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
  const { t } = useTranslation();
  const [showMore, setShowMore] = useState(false);
  const [isInit, setIsInit] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState(null);
  const [filteredAdminUsers, setFilteredAdminUsers] = useState(null);
  const [filterOptions, setFilterOptions] = useState(["all"]);
  const [filterKey, setFilterKey] = useState("");
  const [openAddUserDialog, setOpenAddUserDialog] = useState(false);
  const [openDeleteUserDialog, setOpenDeleteUserDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  // ++TODO customs snackbar https://notistack.com/features/customization
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const getAdminUsers = useCallback(async () => {
    const { adminUsers: users } = await storeCtx.getAdminUsers();
    setAdminUsers(users);
    return users;
  }, [storeCtx]);

  const filter = useCallback(
    ({ users, option, keyword }) => {
      // console.log(`filter option`, option);
      // console.log(`filter keyword`, keyword);
      let _keyword = keyword === undefined ? filterKey : keyword,
        _users = users || adminUsers,
        _options = [...filterOptions];
      // console.log(`filter _users`, _users);
      // console.log(`filter _keyword`, _keyword);
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
        // console.log(`filter _options`, _options);
      }
      if (_users) {
        _users = _users.filter((user) => {
          if (option || keyword) console.log(`filter user`, user);
          let condition =
            user.email.includes(_keyword) ||
            user.id.includes(_keyword) ||
            user.name.includes(_keyword) ||
            user.roles.some((role) => role.includes(_keyword));
          // if (option || keyword) console.log(`filter condition`, condition);
          if (!_options.includes("all"))
            condition =
              condition && user.roles.some((role) => _options.includes(role));
          // if (option || keyword) console.log(`filter condition`, condition);
          return condition;
        });
      }
      setFilteredAdminUsers(_users);
    },
    [adminUsers, filterKey, filterOptions]
  );

  const editUser = useCallback(
    async (user, roles) => {
      // console.log(`editUser user`, user);
      // console.log(`editUser roles`, roles);
      let isUpdated = false;
      let updateUser = { ...user };
      let index = adminUsers.findIndex(
        (adminUser) => adminUser.email === user.email
      );
      // console.log(`editUser index`, index);
      if (index !== -1) {
        updateUser.roles = roles;
        // console.log(`editUser updateUser`, updateUser);
        try {
          const { adminUsers } = await storeCtx.updateAdminUser(updateUser);
          // console.log(`updateAdminUser adminUsers`, adminUsers);
          setAdminUsers(adminUsers);
          isUpdated = true;
          filter({ users: adminUsers });
          enqueueSnackbar(`${t("success-update")}`, {
            variant: "success",
            anchorOrigin: {
              vertical: "top",
              horizontal: "center",
            },
          });
        } catch (error) {
          enqueueSnackbar(`${t("error-happen")}`, {
            variant: "error",
            anchorOrigin: {
              vertical: "top",
              horizontal: "center",
            },
          });
        }
      } else {
        // ++TODO
      }
      return isUpdated;
    },
    [adminUsers, enqueueSnackbar, filter, storeCtx, t]
  );

  const addUser = useCallback(
    async (user) => {
      setOpenAddUserDialog(false);
      setIsLoading(true);
      const index = adminUsers.findIndex(
        (adminUser) => adminUser.email === user.email
      );
      if (index === -1) {
        try {
          const { adminUsers: updateAdminUser } = await storeCtx.addAdminUser(
            user
          );
          setAdminUsers(updateAdminUser);
          filter({ users: updateAdminUser });
          enqueueSnackbar(`${t("success-update")}`, {
            variant: "success",
            anchorOrigin: {
              vertical: "top",
              horizontal: "center",
            },
          });
        } catch (error) {
          enqueueSnackbar(`${t("error-happen")}`, {
            variant: "error",
            anchorOrigin: {
              vertical: "top",
              horizontal: "center",
            },
          });
        }
      } else {
        enqueueSnackbar(`${t("email-exist")}`, {
          variant: "error",
          anchorOrigin: {
            vertical: "top",
            horizontal: "center",
          },
        });
      }
      setIsLoading(false);
    },
    [adminUsers, enqueueSnackbar, filter, storeCtx, t]
  );

  const deleteUser = useCallback(async () => {
    setOpenDeleteUserDialog(false);
    setIsLoading(true);
    try {
      const { adminUsers } = await storeCtx.deleteAdminUser(selectedUser);
      setAdminUsers(adminUsers);
      filter({ users: adminUsers });
      enqueueSnackbar(`${t("success-update")}`, {
        variant: "success",
        anchorOrigin: {
          vertical: "top",
          horizontal: "center",
        },
      });
    } catch (error) {
      enqueueSnackbar(`${t("error-happen")}`, {
        variant: "error",
        anchorOrigin: {
          vertical: "top",
          horizontal: "center",
        },
      });
    }
    setIsLoading(false);
  }, [enqueueSnackbar, filter, selectedUser, storeCtx, t]);

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
      <LoadingDialog isLoading={isLoading} />
      <AddUserDialog
        open={openAddUserDialog}
        onClose={() => setOpenAddUserDialog(false)}
        onCancel={() => {
          setOpenAddUserDialog(false);
        }}
        onConfirm={addUser}
      />
      <DeleteUserDialog
        open={openDeleteUserDialog}
        user={selectedUser}
        onClose={() => setOpenDeleteUserDialog(false)}
        onCancel={() => {
          setOpenDeleteUserDialog(false);
        }}
        onConfirm={deleteUser}
      />
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
              {["all", ...Object.keys(ROLES)].map((key) => (
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
                    setSelectedUser(user);
                  }}
                />
              ))}
          </tbody>
          <tfoot>
            <tr className="screen__table-tools">
              <div
                className={`screen__table-tool${
                  props.currentUser.roles.includes("root") ? "" : " disabled"
                }`}
                onClick={() => {
                  // console.log(`selectedUser`, selectedUser);
                  // console.log(
                  //   `props.currentUser`,
                  //   props.currentUser,
                  //   props.currentUser.roles.includes("root")
                  // );
                  if (
                    selectedUser &&
                    props.currentUser.roles.includes("root")
                  ) {
                    setOpenDeleteUserDialog(true);
                  }
                }}
              >
                <div className="screen__table-tool-icon"></div>
              </div>
              <div
                className={`screen__table-tool${
                  props.currentUser.roles.includes("root") ? "" : " disabled"
                }`}
                onClick={() => {
                  // console.log(
                  //   `props.currentUser`,
                  //   props.currentUser,
                  //   props.currentUser.roles.includes("root")
                  // );
                  if (props.currentUser.roles.includes("root"))
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
