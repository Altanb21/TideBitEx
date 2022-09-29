const path = require("path");
const axios = require("axios");

const Bot = require(path.resolve(__dirname, "Bot.js"));
const OkexConnector = require("../libs/Connectors/OkexConnector");
const TideBitConnector = require("../libs/Connectors/TideBitConnector");
const ResponseFormat = require("../libs/ResponseFormat");
const Codes = require("../constants/Codes");
const EventBus = require("../libs/EventBus");
const Events = require("../constants/Events");
const SafeMath = require("../libs/SafeMath");
const Utils = require("../libs/Utils");
const SupportedExchange = require("../constants/SupportedExchange");
const DepthBook = require("../libs/Books/DepthBook");
const TradeBook = require("../libs/Books/TradeBook");
const TickerBook = require("../libs/Books/TickerBook");
const OrderBook = require("../libs/Books/OrderBook");
const AccountBook = require("../libs/Books/AccountBook");
const ExchangeHubService = require("../libs/services/ExchangeHubServices");
const Database = require("../constants/Database");
const ROLES = require("../constants/Roles");
const { COIN_SETTING_TYPE } = require("../constants/CoinSetting");
const {
  TICKER_SETTING_TYPE,
  TICKER_SETTING_FEE_SIDE,
} = require("../constants/TickerSetting");
const { PLATFORM_ASSET } = require("../../src/constant/PlatformAsset");

class ExchangeHub extends Bot {
  fetchedOrders = {};
  fetchedOrdersInterval = 1 * 60 * 1000;
  systemMemberId;
  okexBrokerId;
  updateDatas = [];
  adminUsers;
  coinsSettings;
  depositsSettings;
  withdrawsSettings;
  constructor() {
    super();
    this.name = "ExchangeHub";
    this.fetchedTickers = false;
  }

  init({ config, database, logger, i18n }) {
    this.okexBrokerId = config.okex.brokerId;
    this.systemMemberId = config.peatio.systemMemberId;
    return super
      .init({ config, database, logger, i18n })
      .then(async () => {
        this.tidebitMarkets = this.getTidebitMarkets();
        this.tickersSettings = this._getTickersSettings();
        this.adminUsers = this._getAdminUsers();
        this.coinsSettings = this._getCoinsSettings();
        this.depositsSettings = this._getDepositsSettings();
        this.withdrawsSettings = this._getWithdrawsSettings();
        this.priceList = await this.getPriceList();
        this.tickerBook = new TickerBook({
          logger,
          markets: this.tidebitMarkets,
          tickersSettings: this.tickersSettings,
        });
        this.depthBook = new DepthBook({
          logger,
          markets: this.tidebitMarkets,
        });
        this.tradeBook = new TradeBook({
          logger,
          markets: this.tidebitMarkets,
        });
        this.orderBook = new OrderBook({
          logger,
          markets: this.tidebitMarkets,
        });
        this.accountBook = new AccountBook({
          logger,
          markets: this.tidebitMarkets,
          coinsSettings: this.coinsSettings,
          priceList: this.priceList,
        });
      })
      .then(async () => {
        this.tideBitConnector = new TideBitConnector({ logger });
        await this.tideBitConnector.init({
          app: this.config.pusher.app,
          key: this.config.pusher.key,
          secret: this.config.pusher.secret,
          wsProtocol: this.config.pusher.protocol,
          wsHost: this.config.pusher.host,
          port: this.config.pusher.port,
          wsPort: this.config.pusher.wsPort,
          wssPort: this.config.pusher.wssPort,
          encrypted: this.config.pusher.encrypted,
          peatio: this.config.peatio.domain,
          redis: this.config.redis.domain,
          database: database,
          tickerBook: this.tickerBook,
          depthBook: this.depthBook,
          tradeBook: this.tradeBook,
          orderBook: this.orderBook,
          accountBook: this.accountBook,
          tickersSettings: this.tickersSettings,
          coinsSettings: this.coinsSettings,
          websocketDomain: this.config.websocket.domain,
        });
        this.okexConnector = new OkexConnector({ logger });
        await this.okexConnector.init({
          domain: this.config.okex.domain,
          apiKey: this.config.okex.apiKey,
          secretKey: this.config.okex.secretKey,
          passPhrase: this.config.okex.passPhrase,
          brokerId: this.config.okex.brokerId,
          wssPublic: this.config.okex.wssPublic,
          wssPrivate: this.config.okex.wssPrivate,
          tickerBook: this.tickerBook,
          depthBook: this.depthBook,
          tradeBook: this.tradeBook,
          orderBook: this.orderBook,
          accountBook: this.accountBook,
          database: this.database,
          tickersSettings: this.tickersSettings,
        });
        this.exchangeHubService = new ExchangeHubService({
          database,
          systemMemberId: this.config.peatio.systemMemberId,
          okexConnector: this.okexConnector,
          tidebitMarkets: this.tidebitMarkets,
          emitUpdateData: (updateData) => this.emitUpdateData(updateData),
          logger,
        });
        return this;
      });
  }

  async start() {
    await super.start();
    await this.okexConnector.start();
    this._eventListener();
    await this.exchangeHubService.sync(SupportedExchange.OKEX, null, true);
    return this;
  }

  emitUpdateData(updateData) {
    this.logger.log(`upateData`, updateData);
    if (updateData) {
      for (const data of updateData) {
        const memberId = data.memberId,
          market = data.market,
          instId = data.instId,
          updateOrder = data.updateOrder,
          newTrade = data.newTrade,
          updateAskAccount = data.updateAskAccount,
          updateBidAccount = data.updateBidAccount;
        if (updateOrder && memberId && instId) {
          this._emitUpdateOrder({
            memberId,
            instId,
            market,
            order: updateOrder,
          });
        }
        if (newTrade) {
          this._emitNewTrade({
            memberId,
            instId,
            market,
            trade: newTrade,
          });
        }
        if (updateAskAccount) {
          this._emitUpdateAccount({
            memberId,
            account: updateAskAccount,
          });
        }
        if (updateBidAccount) {
          this._emitUpdateAccount({
            memberId,
            account: updateBidAccount,
          });
        }
      }
    }
  }

  _getAdminUsers() {
    let users, adminUsers;
    try {
      const p = path.join(
        this.config.base.TideBitLegacyPath,
        "config/roles.yml"
      );
      users = Utils.fileParser(p);
      adminUsers = users.reduce((prev, user) => {
        const index = prev.findIndex((_usr) => _usr.email === user.email);
        if (index === -1) {
          prev = [
            ...prev,
            {
              ...user,
              roles: user.roles.map((role) =>
                role?.replace(" ", "_").toLowerCase()
              ),
            },
          ];
        } else {
          prev[index].roles = prev[index].roles.concat(
            user.roles.map((role) => role?.replace(" ", "_").toLowerCase())
          );
        }
        return prev;
      }, []);
      this.adminUsers = adminUsers;
    } catch (error) {
      this.logger.error(error);
      process.exit(1);
    }
    return adminUsers;
  }

  async getAdminUsers({ query }) {
    if (!this.adminUsers) {
      this.adminUsers = this._getAdminUsers();
    }
    // this.logger.log(`-*-*-*-*- getAdminUsers -*-*-*-*-`, adminUsers);
    return Promise.resolve(
      new ResponseFormat({
        message: "getAdminUsers",
        payload: {
          adminUsers: this.adminUsers,
        },
      })
    );
  }

  _getTickersSettings() {
    let tickersSettings;
    try {
      const p = path.join(
        this.config.base.TideBitLegacyPath,
        "config/markets/markets.yml"
      );
      const obj = Utils.fileParser(p);
      tickersSettings = obj.reduce((prev, ticker) => {
        const instId = ticker.name.split("/").join("-").toUpperCase();
        prev[ticker.id] = {
          id: ticker.id,
          instId,
          code: ticker.code,
          name: ticker.name,
          market: ticker.id,
          baseUnit: ticker.base_unit,
          quoteUnit: ticker.quote_unit,
          ask: {
            fee: ticker.ask?.fee,
            currency: ticker.ask?.currency,
            fixed: ticker.ask?.fixed,
            heroFee: ticker.ask?.hero_fee,
            vipFee: ticker.ask?.vip_fee,
          },
          bid: {
            fee: ticker.bid?.fee,
            currency: ticker.bid?.currency,
            fixed: ticker.bid?.fixed,
            heroFee: ticker.bid?.hero_fee,
            vipFee: ticker.bid?.vip_fee,
          },
          sortOrder: ticker.sort_order,
          primary: ticker.primary,
          visible: ticker.visible !== false ? true : false,
          instType: "",
          group: ticker.tab_category || "others",
          pricescale: ticker.price_group_fixed,
          source: !ticker.source ? SupportedExchange.TIDEBIT : ticker.source,
          exchanges: !ticker.exchanges
            ? [SupportedExchange.TIDEBIT]
            : ticker.exchanges,
          tickSz: Utils.getDecimal(ticker?.bid?.fixed),
          lotSz: Utils.getDecimal(ticker?.ask?.fixed),
          minSz: Utils.getDecimal(ticker?.ask?.fixed),
        };
        return prev;
      }, {});
    } catch (error) {
      this.logger.error(error);
      process.exit(1);
    }
    return tickersSettings;
  }

  // _getCoinsSettings({ query }) {
  _getCoinsSettings() {
    let coinsSettings;
    if (!this.coinsSettings) {
      try {
        const p = path.join(
          this.config.base.TideBitLegacyPath,
          "config/markets/coins.yml"
        );
        coinsSettings = Utils.fileParser(p);
        this.coinsSettings = coinsSettings.map((coinSetting) => ({
          ...coinSetting,
          visible: coinSetting.visible === false ? false : true, // default: true
          disable: coinSetting.disable === true ? true : false, // default: false
        }));
      } catch (error) {
        this.logger.error(error);
        process.exit(1);
      }
    }
    // this.logger.log(`-*-*-*-*- getCoinsSettings -*-*-*-*-`, coinsSettings);
    return this.coinsSettings;
  }

  // _getDepositsSettings({ query }) {
  _getDepositsSettings() {
    let depositsSettings, formatDepositsSettings;
    if (!this.depositsSettings) {
      try {
        const p = path.join(
          this.config.base.TideBitLegacyPath,
          "config/markets/deposits.yml"
        );
        depositsSettings = Utils.fileParser(p);
        formatDepositsSettings = depositsSettings.reduce((prev, deposit) => {
          if (!prev[deposit.id.toString()])
            prev[deposit.id.toString()] = {
              ...deposit,
              visible: deposit.visible === false ? false : true, // default: true
              disable: deposit.disable === true ? true : false, // default: false
            };
          else
            this.logger.error(
              `[config/deposits.yml] duplicate deposit`,
              prev[deposit.id.toString()],
              deposit
            );
          return prev;
        }, {});
        // this.logger.log(`-*-*-*-*- getDepositsSettings -*-*-*-*-`, depositsSettings);
        this.depositsSettings = formatDepositsSettings;
      } catch (error) {
        this.logger.error(error);
        process.exit(1);
      }
    }
    return this.depositsSettings;
    // return Promise.resolve(
    //   new ResponseFormat({
    //     message: "getDepositsSettings",
    //     payload: {
    //       depositsSettings: this.depositsSettings,
    //     },
    //   })
    // );
  }

  // getWithdrawsSettings({ query }) {
  _getWithdrawsSettings() {
    let withdrawsSettings, formatWithdrawsSettings;
    if (!this.withdrawsSettings) {
      try {
        const p = path.join(
          this.config.base.TideBitLegacyPath,
          "config/markets/withdraws.yml"
        );
        withdrawsSettings = Utils.fileParser(p);
        formatWithdrawsSettings = withdrawsSettings.reduce((prev, withdraw) => {
          if (!prev[withdraw.id.toString()])
            prev[withdraw.id.toString()] = {
              ...withdraw,
              visible: withdraw.visible === false ? false : true, // default: true
              disable: withdraw.disable === true ? true : false, // default: false
            };
          else
            this.logger.error(
              `[config/withdraws.yml] duplicate withdraw`,
              prev[withdraw.id.toString()],
              withdraw
            );
          return prev;
        }, {});
        // this.logger.log(`-*-*-*-*- getWithdrawsSettings -*-*-*-*-`, withdrawsSettings);
        this.withdrawsSettings = formatWithdrawsSettings;
      } catch (error) {
        this.logger.error(error);
        process.exit(1);
      }
    }
    return this.withdrawsSettings;
    // return Promise.resolve(
    //   new ResponseFormat({
    //     message: "getWithdrawsSettings",
    //     payload: {
    //       withdrawsSettings:  this.withdrawsSettings,
    //     },
    //   })
    // );
  }

  formatCoinsSettings() {
    let coins;
    if (!this.coinsSettings) this._getCoinsSettings();
    if (!this.depositsSettings) this._getDepositsSettings();
    if (!this.withdrawsSettings) this._getWithdrawsSettings();
    coins = this.coinsSettings
      .filter((coin) => coin.coin && coin.marketing_category)
      .map((coin) => {
        const formatCoin = {
          id: coin.id,
          key: coin.key,
          code: coin.code,
          symbol: coin.symbol,
          coin: coin.coin,
          visible: coin.visible,
          marketingCategory: coin.marketing_category,
          precision: coin.id || 2,
          selfTransfer: coin.self_transfer,
          minConfirm: this.depositsSettings[coin.id]?.min_confirm,
          maxConfirm: this.depositsSettings[coin.id]?.max_confirm,
          deposit:
            this.depositsSettings[coin.id]?.visible &&
            !this.depositsSettings[coin.id]?.disable,
          depositFee: this.depositsSettings[coin.id]?.fee || "0",
          withdraw:
            this.withdrawsSettings[coin.id]?.visible &&
            !this.withdrawsSettings[coin.id]?.disable,
          withdrawFee: this.withdrawsSettings[coin.id]?.fee || "0",
          alert: coin.code === "btc", // ++ TODO
        };
        return formatCoin;
      });
    return coins;
  }

