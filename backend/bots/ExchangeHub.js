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
const { PLATFORM_ASSET } = require("../constants/PlatformAsset");

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
        this.okexConnector = new OkexConnector({ logger, config });
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
          processor: (type, data) => this.processor(type, data),
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
    this.logger.debug(`upateData`, updateData);
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
    // this.logger.debug(`-*-*-*-*- getAdminUsers -*-*-*-*-`, adminUsers);
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
    // this.logger.debug(`-*-*-*-*- getCoinsSettings -*-*-*-*-`, coinsSettings);
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
        // this.logger.debug(`-*-*-*-*- getDepositsSettings -*-*-*-*-`, depositsSettings);
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
        // this.logger.debug(`-*-*-*-*- getWithdrawsSettings -*-*-*-*-`, withdrawsSettings);
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
    // this.logger.debug(
    //   `currentUser[${currentUser.roles?.includes("root")}]`,
    //   currentUser
    // );
    // if (currentUser.roles?.includes("root")) {
    const _accounts = await this.database.getTotalAccountsAssets();
    coinsSettings = this.coinsSettings.reduce((prev, coinSetting) => {
      if (!prev[coinSetting.id.toString()])
        prev[coinSetting.id.toString()] = { ...coinSetting };
      return prev;
    }, {});
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
        // 需拿交易所所有用戶餘額各幣種的加總
        for (let _account of _accounts) {
          let coinSetting = coinsSettings[_account.currency.toString()];
          if (coinSetting) {
            const sum = SafeMath.plus(
              _account.total_balace,
              _account.total_locked
            );
            const RRRRatio = coinSetting.RRR_ratio || 0.35;
            const MPARatio = coinSetting.MPA_ratio || 0.65;
            const RRR = SafeMath.mult(RRRRatio, sum);
            const MPA = SafeMath.mult(MPARatio, sum);
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
                // accounts: {},
                sum,
                totalBalace: Utils.removeZeroEnd(_account.total_balace),
                totalLocked: Utils.removeZeroEnd(_account.total_locked),
                RRRRatio,
                MPARatio,
                maximun: coinSetting.maximun,
                minimun: coinSetting.minimun,
                sources: {},
              };
              // this.logger.debug(
              //   `getPlatformAssets coins[${coinSetting.code}]`,
              //   coins[coinSetting.code]
              // );
              for (let exchange of Object.keys(SupportedExchange)) {
                let alertLevel;
                switch (SupportedExchange[exchange]) {
                  case SupportedExchange.OKEX:
                    if (
                      !sources[exchange][coinSetting.code] ||
                      SafeMath.eq(sources[exchange][coinSetting.code]?.sum, 0)
                    ) {
                      if (SafeMath.eq(sum, 0))
                        alertLevel = PLATFORM_ASSET.WARNING_LEVEL.NULL;
                      else if (SafeMath.gt(sum, 0))
                        alertLevel = PLATFORM_ASSET.WARNING_LEVEL.LEVEL_4;
                    } else {
                      if (
                        SafeMath.gt(
                          sources[exchange][coinSetting.code]?.sum,
                          MPA
                        )
                      ) {
                        alertLevel = PLATFORM_ASSET.WARNING_LEVEL.LEVEL_1;
                      } else {
                        alertLevel = PLATFORM_ASSET.WARNING_LEVEL.LEVEL_2;
                      }
                      if (
                        SafeMath.lte(
                          sources[exchange][coinSetting.code]?.sum,
                          RRR
                        )
                      ) {
                        alertLevel = PLATFORM_ASSET.WARNING_LEVEL.LEVEL_4;
                      }
                    }
                    coins[coinSetting.code]["sources"][exchange.toLowerCase()] =
                      {
                        balance:
                          sources[exchange][coinSetting.code]?.balance || "0",
                        locked:
                          sources[exchange][coinSetting.code]?.locked || "0",
                        sum: sources[exchange][coinSetting.code]?.sum || "0",
                        alertLevel,
                      };
                    break;
                  case SupportedExchange.TIDEBIT:
                    // ++ TODO 現階段資料拿不到 Tidebit ，顯示 0
                    coins[coinSetting.code]["sources"][exchange.toLowerCase()] =
                      {
                        balance: "0",
                        locked: "0",
                        alertLevel: PLATFORM_ASSET.WARNING_LEVEL.NULL,
                      };
                    break;
                  default:
                }
              }
            }
          } else {
            this.logger.error(
              `getPlatformAssets notic accounts.currency did not have correspond id in coins.yml but maybe in DB assets.base table`,
              coins
            );
          }
        }
        this.logger.debug(`getPlatformAssets coins`, coins);
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

  async updatePlatformAsset({ params, email, body }) {
    const p = path.join(
      this.config.base.TideBitLegacyPath,
      "config/markets/coins.yml"
    );
    this.logger.debug(
      `*********** [${this.name}] updatePlatformAsset ************`
    );
    this.logger.debug(`params.id`, params.id);
    this.logger.debug(`email`, email);
    this.logger.debug(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    this.logger.debug(
      `currentUser[${currentUser.roles?.includes("root")}]`,
      currentUser
    );
    try {
      if (currentUser.roles?.includes("root")) {
        let index = this.coinsSettings.findIndex(
          (coin) => coin.id.toString() === params.id.toString()
        );
        this.logger.debug(`index`, index);
        if (index !== -1) {
          let updatedCoinsSettings = this.coinsSettings.map((coin) => ({
            ...coin,
          }));
          updatedCoinsSettings[index] = {
            ...updatedCoinsSettings[index],
            RRR_ratio: body.RRRRatio,
            MPA_ratio: body.MPARatio,
            maximun: body.maximun,
            minimun: body.minimun,
          };
          this.logger.debug(
            `updatePlatformAsset[${index}]`,
            updatedCoinsSettings[index]
          );
          try {
            Utils.yamlUpdate(updatedCoinsSettings, p);
            this.coinsSettings = updatedCoinsSettings;
            result = await this.getPlatformAssets({ query: {} });
          } catch (e) {
            this.logger.error(
              `yamlUpdate updatePlatformAsset`,
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
            message: "Update asset is not  existed",
            code: Codes.INVALID_INPUT,
          });
        }
      } else {
        result = new ResponseFormat({
          message: "Current user is not allow to update platform asset",
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

  async updateTickerSetting({ params, email, body }) {
    const p = path.join(
      this.config.base.TideBitLegacyPath,
      "config/markets/markets.yml"
    );
    this.logger.debug(
      `*********** [${this.name}] updateTickerSetting ************`
    );
    this.logger.debug(`params.id`, params.id);
    this.logger.debug(`email`, email);
    this.logger.debug(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    this.logger.debug(
      `currentUser[${currentUser.roles?.includes("root")}]`,
      currentUser
    );
    try {
      const { type, data } = body;
      this.logger.debug(`type`, type);
      this.logger.debug(`data`, data);
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
          this.logger.debug(
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
    this.logger.debug(`params.id`, params.id);
    this.logger.debug(`email`, email);
    this.logger.debug(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    this.logger.debug(
      `currentUser[${currentUser.roles?.includes("root")}]`,
      currentUser
    );
    try {
      const { visible } = body;
      this.logger.debug(`visible`, visible);
      if (currentUser.roles?.includes("root")) {
        let index = this.coinsSettings.findIndex(
          (coin) => coin.id.toString() === params.id.toString()
        );
        this.logger.debug(`index`, index);
        if (index !== -1) {
          let updatedCoinsSettings = this.coinsSettings.map((coin) => ({
            ...coin,
          }));
          updatedCoinsSettings[index] = {
            ...updatedCoinsSettings[index],
            visible: visible,
          };
          this.logger.debug(
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
          message: "Current user is not allow to update coins settings",
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
    this.logger.debug(`email`, email);
    this.logger.debug(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    this.logger.debug(
      `currentUser[${currentUser.roles?.includes("root")}]`,
      currentUser
    );
    try {
      const { visible } = body;
      this.logger.debug(`visible`, visible);
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
          message: "Current user is not allow to update coins settings",
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
    this.logger.debug(`params.id`, params.id);
    this.logger.debug(`email`, email);
    this.logger.debug(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email),
      updatedDepositCoin;
    this.logger.debug(
      `currentUser[${currentUser.roles?.includes("root")}]`,
      currentUser
    );
    try {
      const { type, data } = body;
      this.logger.debug(`updateDepositCoin`, type, data);
      if (currentUser.roles?.includes("root")) {
        updatedDepositCoin = this.depositsSettings[params.id];
        this.logger.debug(`updatedDepositCoin`, updatedDepositCoin);
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

          this.logger.debug(
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
    this.logger.debug(`params.id`, params.id);
    this.logger.debug(`email`, email);
    this.logger.debug(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email),
      updatedWithdrawCoin;
    this.logger.debug(
      `currentUser[${currentUser.roles?.includes("root")}]`,
      currentUser
    );
    try {
      const { type, data } = body;
      this.logger.debug(`updateWithdrawCoin`, type, data);
      if (currentUser.roles?.includes("root")) {
        updatedWithdrawCoin = this.withdrawsSettings[params.id];
        this.logger.debug(`updatedWithdrawCoin`, updatedWithdrawCoin);
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
          this.logger.debug(
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
    this.logger.debug(`email`, email);
    this.logger.debug(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    this.logger.debug(`currentUser`, currentUser);
    try {
      const { newAdminUser } = body;
      const newAdminUserEmail = newAdminUser.email?.trim();
      if (currentUser.roles?.includes(ROLES.root)) {
        if (newAdminUserEmail) {
          const index = this.adminUsers.findIndex(
            (user) => user.email === newAdminUserEmail
          );
          if (index === -1) {
            const member = await this.database.getMemberByCondition({
              email: newAdminUserEmail,
            });
            this.logger.debug(`addAdminUser member`, member);
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
              this.logger.debug(
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
    this.logger.debug(`email`, email);
    this.logger.debug(`body`, body);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    this.logger.debug(
      `currentUser[${currentUser.roles?.includes("root")}]`,
      currentUser
    );
    try {
      const { updateAdminUser } = body;
      this.logger.debug(`updateAdminUser`, updateAdminUser);
      if (currentUser.roles?.includes("root")) {
        if (updateAdminUser.email) {
          let index = this.adminUsers.findIndex(
            (user) => user.email === updateAdminUser.email
          );
          this.logger.debug(`index`, index);
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
            this.logger.debug(
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
    this.logger.debug(`params.id`, params.id);
    this.logger.debug(`email`, email);
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    this.logger.debug(`currentUser`, currentUser);
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
          this.logger.debug(
            `deleteAdminUser updateAdminUsers`,
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

  async getDashboardData({ query }) {
    this.logger.debug(
      `*********** [${this.name}] getDashboardData ************`
    );
    return Promise.resolve(
      new ResponseFormat({
        message: "getDashboardData",
        payload: {
          totalAssets: 15000000,
          totalDeposit: 18000000,
          totalWithdraw: 5000000,
          totalProfit: 2000000,
          currency: "HKD",
          alertAssets: [
            {
              balance: 568.39572,
              locked: 0,
              alertLevel: PLATFORM_ASSET.WARNING_LEVEL.LEVEL_2,
              code: "btc",
              key: "Bitcoin",
              source: "OKsub 001",
              sum: 1079.951868,
              RRRRatio: 0.35,
              MPARatio: 0.65,
            },
            {
              balance: 100.392,
              locked: 0,
              alertLevel: PLATFORM_ASSET.WARNING_LEVEL.LEVEL_4,
              code: "usdt",
              key: "Tether",
              source: "OKEx",
              sum: 1079.951868,
              RRRRatio: 0.35,
              MPARatio: 0.65,
            },
          ],
          alertTickers: [
            {
              id: "btcusdt",
              visible: true,
              name: "BTC/USDT",
              profitRatio: 0.55,
              targetRatio: 0.6,
              alertLevel: PLATFORM_ASSET.WARNING_LEVEL.LEVEL_2,
              source: "OKEx",
            },
            {
              id: "btcusdc",
              visible: false,
              name: "BTC/USDC",
              profitRatio: 0.55,
              targetRatio: 0.5,
              alertLevel: PLATFORM_ASSET.WARNING_LEVEL.LEVEL_2,
              source: "OKEx",
            },
            {
              id: "ethusdt",
              visible: true,
              name: "ETH/USDT",
              profitRatio: 0.65,
              targetRatio: 0.7,
              alertLevel: PLATFORM_ASSET.WARNING_LEVEL.LEVEL_4,
              source: "OKEx",
            },
            {
              id: "ethusdc",
              visible: true,
              name: "ETH/USDC",
              profitRatio: 0.65,
              targetRatio: 0.7,
              alertLevel: PLATFORM_ASSET.WARNING_LEVEL.LEVEL_4,
              source: "OKEx",
            },
            {
              id: "etcusdt",
              visible: false,
              name: "ETC/USDT",
              profitRatio: 0.55,
              targetRatio: 0.5,
              alertLevel: PLATFORM_ASSET.WARNING_LEVEL.LEVEL_2,
              source: "OKEx",
            },
          ],
          alertCoins: [
            {
              id: 2,
              visible: true,
              deposit: true,
              key: "Bitcoin",
              profitRatio: 0.55,
              targetRatio: 0.6,
              alertLevel: PLATFORM_ASSET.WARNING_LEVEL.LEVEL_2,
              source: "OKEx",
            },
            {
              id: 3,
              visible: true,
              deposit: false,
              key: "ethereum",
              profitRatio: 0.65,
              targetRatio: 0.7,
              alertLevel: PLATFORM_ASSET.WARNING_LEVEL.LEVEL_4,
              source: "OKEx",
            },
            {
              id: 34,
              visible: true,
              deposit: true,
              key: "Tether",
              profitRatio: 0.65,
              targetRatio: 0.7,
              alertLevel: PLATFORM_ASSET.WARNING_LEVEL.LEVEL_4,
              source: "OKEx",
            },
            {
              id: 79,
              visible: true,
              deposit: true,
              key: "Tether Coin",
              profitRatio: 0.65,
              targetRatio: 0.7,
              alertLevel: PLATFORM_ASSET.WARNING_LEVEL.LEVEL_4,
              source: "OKEx",
            },
            {
              id: 5,
              visible: true,
              deposit: false,
              key: "ethercls",
              profitRatio: 0.55,
              targetRatio: 0.5,
              alertLevel: PLATFORM_ASSET.WARNING_LEVEL.LEVEL_2,
              source: "OKEx",
            },
          ],
        },
      })
    );
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
      let order,
        price = _order.price ? Utils.removeZeroEnd(_order.price) : _order.price;
      if (_order.state === Database.ORDER_STATE_CODE.DONE) {
        if (_order.ord_type === Database.TYPE.ORDER_ASK) {
          price = SafeMath.div(_order.funds_received, _order.origin_volume);
        }
        if (_order.ord_type === Database.TYPE.ORDER_BID) {
          price = SafeMath.div(
            SafeMath.minus(_order.origin_locked, _order.locked),
            _order.funds_received
          );
        }
      }
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
        price,
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

  /**
   * [deprecated] 2022/10/14
   */
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
      // this.logger.debug(`getPriceList res`, res);
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
      this.logger.debug(
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
        const _outerTrades = await this.database.getOuterTrades({
          type: Database.TIME_RANGE_TYPE.BETWEEN,
          exchangeCode: Database.EXCHANGE[exchange.toUpperCase()],
          start: startDate,
          end: endtDate,
        });
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
            tickerSetting =
              this.tickersSettings[trade.instId.toLowerCase().replace("-", "")],
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
          // this.logger.debug(`processTrade`, processTrade);
          outerTrades = [...outerTrades, processTrade];
        }
        // }
        // this.logger.debug(`outerTrades`, outerTrades);
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
      // dbOrders = await this.database.getOrdersJoinMemberEmail(
      //   Database.ORDER_STATE_CODE.WAIT
      // );
      memberIds = [];
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
              fundsReceived =
                order.side === Database.ORDER_SIDE.BUY
                  ? SafeMath.mult(order.avgPx, order.accFillSz)
                  : order.accFillSz,
              processOrder;
            memberIds.push(memberId);
            processOrder = {
              ...order,
              unFillSz: SafeMath.minus(order.sz, order.accFillSz),
              id,
              // email: dbOrder?.email || null,
              memberId,
              exchange: query.exchange,
              fundsReceived,
              ts: parseInt(order.uTime),
            };
            // this.logger.debug(`processOrder`, processOrder);
            outerOrders = [...outerOrders, processOrder];
          }
          let emailsObj = this.database.getEmailsByMemberIds(
            memberIds,
            memberIds.length,
            0
          );
          outerOrders.map((order) => {
            let emailObj = emailsObj.find(
              (obj) => obj.id.toString() === order.memberId.toString()
            );
            return { ...order, email: emailObj.email };
          });
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
    this.logger.debug(
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
          accountVersion,
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
          accountVersion = {
            member_id: memberId,
            currency: currencyId,
            created_at: orderData.createdAt,
            updated_at: orderData.createdAt,
            modifiable_type: Database.MODIFIABLE_TYPE.ORDER,
            modifiable_id: orderId,
            reason: Database.REASON.ORDER_SUBMIT,
            fun: Database.FUNC.LOCK_FUNDS,
            balance: orderData.balance,
            locked: orderData.locked,
            fee: 0,
          };
          account = await this.database.getAccountsByMemberId(memberId, {
            options: { currency: currencyId },
            limit: 1,
            dbTransaction: t,
          });
          await this._updateAccount(accountVersion, t);
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
          this.logger.debug("[RESPONSE]", response);
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
          this.logger.debug(`pendingOrdersRes`, pendingOrdersRes);
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
    this.logger.debug(
      `-------------[${this.constructor.name} getOrderList]----------`
    );
    this.logger.debug(` memberId:`, memberId);
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
    // 1. -get orderId from body-
    // 2. get order data from table
    // 3. find and lock account
    // 4. update order state
    // 5. get balance and locked value from order
    // 6. add account_version
    // 7. update account balance and locked
    // 8. -post okex cancel order-
    // const t = await this.database.transaction();
    /*******************************************
     * body.clOrdId: custom orderId for okex
     * locked: value from order.locked, used for unlock balance, negative in account_version
     * balance: order.locked
     *******************************************/
    let success = false,
      order,
      locked,
      balance,
      fee,
      updatedOrder,
      currencyId,
      account,
      updateAccount,
      accountVersion,
      createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    try {
      order = await this.database.getOrder(orderId, {
        dbTransaction: transacion,
      });
      if (order && order.state !== Database.ORDER_STATE_CODE.CANCEL) {
        currencyId =
          order?.type === Database.TYPE.ORDER_ASK ? order?.ask : order?.bid;
        account = await this.database.getAccountsByMemberId(memberId, {
          options: { currency: currencyId },
          limit: 1,
          dbTransaction: transacion,
        });
        locked = SafeMath.mult(order.locked, "-1");
        balance = order.locked;
        fee = "0";
        if (account) {
          const newOrder = {
            id: orderId,
            state: Database.ORDER_STATE_CODE.CANCEL,
            updated_at: `"${createdAt}"`,
          };
          await this.database.updateOrder(newOrder, {
            dbTransaction: transacion,
          });
          this.logger.error(`被取消訂單的狀態更新了`);
          accountVersion = {
            member_id: memberId,
            currency: currencyId,
            created_at: createdAt,
            updated_at: createdAt,
            modifiable_type: Database.MODIFIABLE_TYPE.ORDER,
            modifiable_id: orderId,
            reason: Database.REASON.ORDER_CANCEL,
            fun: Database.FUNC.UNLOCK_FUNDS,
            balance,
            locked,
            fee,
          };
          await this._updateAccount(accountVersion, transacion);
          this.logger.error(`被取消訂單對應的用戶帳號更新了`);
          updatedOrder = {
            ...orderData,
            state: Database.ORDER_STATE.CANCEL,
            state_text: Database.ORDER_STATE_TEXT.CANCEL,
            at: parseInt(SafeMath.div(Date.now(), "1000")),
            ts: Date.now(),
          };
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
          success = true;
        }
      }
    } catch (error) {
      success = false;
      this.logger.error(
        `[${this.constructor.name} updateOrderStatus] error`,
        error
      );
    }
    return { success, updatedOrder, updateAccount };
    /* !!! HIGH RISK (end) !!! */
  }
  async postCancelOrder({ header, params, query, body, memberId }) {
    const tickerSetting = this.tickersSettings[body.market];
    const source = tickerSetting?.source;
    let result,
      dbUpdateR,
      apiR,
      orderId = body.id;
    try {
      switch (source) {
        case SupportedExchange.OKEX:
          // 1. updateDB
          /* !!! HIGH RISK (start) !!! */
          let transacion = await this.database.transaction();
          this.logger.error(
            `準備呼叫 DB 更新被取消訂單的狀態及更新對應用戶帳號`
          );
          dbUpdateR = await this.updateOrderStatus({
            transacion,
            orderId,
            memberId,
            orderData: body,
          });
          /* !!! HIGH RISK (end) !!! */
          if (!dbUpdateR.success) {
            this.logger.error(`DB 更新失敗`);
            await transacion.rollback();
            result = new ResponseFormat({
              message: "DB ERROR",
              code: Codes.CANCEL_ORDER_FAIL,
            });
          } else {
            // 2. performTask (Task: cancel)
            this.logger.error(`準備呼叫 API 執行取消訂單`);
            this.logger.debug(`postCancelOrder`, body);
            apiR = await this.okexConnector.router("postCancelOrder", {
              params,
              query,
              body,
            });
            this.logger.error(`API 取消訂單成功了`);
            this.logger.debug(`okexCancelOrderRes`, apiR);
          }
          if (!apiR.success) {
            this.logger.error(`API 取消訂單失敗`);
            await transacion.rollback();
          } else {
            await transacion.commit();
            // 3. informFrontEnd
            this.logger.error(`準備通知前端更新頁面`);
            this._emitUpdateOrder({
              memberId,
              instId: body.instId,
              market: body.market,
              order: dbUpdateR.updatedOrder,
            });
            this._emitUpdateAccount({
              memberId,
              account: dbUpdateR.updateAccount,
            });
            this.logger.error(`通知前端成功了`);
          }
          result = apiR;
          break;
        case SupportedExchange.TIDEBIT:
          result = this.tideBitConnector.router(`postCancelOrder`, {
            header,
            body: { ...body, orderId, market: tickerSetting },
          });
          break;
        default:
          result = new ResponseFormat({
            message: "instId not Support now",
            code: Codes.INVALID_INPUT,
          });
          break;
      }
    } catch (error) {
      this.logger.error(`取消訂單失敗了`, error);
      result = new ResponseFormat({
        message: error.message,
        code: Codes.CANCEL_ORDER_FAIL,
      });
    }
    return result;
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
            this.logger.debug(`postCancelOrder`, body);
            this.logger.debug(`okexCancelOrderRes`, okexCancelOrderRes);
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

  /**
   * [deprecated] 2022/10/14
   */
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

  getMemberFeeRate(member, market) {
    let memberTag, askFeeRate, bidFeeRate;
    memberTag = member.member_tag;
    this.logger.debug(`member.member_tag`, member.member_tag); // 1 是 vip， 2 是 hero
    if (memberTag) {
      if (memberTag.toString() === Database.MEMBER_TAG.VIP_FEE.toString()) {
        askFeeRate = market.ask.vip_fee;
        bidFeeRate = market.bid.vip_fee;
      }
      if (memberTag.toString() === Database.MEMBER_TAG.HERO_FEE.toString()) {
        askFeeRate = market.ask.hero_fee;
        bidFeeRate = market.bid.hero_fee;
      }
    } else {
      askFeeRate = market.ask.fee;
      bidFeeRate = market.bid.fee;
    }
    return { askFeeRate, bidFeeRate };
  }

  async emitter({
    memberId,
    market,
    instId,
    updatedOrder,
    trade,
    askAccountVersion,
    bidAccountVersion,
    orderFullFilledAccountVersion,
    dbTransaction,
  }) {
    if (!instId || !market || !memberId) this.logger.error("missing arguments");
    try {
      if (updatedOrder) {
        let time = updatedOrder.updated_at.replace(/['"]+/g, "");
        let order = {
          ...updatedOrder,
          at: parseInt(SafeMath.div(new Date(time).getTime(), "1000")),
          ts: new Date(time).getTime(),
          market: market.id,
          filled: updatedOrder.state === Database.ORDER_STATE_CODE.DONE,
          state_text:
            updatedOrder.state === Database.ORDER_STATE_CODE.DONE
              ? Database.ORDER_STATE_TEXT.DONE
              : updatedOrder.state === Database.ORDER_STATE_CODE.CANCEL
              ? Database.ORDER_STATE_TEXT.CANCEL
              : Database.ORDER_STATE_TEXT.WAIT,
          state:
            updatedOrder.state === Database.ORDER_STATE_CODE.DONE
              ? Database.ORDER_STATE.DONE
              : updatedOrder.state === Database.ORDER_STATE_CODE.CANCEL
              ? Database.ORDER_STATE.CANCEL
              : Database.ORDER_STATE.WAIT,
          state_code:
            updatedOrder.state === Database.ORDER_STATE_CODE.DONE
              ? Database.ORDER_STATE_CODE.DONE
              : updatedOrder.state === Database.ORDER_STATE_CODE.CANCEL
              ? Database.ORDER_STATE_CODE.CANCEL
              : Database.ORDER_STATE_CODE.WAIT,
        };
        this._emitUpdateOrder({
          memberId,
          instId,
          market: market.id,
          order,
        });
      }
      let tmp = this.accountBook.getSnapshot(memberId, instId);
      this.logger.log(
        `emitter this.accountBook.getSnapshot([memberId: ${memberId}], [instId: ${instId}])`,
        tmp
      );
      if (!tmp) {
        tmp = [];
        tmp[0] = await this.database.getAccountsByMemberId(
          askAccountVersion.member_id,
          {
            options: { currency: askAccountVersion.currency },
            limit: 1,
            dbTransaction,
          }
        );
      }
      let balance, locked, total;
      if (askAccountVersion) {
        let askAccount = tmp ? tmp[0] : null;
        balance = SafeMath.plus(askAccount.balance, askAccountVersion.balance);
        locked = SafeMath.plus(askAccount.locked, askAccountVersion.locked);
        total = SafeMath.plus(balance, locked);
        this._emitUpdateAccount({
          memberId,
          account: {
            balance,
            locked,
            currency: market.ask.currency.toUpperCase(),
            total,
          },
        });
      }
      if (bidAccountVersion) {
        let bidAccount = tmp ? tmp[1] : null;
        balance = SafeMath.plus(bidAccount.balance, askAccountVersion.balance);
        locked = SafeMath.plus(bidAccount.locked, askAccountVersion.locked);
        total = SafeMath.plus(balance, locked);
        if (orderFullFilledAccountVersion) {
          balance = SafeMath.plus(
            balance,
            orderFullFilledAccountVersion.balance
          );
          locked = SafeMath.plus(locked, orderFullFilledAccountVersion.locked);
          total = SafeMath.plus(balance, locked);
        }
        this._emitUpdateAccount({
          memberId,
          account: {
            balance,
            locked,
            currency: market.ask.currency.toUpperCase(),
            total,
          },
        });
      }
    } catch (error) {
      this.logger.error("Fail to inform frontend", error);
    }
  }

  /**
   * @typedef {Object} Voucher
   * @property {int} id
   * @property {int} member_id
   * @property {int} order_id
   * @property {int} trade_id
   * @property {String} ask (symbol, ex: eth)
   * @property {String} bid (symbol, ex: usdt)
   * @property {decimal} price
   * @property {decimal} volume
   * @property {decimal} value
   * @property {String} trend
   * @property {decimal} ask_fee
   * @property {decimal} bid_fee
   * @property {date} created_at
   */
  /**
   * @typedef {Object} AccountVersion
   * @property {int} id
   * @property {int} member_id
   * @property {int} account_id
   * @property {int} reason
   * @property {decimal} balance
   * @property {decimal} locked
   * @property {decimal} fee
   * @property {decimal} amount
   * @property {int} modifiable_id
   * @property {String} modifiable_type
   * @property {int} currency
   * @property {int} fun
   * @property {Date} created_at
   * @property {Date} updated_at
   */
  // 1. 根據 data 計算需要更新的 order、 trade 、 voucher、 accountVersion(s)，裡面的格式是DB直接可用的資料
  calculator({ market, member, dbOrder, data, type }) {
    this.logger.debug(`calculator `);
    let now = `${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
      value = SafeMath.mult(data.fillPx, data.fillSz),
      tmp = this.getMemberFeeRate(member, market),
      askFeeRate = tmp.askFeeRate,
      bidFeeRate = tmp.bidFeeRate,
      trend,
      askFee,
      bidFee,
      voucher,
      trade,
      updatedOrder,
      orderState,
      orderLocked,
      orderFundsReceived,
      orderVolume,
      orderTradesCount,
      doneAt = null,
      askAccountVersion = {
        member_id: member.id,
        currency: dbOrder.ask,
        created_at: now,
        updated_at: now,
        modifiable_type: Database.MODIFIABLE_TYPE.TRADE,
        // modifiable_id: "",//++TODO
      },
      bidAccountVersion = {
        member_id: member.id,
        currency: dbOrder.bid,
        created_at: now,
        updated_at: now,
        modifiable_type: Database.MODIFIABLE_TYPE.TRADE,
        // modifiable_id: "",//++TODO
      },
      orderFullFilledAccountVersion,
      error = false,
      result;
    try {
      // 1. 新的 order volume 為 db紀錄的該 order volume 減去 data 裡面的 fillSz
      orderVolume = SafeMath.minus(dbOrder.volume, data.fillSz);
      // 2. 新的 order tradesCounts 為 db紀錄的該 order tradesCounts + 1
      orderTradesCount = SafeMath.plus(dbOrder.trades_count, "1");
      // 3. 根據 data side （BUY，SELL）需要分別計算
      // 3.1 order 新的鎖定金額
      // 3.2 order 新的 fund receiced
      // 3.3 voucher 及 account version 的手需費
      // 3.4 voucher 與 account version 裡面的手續費是對應的
      if (data.side === Database.ORDER_SIDE.BUY) {
        orderLocked = SafeMath.minus(dbOrder.locked, value);
        orderFundsReceived = SafeMath.plus(dbOrder.funds_received, data.fillSz);
        trend = Database.ORDER_KIND.BID;
        askFee = 0;
        bidFee = SafeMath.mult(data.fillSz, bidFeeRate);
        askAccountVersion = {
          ...askAccountVersion,
          balance: SafeMath.minus(data.fillSz, bidFee),
          locked: 0,
          fee: bidFee,
          reason: Database.REASON.STRIKE_ADD,
          fun: Database.FUNC.PLUS_FUNDS,
        };
        bidAccountVersion = {
          ...bidAccountVersion,
          balance: 0,
          locked: SafeMath.mult(value, "-1"),
          fee: 0,
          reason: Database.REASON.STRIKE_SUB,
          fun: Database.FUNC.UNLOCK_AND_SUB_FUNDS,
        };
      }
      if (data.side === Database.ORDER_SIDE.SELL) {
        orderLocked = SafeMath.minus(dbOrder.locked, data.fillSz);
        orderFundsReceived = SafeMath.plus(dbOrder.funds_received, value);
        trend = Database.ORDER_KIND.ASK;
        askFee = SafeMath.mult(value, askFeeRate);
        bidFee = 0;
        askAccountVersion = {
          ...askAccountVersion,
          balance: 0,
          locked: SafeMath.mult(data.fillSz, "-1"),
          fee: 0,
          reason: Database.REASON.STRIKE_SUB,
          fun: Database.FUNC.UNLOCK_AND_SUB_FUNDS,
        };
        bidAccountVersion = {
          ...bidAccountVersion,
          balance: SafeMath.minus(value, askFee),
          locked: 0,
          fee: askFee,
          reason: Database.REASON.STRIKE_ADD,
          fun: Database.FUNC.PLUS_FUNDS,
        };
      }
      this.logger.debug(`calculator askAccountVersion`, askAccountVersion);
      this.logger.debug(`calculator bidAccountVersion`, bidAccountVersion);

      voucher = {
        // id: "", // -- filled by DB insert
        member_id: member.id,
        order_id: dbOrder.id,
        // trade_id: "", //++ trade insert 到 DB 之後才會得到
        designated_trading_fee_asset_history_id: null,
        ask: market.ask.currency,
        bid: market.bid.currency,
        price: data.fillPx,
        volume: data.fillSz,
        value,
        trend,
        ask_fee: askFee,
        bid_fee: bidFee,
        created_at: now,
      };
      this.logger.debug(`calculator voucher`, voucher);

      trade = {
        price: data.fillPx,
        volume: data.fillSz,
        ask_id: data.side === Database.ORDER_SIDE.SELL ? dbOrder.id : null,
        bid_id: data.side === Database.ORDER_SIDE.BUY ? dbOrder.id : null,
        trend: null,
        currency: market.code,
        created_at: now,
        updated_at: now,
        ask_member_id:
          data.side === Database.ORDER_SIDE.SELL
            ? member.id
            : this.systemMemberId,
        bid_member_id:
          data.side === Database.ORDER_SIDE.BUY
            ? member.id
            : this.systemMemberId,
        funds: value,
        // trade_fk: data?.tradeId, ++ TODO
      };
      this.logger.debug(`calculator trade`, trade);

      // 4. 根據更新的 order volume 是否為 0 來判斷此筆 order 是否完全撮合，為 0 即完全撮合
      // 4.1 更新 order doneAt
      // 4.2 更新 order state
      this.logger.debug(`calculator orderVolume`, orderVolume);

      if (SafeMath.eq(orderVolume, "0")) {
        orderState = Database.ORDER_STATE_CODE.DONE;
        doneAt = now;
        // 5. 當更新的 order 已完全撮合，需要將剩餘鎖定的金額全部釋放還給對應的 account，此時會新增一筆 account version 的紀錄，這邊將其命名為 orderFullFilledAccountVersion
        if (SafeMath.gt(orderLocked, 0)) {
          orderFullFilledAccountVersion = {
            member_id: member.id,
            currency: dbOrder.bid,
            created_at: now,
            updated_at: now,
            modifiable_type: Database.MODIFIABLE_TYPE.TRADE,
            reason: Database.REASON.ORDER_FULLFILLED,
            fun: Database.FUNC.UNLOCK_FUNDS,
            fee: 0,
            balance: orderLocked,
            locked: SafeMath.mult(orderLocked, "-1"),
            // ++TODO modifiable_id
          };
          // orderLocked = "0"; // !!!!!! ALERT 剩餘鎖定金額的紀錄保留在 order裡面 （實際有還給 account 並生成憑證）
          this.logger.debug(
            `calculator orderFullFilledAccountVersion`,
            orderFullFilledAccountVersion
          );
        }
      } else {
        // 不為 0 即等待中
        orderState = Database.ORDER_STATE_CODE.WAIT;
      }
      // 根據前 5 點 可以得到最終需要更新的 order
      updatedOrder = {
        id: dbOrder.id,
        volume: orderVolume,
        state: orderState,
        locked: orderLocked,
        funds_received: orderFundsReceived,
        trades_count: orderTradesCount,
        updated_at: `"${now}"`,
        done_at: `"${doneAt}"`,
      };
      this.logger.debug(`calculator updatedOrder`, updatedOrder);
    } catch (e) {
      this.logger.error(`[${this.constructor.name}] calculaotor went wrong`, e);
      error = true;
    }
    if (!error) {
      result = {
        updatedOrder,
        voucher,
        trade,
        askAccountVersion,
        bidAccountVersion,
        orderFullFilledAccountVersion,
      };
    }
    return result;
  }
  async updateOuterTrade({
    member,
    status,
    id,
    trade,
    dbOrder,
    voucher,
    dbTransaction,
  }) {
    this.logger.debug(
      `------------- [${this.constructor.name}] updateOuterTrade -------------`
    );
    this.logger.log(`updateOuterTrade status`, status);
    try {
      switch (status) {
        case Database.OUTERTRADE_STATUS.ClORDId_ERROR:
          await this.database.updateOuterTrade(
            {
              id,
              status,
              update_at: voucher.created_at,
              order_id: 0,
            },
            { dbTransaction }
          );
          break;
        case Database.OUTERTRADE_STATUS.OTHER_SYSTEM_TRADE:
        case Database.OUTERTRADE_STATUS.DB_ORDER_CANCEL:
          await this.database.updateOuterTrade(
            {
              id,
              status,
              update_at: voucher.created_at,
              order_id: dbOrder.id,
              member_id: member.id,
            },
            { dbTransaction }
          );
          break;
        case Database.OUTERTRADE_STATUS.DONE:
          if (!id || !dbOrder.id || !member.id || !trade.id || !voucher.id) {
            this.logger.debug(`updateOuterTrade id`, id);
            this.logger.debug(`updateOuterTrade dbOrder`, dbOrder);
            this.logger.debug(`updateOuterTrade trade`, trade);
            this.logger.debug(`updateOuterTrade voucher`, voucher);
            this.logger.debug(`updateOuterTrade member`, member);
            throw Error("missing params");
          }
          await this.database.updateOuterTrade(
            {
              id,
              status,
              update_at: `"${voucher.created_at}"`,
              order_id: dbOrder.id,
              order_price: dbOrder.price,
              order_origin_volume: dbOrder.origin_volume,
              member_id: member.id,
              member_tag: member.member_tag,
              email: member.email,
              trade_id: trade.id,
              voucher_id: voucher.id,
            },
            { dbTransaction }
          );
          break;
        case Database.OUTERTRADE_STATUS.API_ORDER_CANCEL:
          let now = `${new Date()
            .toISOString()
            .slice(0, 19)
            .replace("T", " ")}`;
          // 確保 cancel order 的 locked 金額有還給用戶
          let dbCancelOrderAccountVersions =
            await this.database.getAccountVersionsByModifiableId(dbOrder.id);
          let dbCancelOrderAccountVersion = dbCancelOrderAccountVersions.find(
            (dbAccV) =>
              dbAccV.reason.toString() ===
              Database.REASON.ORDER_CANCEL.toString()
          );
          if (!dbCancelOrderAccountVersion) {
            let cancelOrderAccountVersion = {
              member_id: member.id,
              currency:
                dbOrder.type === Database.TYPE.ORDER_ASK
                  ? dbOrder.ask
                  : dbOrder.bid,
              created_at: now,
              updated_at: now,
              modifiable_type: Database.MODIFIABLE_TYPE.ORDER,
              balance: dbOrder.locked,
              locked: SafeMath.mult(dbOrder.locked, "-1"),
              fee: 0,
              reason: Database.REASON.ORDER_CANCEL,
              fun: Database.FUNC.UNLOCK_FUNDS,
            };
            await this._updateAccount(cancelOrderAccountVersion, dbTransaction);
          }
          let updatedOrder = {
            id: dbOrder.id,
            state: Database.ORDER_STATE_CODE.CANCEL,
            // locked: 0,
            updated_at: `"${now}"`,
          };
          await this.database.updateOrder(updatedOrder, {
            dbTransaction,
          });
          break;
        default:
      }
    } catch (error) {
      throw error;
    }
    this.logger.debug(
      `------------- [${this.constructor.name}] _updateOuterTradeStatus  [END]-------------`
    );
  }

  async dbUpdater({
    dbOrder,
    updatedOrder,
    voucher,
    trade,
    tradeFk,
    askAccountVersion,
    bidAccountVersion,
    orderFullFilledAccountVersion,
    dbTransaction,
  }) {
    /* !!! HIGH RISK (start) !!! */
    let tradeId, voucherId, dbTrade, dbVoucher, dbAccountVersions;
    this.logger.debug(`dbUpdater`);
    try {
      if (dbOrder.state === Database.ORDER_STATE_CODE.WAIT) {
        await this.database.updateOrder(updatedOrder, { dbTransaction });
        this.logger.debug(`dbUpdater updateOrder success`, updatedOrder);
      } else {
        this.logger.error("order is marked as done", trade);
      }
      dbTrade = await this.database.getTradeByTradeFk(tradeFk);
      if (dbTrade) {
        this.logger.error("trade exist trade", trade);
        this.logger.error("trade exist dbTrade", dbTrade);
        tradeId = dbTrade.id;
        dbVoucher = await this.database.getVoucherByOrderIdAndTradeId(
          dbOrder.id,
          tradeId
        );
        // ++ TOOD 10/13 getAccountVersionsByModifiableId
        dbAccountVersions =
          await this.database.getAccountVersionsByModifiableId(tradeId);
      } else {
        tradeId = await this.database.insertTrades(
          { ...trade, trade_fk: tradeFk },
          { dbTransaction }
        );
        this.logger.debug(`dbUpdater insertTrades success tradeId`, tradeId);
      }
      if (dbVoucher) {
        voucherId = dbVoucher.id;
        this.logger.error("voucher exist voucher", voucher);
        this.logger.error("voucher exist dbVoucher", dbVoucher);
      } else {
        voucherId = await this.database.insertVouchers(
          {
            ...voucher,
            trade_id: tradeId,
          },
          { dbTransaction }
        );
        this.logger.debug(
          `dbUpdater insertVouchers success voucherId`,
          voucherId
        );
      }
      let dbAskAccountVersion =
        dbAccountVersions?.length > 0
          ? dbAccountVersions.find(
              (dbAccV) =>
                dbAccV.currency.toString() ===
                askAccountVersion.currency.toString()
            )
          : null;
      if (dbAskAccountVersion) {
        this.logger.error(`askAccountVersion exist`, askAccountVersion);
        this.logger.error(
          `askAccountVersion exist dbAskAccountVersion`,
          dbAskAccountVersion
        );
      } else {
        await this._updateAccount(
          { ...askAccountVersion, modifiable_id: tradeId },
          dbTransaction
        );
        this.logger.debug(`dbUpdater _updateAccount success askAccountVersion`);
      }
      let dbBidAccountVersion =
        dbAccountVersions?.length > 0
          ? dbAccountVersions.find(
              (dbAccV) =>
                dbAccV.currency.toString() ===
                  bidAccountVersion.currency.toString() &&
                dbAccV.reason !== Database.REASON.ORDER_FULLFILLED
            )
          : null;
      if (dbBidAccountVersion) {
        this.logger.error(
          `bidAccountVersion exist bidAccountVersion`,
          bidAccountVersion
        );
        this.logger.error(
          `bidAccountVersion exist dbBidAccountVersion`,
          dbBidAccountVersion
        );
      } else {
        await this._updateAccount(
          { ...bidAccountVersion, modifiable_id: tradeId },
          dbTransaction
        );
        this.logger.debug(`dbUpdater _updateAccount success bidAccountVersion`);
      }
      if (orderFullFilledAccountVersion) {
        let dbOrderFullFilledAccountVersion =
          dbAccountVersions?.length > 0
            ? dbAccountVersions.find(
                (dbAccV) =>
                  dbAccV.currency.toString() ===
                    orderFullFilledAccountVersion.currency.toString() &&
                  dbAccV.reason === Database.REASON.ORDER_FULLFILLED
              )
            : null;
        if (dbOrderFullFilledAccountVersion) {
          this.logger.error(
            `bidAccountVersion exist orderFullFilledAccountVersion`,
            orderFullFilledAccountVersion
          );
          this.logger.error(
            `orderFullFilledAccountVersion exist dbOrderFullFilledAccountVersion`,
            dbOrderFullFilledAccountVersion
          );
        } else {
          await this._updateAccount(
            { ...orderFullFilledAccountVersion, modifiable_id: tradeId },
            dbTransaction
          );
          this.logger.debug(
            `dbUpdater _updateAccount success orderFullFilledAccountVersion`
          );
        }
      }

      return {
        trade: { ...trade, id: tradeId },
        voucher: { ...voucher, id: voucherId },
      };
    } catch (error) {
      throw error;
    }
    /* !!! HIGH RISK (end) !!! */
  }

  /**
   *  syncOuterTrades || OKx Events.order
   * @param {String} type Database.MODIFIABLE_TYPE.TRADE || Database.MODIFIABLE_TYPE.ORDER
   * @param {Object} data trade || order
   */
  async processor(type, data) {
    let market,
      memberId,
      orderId,
      member,
      order,
      status,
      result,
      dbResponse,
      dbTransaction = await this.database.transaction();
    try {
      this.logger.debug(`processor type`, type);
      this.logger.debug(`processor data`, data);
      // 1. 判斷收到的資料 state 不為 cancel
      if (data.state === Database.ORDER_STATE.CANCEL) {
        status = Database.OUTERTRADE_STATUS.SYSTEM_ERROR;
      }
      // 2. 判斷收到的資料是否為此系統的資料
      // 需滿足下列條件，才為此系統的資料：
      // 2.1.可以從 data 解析出 orderId 及 memberId
      // 2.2.可以根據 orderId 從 database 取得 dbOrder
      // 2.3. dbOrder.member_id 同 data 解析出的 memberId
      market = this.tickersSettings[data.instId.toLowerCase().replace("-", "")];
      let tmp = Utils.parseClOrdId(data.clOrdId);
      memberId = tmp.memberId;
      orderId = tmp.orderId;
      if (!memberId || !orderId) {
        status = Database.OUTERTRADE_STATUS.ClORDId_ERROR;
      }
      if (!status) {
        member = await this.database.getMemberByCondition({ id: memberId });
        order = await this.database.getOrder(orderId, { dbTransaction });
      }
      if (!order || order?.member_id.toString() !== member?.id.toString()) {
        status = Database.OUTERTRADE_STATUS.OTHER_SYSTEM_TRADE;
      }
      // 3. 判斷收到的資料對應的 order是否需要更新
      // 3.1 dbOrder.state 不為 0
      if (order && order?.state !== Database.ORDER_STATE_CODE.WAIT) {
        status = Database.OUTERTRADE_STATUS.DB_ORDER_CANCEL;
      }
      // 3.2 OKx api 回傳的 orderDetail state 不為 cancel
      if (!status) {
        if (type === Database.MODIFIABLE_TYPE.TRADE) {
          let apiResonse = await this.okexConnector.router("getOrderDetails", {
            query: {
              instId: data.instId,
              ordId: data.ordId,
            },
          });
          if (apiResonse.success) {
            let orderDetail = apiResonse.payload;
            if (orderDetail.state === Database.ORDER_STATE.CANCEL)
              status = Database.OUTERTRADE_STATUS.API_ORDER_CANCEL;
          } else {
            status = Database.OUTERTRADE_STATUS.SYSTEM_ERROR;
          }
        }
      }
      this.logger.debug(`processor status`, status);
      // 4. 此 data 為本系統的 data，根據 data 裡面的資料去就算對應要更新的 order 及需要新增的 trade、voucher、accounts
      // 計算完後會直接通知前端更新 order 及 accounts
      if (!status) {
        result = this.calculator({
          market,
          member,
          dbOrder: order,
          data,
          type,
        });
      }
      // 5. 只有由 ExchangeHubService 呼叫的時候， type 為 Database.MODIFIABLE_TYPE.TRADE，才會有 tradeId（來自 OKx 的 tradeId） ，才可以對 DB 進行更新
      // trade 新增進 DB 後才可以得到我們的 trade id
      // db 更新的資料為 calculator 得到的 result
      if (result) {
        if (type === Database.MODIFIABLE_TYPE.ORDER) {
          await this.emitter({
            ...result,
            updatedOrder: {
              ...result.updatedOrder,
              ordType: order.ord_type,
              kind:
                data.side === Database.ORDER_SIDE.BUY
                  ? Database.ORDER_KIND.BID
                  : Database.ORDER_KIND.ASK,
              price: order.price,
              origin_volume: order.origin_volume,
              instId: data.instId,
              clOrdId: data.clOrdId,
              ordId: data.ordId,
            },
            memberId: member.id,
            market,
            instId: data.instId,
            dbTransaction,
          });
        }
        if (type === Database.MODIFIABLE_TYPE.TRADE) {
          dbResponse = await this.dbUpdater({
            ...result,
            member,
            dbOrder: order,
            tradeFk: data.tradeId,
            status,
            dbTransaction,
          });
          this.logger.log(`dbResponse`, dbResponse);
          if (dbResponse.trade && dbResponse.trade?.id) {
            let time = dbResponse.trade.updated_at.replace(/['"]+/g, "");
            let newTrade = {
              id: dbResponse.trade.id, // ++ verified 這裡的 id 是 DB trade id 還是  OKx 的 tradeId
              price: dbResponse.trade.price,
              volume: dbResponse.trade.volume,
              market: market.id,
              at: parseInt(SafeMath.div(new Date(time), "1000")),
              ts: new Date(time),
            };
            this._emitNewTrade({
              memberId,
              instId: data.instId,
              market: market.id,
              trade: newTrade,
            });
          }
          status = Database.OUTERTRADE_STATUS.DONE;
        }
      }
    } catch (error) {
      status = Database.OUTERTRADE_STATUS.SYSTEM_ERROR;
      this.logger.error(`processor`, error);
      await dbTransaction.rollback();
    }
    try {
      await this.updateOuterTrade({
        member,
        status,
        id: data.tradeId,
        trade: dbResponse.trade,
        dbOrder: order,
        voucher: dbResponse.voucher,
        dbTransaction,
      });
      await dbTransaction.commit();
    } catch (error) {
      status = Database.OUTERTRADE_STATUS.SYSTEM_ERROR;
      this.logger.error(`processor updateOuterTrade error`, error);
      await dbTransaction.rollback();
    }
  }

  async _updateOrderDetail(formatOrder) {
    this.logger.debug(
      ` ------------- [${this.constructor.name}] _updateOrderDetail [START]---------------`
    );
    this.logger.debug(`formatOrder`, formatOrder);
    let member,
      memberTag,
      askFeeRate,
      bidFeeRate,
      baseAccBalDiff,
      baseAccBal,
      baseLocDiff,
      baseLoc,
      quoteLocDiff,
      quoteLoc,
      quoteAccBalDiff,
      quoteAccBal,
      tmp = Utils.parseClOrdId(formatOrder.clOrdId),
      tickerSetting =
        this.tickersSettings[formatOrder.instId.toLowerCase().replace("-", "")],
      volume = SafeMath.minus(formatOrder.sz, formatOrder.accFillSz),
      filled = formatOrder.state === Database.ORDER_STATE.FILLED,
      updateOrder,
      memberId = tmp.memberId,
      orderId = tmp.orderId,
      updateAccounts = this.accountBook.getSnapshot(
        memberId,
        formatOrder.instId
      ),
      updateBaseAccount = updateAccounts ? updateAccounts[0] : null,
      updateQuoteAccount = updateAccounts ? updateAccounts[1] : null;
    this.logger.debug(`memberId: ${memberId}, orderId: ${orderId}`);
    this.logger.debug(`volume`, volume);
    this.logger.debug(`filled`, filled);
    this.logger.debug(`tickerSetting`, tickerSetting);
    this.logger.debug(`updateBaseAccount`, updateBaseAccount);
    this.logger.debug(`updateQuoteAccount`, updateQuoteAccount);
    if (orderId && tickerSetting && memberId) {
      updateOrder = {
        instId: formatOrder.instId,
        ordType: formatOrder.ordType,
        id: orderId,
        ordId: formatOrder.ordId,
        clOrdId: formatOrder.clOrdId,
        at: parseInt(SafeMath.div(formatOrder.uTime, "1000")),
        ts: parseInt(formatOrder.uTime),
        market: tickerSetting.id,
        kind:
          formatOrder.side === Database.ORDER_SIDE.BUY
            ? Database.ORDER_KIND.BID
            : Database.ORDER_KIND.ASK,
        price: formatOrder.px,
        origin_volume: formatOrder.sz,
        volume,
        filled,
        state_text: filled
          ? Database.ORDER_STATE_TEXT.DONE
          : formatOrder.state === Database.ORDER_STATE_TEXT.CANCEL
          ? Database.ORDER_STATE_TEXT.CANCEL
          : Database.ORDER_STATE_TEXT.WAIT,
        state: filled
          ? Database.ORDER_STATE.DONE
          : formatOrder.state === Database.ORDER_STATE.CANCEL
          ? Database.ORDER_STATE.CANCEL
          : Database.ORDER_STATE.WAIT,
        state_code: filled
          ? Database.ORDER_STATE_CODE.DONE
          : formatOrder.state === Database.ORDER_STATE.CANCEL
          ? Database.ORDER_STATE_CODE.CANCEL
          : Database.ORDER_STATE_CODE.WAIT,
      };
      this.logger.debug(`updateOrder`, updateOrder);
      this._emitUpdateOrder({
        memberId,
        instId: tickerSetting.instId,
        market: tickerSetting.id,
        order: updateOrder,
      });
    }
    if (tickerSetting && memberId && updateBaseAccount && updateQuoteAccount) {
      member = await this.database.getMemberByCondition({ id: memberId });
      if (member) {
        memberTag = member.member_tag;
        this.logger.debug(`member.member_tag`, member.member_tag); // 1 是 vip， 2 是 hero
        if (memberTag) {
          if (memberTag.toString() === Database.MEMBER_TAG.VIP_FEE.toString()) {
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

        if (formatOrder.side === Database.ORDER_SIDE.BUY) {
          baseAccBalDiff = SafeMath.minus(
            formatOrder.fillSz,
            SafeMath.mult(formatOrder.fillSz, bidFeeRate)
          );
          this.logger.debug(`baseAccBalDiff`, baseAccBalDiff);
          baseAccBal = SafeMath.plus(updateBaseAccount.balance, baseAccBalDiff);
          this.logger.debug(`baseAccBal`, baseAccBal);
          baseLocDiff = 0;
          baseLoc = SafeMath.plus(updateBaseAccount.locked, baseLocDiff);
          updateBaseAccount = {
            balance: baseAccBal,
            locked: baseLoc,
            currency: tickerSetting.ask.currency.toUpperCase(),
            total: SafeMath.plus(baseAccBal, baseLoc),
          };
          quoteAccBalDiff = 0;
          quoteAccBal = SafeMath.plus(
            updateQuoteAccount.balance,
            quoteAccBalDiff
          );
          quoteLocDiff = SafeMath.mult(
            SafeMath.mult(formatOrder.px, formatOrder.fillSz),
            "-1"
          );
          this.logger.debug(`quoteLocDiff`, quoteLocDiff);
          quoteLoc = SafeMath.plus(updateQuoteAccount.locked, quoteLocDiff);
          updateQuoteAccount = {
            balance: quoteAccBal,
            locked: quoteLoc,
            currency: tickerSetting.bid.currency.toUpperCase(),
            total: SafeMath.plus(quoteAccBal, quoteLoc),
          };
        } else {
          baseAccBalDiff = 0;
          baseAccBal = SafeMath.plus(updateBaseAccount.balance, baseAccBalDiff);
          baseLocDiff = SafeMath.mult(formatOrder.fillSz, "-1");
          this.logger.debug(`baseLocDiff`, baseLocDiff);
          baseLoc = SafeMath.plus(updateBaseAccount.locked, baseLocDiff);
          updateBaseAccount = {
            balance: baseAccBal,
            locked: baseLoc,
            currency: tickerSetting.ask.currency.toUpperCase(),
            total: SafeMath.plus(baseAccBal, baseLoc),
          };
          quoteAccBalDiff = SafeMath.minus(
            SafeMath.mult(formatOrder.fillPx, formatOrder.fillSz),
            SafeMath.mult(
              SafeMath.mult(formatOrder.fillPx, formatOrder.fillSz),
              askFeeRate
            )
          );
          this.logger.debug(`quoteAccBalDiff`, quoteAccBalDiff);
          quoteAccBal = SafeMath.plus(
            updateQuoteAccount.balance,
            quoteAccBalDiff
          );
          this.logger.debug(`quoteAccBal`, quoteAccBal);
          quoteLocDiff = 0;
          quoteLoc = SafeMath.plus(updateQuoteAccount.locked, quoteLocDiff);
          updateQuoteAccount = {
            balance: quoteAccBal,
            locked: quoteLoc,
            currency: tickerSetting.bid.currency.toUpperCase(),
            total: SafeMath.plus(quoteAccBal, quoteLoc),
          };
        }
        this._emitUpdateAccount({
          memberId,
          account: updateBaseAccount,
        });
        this._emitUpdateAccount({
          memberId,
          account: updateQuoteAccount,
        });
      }
    }
    this.logger.debug(
      ` ------------- [${this.constructor.name}] _updateOrderDetail [END]---------------`
    );
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

  async _updateAccount(accountVersion, dbTransaction) {
    /* !!! HIGH RISK (start) !!! */
    const account = await this.database.getAccountsByMemberId(
      accountVersion.member_id,
      {
        options: { currency: accountVersion.currency },
        limit: 1,
        dbTransaction,
      }
    );
    const oriAccBal = account.balance;
    const oriAccLoc = account.locked;
    const newAccBal = SafeMath.plus(oriAccBal, accountVersion.balance);
    const newAccLoc = SafeMath.plus(oriAccLoc, accountVersion.locked);
    const amount = SafeMath.plus(newAccBal, newAccLoc);
    const newAccount = {
      id: account.id,
      balance: newAccBal,
      locked: newAccLoc,
    };

    await this.database.insertAccountVersion(
      account.member_id,
      account.id,
      accountVersion.reason,
      accountVersion.balance,
      accountVersion.locked,
      accountVersion.fee,
      amount,
      accountVersion.modifiable_id,
      accountVersion.modifiable_type,
      accountVersion.created_at,
      accountVersion.updated_at,
      account.currency,
      accountVersion.fun,
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
    this.logger.debug(`_emitUpdateOrder difference`, order);
    this.orderBook.updateByDifference(memberId, instId, {
      add: [order],
    });
    EventBus.emit(Events.order, memberId, market, {
      market: market,
      difference: this.orderBook.getDifference(memberId, instId),
    });
    this.logger.debug(
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
    this.logger.debug(`difference`, order);
    this.logger.debug(
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
    this.logger.debug(`difference`, trade);
    this.logger.debug(
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
    this.logger.debug(`difference`, account);
    this.logger.debug(
      `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.account}] _emitUpdateAccount[memberId:${memberId}]`,
      this.accountBook.getDifference(memberId)
    );
  }

  async _eventListener() {
    EventBus.on(Events.account, (memberId, account) => {
      this.logger.debug(
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
      this.logger.debug(
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
      this.logger.debug(
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
        this.logger.debug(
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
        this.logger.debug(
          ` ------------- [${this.constructor.name}] EventBus.on(Events.orderDetailUpdate [START]---------------`
        );
        // TODO: using message queue
        for (const formatOrder of formatOrders) {
          if (
            formatOrder.state !==
              Database.ORDER_STATE.CANCEL /* cancel order */ &&
            formatOrder.accFillSz !== "0" /* create order */
          ) {
            await this.processor(Database.MODIFIABLE_TYPE.ORDER, formatOrder);
            this.exchangeHubService.sync(
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
        this.logger.debug(
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