  getCoinsSettings({ query }) {
    return Promise.resolve(
      new ResponseFormat({
        message: "getCoinsSettings",
        payload: {
          coins: this.formatCoinsSettings(),
        },
      })
    );
  }

  async getPlatformAssets({ email, query }) {
    this.logger.debug(
      `*********** [${this.name}] getPlatformAssets ************`
    );
    let result = null,
      coins = {},
      coinsSettings,
      sources = {},
      hasError = false; //,
    // currentUser = this.adminUsers.find((user) => user.email === email);
    // this.logger.log(
    //   `currentUser[${currentUser.roles?.includes("root")}]`,
    //   currentUser
    // );
    // if (currentUser.roles?.includes("root")) {

    for (let exchange of Object.keys(SupportedExchange)) {
      let source = SupportedExchange[exchange];

      switch (source) {
        // okx api 拿 balance 的資料
        case SupportedExchange.OKEX:
          let response = await this.okexConnector.router("getBalances", {
            query: {},
          });
          if (response.success) {
            sources[exchange] = response.payload;
          } else {
            this.logger.error(response);
            hasError = true;
            result = new ResponseFormat({
              message: "",
              code: Codes.API_UNKNOWN_ERROR,
            });
          }
          break;
        case SupportedExchange.TIDEBIT:
          break;
        default:
      }
    }
    if (!hasError) {
      try {
        coinsSettings = this.coinsSettings.reduce((prev, coinSetting) => {
          if (!prev[coinSetting.id.toString()])
            prev[coinSetting.id.toString()] = { ...coinSetting };
          return prev;
        }, {});
        // 需拿交易所所有用戶餘額各幣種的加總
        const _accounts = await this.database.getAccounts();
        for (let _account of _accounts) {
          let coinSetting = coinsSettings[_account.currency.toString()];
          if (!coins[coinSetting.code]) {
            coins[coinSetting.code] = {
              id: coinSetting.id,
              key: coinSetting.key,
              code: coinSetting.code,
              symbol: coinSetting.symbol,
              coin: coinSetting.coin,
              visible: coinSetting.visible,
              disable: coinSetting.disable,
              group: coinSetting.marketing_category,
              accounts: {},
              sum: "0",
              RRRRatio: coinSetting.RRRRatio || 0.35,
              MPARatio: coinSetting.MPARatio || 0.65,
              sources: {},
            };
            // this.logger.log(
            //   `getPlatformAssets coins[${coinSetting.code}]`,
            //   coins[coinSetting.code]
            // );
            for (let exchange of Object.keys(SupportedExchange)) {
              switch (SupportedExchange[exchange]) {
                case SupportedExchange.OKEX:
                  // this.logger.log(
                  //   `getPlatformAssets  sources[${exchange}][${coinSetting.code}]`,
                  //   sources[exchange][coinSetting.code]
                  // );
                  coins[coinSetting.code]["sources"][exchange.toLowerCase()] = {
                    balance:
                      sources[exchange][coinSetting.code]?.balance || "0",
                    locked: sources[exchange][coinSetting.code]?.locked || "0",
                    sum: sources[exchange][coinSetting.code]?.sum || "0",
                    alertLevel: undefined,
                  };
                  break;
                case SupportedExchange.TIDEBIT:
                  // ++ TODO 現階段資料拿不到 Tidebit ，顯示 0
                  coins[coinSetting.code]["sources"][exchange.toLowerCase()] = {
                    balance: "0",
                    locked: "0",
                    alertLevel: PLATFORM_ASSET.WARNING_LEVEL.NULL,
                  };
                  break;
                default:
              }
            }
          }
          coins[coinSetting.code].accounts = {
            ...coins[coinSetting.code].accounts,
          };
          coins[coinSetting.code].accounts[_account.member_id] = {
            balance: Utils.removeZeroEnd(_account.balance),
            locked: Utils.removeZeroEnd(_account.locked),
            updatedAt: _account.updated_at,
          };
          let sum = SafeMath.plus(_account.balance, _account.locked);
          coins[coinSetting.code].sum = SafeMath.plus(
            coins[coinSetting.code].sum,
            sum
          );
        }
        this.logger.log(`getPlatformAssets coins`, coins);
        coins = Object.values(coins).reduce((prev, coin) => {
          const RRR = SafeMath.mult(coin.RRRRatio, coin.sum);
          const MPA = SafeMath.mult(coin.MPARatio, coin.sum);
          let sources = Object.keys(coin.sources).reduce(
            (prevSources, source) => {
              let alertLevel;
              if (SafeMath.lte(coin.sources[source].sum, MPA)) {
                alertLevel = PLATFORM_ASSET.WARNING_LEVEL.LEVEL_2;
              } else if (SafeMath.lte(coin.sources[source].sum, RRR)) {
                alertLevel = PLATFORM_ASSET.WARNING_LEVEL.LEVEL_3;
              } else if (SafeMath.eq(coin.sources[source].sum, 0)) {
                alertLevel = PLATFORM_ASSET.WARNING_LEVEL.NULL;
              } else {
                alertLevel = PLATFORM_ASSET.WARNING_LEVEL.LEVEL_1;
              }
              prevSources[source] = {
                ...coin.sources[source],
                alertLevel,
              };
              return prevSources;
            },
            {}
          );
          prev[coin.code] = { ...coin, sources };
          return prev;
        }, {});
        this.logger.log(`getPlatformAssets coins`, coins);
        result = new ResponseFormat({
          message: "getCoinsSettings",
          payload: coins,
        });
        // 需要有紀錄水位限制的檔案，預計加在 coins.yml
      } catch (error) {
        this.logger.error(error);
        let message = error.message;
        result = new ResponseFormat({
          message,
          code: Codes.API_UNKNOWN_ERROR,
        });
      }
    }
    // }else{
    //   result = new ResponseFormat({
    //     message: "Current user is not allow to update ticker settings",
    //     code: Codes.INVALID_INPUT,
    //   });
    // }
    return result;
  }

  async updateTickerSetting({ params, email, body }) {
    const p = path.join(
      this.config.base.TideBitLegacyPath,
      "config/markets/markets.yml"
    );
    this.logger.debug(
      `*********** [${this.name}] updateTickerSetting ************`
    );
    this.logger.log(`params.id`, params.id);
    this.logger.log(`email`, email);
    this.logger.log(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    this.logger.log(
      `currentUser[${currentUser.roles?.includes("root")}]`,
      currentUser
    );
    try {
      const { type, data } = body;
      this.logger.log(`type`, type);
      this.logger.log(`data`, data);
      if (currentUser.roles?.includes("root")) {
        if (this.tickersSettings[params.id]) {
          let updatedTickersSettings = Object.values(
            this.tickersSettings
          ).reduce((prev, tickerSetting) => {
            prev[tickerSetting.id.toString()] = {
              id: tickerSetting.id,
              code: tickerSetting.code,
              name: tickerSetting.name,
              base_unit: tickerSetting.baseUnit,
              quote_unit: tickerSetting.quoteUnit,
              bid: {
                fee: tickerSetting.bid.fee,
                currency: tickerSetting.bid.currency,
                fixed: tickerSetting.bid.fixed,
                hero_fee: tickerSetting.bid.heroFee,
                vip_fee: tickerSetting.bid.vipFee,
              },
              ask: {
                fee: tickerSetting.ask.fee,
                currency: tickerSetting.ask.currency,
                fixed: tickerSetting.ask.fixed,
                hero_fee: tickerSetting.ask.heroFee,
                vip_fee: tickerSetting.ask.vipFee,
              },
              sort_order: tickerSetting.sortOrder,
              tab_category: tickerSetting.group,
              primary: tickerSetting.primary,
              visible: tickerSetting.visible,
              price_group_fixed: tickerSetting.pricescale,
              source: tickerSetting.source,
              exchanges: tickerSetting.exchanges,
            };
            return prev;
          }, {});

          switch (type) {
            case TICKER_SETTING_TYPE.VISIBLE:
              if (
                updatedTickersSettings[params.id].source ===
                SupportedExchange.OKEX
              ) {
                if (data.visible)
                  this.okexConnector.subscribeTicker(
                    this.tickersSettings[params.id].instId
                  );
                else
                  this.okexConnector.unsubscribeTicker(
                    this.tickersSettings[params.id].instId
                  );
              }
              updatedTickersSettings[params.id] = {
                ...updatedTickersSettings[params.id],
                visible: data.visible,
              };
              break;
            case TICKER_SETTING_TYPE.SOURCE:
              if (data.source === SupportedExchange.OKEX)
                this.okexConnector.subscribeTicker(
                  this.tickersSettings[params.id].instId
                );
              else if (
                data.source !== SupportedExchange.OKEX &&
                updatedTickersSettings[params.id].source ===
                  SupportedExchange.OKEX
              )
                this.okexConnector.unsubscribeTicker(
                  this.tickersSettings[params.id].instId
                );
              updatedTickersSettings[params.id] = {
                ...updatedTickersSettings[params.id],
                source: data.source,
              };
              break;
            case TICKER_SETTING_TYPE.FEE:
              switch (data.side) {
                case TICKER_SETTING_FEE_SIDE.BID:
                  updatedTickersSettings[params.id] = {
                    ...updatedTickersSettings[params.id],
                    bid: {
                      ...updatedTickersSettings[params.id].bid,
                      fee: parseFloat(data.fee.defaultFee), // +TODO 需要確認
                      hero_fee: parseFloat(data.fee.heroFee),
                      vip_fee: parseFloat(data.fee.vipFee),
                    },
                  };
                  break;
                case TICKER_SETTING_FEE_SIDE.ASK:
                  updatedTickersSettings[params.id] = {
                    ...updatedTickersSettings[params.id],
                    ask: {
                      ...updatedTickersSettings[params.id].ask,
                      fee: parseFloat(data.fee.defaultFee), // +TODO 需要確認
                      hero_fee: parseFloat(data.fee.heroFee),
                      vip_fee: parseFloat(data.fee.vipFee),
                    },
                  };
                  break;
                default:
                  break;
              }

              break;
            default:
              break;
          }
          this.logger.log(
            `updatedTickersSettings[${params.id}]`,
            updatedTickersSettings[params.id]
          );
          try {
            Utils.yamlUpdate(Object.values(updatedTickersSettings), p);
            this.tickersSettings = Object.values(updatedTickersSettings).reduce(
              (prev, ticker) => {
                const instId = ticker.name.split("/").join("-").toUpperCase();
                prev[ticker.id] = {
                  id: ticker.id,
                  instId,
                  code: ticker.code,
                  name: ticker.name,
                  market: ticker.id,
                  baseUnit: ticker.base_unit,
                  quoteUnit: ticker.quote_unit,
                  ask: {
                    fee: ticker.ask?.fee,
                    currency: ticker.ask?.currency,
                    fixed: ticker.ask?.fixed,
                    heroFee: ticker.ask?.hero_fee,
                    vipFee: ticker.ask?.vip_fee,
                  },
                  bid: {
                    fee: ticker.bid?.fee,
                    currency: ticker.bid?.currency,
                    fixed: ticker.bid?.fixed,
                    heroFee: ticker.bid?.hero_fee,
                    vipFee: ticker.bid?.vip_fee,
                  },
                  sortOrder: ticker.sort_order,
                  primary: ticker.primary,
                  visible: ticker.visible !== false ? true : false,
                  instType: "",
                  group: ticker.tab_category || "others",
                  pricescale: ticker.price_group_fixed,
                  source: !ticker.source
                    ? SupportedExchange.TIDEBIT
                    : ticker.source,
                  exchanges: !ticker.exchanges
                    ? [SupportedExchange.TIDEBIT]
                    : ticker.exchanges,
                  tickSz: Utils.getDecimal(ticker?.bid?.fixed),
                  lotSz: Utils.getDecimal(ticker?.ask?.fixed),
                  minSz: Utils.getDecimal(ticker?.ask?.fixed),
                };
                return prev;
              },
              {}
            );
            this.tickerBook.updateTickersSettings(this.tickersSettings);
            result = new ResponseFormat({
              message: "updateTickerSetting",
              payload: this.tickerBook.getSnapshot(),
            });
          } catch (e) {
            this.logger.error(
              `yamlUpdate updateTickerSetting`,
              updatedTickersSettings,
              e
            );
            result = new ResponseFormat({
              message: "Internal server error",
              code: Codes.UNKNOWN_ERROR,
            });
          }
        } else {
          result = new ResponseFormat({
            message: "Update ticker is not existed",
            code: Codes.INVALID_INPUT,
          });
        }
      } else {
        result = new ResponseFormat({
          message: "Current user is not allow to update ticker settings",
          code: Codes.INVALID_INPUT,
        });
      }
    } catch (e) {
      this.logger.error(`updateTickerSetting`, e);
      result = new ResponseFormat({
        message: "Internal server error",
        code: Codes.UNKNOWN_ERROR,
      });
    }
    return Promise.resolve(result);
  }

  async updateCoinSetting({ params, email, body }) {
    const p = path.join(
      this.config.base.TideBitLegacyPath,
      "config/markets/coins.yml"
    );
    this.logger.debug(
      `*********** [${this.name}] updateCoinSetting ************`
    );
    this.logger.log(`params.id`, params.id);
    this.logger.log(`email`, email);
    this.logger.log(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    this.logger.log(
      `currentUser[${currentUser.roles?.includes("root")}]`,
      currentUser
    );
    try {
      const { visible } = body;
      this.logger.log(`visible`, visible);
      if (currentUser.roles?.includes("root")) {
        let index = this.coinsSettings.findIndex(
          (coin) => coin.id.toString() === params.id.toString()
        );
        this.logger.log(`index`, index);
        if (index !== -1) {
          let updatedCoinsSettings = this.coinsSettings.map((coin) => ({
            ...coin,
          }));
          updatedCoinsSettings[index] = {
            ...updatedCoinsSettings[index],
            visible: visible,
          };
          this.logger.log(
            `updatedCoinsSettings[${index}]`,
            updatedCoinsSettings[index]
          );
          try {
            Utils.yamlUpdate(updatedCoinsSettings, p);
            this.coinsSettings = updatedCoinsSettings;
            result = new ResponseFormat({
              message: "updateCoinSetting",
              payload: {
                coins: this.formatCoinsSettings(),
              },
            });
          } catch (e) {
            this.logger.error(
              `yamlUpdate updateCoinSetting`,
              updatedCoinsSettings,
              e
            );
            result = new ResponseFormat({
              message: "Internal server error",
              code: Codes.UNKNOWN_ERROR,
            });
          }
        } else {
          result = new ResponseFormat({
            message: "Update coin is not  existed",
            code: Codes.INVALID_INPUT,
          });
        }
      } else {
        result = new ResponseFormat({
          message: "Current user is not allow to update coins settings user",
          code: Codes.INVALID_INPUT,
        });
      }
    } catch (e) {
      this.logger.error(`updateCoinSetting`, e);
      result = new ResponseFormat({
        message: "Internal server error",
        code: Codes.UNKNOWN_ERROR,
      });
    }
    return Promise.resolve(result);
  }

  async updateCoinsSettings({ email, body }) {
    const p = path.join(
      this.config.base.TideBitLegacyPath,
      "config/markets/coins.yml"
    );
    this.logger.debug(
      `*********** [${this.name}] updateCoinSetting ************`
    );
    this.logger.log(`email`, email);
    this.logger.log(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    this.logger.log(
      `currentUser[${currentUser.roles?.includes("root")}]`,
      currentUser
    );
    try {
      const { visible } = body;
      this.logger.log(`visible`, visible);
      if (currentUser.roles?.includes("root")) {
        let updatedCoinsSettings = this.coinsSettings.map((coin) => ({
          ...coin,
          visible,
        }));
        try {
          Utils.yamlUpdate(updatedCoinsSettings, p);
          this.coinsSettings = updatedCoinsSettings;
          result = new ResponseFormat({
            message: "updateCoinsSettings",
            payload: {
              coins: this.formatCoinsSettings(),
            },
          });
        } catch (e) {
          this.logger.error(
            `yamlUpdate updateCoinsSettings`,
            updatedCoinsSettings,
            e
          );
          result = new ResponseFormat({
            message: "Internal server error",
            code: Codes.UNKNOWN_ERROR,
          });
        }
      } else {
        result = new ResponseFormat({
          message: "Current user is not allow to update coins settings user",
          code: Codes.INVALID_INPUT,
        });
      }
    } catch (e) {
      this.logger.error(`updateCoinsSettings`, e);
      result = new ResponseFormat({
        message: "Internal server error",
        code: Codes.UNKNOWN_ERROR,
      });
    }
    return Promise.resolve(result);
  }

  async updateDepositSetting({ params, email, body }) {
    const p = path.join(
      this.config.base.TideBitLegacyPath,
      "config/markets/deposits.yml"
    );
    this.logger.debug(
      `*********** [${this.name}] updateDepositSetting ************`
    );
    this.logger.log(`params.id`, params.id);
    this.logger.log(`email`, email);
    this.logger.log(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email),
      updatedDepositCoin;
    this.logger.log(
      `currentUser[${currentUser.roles?.includes("root")}]`,
      currentUser
    );
    try {
      const { type, data } = body;
      this.logger.log(`updateDepositCoin`, type, data);
      if (currentUser.roles?.includes("root")) {
        updatedDepositCoin = this.depositsSettings[params.id];
        this.logger.log(`updatedDepositCoin`, updatedDepositCoin);
        if (updatedDepositCoin) {
          let updatedDepositsSettings = Object.values(
            this.depositsSettings
          ).reduce((prev, deposit) => {
            prev[deposit.id.toString()] = { ...deposit };
            return prev;
          }, {});
          switch (type) {
            case COIN_SETTING_TYPE.FEE:
              updatedDepositsSettings[params.id] = {
                ...updatedDepositCoin,
                fee: data.fee,
              };
              break;
            case COIN_SETTING_TYPE.DEPOSIT:
              updatedDepositsSettings[params.id] = {
                ...updatedDepositCoin,
                disable: data.disable,
                visible: data.disable === false ? true : false,
              };
              break;
            default:
          }

          this.logger.log(
            `updatedDepositsSettings[${params.id}]`,
            updatedDepositsSettings[params.id]
          );
          try {
            Utils.yamlUpdate(Object.values(updatedDepositsSettings), p);
            this.depositsSettings = updatedDepositsSettings;
            result = new ResponseFormat({
              message: "updateDepositSetting",
              payload: {
                coins: this.formatCoinsSettings(),
              },
            });
          } catch (e) {
            this.logger.error(
              `yamlUpdate updateDepositSetting`,
              updatedDepositsSettings,
              e
            );
            result = new ResponseFormat({
              message: "Internal server error",
              code: Codes.UNKNOWN_ERROR,
            });
          }
        } else {
          result = new ResponseFormat({
            message: "Update coin is not  existed",
            code: Codes.INVALID_INPUT,
          });
        }
      } else {
        result = new ResponseFormat({
          message: "Current user is not allow to update deposit settings",
          code: Codes.INVALID_INPUT,
        });
      }
    } catch (e) {
      this.logger.error(`updateDepositSetting`, e);
      result = new ResponseFormat({
        message: "Internal server error",
        code: Codes.UNKNOWN_ERROR,
      });
    }
    return Promise.resolve(result);
  }

  async updateWithdrawSetting({ params, email, body }) {
    const p = path.join(
      this.config.base.TideBitLegacyPath,
      "config/markets/withdraws.yml"
    );
    this.logger.debug(
      `*********** [${this.name}] updateWithdrawSetting ************`
    );
    this.logger.log(`params.id`, params.id);
    this.logger.log(`email`, email);
    this.logger.log(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email),
      updatedWithdrawCoin;
    this.logger.log(
      `currentUser[${currentUser.roles?.includes("root")}]`,
      currentUser
    );
    try {
      const { type, data } = body;
      this.logger.log(`updateWithdrawCoin`, type, data);
      if (currentUser.roles?.includes("root")) {
        updatedWithdrawCoin = this.withdrawsSettings[params.id];
        this.logger.log(`updatedWithdrawCoin`, updatedWithdrawCoin);
        if (updatedWithdrawCoin) {
          let updatedWithdrawsSettings = Object.values(
            this.withdrawsSettings
          ).reduce((prev, withdraw) => {
            prev[withdraw.id.toString()] = { ...withdraw };
            return prev;
          }, {});
          switch (type) {
            case COIN_SETTING_TYPE.FEE:
              updatedWithdrawsSettings[params.id] = {
                ...updatedWithdrawCoin,
                fee: data.fee,
              };
              break;
            case COIN_SETTING_TYPE.WITHDRAW:
              updatedWithdrawsSettings[params.id] = {
                ...updatedWithdrawCoin,
                disable: data.disable,
                visible: data.disable === false ? true : false,
              };
              break;
            default:
          }
          this.logger.log(
            `updatedWithdrawsSettings[${params.id}]`,
            updatedWithdrawsSettings[params.id]
          );
          try {
            Utils.yamlUpdate(Object.values(updatedWithdrawsSettings), p);
            this.withdrawsSettings = updatedWithdrawsSettings;
            result = new ResponseFormat({
              message: "updateWithdrawSetting",
              payload: {
                coins: this.formatCoinsSettings(),
              },
            });
          } catch (e) {
            this.logger.error(
              `yamlUpdate updateWithdrawSetting`,
              updatedWithdrawsSettings,
              e
            );
            result = new ResponseFormat({
              message: "Internal server error",
              code: Codes.UNKNOWN_ERROR,
            });
          }
        } else {
          result = new ResponseFormat({
            message: "Update coin is not  existed",
            code: Codes.INVALID_INPUT,
          });
        }
      } else {
        result = new ResponseFormat({
          message: "Current user is not allow to update withdraw settings",
          code: Codes.INVALID_INPUT,
        });
      }
    } catch (e) {
      this.logger.error(`updateWithdrawSetting`, e);
      result = new ResponseFormat({
        message: "Internal server error",
        code: Codes.UNKNOWN_ERROR,
      });
    }
    return Promise.resolve(result);
  }

  async addAdminUser({ email, body }) {
    const p = path.join(this.config.base.TideBitLegacyPath, "config/roles.yml");
    this.logger.debug(`*********** [${this.name}] addAdminUser ************`);
    this.logger.log(`email`, email);
    this.logger.log(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    this.logger.log(`currentUser`, currentUser);
    try {
      const { newAdminUser } = body;
      const newAdminUserEmail = newAdminUser.email?.trim();
      if (currentUser.roles?.includes(ROLES.root)) {
        if (newAdminUserEmail) {
          const index = this.adminUsers.findIndex(
            (user) => user.email === newAdminUserEmail
          );
          if (index === -1) {
            const member = await this.database.getMemberByEmail(
              // `"${newAdminUserEmail}"`
              newAdminUserEmail
            );
            this.logger.log(`addAdminUser member`, member);
            if (member) {
              const updateAdminUsers = this.adminUsers
                .map((user) => ({
                  ...user,
                  roles: user.roles.map((key) => ROLES[key]),
                }))
                .concat({
                  id: member.id,
                  email: member.email,
                  name: newAdminUser.name,
                  roles: newAdminUser.roles.map((key) => ROLES[key]),
                });
              this.logger.log(
                `addAdminUser updateAdminUsers`,
                updateAdminUsers
              );
              try {
                Utils.yamlUpdate(updateAdminUsers, p);
                this.adminUsers = updateAdminUsers.map((user) => ({
                  ...user,
                  roles: user.roles.map((role) =>
                    role?.replace(" ", "_").toLowerCase()
                  ),
                }));
                result = Promise.resolve(
                  new ResponseFormat({
                    message: "addAdminUser",
                    payload: {
                      adminUsers: this.adminUsers,
                    },
                  })
                );
              } catch (e) {
                this.logger.error(
                  `yamlUpdate addAdminUser`,
                  updateAdminUsers,
                  e
                );
                result = new ResponseFormat({
                  message: "Internal server error",
                  code: Codes.UNKNOWN_ERROR,
                });
              }
            } else {
              result = new ResponseFormat({
                message: "Admin User is not existed",
                code: Codes.INVALID_INPUT,
              });
            }
          } else {
            result = new ResponseFormat({
              message: "Admin User is existed",
              code: Codes.MEMBER_ID_NOT_FOUND,
            });
          }
        }
      } else {
        result = new ResponseFormat({
          message: "Current user is not allow to add admin user",
          code: Codes.INVALID_INPUT,
        });
      }
    } catch (e) {
      this.logger.error(`addAdminUser`, e);
      result = new ResponseFormat({
        message: "Internal server error",
        code: Codes.UNKNOWN_ERROR,
      });
    }
    return Promise.resolve(result);
  }

  async updateAdminUser({ email, body }) {
    const p = path.join(this.config.base.TideBitLegacyPath, "config/roles.yml");
    this.logger.debug(
      `*********** [${this.name}] updateAdminUser ************`
    );
    this.logger.log(`email`, email);
    this.logger.log(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    this.logger.log(
      `currentUser[${currentUser.roles?.includes("root")}]`,
      currentUser
    );
    try {
      const { updateAdminUser } = body;
      this.logger.log(`updateAdminUser`, updateAdminUser);
      if (currentUser.roles?.includes("root")) {
        if (updateAdminUser.email) {
          let index = this.adminUsers.findIndex(
            (user) => user.email === updateAdminUser.email
          );
          this.logger.log(`index`, index);
          if (index !== -1) {
            let updateAdminUsers = this.adminUsers.map((user) => ({
              ...user,
              roles: user.roles.map((key) => ROLES[key]),
            }));
            updateAdminUsers[index] = {
              id: updateAdminUser.id,
              email: updateAdminUser.email,
              name: updateAdminUser.name,
              roles: updateAdminUser.roles.map((key) => ROLES[key]),
            };
            this.logger.log(
              `updateAdminUser updateAdminUsers`,
              updateAdminUsers
            );
            try {
              Utils.yamlUpdate(updateAdminUsers, p);
              this.adminUsers = updateAdminUsers.map((user) => ({
                ...user,
                roles: user.roles.map((role) =>
                  role?.replace(" ", "_").toLowerCase()
                ),
              }));
              result = new ResponseFormat({
                message: "updateAdminUser",
                payload: {
                  adminUsers: this.adminUsers,
                },
              });
            } catch (e) {
              this.logger.error(
                `yamlUpdate updateAdminUser`,
                updateAdminUsers,
                e
              );
              result = new ResponseFormat({
                message: "Internal server error",
                code: Codes.UNKNOWN_ERROR,
              });
            }
          } else {
            result = new ResponseFormat({
              message: "Update user is not  existed",
              code: Codes.MEMBER_ID_NOT_FOUND,
            });
          }
        }
      } else {
        result = new ResponseFormat({
          message: "Current user is not allow to update admin user",
          code: Codes.INVALID_INPUT,
        });
      }
    } catch (e) {
      this.logger.error(`updateAdminUser`, e);
      result = new ResponseFormat({
        message: "Internal server error",
        code: Codes.UNKNOWN_ERROR,
      });
    }
    return Promise.resolve(result);
  }

  async deleteAdminUser({ params, email }) {
    const p = path.join(this.config.base.TideBitLegacyPath, "config/roles.yml");
    this.logger.debug(
      `*********** [${this.name}] deleteAdminUser ************`
    );
    this.logger.log(`params.id`, params.id);
    this.logger.log(`email`, email);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    this.logger.log(`currentUser`, currentUser);
    try {
      if (currentUser.roles?.includes("root")) {
        if (params.id) {
          let updateAdminUsers = this.adminUsers
            .filter(
              (adminUser) => adminUser.id.toString() !== params.id.toString()
            )
            .map((user) => ({
              ...user,
              roles: user.roles.map((key) => ROLES[key]),
            }));
          this.logger.log(`deleteAdminUser updateAdminUsers`, updateAdminUsers);
          try {
            Utils.yamlUpdate(updateAdminUsers, p);
            this.adminUsers = updateAdminUsers.map((user) => ({
              ...user,
              roles: user.roles.map((role) =>
                role?.replace(" ", "_").toLowerCase()
              ),
            }));
            result = new ResponseFormat({
              message: "deleteAdminUser",
              payload: {
                adminUsers: this.adminUsers,
              },
            });
          } catch (e) {
            this.logger.error(
              `yamlUpdate deleteAdminUser`,
              updateAdminUsers,
              e
            );
            result = new ResponseFormat({
              message: "Internal server error",
              code: Codes.UNKNOWN_ERROR,
            });
          }
        } else {
          result = new ResponseFormat({
            message: "delete user is not exit",
            code: Codes.MEMBER_ID_NOT_FOUND,
          });
        }
      } else {
        result = new ResponseFormat({
          message: "Current user is not allow to delete admin user",
          code: Codes.INVALID_INPUT,
        });
      }
    } catch (e) {
      this.logger.error(`deleteAdminUser`, e);
      result = new ResponseFormat({
        message: "Internal server error",
        code: Codes.UNKNOWN_ERROR,
      });
    }
    return Promise.resolve(result);
  }

  getTidebitMarkets() {
    try {
      const p = path.join(
        this.config.base.TideBitLegacyPath,
        "config/markets/markets.yml"
      );
      const markets = Utils.fileParser(p);
      const formatMarket = markets
        .filter((market) => market.visible !== false) // default visible is true, so if visible is undefined still need to show on list.
        .map((market) => {
          const instId = market.name.split("/").join("-").toUpperCase();
          return {
            ...market,
            instId,
            instType: "",
            group: market.tab_category,
            source: SupportedExchange.TIDEBIT,
          };
        });
      return formatMarket;
    } catch (error) {
      this.logger.error(error);
      process.exit(1);
    }
  }

  async getOrdersFromDb(query) {
    if (!query.tickerSetting) {
      throw new Error(`${query.tickerSetting} is undefined.`);
    }
    const { id: bid } = this.coinsSettings.find(
      (curr) => curr.code === query.tickerSetting?.quoteUnit
    );
    const { id: ask } = this.coinsSettings.find(
      (curr) => curr.code === query.tickerSetting?.baseUnit
    );
    if (!bid) {
      throw new Error(`bid not found${query.tickerSetting?.quoteUnit}`);
    }
    if (!ask) {
      throw new Error(`ask not found${query.tickerSetting?.baseUnit}`);
    }
    let _orders,
      _doneMarketBidOrders,
      orders = [];
    _orders = await this.database.getOrderList({
      quoteCcy: bid,
      baseCcy: ask,
      memberId: query.memberId,
    });
    _doneMarketBidOrders = await this.database.getDoneOrders({
      quoteCcy: bid,
      baseCcy: ask,
      memberId: query.memberId,
      state: Database.ORDER_STATE_CODE.DONE,
      type: Database.TYPE.ORDER_BID,
    });
    _orders = _orders
      .filter(
        (_order) =>
          !(
            _order.type === Database.TYPE.ORDER_BID &&
            _order.state === Database.ORDER_STATE_CODE.DONE &&
            _order.ord_type !== Database.ORD_TYPE.LIMIT
          )
      )
      .concat(_doneMarketBidOrders);
    for (let _order of _orders) {
      let order;
      order = {
        id: _order.id,
        ts: parseInt(new Date(_order.updated_at).getTime()),
        at: parseInt(
          SafeMath.div(new Date(_order.updated_at).getTime(), "1000")
        ),
        market: query.tickerSetting?.market,
        kind:
          _order.type === Database.TYPE.ORDER_ASK
            ? Database.ORDER_KIND.ASK
            : Database.ORDER_KIND.BID,
        price: _order.price ? Utils.removeZeroEnd(_order.price) : _order.price,
        origin_volume: Utils.removeZeroEnd(_order.origin_volume),
        volume: Utils.removeZeroEnd(_order.volume),
        state_code: _order.state,
        state: SafeMath.eq(_order.state, Database.ORDER_STATE_CODE.CANCEL)
          ? Database.ORDER_STATE.CANCEL
          : SafeMath.eq(_order.state, Database.ORDER_STATE_CODE.WAIT)
          ? Database.ORDER_STATE.WAIT
          : SafeMath.eq(_order.state, Database.ORDER_STATE_CODE.DONE)
          ? Database.ORDER_STATE.DONE
          : Database.ORDER_STATE.UNKNOWN,
        state_text: SafeMath.eq(_order.state, Database.ORDER_STATE_CODE.CANCEL)
          ? Database.ORDER_STATE_TEXT.CANCEL
          : SafeMath.eq(_order.state, Database.ORDER_STATE_CODE.WAIT)
          ? Database.ORDER_STATE_TEXT.WAIT
          : SafeMath.eq(_order.state, Database.ORDER_STATE_CODE.DONE)
          ? Database.ORDER_STATE_TEXT.DONE
          : Database.ORDER_STATE_TEXT.UNKNOWN,
        clOrdId: _order.id,
        instId: query.tickerSetting?.instId,
        ordType: _order.ord_type,
        filled: _order.volume !== _order.origin_volume,
      };
      if (
        order.state_code === Database.ORDER_STATE_CODE.DONE &&
        order.ordType !== Database.ORD_TYPE.LIMIT &&
        _order.type === Database.TYPE.ORDER_ASK
      ) {
        orders.push({
          ...order,
          price: SafeMath.div(_order.funds_received, _order.origin_volume),
        });
      } else if (
        (order.state_code === Database.ORDER_STATE_CODE.WAIT &&
          order.ordType === Database.ORD_TYPE.LIMIT) || // 非限價單不顯示在 pendingOrders)
        order.state_code === Database.ORDER_STATE_CODE.CANCEL || // canceled 單
        (order.state_code === Database.ORDER_STATE_CODE.DONE &&
          order.ordType === Database.ORD_TYPE.LIMIT) ||
        (order.state_code === Database.ORDER_STATE_CODE.DONE &&
          order.ordType !== Database.ORD_TYPE.LIMIT &&
          _order.type === Database.TYPE.ORDER_BID)
      ) {
        if (order.price) {
          // _canceledOrders.push(order);
          orders.push(order);
        }
        // tidebit 市價單（no price）是否會出現交易失敗導致交易 canceled ？ okex 市價單或ioc單失敗會顯示 cancled 且有price
        else
          this.logger.error(
            `!!! NOTICE !!! canceledOrder without price`,
            order
          );
      } else if (
        order.state_code === Database.ORDER_STATE_CODE.DONE &&
        _order.type === Database.TYPE.ORDER_BID
      ) {
      }
    }
    // const orders = _pendingOrders
    //   .concat(_canceledOrders)
    //   .concat(_doneOrders)
    //   .sort((a, b) => b.ts - a.ts);
    return orders;
  }

  async getUsersAccounts() {
    return this.tideBitConnector.router("getUsersAccounts", {});
  }

  async getPriceList() {
    try {
      const res = await axios({
        method: `get`,
        url: `https://cc.isun.one/api/cc/PriceList`,
      });
      if (res.data && res.status !== 200) {
        const message = JSON.stringify(res.data);
        this.logger.trace(message);
      }
      // this.logger.log(`getPriceList res`, res);
      return res.data;
    } catch (e) {
      this.logger.error(`getPriceList e`, e);
    }
  }

  async getExchangeRates() {
    const exchangeRates = this.accountBook.exchangeRates;
    return Promise.resolve(
      new ResponseFormat({
        message: "getExchangeRates",
        payload: exchangeRates,
      })
    );
  }

  // account api
  async getAccounts({ memberId, email, token }) {
    this.logger.debug(
      `*********** [${this.name}] getAccounts memberId:[${memberId}]************`
    );

    if (!memberId || memberId === -1) {
      return new ResponseFormat({
        message: "getAccounts",
        payload: null,
      });
    }
    return this.tideBitConnector.router("getAccounts", {
      query: { memberId, email, token },
    });
  }

  async getTicker({ params, query }) {
    this.logger.debug(`*********** [${this.name}] getTicker ************`);
    // this.tickersSettings = this._getTickersSettings();
    const tickerSetting = this.tickersSettings[query.id];
    if (tickerSetting) {
      const source = tickerSetting.source;
      this.logger.log(
        `[${this.constructor.name}] getTicker ticketSource`,
        source
      );
      switch (source) {
        case SupportedExchange.OKEX:
          return this.okexConnector.router("getTicker", {
            params,
            query: { ...query, instId: tickerSetting.instId },
          });
        case SupportedExchange.TIDEBIT:
          return this.tideBitConnector.router("getTicker", {
            params,
            query: { ...query, instId: tickerSetting.instId },
          });
        default:
          return new ResponseFormat({
            message: "getTicker",
            payload: null,
          });
      }
    } else {
      return new ResponseFormat({
        message: "getTicker",
        payload: null,
      });
    }
  }

  async getTickers({ query }) {
    this.logger.debug(`*********** [${this.name}] getTickers ************`);
    // this.tickersSettings = this._getTickersSettings();
    if (!this.fetchedTickers) {
      let okexTickers,
        tidebitTickers = {};
      try {
        const okexRes = await this.okexConnector.router("getTickers", {
          query,
        });
        if (okexRes.success) {
          okexTickers = okexRes.payload;
        } else {
          this.logger.error(okexRes);
          return new ResponseFormat({
            message: "",
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
      } catch (error) {
        this.logger.error(error);
        return new ResponseFormat({
          message: error.stack,
          code: Codes.API_UNKNOWN_ERROR,
        });
      }
      try {
        const tBTickersRes = await this.tideBitConnector.router(
          "getTickers",
          {}
        );
        if (tBTickersRes.success) {
          tidebitTickers = tBTickersRes.payload;
        } else {
          this.logger.error(tBTickersRes);
          return new ResponseFormat({
            message: "",
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
        this.tickerBook.updateAll(okexTickers, tidebitTickers);
      } catch (error) {
        this.logger.error(error);
        return new ResponseFormat({
          message: error.stack,
          code: Codes.API_UNKNOWN_ERROR,
        });
      }
      this.fetchedTickers = true;
    }
    return new ResponseFormat({
      message: "getTickers",
      payload: Object.values(this.tickerBook.getSnapshot())?.filter(
        (ticker) => ticker.visible
      ),
    });
  }

  async getTickersSettings({ query }) {
    this.logger.debug(
      `*********** [${this.name}] getTickersSettings ************`
    );
    // this.tickersSettings = this._getTickersSettings();
    if (!this.fetchedTickers) {
      let okexTickers,
        tidebitTickers = {};
      try {
        const okexRes = await this.okexConnector.router("getTickers", {
          query: { ...query, instType: "SPOT" },
        });
        if (okexRes.success) {
          okexTickers = okexRes.payload;
        } else {
          this.logger.error(okexRes);
          return new ResponseFormat({
            message: "",
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
      } catch (error) {
        this.logger.error(error);
        return new ResponseFormat({
          message: error.stack,
          code: Codes.API_UNKNOWN_ERROR,
        });
      }
      try {
        const tBTickersRes = await this.tideBitConnector.router(
          "getTickers",
          {}
        );
        if (tBTickersRes.success) {
          tidebitTickers = tBTickersRes.payload;
        } else {
          this.logger.error(tBTickersRes);
          return new ResponseFormat({
            message: "",
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
        this.tickerBook.updateAll(okexTickers, tidebitTickers);
      } catch (error) {
        this.logger.error(error);
        return new ResponseFormat({
          message: error.stack,
          code: Codes.API_UNKNOWN_ERROR,
        });
      }
      this.fetchedTickers = true;
    }
    return new ResponseFormat({
      message: "getTickers",
      payload: this.tickerBook.getSnapshot(),
    });
  }

  async getDepthBooks({ query }) {
    this.logger.debug(
      `*********** [${this.name}] getDepthBooks ************`,
      query
    );
    const tickerSetting = this.tickersSettings[query.market];
    switch (tickerSetting?.source) {
      case SupportedExchange.OKEX:
        return this.okexConnector.router("getDepthBooks", {
          query: { ...query, instId: tickerSetting?.instId },
        });
      case SupportedExchange.TIDEBIT:
        return this.tideBitConnector.router("getDepthBooks", {
          query: { ...query, instId: tickerSetting?.instId },
        });
      default:
        return new ResponseFormat({
          message: "getDepthBooks",
          payload: {},
        });
    }
  }

  async getTradingViewConfig({ query }) {
    this.logger.debug(
      `*********** [${this.name}] getTradingViewConfig ************`,
      query
    );
    return Promise.resolve({
      supported_resolutions: ["1", "5", "15", "30", "60", "1D", "1W"],
      supports_group_request: false,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_search: true,
    });
  }

  async getTradingViewSymbol({ query }) {
    this.logger.debug(
      `*********** [${this.name}] getTradingViewSymbol ************`,
      query
    );
    const id = decodeURIComponent(query.symbol).replace("/", "").toLowerCase();
    const tickerSetting = this.tickersSettings[id];
    switch (tickerSetting?.source) {
      case SupportedExchange.OKEX:
        return this.okexConnector.router("getTradingViewSymbol", {
          query: {
            ...query,
            instId: tickerSetting?.instId,
            id,
            market: tickerSetting,
          },
        });
      case SupportedExchange.TIDEBIT:
        return this.tideBitConnector.router("getTradingViewSymbol", {
          query: {
            ...query,
            instId: tickerSetting?.instId,
            id,
            market: tickerSetting,
          },
        });
      default:
        return new ResponseFormat({
          message: "getTradingViewSymbol",
          payload: [],
        });
    }
  }

  async getTradingViewHistory({ query }) {
    this.logger.debug(
      `*********** [${this.name}] getTradingViewHistory ************`,
      query
    );
    const tickerSetting = this.tickersSettings[query.symbol];
    switch (tickerSetting?.source) {
      case SupportedExchange.OKEX:
        return this.okexConnector.router("getTradingViewHistory", {
          query: { ...query, instId: tickerSetting?.instId },
        });
      case SupportedExchange.TIDEBIT:
        return this.tideBitConnector.router("getTradingViewHistory", {
          query: { ...query, instId: tickerSetting?.instId },
        });
      default:
        return new ResponseFormat({
          message: "getTradingViewHistory",
          payload: [],
        });
    }
  }

  async getCandlesticks({ query }) {
    // decrepted
    // switch (this._findSource(query.instId)) {
    //   case SupportedExchange.OKEX:
    //     return this.okexConnector.router("getCandlesticks", { query });
    //   case SupportedExchange.TIDEBIT:
    //   default:
    //     return new ResponseFormat({
    //       message: "getCandlesticks",
    //       payload: [],
    //     });
    // }
  }

  async getTrades({ query }) {
    this.logger.debug(
      `*********** [${this.name}] getTrades ************`,
      query
    );
    const tickerSetting = this.tickersSettings[query.market];
    switch (tickerSetting?.source) {
      case SupportedExchange.OKEX:
        return this.okexConnector.router("getTrades", {
          query: { ...query, instId: tickerSetting?.instId },
        });
      case SupportedExchange.TIDEBIT:
        return this.tideBitConnector.router("getTrades", {
          query: { ...query, instId: tickerSetting?.instId },
        });
      default:
        return new ResponseFormat({
          message: "getTrades",
          payload: [],
        });
    }
  }

  async getOuterTradeFills({ query }) {
    this.logger.debug(
      `*********** [${this.name}] getOuterTradeFills ************`,
      query
    );
    let { exchange, start, end } = query;
    let startDate = `${start} 00:00:00`;
    let endtDate = `${end} 23:59:59`;
    this.logger.debug(`startDate:${startDate}, endtDate:${endtDate}`);
    let outerTrades = [];
    switch (exchange) {
      case SupportedExchange.OKEX:
        // const _outerTrades = await this.database.getOuterTradesByDayAfter(
        //   Database.EXCHANGE[exchange.toUpperCase()],
        //   365 // ++ TODO
        // );
        const _outerTrades = await this.database.getOuterTradesBetweenDays(
          Database.EXCHANGE[exchange.toUpperCase()],
          startDate,
          endtDate
        );
        // const res = await this.okexConnector.router(
        //   "fetchTradeFillsHistoryRecords",
        //   {
        //     query: { ...query, instType: Database.INST_TYPE.SPOT },
        //   }
        // );
        // if (res.success) {
        // for (let trade of res.payload) {
        for (let _trade of _outerTrades) {
          let trade = JSON.parse(_trade.data),
            parsedClOrdId = Utils.parseClOrdId(trade.clOrdId),
            memberId = parsedClOrdId.memberId,
            orderId = parsedClOrdId.orderId,
            askFeeRate,
            bidFeeRate,
            tickerSetting = this.tickersSettings(
              trade.instId.toLowerCase().replace("-", "")
            ),
            memberTag = _trade.member_tag,
            fee,
            processTrade,
            profit;
          if (memberTag) {
            if (
              memberTag.toString() === Database.MEMBER_TAG.VIP_FEE.toString()
            ) {
              askFeeRate = tickerSetting.ask.vip_fee;
              bidFeeRate = tickerSetting.bid.vip_fee;
            }
            if (
              memberTag.toString() === Database.MEMBER_TAG.HERO_FEE.toString()
            ) {
              askFeeRate = tickerSetting.ask.hero_fee;
              bidFeeRate = tickerSetting.bid.hero_fee;
            }
          } else {
            askFeeRate = tickerSetting.ask.fee;
            bidFeeRate = tickerSetting.bid.fee;
          }
          fee =
            _trade.status === Database.OUTERTRADE_STATUS.DONE
              ? trade.side === Database.ORDER_SIDE.SELL
                ? SafeMath.mult(
                    SafeMath.mult(trade.fillPx, trade.fillSz),
                    askFeeRate
                  )
                : SafeMath.mult(trade.fillSz, bidFeeRate)
              : null;
          profit =
            _trade.status === Database.OUTERTRADE_STATUS.DONE
              ? _trade.ref_net_fee
                ? SafeMath.minus(
                    SafeMath.minus(fee, Math.abs(trade.fee)),
                    Math.abs(_trade.ref_net_fee)
                  )
                : SafeMath.minus(fee, Math.abs(trade.fee))
              : null;
          processTrade = {
            ...trade,
            orderId,
            px:
              _trade.status === Database.OUTERTRADE_STATUS.DONE
                ? Utils.removeZeroEnd(_trade.order_price)
                : null,
            sz:
              _trade.status === Database.OUTERTRADE_STATUS.DONE
                ? Utils.removeZeroEnd(_trade.order_origin_volume)
                : null,
            email: _trade?.email || null,
            memberId,
            externalFee: Math.abs(trade.fee),
            fee,
            profit: profit,
            exchange: exchange,
            referral: _trade.ref_net_fee
              ? Utils.removeZeroEnd(_trade.ref_net_fee)
              : null,
            ts: parseInt(trade.ts),
          };
          // this.logger.log(`processTrade`, processTrade);
          outerTrades = [...outerTrades, processTrade];
        }
        // }
        // this.logger.log(`outerTrades`, outerTrades);
        return new ResponseFormat({
          message: "getOuterTradeFills",
          payload: outerTrades,
        });
      default:
        return new ResponseFormat({
          message: "getOuterTradeFills",
          payload: null,
        });
    }
  }

  async getOuterPendingOrders({ query }) {
    this.logger.debug(
      `*********** [${this.name}] getOuterPendingOrders ************`,
      query
    );
    let outerOrders = [],
      dbOrders = await this.database.getOrdersJoinMemberEmail(
        Database.ORDER_STATE_CODE.WAIT
      );
    switch (query.exchange) {
      case SupportedExchange.OKEX:
        const res = await this.okexConnector.router("getAllOrders", {
          query: { ...query, instType: Database.INST_TYPE.SPOT },
        });
        if (res.success) {
          for (let order of res.payload) {
            let parsedClOrdId = Utils.parseClOrdId(order.clOrdId),
              memberId = parsedClOrdId.memberId,
              id = parsedClOrdId.orderId,
              dbOrder = dbOrders.find(
                (_dbOrder) => _dbOrder.id.toString() === id.toString()
              ),
              fundsReceived =
                order.side === Database.ORDER_SIDE.BUY
                  ? SafeMath.mult(order.avgPx, order.accFillSz)
                  : order.accFillSz,
              processOrder;
            processOrder = {
              ...order,
              unFillSz: SafeMath.minus(order.sz, order.accFillSz),
              id,
              email: dbOrder?.email || null,
              memberId,
              exchange: query.exchange,
              fundsReceived,
              ts: parseInt(order.uTime),
            };
            // this.logger.log(`processOrder`, processOrder);
            outerOrders = [...outerOrders, processOrder];
          }
        }
        return new ResponseFormat({
          message: "getOuterPendingOrders",
          payload: outerOrders,
        });
      default:
        return new ResponseFormat({
          message: "getOuterPendingOrders",
          payload: null,
        });
    }
  }

  // market api end
  // trade api
  /**
   * ++ TODO
   * 外部 Order 掛單流程調整
   * 1. DB transaction
   * 2. 建立 TideBit order 單
   * ~2.~ 3. 根據 order 單內容更新 account locked 與 balance
   * ~3.~ 4. 新增 account version
   * ~4. 建立 TideBit order 單~
   * 5. commit transaction
   * 6. 建立 OKX order 單
   * 6.1 掛單成功
   * 6.2 掛單失敗
   * 6.2.1 DB transaction
   * 6.2.2 根據 order locked amount 減少 account locked amount 並增加 balance amount
   * 6.2.3 新增 account_versions 記錄
   * 6.2.4 更新 order 為 cancel 狀態
   * 6.2.5 commit transaction
   */
  async postPlaceOrder({ header, params, query, body, memberId }) {
    this.logger.log(
      `---------- [${this.constructor.name}]  postPlaceOrder  ----------`
    );
    if (!memberId || memberId === -1) {
      return new ResponseFormat({
        message: "member_id not found",
        code: Codes.MEMBER_ID_NOT_FOUND,
      });
    }
    /* !!! HIGH RISK (start) !!! */
    // 1. find and lock account
    // 2. get orderData from body
    // 3. calculate balance value, locked value
    // 4. new order
    // 5. add account_version
    // 6. update account balance and locked
    // 7. post okex placeOrder
    const tickerSetting = this.tickersSettings[body.id];
    switch (tickerSetting?.source) {
      case SupportedExchange.OKEX:
        let orderData,
          order,
          orderId,
          clOrdId,
          currencyId,
          account,
          result,
          response,
          updateOrder,
          // * 1. DB transaction
          t = await this.database.transaction();
        try {
          /*******************************************
           * body.kind: order is 'bid' or 'ask'
           * orderData.price: body.price, price value
           * orderData.volume: body.volume, volume value
           * orderData.locked:
           *   if body.kind === 'bid', locked = body.price * body.volume
           *   if body.kind === 'ask', locked = body.volume
           *
           * orderData.balance: locked value * -1
           *******************************************/
          //  * 2. 建立 TideBit order 單
          orderData = await this._getPlaceOrderData(
            memberId,
            body,
            tickerSetting
          );
          order = await this.database.insertOrder({
            ...orderData,
            dbTransaction: t,
          });
          orderId = order[0];
          clOrdId = `${this.okexBrokerId}${memberId}m${orderId}o`.slice(0, 32);
          // clOrdId = 377bd372412fSCDE60977m247674466o
          // brokerId = 377bd372412fSCDE
          // memberId = 60976
          // orderId = 247674466
          this.logger.error(`clOrdId`, clOrdId);
          // * ~2.~ 3. 根據 order 單內容更新 account locked 與 balance
          // * ~3.~ 4. 新增 account version
          currencyId =
            body.kind === Database.ORDER_KIND.BID
              ? orderData.bid
              : orderData.ask;
          account = await this.database.getAccountByMemberIdCurrency(
            memberId,
            currencyId,
            { dbTransaction: t }
          );
          await this._updateAccount({
            account,
            reason: Database.REASON.ORDER_SUBMIT,
            dbTransaction: t,
            balance: orderData.balance,
            locked: orderData.locked,
            fee: 0,
            modifiableType: Database.MODIFIABLE_TYPE.ORDER,
            modifiableId: orderId,
            createdAt: orderData.createdAt,
            fun: Database.FUNC.LOCK_FUNDS,
          });
          //   * 5. commit transaction
          await t.commit();
          //   * 6. 建立 OKX order 單
          response = await this.okexConnector.router("postPlaceOrder", {
            memberId,
            orderId,
            body: {
              instId: body.instId,
              tdMode: body.tdMode,
              // ccy: body.ccy,
              clOrdId,
              tag: this.brokerId,
              side:
                body.kind === Database.ORDER_KIND.BID
                  ? Database.ORDER_SIDE.BUY
                  : Database.ORDER_SIDE.SELL,
              // posSide: body.posSide,
              ordType: orderData.ordType,
              sz: body.volume,
              px: orderData.price,
              // reduceOnly: body.reduceOnly,
              // tgtCcy: body.tgtCcy,
            },
          });
          this.logger.log("[RESPONSE]", response);
          updateOrder = {
            instId: body.instId,
            ordType:
              body.ordType === Database.ORD_TYPE.MARKET
                ? Database.ORD_TYPE.IOC
                : body.ordType,
            id: orderId,
            clOrdId,
            at: parseInt(SafeMath.div(Date.now(), "1000")),
            ts: Date.now(),
            market: body.market,
            kind: body.kind,
            price: body.price,
            origin_volume: body.volume,
            state: Database.ORDER_STATE.WAIT,
            state_text: Database.ORDER_STATE_TEXT.WAIT,
            volume: body.volume,
          };
          if (response.success) {
            // * 6.1 掛單成功
            if (body.ordType === Database.ORD_TYPE.LIMIT) {
              updateOrder = {
                ...updateOrder,
                ordId: response.payload.ordId,
                clOrdId: response.payload.clOrdId,
              };
              this._emitUpdateOrder({
                memberId,
                instId: body.instId,
                market: body.market,
                order: updateOrder,
              });
              let _updateAccount = {
                balance: SafeMath.plus(account.balance, orderData.balance),
                locked: SafeMath.plus(account.locked, orderData.locked),
                currency: this.coinsSettings.find(
                  (curr) => curr.id === account.currency
                )?.symbol,
                total: SafeMath.plus(
                  SafeMath.plus(account.balance, orderData.balance),
                  SafeMath.plus(account.locked, orderData.locked)
                ),
              };
              this._emitUpdateAccount({
                memberId,
                account: _updateAccount,
              });
            }
          } else {
            //  * 6.2 掛單失敗
            //  * 6.2.1 DB transaction
            t = await this.database.transaction();
            //    * 6.2.2 根據 order locked amount 減少 account locked amount 並增加 balance amount
            //    * 6.2.3 新增 account_versions 記錄
            //    * 6.2.4 更新 order 為 cancel 狀態
            result = await this.updateOrderStatus({
              transacion: t,
              orderId,
              memberId,
              orderData: updateOrder,
            });
            if (result) {
              //   * 6.2.5 commit transaction
              await t.commit();
            } else {
              await t.rollback();
              response = new ResponseFormat({
                message: "DB ERROR",
                code: Codes.DB_OPERATION_ERROR,
              });
            }
          }
        } catch (error) {
          this.logger.error(error);
          await t.rollback();
          response = new ResponseFormat({
            message: error.message,
            code: Codes.DB_OPERATION_ERROR,
          });
        }
        // -- WORKAROUND
        setTimeout(() => {
          this.exchangeHubService.sync(
            SupportedExchange.OKEX,
            updateOrder,
            true
          );
        }, 2000);
        // -- WORKAROUND
        return response;
      /* !!! HIGH RISK (end) !!! */
      case SupportedExchange.TIDEBIT:
        return this.tideBitConnector.router("postPlaceOrder", {
          header,
          body: { ...body, market: tickerSetting },
        });
      default:
        return new ResponseFormat({
          message: "instId not Support now",
          code: Codes.API_NOT_SUPPORTED,
        });
    }
  }

  async getOrders({ query, memberId }) {
    this.logger.debug(
      `*********** [${this.name}] getOrders memberId:[${memberId}]************`,
      query
    );
    const tickerSetting = this.tickersSettings[query.market];
    if (memberId && memberId !== -1) {
      let pendingOrders, orderHistories, orders;
      switch (tickerSetting?.source) {
        case SupportedExchange.OKEX:
          const pendingOrdersRes = await this.okexConnector.router(
            "getOrderList",
            {
              query: {
                ...query,
                instId: tickerSetting?.instId,
                memberId,
              },
            }
          );
          this.logger.log(`pendingOrdersRes`, pendingOrdersRes);
          pendingOrders = pendingOrdersRes.success
            ? pendingOrdersRes.payload
            : [];
          orderHistories = await this.getOrdersFromDb({
            ...query,
            memberId,
            tickerSetting,
          });
          orderHistories = orderHistories.filter(
            (order) => order.state_code !== Database.ORDER_STATE_CODE.WAIT
          );
          this.orderBook.updateAll(
            memberId,
            tickerSetting?.instId,
            pendingOrders.concat(orderHistories)
          );
          return new ResponseFormat({
            message: "getOrders",
            payload: this.orderBook.getSnapshot(
              memberId,
              tickerSetting?.instId
            ),
          });
        case SupportedExchange.TIDEBIT:
          orders = await this.getOrdersFromDb({
            ...query,
            memberId,
            tickerSetting,
          });
          this.orderBook.updateAll(memberId, tickerSetting?.instId, orders);
          return new ResponseFormat({
            message: "getOrders",
            payload: this.orderBook.getSnapshot(
              memberId,
              tickerSetting?.instId
            ),
          });
        default:
          return new ResponseFormat({
            message: "getOrders",
            payload: null,
          });
      }
    }
    return new ResponseFormat({
      message: "getOrders",
      payload: null,
    });
  }
  // TODO integrate getOrderList and getOrderHistory into one
  async getOrderList({ query, memberId }) {
    this.logger.log(
      `-------------[${this.constructor.name} getOrderList]----------`
    );
    this.logger.log(` memberId:`, memberId);
    const tickerSetting = this.tickersSettings[query.id];
    if (memberId !== -1) {
      switch (tickerSetting?.source) {
        case SupportedExchange.OKEX:
          const res = await this.okexConnector.router("getOrderList", {
            query: {
              ...query,
              instId: tickerSetting?.instId,
              market: tickerSetting,
              memberId,
            },
          });
          const list = res.payload;
          if (Array.isArray(list)) {
            const newList = list.filter((order) =>
              order.clOrdId.includes(`${memberId}m`)
            ); // 可能發生與brokerId, randomId碰撞
            res.payload = newList;
          }
          return res;
        case SupportedExchange.TIDEBIT:
          if (!this.fetchedOrders[memberId]) this.fetchedOrders[memberId] = {};
          let ts = Date.now();
          if (
            !this.fetchedOrders[memberId][tickerSetting?.instId] ||
            SafeMath.gt(
              SafeMath.minus(
                ts,
                this.fetchedOrders[memberId][tickerSetting?.instId]
              ),
              this.fetchedOrdersInterval
            )
          )
            try {
              const orders = await this.getOrdersFromDb({
                ...query,
                memberId,
                instId: tickerSetting?.instId,
                market: tickerSetting,
              });
              this.orderBook.updateAll(memberId, tickerSetting?.instId, orders);
              this.fetchedOrders[memberId][tickerSetting?.instId] = ts;
            } catch (error) {
              this.logger.error(error);
              const message = error.message;
              return new ResponseFormat({
                message,
                code: Codes.API_UNKNOWN_ERROR,
              });
            }
          return new ResponseFormat({
            message: "getOrderList",
            payload: this.orderBook.getSnapshot(
              memberId,
              tickerSetting?.instId,
              "pending"
            ),
          });
        default:
          return new ResponseFormat({
            message: "getOrderList",
            payload: null,
          });
      }
    }
    return new ResponseFormat({
      message: "getOrderList",
      payload: null,
    });
  }

  async getOrderHistory({ query, memberId }) {
    const tickerSetting = this.tickersSettings[query.id];
    if (!memberId || memberId === -1) {
      return new ResponseFormat({
        message: "getOrderHistory",
        payload: null,
      });
    }
    switch (tickerSetting?.source) {
      case SupportedExchange.OKEX:
      case SupportedExchange.TIDEBIT:
        if (!this.fetchedOrders[memberId]) this.fetchedOrders[memberId] = {};
        let ts = Date.now();
        if (
          !this.fetchedOrders[memberId][tickerSetting?.instId] ||
          SafeMath.gt(
            SafeMath.minus(
              ts,
              this.fetchedOrders[memberId][tickerSetting?.instId]
            ),
            this.fetchedOrdersInterval
          )
        ) {
          try {
            const orders = await this.getOrdersFromDb({
              ...query,
              memberId,
              tickerSetting,
            });
            this.orderBook.updateAll(memberId, tickerSetting?.instId, orders);
            this.fetchedOrders[memberId][tickerSetting?.instId] = ts;
          } catch (error) {
            this.logger.error(error);
            const message = error.message;
            return new ResponseFormat({
              message,
              code: Codes.API_UNKNOWN_ERROR,
            });
          }
        }
        return new ResponseFormat({
          message: "getOrderHistory",
          payload: this.orderBook.getSnapshot(
            memberId,
            tickerSetting?.instId,
            "history"
          ),
        });
      default:
        return new ResponseFormat({
          message: "getOrderHistory",
          payload: null,
        });
    }
  }

  async updateOrderStatus({ transacion, orderId, memberId, orderData }) {
    /* !!! HIGH RISK (start) !!! */
    // 1. get orderId from body
    // 2. get order data from table
    // 3. find and lock account
    // 4. update order state
    // 5. get balance and locked value from order
    // 6. add account_version
    // 7. update account balance and locked
    // 8. post okex cancel order
    // const t = await this.database.transaction();
    /*******************************************
     * body.clOrdId: custom orderId for okex
     * locked: value from order.locked, used for unlock balance, negative in account_version
     * balance: order.locked
     *******************************************/
    let result = false,
      order,
      locked,
      balance,
      fee,
      updateOrder,
      currencyId,
      account,
      updateAccount,
      createdAt = new Date().toISOString();
    try {
      order = await this.database.getOrder(orderId, {
        dbTransaction: transacion,
      });
      if (order && order.state !== Database.ORDER_STATE_CODE.CANCEL) {
        currencyId =
          order?.type === Database.TYPE.ORDER_ASK ? order?.ask : order?.bid;
        account = await this.database.getAccountByMemberIdCurrency(
          memberId,
          currencyId,
          { dbTransaction: transacion }
        );
        locked = SafeMath.mult(order.locked, "-1");
        balance = order.locked;
        fee = "0";
        if (account) {
          const newOrder = {
            id: orderId,
            state: Database.ORDER_STATE_CODE.CANCEL,
          };
          await this.database.updateOrder(newOrder, {
            dbTransaction: transacion,
          });
          await this._updateAccount({
            account,
            dbTransaction: transacion,
            balance,
            locked,
            fee,
            modifiableType: Database.MODIFIABLE_TYPE.ORDER,
            modifiableId: orderId,
            createdAt,
            fun: Database.FUNC.UNLOCK_FUNDS,
            reason: Database.REASON.ORDER_CANCEL,
          });
          updateOrder = {
            ...orderData,
            state: Database.ORDER_STATE.CANCEL,
            state_text: Database.ORDER_STATE_TEXT.CANCEL,
            at: parseInt(SafeMath.div(Date.now(), "1000")),
            ts: Date.now(),
          };
          this._emitUpdateOrder({
            memberId,
            instId: updateOrder.instId,
            market: updateOrder.market,
            order: updateOrder,
          });
          updateAccount = {
            balance: SafeMath.plus(account.balance, balance),
            locked: SafeMath.plus(account.locked, locked),
            currency: this.coinsSettings.find(
              (curr) => curr.id === account.currency
            )?.symbol,
            total: SafeMath.plus(
              SafeMath.plus(account.balance, balance),
              SafeMath.plus(account.locked, locked)
            ),
          };
          this._emitUpdateAccount({ memberId, account: updateAccount });
          result = true;
        }
      }
    } catch (error) {
      this.logger.error(
        `[${this.constructor.name} updateOrderStatus] error`,
        error
      );
    }
    return result;
    /* !!! HIGH RISK (end) !!! */
  }
  // ++ TODO: fix multi return
  async postCancelOrder({ header, params, query, body, memberId }) {
    const tickerSetting = this.tickersSettings[body.market];
    const source = tickerSetting?.source;
    // const t = await this.database.transaction();
    try {
      // 1. get orderId from body.clOrdId
      // let { orderId } =
      //   source === SupportedExchange.OKEX
      //     ? Utils.parseClOrdId(body.clOrdId)
      //     : { orderId: body.id };
      let orderId = body.id;
      switch (source) {
        case SupportedExchange.OKEX:
          /* !!! HIGH RISK (start) !!! */
          let result,
            response,
            transacion = await this.database.transaction();

          result = await this.updateOrderStatus({
            transacion,
            orderId,
            memberId,
            orderData: body,
          });
          if (result) {
            /* !!! HIGH RISK (end) !!! */
            response = await this.okexConnector.router("postCancelOrder", {
              params,
              query,
              body,
            });
            this.logger.log(`postCancelOrder`, body);
            this.logger.log(`okexCancelOrderRes`, response);
            if (!response.success) {
              await transacion.rollback();
            } else {
              await transacion.commit();
            }
          } else {
            await transacion.rollback();
            response = new ResponseFormat({
              message: "DB ERROR",
              code: Codes.CANCEL_ORDER_FAIL,
            });
          }
          return response;
        case SupportedExchange.TIDEBIT:
          return this.tideBitConnector.router(`postCancelOrder`, {
            header,
            body: { ...body, orderId, market: tickerSetting },
          });

        default:
          // await t.rollback();
          return new ResponseFormat({
            message: "instId not Support now",
            code: Codes.API_NOT_SUPPORTED,
          });
      }
    } catch (error) {
      this.logger.error(error);
      // await t.rollback();
      return new ResponseFormat({
        message: error.message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }

  // ++ TODO
  // get pending orders by snapshot
  async cancelOrders({ header, body, memberId }) {
    const tickerSetting = this.tickersSettings[body.id];
    const source = tickerSetting?.source;
    try {
      switch (source) {
        case SupportedExchange.OKEX:
          // get pending orders by snapshot
          const _orders = await this.getOrdersFromDb({
            ...body,
            tickerSetting,
            memberId,
            // state: Database.ORDER_STATE_CODE.WAIT,
            // orderType: Database.ORD_TYPE.LIMIT,
          });

          const orders = _orders
            .filter(
              (_order) =>
                body.type === Database.ORDER_KIND.ALL ||
                (body.type === Database.ORDER_KIND.ASK &&
                  _order.type === Database.TYPE.ORDER_ASK) ||
                (body.type === Database.ORDER_KIND.BID &&
                  _order.type === Database.TYPE.ORDER_BID)
            )
            .map((_order) => {
              return {
                ..._order,
                ordId: Utils.parseClOrdId(_order.clOrdId),
              };
            });
          const res = [];
          const err = [];
          orders.forEach(async (order) => {
            /* !!! HIGH RISK (start) !!! */
            let t = await this.updateOrderStatus({
              orderId: order.id,
              memberId,
              orderData: body,
            });
            /* !!! HIGH RISK (end) !!! */
            const okexCancelOrderRes = await this.okexConnector.router(
              "postCancelOrder",
              { body }
            );
            this.logger.log(`postCancelOrder`, body);
            this.logger.log(`okexCancelOrderRes`, okexCancelOrderRes);
            if (!okexCancelOrderRes.success) {
              err.push(okexCancelOrderRes);
              await t.rollback();
            } else {
              res.push(okexCancelOrderRes);
              await t.commit();
            }
          });
          if (err.length > 0) {
            return new ResponseFormat({
              message: "Fail to cancel partial orders",
              code: Codes.API_NOT_SUPPORTED,
            });
          } else {
            return new ResponseFormat({
              message: "postCancelOrder",
              payload: res,
            });
          }
        /* !!! HIGH RISK (end) !!! */
        case SupportedExchange.TIDEBIT:
          let functionName =
            body.type === Database.ORDER_KIND.ASK
              ? "cancelAllAsks"
              : body.type === Database.ORDER_KIND.BID
              ? "cancelAllBids"
              : body.type === Database.ORDER_KIND.ALL
              ? "cancelAllOrders"
              : undefined;
          if (functionName) {
            return this.tideBitConnector.router(`${functionName}`, {
              header,
              body: { ...body, market: tickerSetting },
            });
          } else
            return new ResponseFormat({
              message: "instId not Support now",
              code: Codes.API_NOT_SUPPORTED,
            });
        default:
          return new ResponseFormat({
            message: "instId not Support now",
            code: Codes.API_NOT_SUPPORTED,
          });
      }
    } catch (error) {
      return new ResponseFormat({
        message: error.message,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
  }
  // trade api end

  // public api
  async getInstruments({ params, query }) {
    const list = [];
    try {
      const okexRes = await this.okexConnector.router("getInstruments", {
        params,
        query,
      });
      if (okexRes.success) {
        const okexInstruments = okexRes.payload;
        const includeTidebitMarket = Utils.marketFilterInclude(
          this.tidebitMarkets,
          okexInstruments
        );
        includeTidebitMarket.forEach((market) => {
          market.source = SupportedExchange.OKEX;
        });
        list.push(...includeTidebitMarket);
      } else {
        return okexRes;
      }
    } catch (error) {
      this.logger.error(error);
      return new ResponseFormat({
        message: error.stack,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }
    try {
      const tideBitOnlyMarkets = Utils.marketFilterExclude(
        list,
        this.tidebitMarkets
      );
      const isVisibles = tideBitOnlyMarkets.filter(
        (m) => m.visible === true || m.visible === undefined
      ); // default visible is true, so if visible is undefined still need to show on list.
      list.push(...isVisibles);
    } catch (error) {
      this.logger.error(error);
      return new ResponseFormat({
        message: error.stack,
        code: Codes.API_UNKNOWN_ERROR,
      });
    }

    return new ResponseFormat({
      message: "getInstruments",
      payload: list,
    });
  }

  // public api end
  async getExAccounts({ query }) {
    const { exchange } = query;
    this.logger.debug(`[${this.constructor.name}] getExAccounts`, exchange);
    switch (exchange) {
      case SupportedExchange.OKEX:
      default:
        try {
          this.logger.debug(
            `[${this.constructor.name}] getExAccounts run default`
          );
          const okexRes = await this.okexConnector.router("getExAccounts", {
            query,
          });
          return okexRes;
        } catch (error) {
          this.logger.error(error);
          return new ResponseFormat({
            message: error.stack,
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
    }
  }

  getAdminUser({ memberId, email }) {
    if (!this.adminUsers) {
      this.adminUsers = this._getAdminUsers();
    }
    let roles, name;
    if (email) {
      let user = this.adminUsers.find((user) => user.email === email);
      roles = user?.roles;
      name = user?.name;
    }
    return Promise.resolve(
      new ResponseFormat({
        message: "getAdminUser",
        payload: email
          ? {
              memberId: memberId,
              email: email,
              roles: roles,
              name: name,
            }
          : null,
      })
    );
  }

  async getOptions({ query, memberId, email, token }) {
    this.logger.debug(`*********** [${this.name}] getOptions ************`);
    this.logger.debug(
      `[${this.constructor.name}] getOptions`,
      this.config.websocket.domain
    );
    this.logger.debug(
      `[${this.constructor.name}] memberId`,
      memberId,
      `email`,
      email
    );
    // let roles = this.adminUsers.find((user) => user.email === email)?.roles;
    return Promise.resolve(
      new ResponseFormat({
        message: "getOptions",
        payload: {
          wsUrl: this.config.websocket.domain,
          memberId: memberId,
          email: email,
          // roles: roles,
          peatioSession: token,
        },
      })
    );
  }

  async broadcast(market, { type, data }) {
    const ws = await this.getBot("WSChannel");
    return ws.broadcast(market, { type, data });
  }

  async broadcastAllClient({ type, data }) {
    const ws = await this.getBot("WSChannel");
    return ws.broadcastAllClient({ type, data });
  }

  async broadcastPrivateClient(memberId, { market, type, data }) {
    const ws = await this.getBot("WSChannel");
    return ws.broadcastPrivateClient(memberId, { market, type, data });
  }

  async broadcastAllPrivateClient(memberId, { type, data }) {
    const ws = await this.getBot("WSChannel");
    return ws.broadcastAllPrivateClient(memberId, { type, data });
  }

  async _updateOrderDetail(formatOrder) {
    this.logger.log(
      `---------- [${this.constructor.name}]  _updateOrderDetail [START] ----------`
    );
    const t = await this.database.transaction();
    /* !!! HIGH RISK (start) !!! */
    // 1. get orderId from body
    // 2. get order data from table
    // 3. find and lock account
    // 4. update order state
    // 5. get balance and locked value from order
    // 6. add trade // -- CAUTION!!! skip now, tradeId use okex tradeId ++ TODO
    // 7. add vouchers
    // 8. add account_version
    // 9. update account balance and locked
    try {
      const {
        ordType,
        instId,
        accFillSz,
        clOrdId,
        tradeId,
        state,
        side,
        fillPx,
        fillSz,
        sz,
        fee,
        uTime,
        ordId,
      } = formatOrder;
      // get orderId from formatOrder.clOrdId
      const { memberId, orderId } = Utils.parseClOrdId(clOrdId);
      const order = await this.database.getOrder(orderId, { dbTransaction: t });
      if (order.state !== Database.ORDER_STATE_CODE.WAIT) {
        await t.rollback();
        this.logger.error(`[${this.constructor.name}], order has been closed`);
      }
      const currencyId =
        order.type === Database.TYPE.ORDER_ASK ? order.ask : order.bid;
      const accountAsk = await this.database.getAccountByMemberIdCurrency(
        memberId,
        order.ask,
        { dbTransaction: t }
      );
      const accountBid = await this.database.getAccountByMemberIdCurrency(
        memberId,
        order.bid,
        { dbTransaction: t }
      );

      /*******************************************
       * formatOrder.clOrdId: custom orderId for okex
       * formatOrder.accFillSz: valume which already matched
       * formatOrder.state: 'live', 'canceled', 'filled', 'partially_filled', but 'cancel' may not enter this function
       * lockedA: Ask locked value, this value would be negative
       *   if formatOrder.side === 'sell', formatOrder.fillSz || '0'
       * feeA: Ask fee value
       *   if formatOrder.side === 'buy', formatOrder.fee - all this order ask vouchers.fee || 0
       * balanceA: Ask Balance, this value would be positive;
       *   if formatOrder.side === 'buy', formatOrder.fillSz - feeA || '0'
       * lockedB: Bid locked value, this value would be negative
       *   if formatOrder.side === 'buy',value = formatOrder.fillSz * formatOrder.fillPx - feeA, else value = '0'
       * feeB: Bid fee value
       *   if formatOrder.side === 'sell', formatOrder.fee - all this order bid vouchers.fee || 0
       * balanceB: Bid Blance, this value would be positive;
       *   if formatOrder.side === 'sell',value = formatOrder.fillSz * formatOrder.fillPx - feeB, else value = '0'
       * newOrderVolume: remain volume to be matched
       * newOrderLocked: remain locked to be matched
       * newFundReceive:
       *   if formatOrder.side === 'sell': formatOrder.fillSz * formatOrder.fillPx
       *   if formatOrder.side === 'buy': formatOrder.fillSz
       * changeBalance: if order is done, euqal to newOrderLocked
       * changeLocked: if order is done, euqal to newOrderLocked * -1
       *******************************************/

      let orderState = Database.ORDER_STATE_CODE.WAIT;
      if (state === Database.ORDER_STATE.FILLED) {
        orderState = Database.ORDER_STATE_CODE.DONE;
      }

      const lockedA =
        side === Database.ORDER_SIDE.SELL ? SafeMath.mult(fillSz, "-1") : "0";
      const totalFee = SafeMath.abs(fee);
      const feeA =
        side === Database.ORDER_SIDE.BUY
          ? await this._calculateFee(
              orderId,
              Database.ORDER_KIND.ASK,
              totalFee,
              t
            )
          : "0";
      const balanceA =
        side === Database.ORDER_SIDE.BUY ? SafeMath.minus(fillSz, feeA) : "0";

      const value = SafeMath.mult(fillPx, fillSz);
      const lockedB =
        side === Database.ORDER_SIDE.BUY ? SafeMath.mult(value, "-1") : "0";
      const feeB =
        side === Database.ORDER_SIDE.SELL
          ? await this._calculateFee(
              orderId,
              Database.ORDER_KIND.BID,
              totalFee,
              t
            )
          : "0";
      const balanceB =
        side === Database.ORDER_SIDE.SELL ? SafeMath.minus(value, feeB) : "0";

      const newOrderVolume = SafeMath.minus(order.origin_volume, accFillSz);
      const newOrderLocked = SafeMath.plus(
        order.locked,
        side === Database.ORDER_SIDE.BUY ? lockedB : lockedA
      );
      const newFundReceive = side === Database.ORDER_SIDE.BUY ? fillSz : value;

      const changeBalance = newOrderLocked;
      const changeLocked = SafeMath.mult(newOrderLocked, "-1");

      const created_at = new Date().toISOString();
      const updated_at = created_at;

      const newOrder = {
        id: orderId,
        volume: newOrderVolume,
        state: orderState,
        locked: newOrderLocked,
        funds_received: newFundReceive,
        trades_count: order.trades_count + 1,
      };

      // TODO: ++ 6. add trade
      // -- CAUTION!!! skip now, tradeId use okex tradeId,
      // because it need columns 'ask_member_id' and 'bid_member_id' with foreign key
      const base_unit = this.coinsSettings.find(
        (curr) => curr.id === order.ask
      )?.key;
      const quote_unit = this.coinsSettings.find(
        (curr) => curr.id === order.bid
      )?.key;
      if (!base_unit || !quote_unit)
        throw Error(
          `order base_unit[order.ask: ${order.ask}] or quote_unit[order.bid: ${order.bid}] not found`
        );
      await this.database.insertVouchers(
        memberId,
        orderId,
        tradeId, // ++ TODO reference step6 trade.id
        null,
        base_unit, // -- need change
        quote_unit, // -- need change
        fillPx,
        fillSz,
        value,
        order.type === Database.TYPE.ORDER_ASK
          ? Database.ORDER_KIND.ASK
          : Database.ORDER_KIND.BID,
        order.type === Database.TYPE.ORDER_ASK ? feeB : "0", // get bid, so fee is bid
        order.type === Database.TYPE.ORDER_ASK ? "0" : feeA, // get ask, so fee is ask
        created_at,
        { dbTransaction: t }
      );

      await this.database.updateOrder(newOrder, { dbTransaction: t });

      const _updateOrder = {
        id: ordId,
        at: parseInt(SafeMath.div(uTime, "1000")),
        ts: parseInt(uTime),
        market: instId.replace("-", "").toLowerCase(),
        kind:
          side === Database.ORDER_SIDE.BUY
            ? Database.ORDER_KIND.BID
            : Database.ORDER_KIND.ASK,
        price: null, // market prcie
        origin_volume: sz,
        clOrdId: clOrdId,
        state:
          state === Database.ORDER_STATE.CANCEL
            ? Database.ORDER_STATE.CANCEL
            : state === Database.ORDER_STATE.FILLED
            ? Database.ORDER_STATE.DONE
            : Database.ORDER_STATE.WAIT,
        state_text:
          state === Database.ORDER_STATE.CANCEL
            ? Database.ORDER_STATE_TEXT.CANCEL
            : state === Database.ORDER_STATE.FILLED
            ? Database.ORDER_STATE_TEXT.DONE
            : Database.ORDER_STATE_TEXT.WAIT,
        volume: SafeMath.minus(sz, fillSz),
        instId: instId,
        ordType: ordType,
        filled: state === Database.ORDER_STATE.FILLED,
      };
      this.logger.log(
        `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.order}] updateOrder ln:1092`,
        _updateOrder
      );
      this.orderBook.updateByDifference(memberId, instId, {
        add: [_updateOrder],
      });
      let market = instId.replace("-", "").toLowerCase();
      EventBus.emit(Events.order, memberId, market, {
        market,
        difference: this.orderBook.getDifference(memberId, instId),
      });
      await this._updateAccount({
        account: accountAsk,
        dbTransaction: t,
        balance: balanceA,
        locked: lockedA,
        fee: feeA,
        modifiableType: Database.MODIFIABLE_TYPE.TRADE,
        modifiableId: tradeId,
        createdAt: created_at,
        fun:
          order.type === Database.TYPE.ORDER_ASK
            ? Database.FUNC.UNLOCK_AND_SUB_FUNDS
            : Database.FUNC.PLUS_FUNDS,
      });
      let _updateAcc = {
        balance: SafeMath.plus(accountAsk.balance, balanceA),
        locked: SafeMath.plus(accountAsk.balance, lockedA), //++ TODO verify => SafeMath.plus(accountAsk.balance, lockedA)
        currency: this.coinsSettings.find(
          (curr) => curr.id === accountAsk.currency
        )?.symbol,
        total: SafeMath.plus(
          SafeMath.plus(accountAsk.balance, balanceA),
          SafeMath.plus(accountAsk.balance, lockedA) //++ TODO verify => SafeMath.plus(accountAsk.balance, lockedA)
        ),
      };
      this.accountBook.updateByDifference(memberId, _updateAcc);
      EventBus.emit(
        Events.account,
        memberId,
        this.accountBook.getDifference(memberId)
      );

      this.logger.log(
        `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.account}] _updateAcc ln:1057`,
        _updateAcc
      );
      await this._updateAccount({
        account: accountBid,
        dbTransaction: t,
        balance: balanceB,
        locked: lockedB,
        fee: feeB,
        modifiableType: Database.MODIFIABLE_TYPE.TRADE,
        modifiableId: tradeId,
        createdAt: created_at,
        fun:
          order.type === Database.TYPE.ORDER_ASK
            ? Database.FUNC.PLUS_FUNDS
            : Database.FUNC.UNLOCK_AND_SUB_FUNDS,
      });
      _updateAcc = {
        balance: SafeMath.plus(accountBid.balance, balanceB),
        locked: SafeMath.plus(accountBid.balance, lockedB),
        currency: this.coinsSettings.find(
          (curr) => curr.id === accountBid.currency
        )?.symbol,
        total: SafeMath.plus(
          SafeMath.plus(accountBid.balance, balanceB),
          SafeMath.plus(accountBid.balance, lockedB)
        ),
      };
      this.accountBook.updateByDifference(memberId, _updateAcc);
      EventBus.emit(
        Events.account,
        memberId,
        this.accountBook.getDifference(memberId)
      );

      this.logger.log(
        `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.account}] _updateAcc ln:1086`,
        _updateAcc
      );
      // order 完成，解鎖剩餘沒用完的
      if (
        orderState === Database.ORDER_STATE_CODE.DONE &&
        SafeMath.gt(newOrderLocked, "0")
      ) {
        if (order.type === Database.TYPE.ORDER_ASK) {
          // ++ TODO reference step6 trade.id
          await this._updateAccount({
            account: accountAsk,
            dbTransaction: t,
            balance: changeLocked,
            locked: changeBalance,
            fee: 0,
            modifiableType: Database.MODIFIABLE_TYPE.TRADE,
            modifiableId: tradeId,
            createdAt: created_at,
            fun: Database.FUNC.UNLOCK_FUNDS,
          });
          _updateAcc = {
            balance: SafeMath.plus(accountAsk.balance, changeLocked),
            locked: SafeMath.plus(accountAsk.balance, changeBalance),
            currency: this.coinsSettings.find(
              (curr) => curr.id === accountAsk.currency
            )?.symbol,
            total: SafeMath.plus(
              SafeMath.plus(accountAsk.balance, changeLocked),
              SafeMath.plus(accountAsk.balance, changeBalance)
            ),
          };
          this.accountBook.updateByDifference(memberId, _updateAcc);
          EventBus.emit(
            Events.account,
            memberId,
            this.accountBook.getDifference(memberId)
          );
          this.logger.log(
            `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.account}] _updateAcc ln:1120`,
            _updateAcc
          );
        } else if (order.type === Database.TYPE.ORDER_BID) {
          // ++ TODO reference step6 trade.id
          await this._updateAccount({
            account: accountBid,
            dbTransaction: t,
            balance: changeLocked,
            locked: changeBalance,
            fee: 0,
            modifiableType: Database.MODIFIABLE_TYPE.TRADE,
            modifiableId: tradeId,
            createdAt: created_at,
            fun: Database.FUNC.UNLOCK_FUNDS,
          });
          _updateAcc = {
            balance: SafeMath.plus(accountBid.balance, changeLocked),
            locked: SafeMath.plus(accountBid.balance, changeBalance),
            currency: this.coinsSettings.find(
              (curr) => curr.id === accountBid.currency
            )?.symbol,
            total: SafeMath.plus(
              SafeMath.plus(accountBid.balance, changeLocked),
              SafeMath.plus(accountBid.balance, changeBalance)
            ),
          };
          this.accountBook.updateByDifference(memberId, _updateAcc);
          EventBus.emit(
            Events.account,
            memberId,
            this.accountBook.getDifference(memberId)
          );
          this.logger.log(
            `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.account}] _updateAcc ln:1149`,
            _updateAcc
          );
        }
      }

      await t.commit();
    } catch (error) {
      this.logger.error(error);
      await t.rollback();
    }
    /* !!! HIGH RISK (end) !!! */
  }

  async _getPlaceOrderData(memberId, body, tickerSetting) {
    if (!tickerSetting) {
      throw new Error(`this ticker ${body.instId} can be found.`);
    }
    const { id: bid } = this.coinsSettings.find(
      (curr) => curr.code === tickerSetting.quoteUnit
    );
    const { id: ask } = this.coinsSettings.find(
      (curr) => curr.code === tickerSetting.baseUnit
    );
    if (!bid) {
      throw new Error(`bid not found`);
    }
    if (!ask) {
      throw new Error(`ask not found`);
    }
    const currency = tickerSetting.code;
    const type =
      body.kind === Database.ORDER_KIND.BID
        ? Database.TYPE.ORDER_BID
        : Database.TYPE.ORDER_ASK;
    const ordType =
      body.ordType === Database.ORD_TYPE.MARKET
        ? Database.ORD_TYPE.IOC
        : body.ordType;
    const price =
      ordType === Database.ORD_TYPE.IOC
        ? type === Database.TYPE.ORDER_BID
          ? body.price
            ? (parseFloat(body.price) * 1.05).toString()
            : null
          : body.price
          ? (parseFloat(body.price) * 0.95).toString()
          : null
        : body.price || null;
    const locked =
      type === Database.TYPE.ORDER_BID
        ? SafeMath.mult(price, body.volume)
        : body.volume;
    const balance = SafeMath.mult(locked, "-1"); // balanceDiff
    const createdAt = new Date().toISOString();
    const orderData = {
      bid,
      ask,
      currency,
      price,
      volume: body.volume,
      originVolume: body.volume,
      state: Database.ORDER_STATE_CODE.WAIT,
      doneAt: null,
      type,
      memberId,
      createdAt,
      updatedAt: createdAt,
      sn: null,
      source: "Web",
      ordType,
      locked,
      originLocked: locked,
      fundsReceived: 0,
      tradesCount: 0,
      balance,
    };
    return orderData;
  }

  async _updateAccount({
    account,
    reason,
    dbTransaction,
    balance,
    locked,
    fee,
    modifiableType,
    modifiableId,
    createdAt,
    fun,
  }) {
    /* !!! HIGH RISK (start) !!! */
    const updatedAt = createdAt;
    const oriAccBal = account.balance;
    const oriAccLoc = account.locked;
    const newAccBal = SafeMath.plus(oriAccBal, balance);
    const newAccLoc = SafeMath.plus(oriAccLoc, locked);
    const amount = SafeMath.plus(newAccBal, newAccLoc);
    const newAccount = {
      id: account.id,
      balance: newAccBal,
      locked: newAccLoc,
    };

    await this.database.insertAccountVersion(
      account.member_id,
      account.id,
      reason,
      // Database.REASON.ORDER_CANCEL,
      balance,
      locked,
      fee,
      amount,
      modifiableId,
      modifiableType,
      createdAt,
      updatedAt,
      account.currency,
      fun,
      { dbTransaction }
    );

    await this.database.updateAccount(newAccount, { dbTransaction });
    /* !!! HIGH RISK (end) !!! */
  }

  async _calculateFee(orderId, trend, totalFee, dbTransaction) {
    const vouchers = await this.database.getVouchersByOrderId(orderId, {
      dbTransaction,
    });
    let totalVfee = "0";
    for (const voucher of vouchers) {
      if (voucher.trend === trend) {
        switch (trend) {
          case Database.ORDER_KIND.ASK:
            totalVfee = SafeMath.plus(totalVfee, voucher.ask_fee);
            break;
          case Database.ORDER_KIND.BID:
            totalVfee = SafeMath.plus(totalVfee, voucher.bid_fee);
            break;
          default:
        }
      }
    }
    return SafeMath.minus(totalFee, totalVfee);
  }
  /**
   *
   * @param {String} memberId
   * @param {String} instId
   * @param {String} market ex: ethusdt
   * @param {Object} order
   */
  _emitUpdateOrder({ memberId, instId, market, order }) {
    this.logger.log(`_emitUpdateOrder difference`, order);
    this.orderBook.updateByDifference(memberId, instId, {
      add: [order],
    });
    EventBus.emit(Events.order, memberId, market, {
      market: market,
      difference: this.orderBook.getDifference(memberId, instId),
    });
    this.logger.log(
      `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.order}] _emitUpdateOrder[market:${market}][memberId:${memberId}][instId:${instId}]`,
      this.orderBook.getDifference(memberId, instId)
    );
  }
  /**
   *
   * @param {String} memberId
   * @param {String} instId
   * @param {String} market ex: ethusdt
   * @param {Object} order
   */
  _emitUpdateMarketOrder({ memberId, instId, market, order }) {
    this.orderBook.updateByDifference(memberId, instId, {
      add: [order],
    });
    EventBus.emit(Events.marketOrder, memberId, market, {
      market: market,
      difference: this.orderBook.getDifference(memberId, instId),
    });
    this.logger.log(`difference`, order);
    this.logger.log(
      `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.marketOrder}] _emitUpdateMarketOrder[market:${market}][memberId:${memberId}][instId:${instId}]`,
      this.orderBook.getDifference(memberId, instId)
    );
  }

  _emitNewTrade({ memberId, instId, market, trade }) {
    this.tradeBook.updateByDifference(instId, 0, [
      {
        ...trade,
        ts: trade.ts || parseInt(SafeMath.mult(trade.at, "1000")),
      },
    ]);
    EventBus.emit(Events.trade, memberId, market, {
      market,
      difference: this.tradeBook.getDifference(instId),
    });
    this.logger.log(`difference`, trade);
    this.logger.log(
      `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.trade}] _emitNewTrade[market:${market}][memberId:${memberId}][instId:${instId}]`,
      this.tradeBook.getDifference(instId)
    );
  }

  _emitUpdateAccount({ memberId, account }) {
    this.accountBook.updateByDifference(memberId, account);
    EventBus.emit(
      Events.account,
      memberId,
      this.accountBook.getDifference(memberId)
    );
    this.logger.log(`difference`, account);
    this.logger.log(
      `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.account}] _emitUpdateAccount[memberId:${memberId}]`,
      this.accountBook.getDifference(memberId)
    );
  }

  async _eventListener() {
    EventBus.on(Events.account, (memberId, account) => {
      this.logger.log(
        `[${this.constructor.name}] EventBus.on(Events.account)`,
        memberId,
        account
      );
      this.broadcastAllPrivateClient(memberId, {
        type: Events.account,
        data: account,
      });
    });

    EventBus.on(Events.order, (memberId, market, order) => {
      this.logger.log(
        `[${this.constructor.name}] EventBus.on(Events.order)`,
        memberId,
        market,
        order
      );
      this.broadcastPrivateClient(memberId, {
        market,
        type: Events.order,
        data: order,
      });
    });

    EventBus.on(Events.userStatusUpdate, (memberId, userStatus) => {
      this.logger.log(
        `[${this.constructor.name}] EventBus.on(Events.userStatusUpdate)`,
        memberId,
        userStatus
      );
      this.broadcastAllPrivateClient(memberId, {
        type: Events.userStatusUpdate,
        data: userStatus,
      });
    });

    EventBus.on(Events.trade, (memberId, market, tradeData) => {
      if (this._isIncludeTideBitMarket(market)) {
        this.logger.log(
          `[${this.constructor.name}] EventBus.on(Events.trade)`,
          memberId,
          market,
          tradeData
        );
        this.broadcastPrivateClient(memberId, {
          market,
          type: Events.trade,
          data: tradeData,
        });
      }
    });

    EventBus.on(Events.trades, (market, tradesData) => {
      this.broadcast(market, {
        type: Events.trades,
        data: tradesData,
      });
    });

    EventBus.on(Events.update, (market, booksData) => {
      this.broadcast(market, {
        type: Events.update,
        data: booksData,
      });
    });

    EventBus.on(Events.candleOnUpdate, (market, trade) => {
      this.broadcast(market, {
        type: Events.candleOnUpdate,
        data: trade,
      });
    });

    EventBus.on(Events.tickers, (updateTickers) => {
      this.broadcastAllClient({
        type: Events.tickers,
        data: updateTickers,
      });
    });

    EventBus.on(Events.orderDetailUpdate, async (instType, formatOrders) => {
      if (instType === Database.INST_TYPE.SPOT) {
        this.logger.log(
          ` ------------- [${this.constructor.name}] EventBus.on(Events.orderDetailUpdate [START]---------------`
        );
        // TODO: using message queue
        for (const formatOrder of formatOrders) {
          if (
            formatOrder.state !==
              Database.ORDER_STATE.CANCEL /* cancel order */ &&
            formatOrder.accFillSz !== "0" /* create order */
          ) {
            // await this._updateOrderDetail(formatOrder);
            await this.exchangeHubService.sync(
              SupportedExchange.OKEX,
              formatOrder,
              true
            );
          } else if (formatOrder.state === Database.ORDER_STATE.CANCEL) {
            let result,
              orderId,
              memberId,
              transacion = await this.database.transaction();
            try {
              let parsedClOrdId = Utils.parseClOrdId(formatOrder.clOrdId);
              orderId = parsedClOrdId.orderId;
              memberId = parsedClOrdId.memberId;
            } catch (e) {
              this.logger.error(`ignore`);
            }
            if (orderId && memberId) {
              result = await this.updateOrderStatus({
                transacion,
                orderId,
                memberId,
                orderData: {
                  ...formatOrder,
                  id: orderId,
                  at: parseInt(SafeMath.div(formatOrder.uTime, "1000")),
                  ts: formatOrder.uTime,
                  market: formatOrder.instId.replace("-", "").toLowerCase(),
                  kind:
                    formatOrder.side === Database.ORDER_SIDE.BUY
                      ? Database.ORDER_KIND.BID
                      : Database.ORDER_KIND.ASK,
                  price: formatOrder.px,
                  origin_volume: formatOrder.sz,
                  state: Database.ORDER_STATE.CANCEL,
                  state_text: Database.ORDER_STATE_TEXT.CANCEL,
                  volume: SafeMath.minus(formatOrder.sz, formatOrder.fillSz),
                },
              });
              if (result) {
                await transacion.commit();
              } else {
                await transacion.rollback();
              }
            }
          }
        }
        this.logger.log(
          ` ------------- [${this.constructor.name}] EventBus.on(Events.orderDetailUpdate [END]---------------`
        );
      }
    });
  }

  _isIncludeTideBitMarket(instId) {
    return (
      Utils.marketFilterInclude(this.tidebitMarkets, [{ instId }]).length > 0
    );
  }
}

module.exports = ExchangeHub;
