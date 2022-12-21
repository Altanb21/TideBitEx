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
const { removeZeroEnd } = require("../libs/Utils");
class ExchangeHub extends Bot {
  dbOuterTradesData = {};
  fetchedOrders = {};
  fetchedOrdersInterval = 1 * 60 * 1000;
  systemMemberId;
  okexBrokerId;
  updateDatas = [];
  adminUsers;
  coinsSettings;
  depositsSettings;
  withdrawsSettings;
  jobQueue = [];
  jobTimer = [];
  constructor() {
    super();
    this.name = "ExchangeHub";
    this.fetchedTickers = false;
  }
  oneDayinMillionSeconds = 24 * 60 * 60 * 1000;

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
        this.coinsSettingsMap = this.coinsSettings.reduce(
          (prev, coinSetting) => {
            if (!prev[coinSetting.id.toString()])
              prev[coinSetting.id.toString()] = { ...coinSetting };
            return prev;
          },
          {}
        );
        this.depositsSettings = this._getDepositsSettings();
        this.withdrawsSettings = this._getWithdrawsSettings();
        // this.priceList = await this.getPriceList();
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
          // priceList: this.priceList,
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
          tickersSettings: this.tickersSettings,
          emitUpdateData: (updateData) => this.emitUpdateData(updateData),
          processor: (data) => this.processorHandler(data),
          logger,
        });
        return this;
      });
  }

  async start() {
    await super.start();
    await this.okexConnector.start();
    this._eventListener();
    this.exchangeHubService.sync({
      exchange: SupportedExchange.OKEX,
      force: true,
    });
    this.worker();
    return this;
  }

  emitUpdateData(updateData) {
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
      this.logger.error(`_getAdminUsers`, error);
      process.exit(1);
    }
    return adminUsers;
  }

  async getAdminUsers({ query }) {
    if (!this.adminUsers) {
      this.adminUsers = this._getAdminUsers();
    }
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
      this.logger.error(`_getTickersSettings`, error);
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
        this.logger.error(`_getCoinsSettings`, error);
        process.exit(1);
      }
    }
    return this.coinsSettings;
  }

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
          // else
          //   this.logger.error(
          //     `[config/deposits.yml] duplicate deposit`,
          //     prev[deposit.id.toString()],
          //     deposit
          //   );
          return prev;
        }, {});
        this.depositsSettings = formatDepositsSettings;
      } catch (error) {
        this.logger.error(`_getDepositsSettings`, error);
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
          // else
          //   this.logger.error(
          //     `[config/withdraws.yml] duplicate withdraw`,
          //     prev[withdraw.id.toString()],
          //     withdraw
          //   );
          return prev;
        }, {});
        this.withdrawsSettings = formatWithdrawsSettings;
      } catch (error) {
        this.logger.error(`_getWithdrawsSettings`, error);
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

  estimateAlertLevel({ account, amount, sum, MPA, RRR }) {
    let alertLevel;
    if (!account || SafeMath.eq(amount, 0)) {
      if (SafeMath.eq(sum, 0)) alertLevel = PLATFORM_ASSET.WARNING_LEVEL.NULL;
      else if (SafeMath.gt(sum, 0))
        alertLevel = PLATFORM_ASSET.WARNING_LEVEL.LEVEL_4;
    } else {
      if (SafeMath.gt(amount, MPA)) {
        alertLevel = PLATFORM_ASSET.WARNING_LEVEL.LEVEL_1;
      } else {
        alertLevel = PLATFORM_ASSET.WARNING_LEVEL.LEVEL_2;
      }
      if (SafeMath.lte(amount, RRR)) {
        alertLevel = PLATFORM_ASSET.WARNING_LEVEL.LEVEL_4;
      }
    }
    return alertLevel;
  }
  async getPlatformAssets({ email, query }) {
    let result = null,
      coins = {},
      sources = {},
      hasError = false; //,
    const _accounts = await this.database.getTotalAccountsAssets();
    let _assetBalances = await this.database.getAssetBalances();
    _assetBalances = _assetBalances.reduce((prev, assetBalance) => {
      prev[assetBalance.asset_key] = assetBalance;
      return prev;
    }, {});
    // this.logger.debug(`_assetBalances`, _assetBalances);
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
            // this.logger.error(response);
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
          let coinSetting = this.coinsSettingsMap[_account.currency.toString()];
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
              for (let exchange of Object.keys(SupportedExchange)) {
                switch (SupportedExchange[exchange]) {
                  case SupportedExchange.OKEX:
                    coins[coinSetting.code]["sources"][exchange.toLowerCase()] =
                      {
                        balance:
                          sources[exchange][coinSetting.code]?.balance || "0",
                        locked:
                          sources[exchange][coinSetting.code]?.locked || "0",
                        sum: sources[exchange][coinSetting.code]?.sum || "0",
                        alertLevel: this.estimateAlertLevel({
                          account: sources[exchange][coinSetting.code],
                          amount: sources[exchange][coinSetting.code]?.amount,
                          sum,
                          MPA,
                          RRR,
                        }),
                      };
                    break;
                  case SupportedExchange.TIDEBIT:
                    coins[coinSetting.code]["sources"][exchange.toLowerCase()] =
                      {
                        balance:
                          _assetBalances[coinSetting.code]?.amount || "0",
                        locked: "0",
                        sum: _assetBalances[coinSetting.code]?.amount || "0",
                        alertLevel: this.estimateAlertLevel({
                          account: _assetBalances[coinSetting.code],
                          amount: _assetBalances[coinSetting.code]?.amount,
                          sum,
                          MPA,
                          RRR,
                        }),
                      };
                    break;
                  default:
                }
              }
            }
          } else {
            // this.logger.error(
            //   `getPlatformAssets notic accounts.currency did not have correspond id in coins.yml but maybe in DB assets.base table`,
            //   coins
            // );
          }
        }
        result = new ResponseFormat({
          message: "getPlatformAssets",
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
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    try {
      if (currentUser.roles?.includes("root")) {
        let index = this.coinsSettings.findIndex(
          (coin) => coin.id.toString() === params.id.toString()
        );
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
      this.logger.error(`updatePlatformAsset`, e);
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
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    try {
      const { type, data } = body;
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
              // if (
              //   updatedTickersSettings[params.id].source ===
              //   SupportedExchange.OKEX
              // ) {
              //   if (data.visible)
              //     this.okexConnector.registerMarket(
              //       this.tickersSettings[params.id].market
              //         .replace("-", "")
              //         .toLowerCase()
              //     );
              //   else
              //     this.okexConnector.unregisterMarket(
              //       this.tickersSettings[params.id].market
              //         .replace("-", "")
              //         .toLowerCase()
              //     );
              // }
              updatedTickersSettings[params.id] = {
                ...updatedTickersSettings[params.id],
                visible: data.visible,
              };
              break;
            case TICKER_SETTING_TYPE.SOURCE:
              // if (data.source === SupportedExchange.OKEX)
              //   this.okexConnector.registerMarket(
              //     this.tickersSettings[params.id].market
              //   );
              // else if (
              //   data.source !== SupportedExchange.OKEX &&
              //   updatedTickersSettings[params.id].source ===
              //     SupportedExchange.OKEX
              // )
              //   this.okexConnector.unregisterMarket(
              //     this.tickersSettings[params.id].market
              //   );
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
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    try {
      const { visible } = body;
      if (currentUser.roles?.includes("root")) {
        let index = this.coinsSettings.findIndex(
          (coin) => coin.id.toString() === params.id.toString()
        );
        if (index !== -1) {
          let updatedCoinsSettings = this.coinsSettings.map((coin) => ({
            ...coin,
          }));
          updatedCoinsSettings[index] = {
            ...updatedCoinsSettings[index],
            visible: visible,
          };
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
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    try {
      const { visible } = body;
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
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email),
      updatedDepositCoin;
    try {
      const { type, data } = body;
      if (currentUser.roles?.includes("root")) {
        updatedDepositCoin = this.depositsSettings[params.id];
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
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email),
      updatedWithdrawCoin;
    try {
      const { type, data } = body;
      if (currentUser.roles?.includes("root")) {
        updatedWithdrawCoin = this.withdrawsSettings[params.id];
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

  async getMemberReferral(member) {
    let referredByMember, memberReferral;
    referredByMember = await this.database.getMemberByCondition({
      referCode: member.refer,
    });
    if (referredByMember) {
      memberReferral = await this.database.getMemberReferral({
        referrerId: referredByMember.id,
        refereeId: member.id,
      });
    } else {
      this.logger.debug(
        `getMemberReferral did not get referredByMember with refer_code[${member.refer}]`,
        member
      );
    }
    return { referredByMember, memberReferral };
  }

  async getReferrerCommissionPlan(referral) {
    // expose :referrer_commission_plan do |member|
    // ::APIv2::Entities::CommissionPlan.represent(
    //   Referral::CommissionService.get_default_commission_plan(member: member),
    //   { enabled_policies_only: true }
    // )
    // this.logger.debug(`getReferrerCommissionPlan referral`, referral);
    let plan,
      planId = referral.commission_plan_id;
    if (!planId) {
      plan = await this.database.getDefaultCommissionPlan();
      planId = plan.id;
    }
    return planId;
  }

  async getReferrerCommissionPolicy(referral, voucher) {
    // commission_plan.policies.sort_by{ |policy| policy.referred_months }.detect do |policy|
    // policy.is_enabled? && (@referral.created_at + policy.referred_months.month >= @voucher.created_at)
    let policy;
    if (referral.is_enabled) {
      let commissionPlanId = await this.getReferrerCommissionPlan(referral);
      let commissionPolicies = await this.database.getCommissionPolicies(
        commissionPlanId
      );
      let days = Math.ceil(
        (new Date(`${voucher.created_at}`).getTime() -
          new Date(`${referral.created_at}`).getTime()) /
          this.oneDayinMillionSeconds
      );
      if (days <= 365) {
        let index = 1;
        let year = new Date(`${referral.created_at}`).getFullYear();
        let month = new Date(`${referral.created_at}`).getMonth();
        let accDays = new Date(year, month + 1, 0).getDate();
        while (days > accDays) {
          month++;
          index++;
          let dateLength = new Date(year, month + 1, 0).getDate();
          accDays += dateLength;
          if (month === 12) {
            month = 0;
            year++;
          }
        }
        policy = commissionPolicies.find((policy) =>
          SafeMath.eq(policy.referred_months, index)
        );
      }
    }
    return policy;
  }

  async addAdminUser({ email, body }) {
    const p = path.join(this.config.base.TideBitLegacyPath, "config/roles.yml");
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
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
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
    try {
      const { updateAdminUser } = body;
      if (currentUser.roles?.includes("root")) {
        if (updateAdminUser.email) {
          let index = this.adminUsers.findIndex(
            (user) => user.email === updateAdminUser.email
          );
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
    let result = null,
      currentUser = this.adminUsers.find((user) => user.email === email);
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
    let dbOrders,
      orders = [];
    dbOrders = await this.database.getOrderList({
      quoteCcy: bid,
      baseCcy: ask,
      memberId: query.memberId,
    });
    for (let dbOrder of dbOrders) {
      let order,
        price = dbOrder.price ? Utils.removeZeroEnd(dbOrder.price) : "market";
      if (dbOrder.state === Database.ORDER_STATE_CODE.DONE) {
        if (dbOrder.type === Database.TYPE.ORDER_ASK) {
          price = SafeMath.div(
            dbOrder.funds_received,
            SafeMath.minus(dbOrder.origin_volume, dbOrder.volume)
          );
        }
        if (dbOrder.type === Database.TYPE.ORDER_BID) {
          price = SafeMath.div(
            SafeMath.minus(dbOrder.origin_locked, dbOrder.locked),
            dbOrder.funds_received
          );
        }
      }
      order = {
        id: dbOrder.id,
        ts: parseInt(new Date(dbOrder.updated_at).getTime()),
        at: parseInt(
          SafeMath.div(new Date(dbOrder.updated_at).getTime(), "1000")
        ),
        market: query.tickerSetting?.market,
        kind:
          dbOrder.type === Database.TYPE.ORDER_ASK
            ? Database.ORDER_KIND.ASK
            : Database.ORDER_KIND.BID,
        price,
        origin_volume: Utils.removeZeroEnd(dbOrder.origin_volume),
        volume: Utils.removeZeroEnd(dbOrder.volume),
        state_code: dbOrder.state,
        state: SafeMath.eq(dbOrder.state, Database.ORDER_STATE_CODE.CANCEL)
          ? Database.ORDER_STATE.CANCEL
          : SafeMath.eq(dbOrder.state, Database.ORDER_STATE_CODE.WAIT)
          ? Database.ORDER_STATE.WAIT
          : SafeMath.eq(dbOrder.state, Database.ORDER_STATE_CODE.DONE)
          ? Database.ORDER_STATE.DONE
          : Database.ORDER_STATE.UNKNOWN,
        state_text: SafeMath.eq(dbOrder.state, Database.ORDER_STATE_CODE.CANCEL)
          ? Database.ORDER_STATE_TEXT.CANCEL
          : SafeMath.eq(dbOrder.state, Database.ORDER_STATE_CODE.WAIT)
          ? Database.ORDER_STATE_TEXT.WAIT
          : SafeMath.eq(dbOrder.state, Database.ORDER_STATE_CODE.DONE)
          ? Database.ORDER_STATE_TEXT.DONE
          : Database.ORDER_STATE_TEXT.UNKNOWN,
        clOrdId: dbOrder.id,
        instId: query.tickerSetting?.instId,
        ordType: dbOrder.ord_type,
        filled: dbOrder.volume !== dbOrder.origin_volume,
      };
      orders = [...orders, order];
    }
    return orders;
  }

  /**
   * [deprecated] 2022/10/14
   */
  async getUsersAccounts() {
    return this.tideBitConnector.router("getUsersAccounts", {});
  }

  /**
   * [deprecated] 2022/10/28
   *  move to frontend ticker book `getPrice`
   */
  // async getPriceList() {
  //   try {
  //     const res = await axios({
  //       method: `get`,
  //       url: `https://cc.isun.one/api/cc/PriceList`,
  //     });
  //     if (res.data && res.status !== 200) {
  //       const message = JSON.stringify(res.data);
  //       this.logger.trace(message);
  //     }
  //     // this.logger.debug(`getPriceList res`, res);
  //     return res.data;
  //   } catch (e) {
  //     this.logger.error(`getPriceList e`, e);
  //   }
  // }

  /**
   * [deprecated] 2022/10/28
   *  move to frontend ticker book `getPrice`
   */
  // async getExchangeRates() {
  //   const exchangeRates = this.accountBook.exchangeRates;
  //   return Promise.resolve(
  //     new ResponseFormat({
  //       message: "getExchangeRates",
  //       payload: exchangeRates,
  //     })
  //   );
  // }

  // account api
  async getAccounts({ memberId, email, token }) {
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

  async logout({ header, body }) {
    return this.tideBitConnector.router("logout", { header, body });
  }

  async getTicker({ params, query }) {
    const tickerSetting = this.tickersSettings[query.id];
    if (tickerSetting) {
      const source = tickerSetting.source;
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
    return Promise.resolve({
      supported_resolutions: ["1", "5", "15", "30", "60", "1D", "1W"],
      supports_group_request: false,
      supports_marks: false,
      supports_timescale_marks: false,
      supports_search: true,
    });
  }

  async getTradingViewSymbol({ query }) {
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

  // async countOuterTradeFills({ query }) {
  //   this.logger.debug(
  //     `*********** [${this.name}] countOuterTradeFills ************`,
  //     query
  //   );
  //   let { exchange, start, end } = query;
  //   let startDate = `${start} 00:00:00`,
  //     endtDate = `${end} 23:59:59`,
  //     counts = 0;
  //   switch (exchange) {
  //     case SupportedExchange.OKEX:
  //       counts = await this.database.countOuterTrades({
  //         type: Database.TIME_RANGE_TYPE.BETWEEN,
  //         exchangeCode: Database.EXCHANGE[exchange.toUpperCase()],
  //         start: startDate,
  //         end: endtDate,
  //       });
  //       break;
  //     default:
  //       break;
  //   }
  //   return new ResponseFormat({
  //     message: "getOuterTradeFills",
  //     payload: counts,
  //   });
  // }

  formateDailyProfitChart = (dbOuterTrades) => {
    // this.logger.debug(
    //   `dbOuterTrades[0]${dbOuterTrades[0].create_at.toISOString()}`,
    //   dbOuterTrades[0]
    // );
    let chartData = { data: {}, xaxisType: "string" },
      data = {},
      profits = {},
      lastDailyBar = dbOuterTrades[0]
        ? new Date(
            `${dbOuterTrades[0].create_at
              .toISOString()
              .substring(0, 10)} 00:00:00`
          )
        : null,
      nextDailyBarTime = lastDailyBar
        ? Utils.getNextDailyBarTime(lastDailyBar.getTime())
        : null;
    for (let dbOuterTrade of dbOuterTrades) {
      let outerTradeData = JSON.parse(dbOuterTrade.data),
        outerFee = outerTradeData.avgPx
          ? outerTradeData.fillFee // data source is OKx order
          : outerTradeData.fee,
        profit = SafeMath.minus(
          SafeMath.minus(dbOuterTrade.voucher_fee, Math.abs(outerFee)),
          Math.abs(dbOuterTrade.referral)
        );
      if (profit) {
        // this.logger.debug(`formateDailyProfitChart profit`, profit);
        if (!profits[dbOuterTrade.voucher_fee_currency]) {
          profits[dbOuterTrade.voucher_fee_currency] = {
            sum: 0,
            currency: dbOuterTrade.voucher_fee_currency.toUpperCase(),
          };
        }
        profits[dbOuterTrade.voucher_fee_currency].sum = SafeMath.plus(
          profits[dbOuterTrade.voucher_fee_currency].sum,
          profit
        );
        let key = `${lastDailyBar.getFullYear()}-${
          lastDailyBar.getMonth() + 1
        }-${lastDailyBar.getDate()}`;
        if (!data[key])
          data[key] = {
            y: "0",
            x: key,
            date: lastDailyBar,
          };
        let time = outerTradeData.ts || outerTradeData.cTime;
        // this.logger.debug(`formateDailyProfitChart time`, time);
        while (nextDailyBarTime <= time) {
          lastDailyBar = new Date(nextDailyBarTime);
          nextDailyBarTime = Utils.getNextDailyBarTime(lastDailyBar.getTime());
          key = `${lastDailyBar.getFullYear()}-${
            lastDailyBar.getMonth() + 1
          }-${lastDailyBar.getDate()}`;
          if (!data[key])
            data[key] = {
              y: "0",
              x: key,
              date: lastDailyBar,
            };
        }
        key = `${lastDailyBar.getFullYear()}-${
          lastDailyBar.getMonth() + 1
        }-${lastDailyBar.getDate()}`;
        let price = this.tickerBook.getPrice(dbOuterTrade.voucher_fee_currency);
        // this.logger.debug(`formateDailyProfitChart price`, price);
        if (!data[key])
          data[key] = {
            y: SafeMath.mult(profit, price),
            x: key,
            date: lastDailyBar,
          };
        else
          data[key] = {
            ...data[key],
            y: SafeMath.plus(data[key].y, SafeMath.mult(profit, price)),
          };
      }
    }
    chartData.data = data;
    chartData.xaxisType = "datetime";
    return { chartData, profits };
  };

  formateMonthlyProfitChart = (dbOuterTrades) => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    let chartData = { data: {}, xaxisType: "string" },
      data = {},
      profits = {},
      lastMonthlyBar = dbOuterTrades[0]
        ? new Date(
            `${dbOuterTrades[0].create_at
              .toISOString()
              .substring(0, 7)}-01 00:00:00`
          )
        : null,
      nextMonthlyBarTime = lastMonthlyBar
        ? Utils.getNextMonthlyBarTime(lastMonthlyBar.getTime())
        : null;
    for (let dbOuterTrade of dbOuterTrades) {
      let outerTradeData = JSON.parse(dbOuterTrade.data),
        outerFee = outerTradeData.avgPx
          ? outerTradeData.fillFee // data source is OKx order
          : outerTradeData.fee,
        profit = SafeMath.minus(
          SafeMath.minus(dbOuterTrade.voucher_fee, Math.abs(outerFee)),
          Math.abs(dbOuterTrade.referral)
        );
      if (profit) {
        // this.logger.debug(`formateMonthlyProfitChart profit`, profit);
        if (!profits[dbOuterTrade.voucher_fee_currency]) {
          profits[dbOuterTrade.voucher_fee_currency] = {
            sum: 0,
            currency: dbOuterTrade.voucher_fee_currency.toUpperCase(),
          };
        }
        profits[dbOuterTrade.voucher_fee_currency].sum = SafeMath.plus(
          profits[dbOuterTrade.voucher_fee_currency].sum,
          profit
        );
        let key = `${lastMonthlyBar.getFullYear()}-${
          lastMonthlyBar.getMonth() + 1
        }`;
        if (!data[key])
          data[key] = {
            y: "0",
            x: `${
              months[lastMonthlyBar.getMonth()]
            } ${lastMonthlyBar.getFullYear()}`,
            date: lastMonthlyBar,
          };
        let time = outerTradeData.ts || outerTradeData.cTime;
        while (nextMonthlyBarTime <= time) {
          lastMonthlyBar = new Date(nextMonthlyBarTime);
          nextMonthlyBarTime = Utils.getNextMonthlyBarTime(
            lastMonthlyBar.getTime()
          );
          key = `${lastMonthlyBar.getFullYear()}-${
            lastMonthlyBar.getMonth() + 1
          }`;
          if (!data[key])
            data[key] = {
              y: "0",
              x: `${
                months[lastMonthlyBar.getMonth()]
              } ${lastMonthlyBar.getFullYear()}`,
              date: lastMonthlyBar,
            };
        }
        key = `${lastMonthlyBar.getFullYear()}-${
          lastMonthlyBar.getMonth() + 1
        }`;
        let price = this.tickerBook.getPrice(dbOuterTrade.voucher_fee_currency);
        if (!data[key])
          data[key] = {
            y: SafeMath.mult(profit, price),
            x: `${
              months[lastMonthlyBar.getMonth()]
            } ${lastMonthlyBar.getFullYear()}`,
            date: lastMonthlyBar,
          };
        else
          data[key] = {
            ...data[key],
            y: SafeMath.plus(data[key].y, SafeMath.mult(profit, price)),
          };
      }
    }
    chartData.data = data;
    chartData.xaxisType = "string";
    return { chartData, profits };
  };

  /**  !!! Heavy Loading*/
  async getOuterTradesProfits({ query }) {
    // const pad = (n) => {
    //   return n < 10 ? "0" + n : n;
    // };
    // const monthInterval = 30 * this.oneDayinMillionSeconds;

    let { exchange, start, end, instId } = query;
    let id = instId.replace("-", "").toLowerCase(),
      tickerSetting = this.tickersSettings[id],
      startTime = new Date(start).getTime(),
      endTime = new Date(end).getTime(),
      startDate = `${start} 00:00:00`,
      endtDate = `${end} 23:59:59`,
      result,
      chartData,
      profits,
      dbOuterTrades,
      mDBOTrades;
    if (!this.dbOuterTradesData[instId]) {
      this.dbOuterTradesData[instId] = {
        startTime: null,
        endTime: null,
        data: [],
      };
      // getOuterTradesWithFee asce
      dbOuterTrades = await this.database.getOuterTrades({
        type: Database.TIME_RANGE_TYPE.BETWEEN,
        exchangeCode: Database.EXCHANGE[exchange.toUpperCase()],
        status: Database.OUTERTRADE_STATUS.DONE,
        currency: tickerSetting.code,
        start: startDate,
        end: endtDate,
        asc: true,
      });
      this.dbOuterTradesData[instId].startTime = startTime;
      this.dbOuterTradesData[instId].endTime = endTime;
      this.dbOuterTradesData[instId].data = dbOuterTrades.map(
        (dbOuterTrade) => ({
          ...dbOuterTrade,
        })
      );
    } else {
      if (
        startTime >= this.dbOuterTradesData[instId].startTime &&
        endTime <= this.dbOuterTradesData[instId].endTime
      ) {
        dbOuterTrades = this.dbOuterTradesData[instId].data.filter(
          (dbOuterTrades) => {
            let ts = new Date(
              `${dbOuterTrades.create_at
                .toISOString()
                .substring(0, 10)} 00:00:00`
            );
            return ts >= startTime && ts <= endTime;
          }
        );
      }
      if (
        startTime >= this.dbOuterTradesData[instId].startTime &&
        endTime > this.dbOuterTradesData[instId].endTime
      ) {
        dbOuterTrades = this.dbOuterTradesData[instId].data.filter(
          (dbOuterTrades) => {
            let ts = new Date(
              `${dbOuterTrades.create_at
                .toISOString()
                .substring(0, 10)} 00:00:00`
            );
            return ts >= startTime && ts <= endTime;
          }
        );
        mDBOTrades = await this.database.getOuterTrades({
          type: Database.TIME_RANGE_TYPE.BETWEEN,
          exchangeCode: Database.EXCHANGE[exchange.toUpperCase()],
          status: Database.OUTERTRADE_STATUS.DONE,
          currency: tickerSetting.code,
          start: `${new Date(
            this.dbOuterTradesData[instId].endTime
          ).getFullYear()}-${
            new Date(this.dbOuterTradesData[instId].endTime).getMonth() + 1
          }-${Utils.pad(
            new Date(this.dbOuterTradesData[instId].endTime).getDate() + 1
          )} 23:59:59`,
          end: endtDate,
          asc: true,
        });
        dbOuterTrades = dbOuterTrades.concat(mDBOTrades.map((t) => ({ ...t })));
        this.dbOuterTradesData[instId].data = dbOuterTrades.map(
          (dbOuterTrade) => ({
            ...dbOuterTrade,
          })
        );
        this.dbOuterTradesData[instId].endTime = endTime;
      }
      if (
        startTime < this.dbOuterTradesData[instId].startTime &&
        endTime <= this.dbOuterTradesData[instId].endTime
      ) {
        dbOuterTrades = this.dbOuterTradesData[instId].data.filter(
          (dbOuterTrades) => {
            let ts = new Date(
              `${dbOuterTrades.create_at
                .toISOString()
                .substring(0, 10)} 00:00:00`
            );
            return ts >= startTime && ts <= endTime;
          }
        );
        mDBOTrades = await this.database.getOuterTrades({
          type: Database.TIME_RANGE_TYPE.BETWEEN,
          exchangeCode: Database.EXCHANGE[exchange.toUpperCase()],
          status: Database.OUTERTRADE_STATUS.DONE,
          currency: tickerSetting.code,
          start: startDate,
          end: `${new Date(
            this.dbOuterTradesData[instId].startTime
          ).getFullYear()}-${
            new Date(this.dbOuterTradesData[instId].startTime).getMonth() + 1
          }-${Utils.pad(
            new Date(this.dbOuterTradesData[instId].startTime).getDate() - 1
          )} 23:59:59`,
          asc: true,
        });
        dbOuterTrades = mDBOTrades.map((t) => ({ ...t })).concat(dbOuterTrades);
        this.dbOuterTradesData[instId].data = dbOuterTrades.map(
          (dbOuterTrade) => ({
            ...dbOuterTrade,
          })
        );
        this.dbOuterTradesData[instId].startTime = startTime;
      }
      if (
        startTime < this.dbOuterTradesData[instId].startTime &&
        endTime > this.dbOuterTradesData[instId].endTime
      ) {
        dbOuterTrades = this.dbOuterTradesData[instId].data.filter(
          (dbOuterTrades) => {
            let ts = new Date(
              `${dbOuterTrades.create_at
                .toISOString()
                .substring(0, 10)} 00:00:00`
            );
            return ts >= startTime && ts <= endTime;
          }
        );
        mDBOTrades = await this.database.getOuterTrades({
          type: Database.TIME_RANGE_TYPE.BETWEEN,
          exchangeCode: Database.EXCHANGE[exchange.toUpperCase()],
          status: Database.OUTERTRADE_STATUS.DONE,
          currency: tickerSetting.code,
          start: `${new Date(
            this.dbOuterTradesData[instId].endTime
          ).getFullYear()}-${
            new Date(this.dbOuterTradesData[instId].endTime).getMonth() + 1
          }-${Utils.pad(
            new Date(this.dbOuterTradesData[instId].endTime).getDate() + 1
          )} 23:59:59`,
          end: endtDate,
          asc: true,
        });
        dbOuterTrades = dbOuterTrades.concat(mDBOTrades.map((t) => ({ ...t })));
        this.dbOuterTradesData[instId].endTime = endTime;
        mDBOTrades = await this.database.getOuterTrades({
          type: Database.TIME_RANGE_TYPE.BETWEEN,
          exchangeCode: Database.EXCHANGE[exchange.toUpperCase()],
          status: Database.OUTERTRADE_STATUS.DONE,
          currency: tickerSetting.code,
          start: startDate,
          end: `${new Date(
            this.dbOuterTradesData[instId].startTime
          ).getFullYear()}-${
            new Date(this.dbOuterTradesData[instId].startTime).getMonth() + 1
          }-${Utils.pad(
            new Date(this.dbOuterTradesData[instId].startTime).getDate() - 1
          )} 23:59:59`,
          asc: true,
        });
        dbOuterTrades = mDBOTrades.map((t) => ({ ...t })).concat(dbOuterTrades);
        this.dbOuterTradesData[instId].data = dbOuterTrades.map(
          (dbOuterTrade) => ({
            ...dbOuterTrade,
          })
        );
        this.dbOuterTradesData[instId].startTime = startTime;
      }
    }
    // if (endTime - startTime < 3 * monthInterval) {
    result = this.formateDailyProfitChart(dbOuterTrades);
    chartData = result.chartData;
    profits = result.profits;
    // } else {
    //   result = this.formateMonthlyProfitChart(dbOuterTrades);
    //   chartData = result.chartData;
    //   profits = result.profits;
    // }
    return new ResponseFormat({
      message: "getOuterTradesProfit",
      payload: { chartData: chartData, profits: profits },
    });
  }

  async getOuterTradeFills({ query }) {
    let { exchange, start, end, limit, offset, instId } = query;
    let startDate = `${start} 00:00:00`;
    let endtDate = `${end} 23:59:59`;
    let trades = [],
      id = instId.replace("-", "").toLowerCase(),
      tickerSetting = this.tickersSettings[id],
      referralCommissions = [],
      processTrades = [],
      orderIds = [],
      voucherIds = [],
      orders = [],
      vouchers = [],
      counts;
    switch (exchange) {
      case SupportedExchange.OKEX:
        let result = await this.database.countOuterTrades({
          currency: tickerSetting.code,
          type: Database.TIME_RANGE_TYPE.BETWEEN,
          exchangeCode: Database.EXCHANGE[exchange.toUpperCase()],
          start: startDate,
          end: endtDate,
        });
        counts = result["counts"];
        if (counts > 0) {
          const dbOuterTrades = await this.database.getOuterTrades({
            type: Database.TIME_RANGE_TYPE.BETWEEN,
            exchangeCode: Database.EXCHANGE[exchange.toUpperCase()],
            currency: tickerSetting.code,
            start: startDate,
            end: endtDate,
            limit,
            offset,
          });
          for (let dbOuterTrade of dbOuterTrades) {
            let outerTradeData = JSON.parse(dbOuterTrade.data),
              outerTrade = {
                orderId: outerTradeData.ordId,
                exchange: SupportedExchange.OKEX,
                price: outerTradeData.px, // if outer_trade data type is trade, this value will be null
                volume: outerTradeData.sz, // if outer_trade data type is trade, this value will be null
                fillPrice: outerTradeData.fillPx,
                fillVolume: outerTradeData.fillSz,
                fee: outerTradeData.avgPx
                  ? outerTradeData.fillFee // data source is OKx order
                  : outerTradeData.fee, // data source is Okx trade
                state: Database.OKX_ORDER_STATE[outerTradeData.state],
              },
              tickerSetting =
                this.tickersSettings[
                  outerTradeData.instId.toLowerCase().replace("-", "")
                ],
              innerTrade = {
                orderId: dbOuterTrade.order_id,
                exchange: SupportedExchange.TIDEBIT,
              };
            if (dbOuterTrade.order_id && dbOuterTrade.voucher_id) {
              orderIds = [...orderIds, dbOuterTrade.order_id];
              voucherIds = [...voucherIds, dbOuterTrade.voucher_id];
              // innerTrade = {
              //   orderId: dbOuterTrade.order_id,
              //   exchange: SupportedExchange.TIDEBIT,
              // price: dbOuterTrade.order_price
              //   ? Utils.removeZeroEnd(dbOuterTrade.order_price)
              //   : null,
              // volume: dbOuterTrade.order_origin_volume
              //   ? Utils.removeZeroEnd(dbOuterTrade.order_origin_volume)
              //   : null,
              // fillPrice: dbOuterTrade.voucher_price
              //   ? Utils.removeZeroEnd(dbOuterTrade.voucher_price)
              //   : null,
              // fillVolume: dbOuterTrade.voucher_volume
              //   ? Utils.removeZeroEnd(dbOuterTrade.voucher_volume)
              //   : null,
              // fee: dbOuterTrade.voucher_fee
              //   ? Utils.removeZeroEnd(dbOuterTrade.voucher_fee)
              //   : null,
              // };
            }
            trades = [
              ...trades,
              {
                id: dbOuterTrade.id,
                instId: outerTradeData.instId,
                memberId: dbOuterTrade.memberId,
                email: dbOuterTrade.email,
                status: dbOuterTrade.status,
                voucherId: dbOuterTrade.voucher_id,
                marketCode: tickerSetting.code,
                // kind: dbOuterTrade?.kind,
                outerTrade,
                innerTrade,
                fillPrice: dbOuterTrade.voucher_price || outerTradeData.fillPx,
                fillVolume:
                  dbOuterTrade.voucher_volume || outerTradeData.fillSz,
                fee: dbOuterTrade.voucher_fee
                  ? SafeMath.plus(dbOuterTrade.voucher_fee, outerTradeData.fee)
                  : dbOuterTrade.voucher_fee,
                side: outerTradeData.side,
                exchange: SupportedExchange.OKEX,
                feeCurrency:
                  outerTradeData.feeCcy || dbOuterTrade.voucher_fee_currency,
                ts: new Date(dbOuterTrade.create_at).getTime(),
                alert: false,
              },
            ];
          }
          // getOrdersByIds
          orders = await this.database.getOrdersByIds(orderIds);
          // getVouchersByIds
          vouchers = await this.database.getVouchersByIds(voucherIds);
          // getReferralCommissionsByMarkets
          referralCommissions =
            await this.database.getReferralCommissionsByMarkets({
              markets: [tickerSetting.code],
              start,
              end,
            });
          for (let trade of trades) {
            let alert,
              referral,
              profit,
              referralCommission,
              feeCurrency,
              fee,
              price,
              volume,
              kind,
              state,
              fillPrice,
              fillVolume;
            if (trade.innerTrade.orderId && trade.voucherId) {
              let order = orders.find((o) =>
                SafeMath.eq(o.id, trade.innerTrade.orderId)
              );
              let voucher = vouchers.find((v) =>
                SafeMath.eq(v.id, trade.voucherId)
              );
              if (order) {
                kind = order.ord_type;
                state = Database.DB_STATE_CODE[order.state];
                price = order.price ? Utils.removeZeroEnd(order.price) : null;
                volume = order.origin_volume
                  ? Utils.removeZeroEnd(order.origin_volume)
                  : null;
                state = Database.DB_STATE_CODE[order.state];
                if (voucher) {
                  feeCurrency = (
                    voucher.trend === Database.ORDER_KIND.ASK
                      ? voucher.bid
                      : voucher.ask
                  )?.toUpperCase();
                  fee = voucher
                    ? Utils.removeZeroEnd(voucher[`${voucher.trend}_fee`])
                    : null;
                  fillPrice = voucher.price
                    ? Utils.removeZeroEnd(voucher.price)
                    : null;
                  fillVolume = voucher.volume
                    ? Utils.removeZeroEnd(voucher.volume)
                    : null;
                }
                trade.innerTrade = {
                  ...trade.innerTrade,
                  price,
                  volume,
                  fillPrice,
                  fillVolume,
                  fee,
                  state,
                };
              }
              referralCommission = referralCommissions.find(
                (rc) =>
                  SafeMath.eq(rc.market, trade.marketCode) &&
                  SafeMath.eq(rc.voucher_id, trade.voucherId)
              );
              referral = referralCommission?.amount
                ? Utils.removeZeroEnd(referralCommission?.amount)
                : null;
              profit =
                trade.status === Database.OUTERTRADE_STATUS.DONE
                  ? referral
                    ? SafeMath.minus(
                        SafeMath.minus(
                          trade.innerTrade.fee,
                          Math.abs(trade.outerTrade.fee)
                        ),
                        Math.abs(referral)
                      )
                    : SafeMath.minus(
                        trade.innerTrade.fee,
                        Math.abs(trade.outerTrade.fee)
                      )
                  : null;
              if (
                // (trade.outerTrade.price &&
                //   !SafeMath.eq(
                //     trade.outerTrade.price,
                //     trade.innerTrade.price
                //   )) ||
                (trade.outerTrade.volume &&
                  !SafeMath.eq(
                    trade.outerTrade.volume,
                    trade.innerTrade.volume
                  )) ||
                !SafeMath.eq(
                  trade.outerTrade.fillPrice,
                  trade.innerTrade.fillPrice
                ) ||
                !SafeMath.eq(
                  trade.outerTrade.fillVolume,
                  trade.innerTrade.fillVolume
                ) ||
                (trade.outerTrade.state &&
                  trade.outerTrade.state !==
                    Database.OKX_ORDER_STATE.partially_filled &&
                  trade.outerTrade.state !== trade.innerTrade.state) ||
                (trade.outerTrade.state &&
                  trade.outerTrade.state ===
                    Database.OKX_ORDER_STATE.partially_filled &&
                  trade.innerTrade.state === Database.ORDER_STATE.CANCEL)
              )
                alert = true;
            }
            processTrades = [
              ...processTrades,
              {
                ...trade,
                kind,
                feeCurrency: trade.feeCurrency || feeCurrency,
                referral,
                profit,
                alert,
              },
            ];
          }
        }
        return new ResponseFormat({
          message: "getOuterTradeFills",
          payload: { totalCounts: counts, trades: processTrades },
        });
      default:
        return new ResponseFormat({
          message: "getOuterTradeFills",
          payload: null,
        });
    }
  }

  async getOuterPendingOrders({ query }) {
    let orders = [],
      dbOrders = [],
      orderIds = [],
      emails = [],
      pendingOrders = [],
      memberIds = {};
    // totalCounts,
    // id = query.instId.replace("-", "").toLowerCase(),
    // tickerSetting = this.tickersSettings[id];
    switch (query.exchange) {
      case SupportedExchange.OKEX:
        // ++ TODO 2022/11/25 (需處理 pendingOrders 超過100筆的情況)
        const res = await this.okexConnector.router("getAllOrders", {
          query: { ...query, instType: Database.INST_TYPE.SPOT },
        });
        // let result = await this.database.countOrders({
        //   currency: tickerSetting.code,
        //   state: Database.ORDER_STATE_CODE.WAIT,
        // });
        // totalCounts = result["counts"];
        if (res.success) {
          for (let order of res.payload) {
            let parsedClOrdId, memberId, orderId, outerOrder, innerOrder;
            outerOrder = {
              orderId: order.ordId,
              exchange: SupportedExchange.OKEX,
              price: order.px,
              avgFillPrice: order.avgPx,
              volume: order.sz,
              accFillVolume: order.accFillSz,
              state: Database.OKX_ORDER_STATE[order.state],
              expect:
                order.side === Database.ORDER_SIDE.BUY
                  ? order.sz
                  : SafeMath.mult(order.px, order.sz),
              received:
                order.side === Database.ORDER_SIDE.BUY
                  ? order.accFillSz
                  : SafeMath.mult(order.avgPx, order.accFillSz),
            };
            try {
              parsedClOrdId = Utils.parseClOrdId(order.clOrdId);
            } catch (error) {
              this.logger.error(`OKX order parseClOrdId error`, order, error);
            }
            if (parsedClOrdId) {
              memberId = parsedClOrdId.memberId;
              if (!memberIds[memberId]) memberIds[memberId] = memberId;
              orderId = parsedClOrdId.orderId;
              orderIds = [...orderIds, orderId];
              innerOrder = {
                orderId,
                exchange: SupportedExchange.TIDEBIT,
              };
            }
            let processedOrder = {
              id: order.clOrdId,
              instId: order.instId,
              memberId,
              kind: order.ordType,
              side: order.side,
              outerOrder,
              innerOrder,
              price: order.px,
              volume: order.sz,
              exchange: SupportedExchange.OKEX,
              feeCurrency: order.feeCcy,
              ts: parseInt(order.cTime),
            };
            orders = [...orders, processedOrder];
            // if (order.side === Database.ORDER_SIDE.BUY)
            //   bidOrders = [...bidOrders, processedOrder];
            // else askOrders = [...askOrders, processedOrder];
          }
          // getOrdersByIds
          // askOrders.sort((a, b) => a.price - b.price);
          // bidOrders.sort((a, b) => b.price - a.price);
          // orders = bidOrders.concat(askOrders);
          dbOrders = await this.database.getOrdersByIds(orderIds);
          emails = await this.database.getEmailsByMemberIds(
            Object.values(memberIds)
          );
          for (let order of orders) {
            let dbOrder,
              innerOrder = { ...order.innerOrder },
              price,
              volume,
              email = emails.find((obj) =>
                SafeMath.eq(obj.id, order.memberId)
              )?.email,
              alert = false;
            dbOrder = dbOrders.find(
              (o) =>
                SafeMath.eq(order.innerOrder.orderId, o.id) &&
                SafeMath.eq(order.memberId, o.member_id)
            );
            if (dbOrder) {
              price = Utils.removeZeroEnd(dbOrder.price);
              volume = Utils.removeZeroEnd(dbOrder.origin_volume);
              innerOrder = {
                ...innerOrder,
                price,
                avgFillPrice:
                  order.side === Database.ORDER_SIDE.BUY
                    ? SafeMath.gt(dbOrder.funds_received, 0)
                      ? SafeMath.div(
                          SafeMath.minus(dbOrder.origin_locked, dbOrder.locked),
                          dbOrder.funds_received
                        )
                      : null
                    : SafeMath.gt(
                        SafeMath.minus(dbOrder.origin_volume, dbOrder.volume),
                        0
                      )
                    ? SafeMath.div(
                        dbOrder.funds_received,
                        SafeMath.minus(dbOrder.origin_volume, dbOrder.volume)
                      )
                    : null,
                volume,
                accFillVolume: SafeMath.minus(
                  dbOrder.origin_volume,
                  dbOrder.volume
                ),
                state:
                  dbOrder.state === Database.ORDER_STATE_CODE.CANCEL
                    ? Database.ORDER_STATE.CANCEL
                    : dbOrder.state === Database.ORDER_STATE_CODE.DONE
                    ? Database.ORDER_STATE.DONE
                    : Database.ORDER_STATE.WAIT,
                expect:
                  order.side === Database.ORDER_SIDE.BUY
                    ? Utils.removeZeroEnd(dbOrder.origin_volume)
                    : dbOrder.price
                    ? SafeMath.mult(dbOrder.price, dbOrder.origin_volume)
                    : null,
                received: Utils.removeZeroEnd(dbOrder.funds_received),
              };
              if (
                !SafeMath.eq(
                  order.outerOrder.accFillVolume,
                  innerOrder.accFillVolume
                ) ||
                !SafeMath.eq(order.outerOrder.expect, innerOrder.expect) ||
                !SafeMath.eq(order.outerOrder.received, innerOrder.received) ||
                order.outerOrder.state !== innerOrder.state
              ) {
                alert = true;
              }
            }
            pendingOrders = [
              ...pendingOrders,
              {
                ...order,
                email: dbOrder ? email : null,
                innerOrder,
                price: price || order.outerOrder.price,
                volume: volume || order.outerOrder.volume,
                alert,
              },
            ];
          }
        }
        return new ResponseFormat({
          message: "getOuterPendingOrders",
          payload: pendingOrders,
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
    if (!memberId || memberId === -1) {
      return new ResponseFormat({
        message: "member_id not found",
        code: Codes.USER_IS_LOGOUT,
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
          // account,
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
          // this.logger.error(`clOrdId`, clOrdId);
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
          // this.logger.debug("[RESPONSE]", response);
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
              // let _updateAccount = {
              //   balance: SafeMath.plus(account.balance, orderData.balance),
              //   locked: SafeMath.plus(account.locked, orderData.locked),
              //   currency: this.coinsSettings.find(
              //     (curr) => curr.id === account.currency
              //   )?.symbol,
              //   total: SafeMath.plus(
              //     SafeMath.plus(account.balance, orderData.balance),
              //     SafeMath.plus(account.locked, orderData.locked)
              //   ),
              // };
              // this._emitUpdateAccount({
              //   memberId,
              //   account: _updateAccount,
              // });
            }
          } else {
            //  * 6.2 掛單失敗
            //  * 6.2.1 DB transaction
            t = await this.database.transaction();
            //    * 6.2.2 根據 order locked amount 減少 account locked amount 並增加 balance amount
            //    * 6.2.3 新增 account_versions 記錄
            //    * 6.2.4 更新 order 為 cancel 狀態
            result = await this.updateOrderStatus({
              transaction: t,
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

  /**
   * [deprecated] 2022/11/17
   */
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

  async updateOrderStatus({
    transaction,
    orderId,
    memberId,
    orderData,
    dbOrder,
    tickerSetting,
    force,
  }) {
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
      _tickerSetting,
      accountVersion,
      createdAt = new Date().toISOString().slice(0, 19).replace("T", " ");
    try {
      order = dbOrder
        ? dbOrder
        : await this.database.getOrder(orderId, {
            dbTransaction: transaction,
          });
      if (order && order.state === Database.ORDER_STATE_CODE.WAIT) {
        currencyId =
          order?.type === Database.TYPE.ORDER_ASK ? order?.ask : order?.bid;
        _tickerSetting = tickerSetting
          ? tickerSetting
          : Object.values(this.tickersSettings).find((ts) =>
              SafeMath.eq(ts.code, order.currency)
            );
        if (!_tickerSetting) throw Error("Can't find instId");
        locked = SafeMath.mult(order.locked, "-1");
        balance = order.locked;
        fee = "0";
        const newOrder = {
          id: orderId,
          state: Database.ORDER_STATE_CODE.CANCEL,
          updated_at: `"${createdAt}"`,
        };
        await this.database.updateOrder(newOrder, {
          dbTransaction: transaction,
        });
        this.logger.debug(`被取消訂單的狀態更新了`);
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
        await this._updateAccount(accountVersion, transaction);
        this.logger.debug(`被取消訂單對應的用戶帳號更新了`);
        updatedOrder = {
          ...order,
          clOrdId: orderData.clOrdId,
          instId: _tickerSetting?.instId,
          state: Database.ORDER_STATE.CANCEL,
          state_text: Database.ORDER_STATE_TEXT.CANCEL,
          at: parseInt(SafeMath.div(Date.now(), "1000")),
          ts: Date.now(),
        };
        this.logger.debug(`回傳更新後的 order snapshot`, updatedOrder);
        success = true;
      }
    } catch (error) {
      success = false;
      this.logger.error(
        `[${this.constructor.name} updateOrderStatus] error`,
        error
      );
    }
    return { success, updatedOrder };
    /* !!! HIGH RISK (end) !!! */
  }
  async postCancelOrder({ header, params, query, body, memberId }) {
    let transaction = await this.database.transaction(),
      dbOrder,
      tickerSetting,
      result,
      dbUpdateR,
      apiR,
      orderId = body.orderId,
      clOrdId = `${this.okexBrokerId}${memberId}m${body.orderId}o`.slice(0, 32);
    try {
      dbOrder = await this.database.getOrder(orderId, {
        dbTransaction: transaction,
      });
      this.logger.debug(
        `postCancelOrder dbOrder[memberId:${memberId}](SafeMath.eq(dbOrder.member_id, memberId):${SafeMath.eq(
          dbOrder.member_id,
          memberId
        )})`,
        dbOrder
      );
      if (!SafeMath.eq(dbOrder.member_id, memberId))
        throw Error("Order not found");
      tickerSetting = Object.values(this.tickersSettings).find((ts) =>
        SafeMath.eq(ts.code, dbOrder.currency)
      );
      // this.logger.debug(`postCancelOrder tickerSetting`, tickerSetting);
      if (!tickerSetting) throw Error("Can't find ticker");
      switch (tickerSetting?.source) {
        case SupportedExchange.OKEX:
          // 1. updateDB
          /* !!! HIGH RISK (start) !!! */

          this.logger.debug(
            `準備呼叫 DB 更新被取消訂單的狀態及更新對應用戶帳號 orderId:[${orderId}] clOrdId:[${clOrdId}]`
          );
          dbUpdateR = await this.updateOrderStatus({
            transaction,
            orderId,
            memberId,
            dbOrder,
            tickerSetting,
            orderData: {
              id: orderId,
              clOrdId,
            },
          });
          /* !!! HIGH RISK (end) !!! */
          if (!dbUpdateR?.success) {
            await transaction.rollback();
            result = new ResponseFormat({
              message: "DB ERROR",
              code: Codes.CANCEL_ORDER_FAIL,
            });
            this.logger.debug(`DB 更新失敗 rollback`);
          } else {
            // 2. performTask (Task: cancel)
            this.logger.debug(`準備呼叫 API 執行取消訂單`);
            this.logger.debug(`postCancelOrder`, body);
            apiR = await this.okexConnector.router("postCancelOrder", {
              params,
              query,
              memberId,
              body: {
                instId: tickerSetting.instId,
                clOrdId,
              },
            });
            this.logger.debug(`okexCancelOrderRes`, apiR);
          }
          if (!result) {
            if (!apiR?.success) {
              await transaction.rollback();
              this.logger.debug(`API 取消訂單失敗 rollback`);
            } else {
              await transaction.commit();
              this.logger.debug(`API 取消訂單成功了`);
              // 3. informFrontEnd
              this.logger.debug(`準備通知前端更新頁面`);
              this._emitUpdateOrder({
                memberId,
                instId: tickerSetting.instId,
                market: tickerSetting.market,
                order: {
                  ...dbUpdateR.updatedOrder,
                  ordId: apiR.payload[0].ordId,
                },
              });
              // this._emitUpdateAccount({
              //   memberId,
              //   account: dbUpdateR.updateAccount,
              // });
              this.logger.debug(`通知前端成功了`);
            }
          }
          result = apiR;
          break;
        case SupportedExchange.TIDEBIT:
          await transaction.commit();
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

  async forceCancelOrder({ body, email }) {
    this.logger.debug(`forceCancelOrder email, body`, email, body);
    let memberId = body.memberId;
    let orderId = body.orderId;
    let orderExchange = body.orderExchange;
    let result,
      dbOrder,
      dbUpdateR,
      apiR,
      tickerSetting,
      currentUser = this.adminUsers.find((user) => user.email === email),
      dbTransaction;
    if (!currentUser.roles?.includes("root"))
      result = new ResponseFormat({
        message: `Permission denied`,
        code: Codes.INVALID_INPUT,
      });
    if (!result) {
      dbTransaction = await this.database.transaction();
      try {
        dbOrder = await this.database.getOrder(orderId, {
          dbTransaction,
        });
        this.logger.debug(`forceCancelOrder dbOrder`, dbOrder);
        if (
          dbOrder &&
          SafeMath.eq(dbOrder.member_id, memberId) &&
          dbOrder.state !== Database.ORDER_STATE_CODE.DONE
        ) {
          tickerSetting = Object.values(this.tickersSettings).find((ts) =>
            SafeMath.eq(ts.code, dbOrder.currency)
          );
          switch (orderExchange) {
            case SupportedExchange.OKEX:
              let clOrdId =
                `${this.okexBrokerId}${dbOrder.member_id}m${orderId}o`.slice(
                  0,
                  32
                );
              if (dbOrder.state === Database.ORDER_STATE_CODE.WAIT) {
                dbUpdateR = await this.updateOrderStatus({
                  transaction: dbTransaction,
                  orderId: orderId,
                  memberId: dbOrder.member_id,
                  dbOrder,
                  tickerSetting,
                  orderData: {
                    id: orderId,
                    clOrdId,
                  },
                });
                if (!dbUpdateR?.success) {
                  await dbTransaction.rollback();
                  result = new ResponseFormat({
                    message: "DB ERROR",
                    code: Codes.CANCEL_ORDER_FAIL,
                  });
                  this.logger.debug(`DB 更新失敗 rollback`);
                }
              }
              if (!result) {
                // 2. performTask (Task: cancel)
                this.logger.debug(`準備呼叫 API 執行取消訂單`);
                this.logger.debug(`postCancelOrder`, body);
                apiR = await this.okexConnector.router("postCancelOrder", {
                  body: {
                    instId: tickerSetting.instId,
                    clOrdId,
                  },
                });
                this.logger.debug(`okexCancelOrderRes`, apiR);
                if (!apiR?.success) {
                  await dbTransaction.rollback();
                  this.logger.debug(`API 取消訂單失敗 rollback`);
                } else {
                  await dbTransaction.commit();
                  this.logger.debug(`API 取消訂單成功了`);
                }
              }
              result = apiR;
              break;
            default:
              result = new ResponseFormat({
                message: `訂單不存在`,
                code: Codes.INVALID_INPUT,
              });
              break;
          }
        } else {
          result = new ResponseFormat({
            message: `訂單不存在`,
            code: Codes.INVALID_INPUT,
          });
        }
      } catch (error) {
        this.logger.error(`取消訂單失敗了`, error);
        result = new ResponseFormat({
          message: error.message,
          code: Codes.CANCEL_ORDER_FAIL,
        });
      }
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
            // this.logger.debug(`postCancelOrder`, body);
            // this.logger.debug(`okexCancelOrderRes`, okexCancelOrderRes);
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
    switch (exchange) {
      case SupportedExchange.OKEX:
      default:
        try {
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

  getMemberFeeRate(memberTag, market) {
    let askFeeRate, bidFeeRate;
    // this.logger.debug(`memberTag`, memberTag); // 1 是 vip， 2 是 hero
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

  /**
   * [deprecated] 2022/11/18
   * (
   *   原本是想用在 processor 流程但後來沒有用，因為怕 DB 更新跟通知前端更新分開來數值會有錯誤，
   *   所以此function _emitUpdateOrder 的部份寫在 processor 裡面 calculator 之後 updater 之前，
   *   _emitUpdateAccount 寫在 updater 裡面的 _updateAccount
   * )
   */
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

  async abnormalOrderHandler({ dbOrder, apiOrder, dbTransaction }) {
    // ++ TODO high priority !!!
    // this.logger.debug(`abnormalOrderHandler dbOrder`, dbOrder);
    // this.logger.debug(`abnormalOrderHandler apiOrder`, apiOrder);
    let now = `${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
      updatedOrder,
      orderState,
      orderLocked,
      orderFundsReceived,
      orderVolume,
      orderTradesCount,
      doneAt = null;
    switch (apiOrder.state) {
      case Database.ORDER_STATE.CANCEL:
        orderState = Database.ORDER_STATE_CODE.CANCEL;
        break;
      case Database.ORDER_STATE.FILLED:
        orderState = Database.ORDER_STATE_CODE.DONE;
        doneAt = `${new Date(parseInt(apiOrder.fillTime))
          .toISOString()
          .slice(0, 19)
          .replace("T", " ")}`;
        break;
      default:
        orderState = Database.ORDER_STATE_CODE.WAIT;
        break;
    }
    orderVolume = SafeMath.minus(dbOrder.origin_volume, apiOrder.accFillSz);
    orderLocked =
      apiOrder.side === Database.ORDER_SIDE.BUY
        ? SafeMath.minus(
            dbOrder.origin_locked,
            SafeMath.mult(apiOrder.avgPx, apiOrder.accFillSz)
          )
        : SafeMath.minus(dbOrder.origin_locked, apiOrder.accFillSz);
    orderFundsReceived =
      apiOrder.side === Database.ORDER_SIDE.BUY
        ? apiOrder.accFillSz
        : SafeMath.mult(apiOrder.avgPx, apiOrder.accFillSz);
    let count = await this.database.countOuterTrades({
      exchangeCode: Database.EXCHANGE.OKEX,
      id: apiOrder.tradeId,
    });
    orderTradesCount = count["counts"];
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
    // ++ TODO high priority !!!
    // this.logger.debug(
    //   `abnormalOrderHandler combined dbOrder & apiOrder get updatedOrder`,
    //   updatedOrder
    // );
    return updatedOrder;
    // await this.database.updateOrder(updatedOrder, { dbTransaction });
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
  async calculator({
    market,
    member,
    dbOrder,
    orderDetail,
    data,
    referredByMember,
    memberReferral,
  }) {
    // this.logger.debug(`calculator `);
    let now = `${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
      value = SafeMath.mult(data.fillPx, data.fillSz),
      tmp = this.getMemberFeeRate(member.member_tag, market),
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
      currency,
      refGrossFee,
      referralCommission,
      result;
    try {
      // 1. 新的 order volume 為 db紀錄的該 order volume 減去 data 裡面的 fillSz
      orderVolume = SafeMath.minus(dbOrder.volume, data.fillSz);
      // 2. 新的 order tradesCounts 為 db紀錄的該 order tradesCounts + 1
      orderTradesCount = SafeMath.plus(dbOrder.trades_count, "1");
      // 3. 根據 data side （BUY，SELL）需要分別計算
      // 3.1 order 新的鎖定金額
      // 3.2 order 新的 fund receiced
      if (data.side === Database.ORDER_SIDE.BUY) {
        orderLocked = SafeMath.minus(dbOrder.locked, value);
        orderFundsReceived = SafeMath.plus(dbOrder.funds_received, data.fillSz);
      }
      if (data.side === Database.ORDER_SIDE.SELL) {
        orderLocked = SafeMath.minus(dbOrder.locked, data.fillSz);
        orderFundsReceived = SafeMath.plus(dbOrder.funds_received, value);
      }
      // 4. 根據更新的 order volume 是否為 0 來判斷此筆 order 是否完全撮合，為 0 即完全撮合
      // 4.1 更新 order doneAt
      // 4.2 更新 order state
      // this.logger.debug(`calculator orderVolume`, orderVolume);
      if (SafeMath.eq(orderVolume, "0")) {
        orderState = Database.ORDER_STATE_CODE.DONE;
        doneAt = now;
        // 5. 當更新的 order 已完全撮合，需要將剩餘鎖定的金額全部釋放還給對應的 account，此時會新增一筆 account version 的紀錄，這邊將其命名為 orderFullFilledAccountVersion
        // if (SafeMath.gt(orderLocked, 0)) {
        // orderLocked = "0"; // !!!!!! ALERT 剩餘鎖定金額的紀錄保留在 order裡面 （實際有還給 account 並生成憑證）
        // this.logger.debug(
        //   `calculator orderFullFilledAccountVersion`,
        //   orderFullFilledAccountVersion
        // );
        // }
      } else if (SafeMath.gt(orderVolume, "0")) {
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
      if (
        SafeMath.lt(orderVolume, 0) ||
        SafeMath.lt(
          orderVolume,
          SafeMath.minus(orderDetail.sz, orderDetail.accFillSz)
        )
      ) {
        /**
         * ALERT: handle abnormal order
         */
        this.logger.debug(
          // throw Error(
          `!!! ERROR !!!, abnormal order:update orderVolume:[${orderVolume}] less than 0(${SafeMath.lt(
            orderVolume,
            0
          )}) or orderVolume less than orderDetail(sz:[${
            orderDetail.sz
          }] - accFillSz:[${orderDetail.accFillSz}]) remain size( ${SafeMath.lt(
            orderVolume,
            SafeMath.minus(orderDetail.sz, orderDetail.accFillSz)
          )})`
        );
        try {
          updatedOrder = await this.abnormalOrderHandler({
            dbOrder,
            apiOrder: orderDetail,
          });
        } catch (error) {
          throw error;
        }
      }

      if (SafeMath.eq(updatedOrder.orderVolume, "0")) {
        // 5. 當更新的 order 已完全撮合，需要將剩餘鎖定的金額全部釋放還給對應的 account，此時會新增一筆 account version 的紀錄，這邊將其命名為 orderFullFilledAccountVersion
        if (SafeMath.gt(updatedOrder.orderLocked, 0)) {
          orderFullFilledAccountVersion = {
            member_id: member.id,
            currency: dbOrder.bid,
            created_at: now,
            updated_at: now,
            modifiable_type: Database.MODIFIABLE_TYPE.TRADE,
            reason: Database.REASON.ORDER_FULLFILLED,
            fun: Database.FUNC.UNLOCK_FUNDS,
            fee: 0,
            balance: updatedOrder.orderLocked,
            locked: SafeMath.mult(updatedOrder.orderLocked, "-1"),
            // ++TODO modifiable_id
          };
        }
      }

      // 3. 根據 data side （BUY，SELL）需要分別計算
      // 3.3 voucher 及 account version 的手需費
      // 3.4 voucher 與 account version 裡面的手續費是對應的
      if (data.side === Database.ORDER_SIDE.BUY) {
        trend = Database.ORDER_KIND.BID;
        askFee = 0;
        bidFee = SafeMath.mult(data.fillSz, bidFeeRate);
        refGrossFee = bidFee;
        currency = this.coinsSettings.find(
          (coinSetting) => coinSetting.code === market.bid.currency
        )?.id;
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
        trend = Database.ORDER_KIND.ASK;
        askFee = SafeMath.mult(value, askFeeRate);
        refGrossFee = askFee;
        currency = this.coinsSettings.find(
          (coinSetting) => coinSetting.code === market.ask.currency
        )?.id;
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
      // this.logger.debug(`calculator askAccountVersion`, askAccountVersion);
      // this.logger.debug(`calculator bidAccountVersion`, bidAccountVersion);
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
      // this.logger.debug(`calculator voucher`, voucher);
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
      // this.logger.debug(`calculator trade`, trade);
      if (referredByMember) {
        // this.logger.debug(`calculator referredByMember`, referredByMember);
        // this.logger.debug(`calculator memberReferral`, memberReferral);
        /**
         * referred_by_member: @referred_by_member => referredByMember.id
         * trade_member: @trade_member => member.id
         * voucher: @voucher => vouucher.id
         * applied_plan: plan => getReferrerCommissionPlan(memberReferral)
         * applied_policy: policy => getReferrerCommissionPolicy(memberReferral, voucher)
         * trend: @trend,
         * market: @market_code,
         * currency: @currency_id,
         * ref_gross_fee: @fee,
         * ref_net_fee: @fee - eligible_commission,
         * amount: eligible_commission
         */
        let plan = await this.getReferrerCommissionPlan(memberReferral);
        let policy = await this.getReferrerCommissionPolicy(
          memberReferral,
          voucher
        );
        if (policy) {
          let eligibleCommission = SafeMath.mult(refGrossFee, policy.rate);
          referralCommission = {
            referredByMemberId: referredByMember.id,
            tradeMemberId: member.id,
            // voucherId: voucher.id, // ++ after insert voucherId
            appliedPlanId: plan,
            appliedPolicyId: policy.id,
            trend,
            market: market.code,
            currency,
            refGrossFee,
            refNetFee: SafeMath.minus(refGrossFee, eligibleCommission),
            amount: eligibleCommission,
            state: "submitted",
            depositedAt: null,
            createdAt: now,
            updatedAt: now,
          };
          // this.logger.debug(`calculator referralCommission`, referralCommission);
        }
      }
    } catch (error) {
      throw error;
    }
    result = {
      updatedOrder,
      voucher,
      trade,
      askAccountVersion,
      bidAccountVersion,
      orderFullFilledAccountVersion,
      referralCommission,
    };
    return result;
  }

  accountVersionVerifier(accountVersion, dbAccountVersion) {
    let result = true;
    if (!SafeMath.eq(accountVersion.currency, dbAccountVersion.currency))
      result = false;
    if (accountVersion.modifiable_type !== dbAccountVersion.modifiable_type)
      result = false;
    if (!SafeMath.eq(accountVersion.balance, dbAccountVersion.balance))
      result = false;
    if (!SafeMath.eq(accountVersion.locked, dbAccountVersion.locked))
      result = false;
    if (!SafeMath.eq(accountVersion.fee, dbAccountVersion.fee)) result = false;
    if (!SafeMath.eq(accountVersion.reason, dbAccountVersion.reason))
      result = false;
    if (!SafeMath.eq(accountVersion.fun, dbAccountVersion.fun)) result = false;
    return result;
  }

  async updateOuterTrade({
    member,
    status,
    id,
    currency,
    trade,
    dbOrder,
    voucher,
    askAccountVersion,
    bidAccountVersion,
    orderFullFilledAccountVersion,
    referralCommission,
    dbTransaction,
  }) {
    // this.logger.log(`updateOuterTrade status`, status);
    let now = `${new Date().toISOString().slice(0, 19).replace("T", " ")}`;
    try {
      switch (status) {
        case Database.OUTERTRADE_STATUS.DUPLICATE_PROCESS:
          await this.database.updateOuterTrade(
            {
              id,
              status,
              update_at: `"${now}"`,
            },
            { dbTransaction }
          );
          break;
        case Database.OUTERTRADE_STATUS.SYSTEM_ERROR:
        case Database.OUTERTRADE_STATUS.OTHER_SYSTEM_TRADE:
        case Database.OUTERTRADE_STATUS.ClORDId_ERROR:
          await this.database.updateOuterTrade(
            {
              id,
              status,
              currency,
              update_at: `"${now}"`,
              order_id: 0,
            },
            { dbTransaction }
          );
          break;
        case Database.OUTERTRADE_STATUS.API_ORDER_CANCEL:
          // 確保 cancel order 的 locked 金額有還給用戶
          let dbCancelOrderAccountVersions =
            await this.database.getAccountVersionsByModifiableIds(
              [dbOrder.id],
              Database.MODIFIABLE_TYPE.ORDER
            );
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
          this.logger.debug(`updateOuterTrade updateOrder`, updatedOrder);
          break;
        case Database.OUTERTRADE_STATUS.DB_ORDER_CANCEL:
          await this.database.updateOuterTrade(
            {
              id,
              status,
              currency,
              update_at: `"${now}"`,
              order_id: dbOrder.id,
              member_id: member.id,
            },
            { dbTransaction }
          );
          break;
        case Database.OUTERTRADE_STATUS.DONE:
          if (
            !id ||
            !dbOrder?.id ||
            !trade?.id ||
            !voucher?.id ||
            !member?.id ||
            !askAccountVersion?.id ||
            !bidAccountVersion?.id
          ) {
            // this.logger.debug(`updateOuterTrade id`, id);
            // this.logger.debug(`updateOuterTrade dbOrder`, dbOrder);
            // this.logger.debug(`updateOuterTrade trade`, trade);
            // this.logger.debug(`updateOuterTrade voucher`, voucher);
            // this.logger.debug(`updateOuterTrade member`, member);
            // this.logger.debug(
            //   `updateOuterTrade askAccountVersion`,
            //   askAccountVersion
            // );
            // this.logger.debug(
            //   `updateOuterTrade bidAccountVersion`,
            //   bidAccountVersion
            // );
            // this.logger.debug(
            //   `updateOuterTrade orderFullFilledAccountVersions`,
            //   orderFullFilledAccountVersion
            // );
            throw Error("missing params");
          }
          await this.database.updateOuterTrade(
            {
              id,
              status,
              update_at: `"${now}"`,
              order_id: dbOrder.id,
              order_price: dbOrder.price,
              order_origin_volume: dbOrder.origin_volume,
              member_id: member.id,
              member_tag: member.member_tag,
              email: member.email,
              trade_id: trade.id,
              voucher_id: voucher.id,
              currency,
              kind: `"${dbOrder.ord_type}"`,
              voucher_price: voucher.price,
              voucher_volume: voucher.volume,
              voucher_fee: voucher ? voucher[`${voucher.trend}_fee`] : null,
              voucher_fee_currency:
                voucher.trend === Database.ORDER_KIND.ASK
                  ? `"${voucher.bid}"`
                  : `"${voucher.ask}"`,
              ask_account_version_id: askAccountVersion.id || null,
              bid_account_version_id: bidAccountVersion.id || null,
              order_full_filled_account_version_id:
                orderFullFilledAccountVersion?.id || null,
              referral_commission_id: referralCommission?.id || null,
              referral: referralCommission?.amount || null,
            },
            { dbTransaction }
          );
          break;
        default:
          break;
      }
    } catch (error) {
      throw error;
    }
  }

  async updater({
    dbOrder,
    updatedOrder,
    voucher,
    trade,
    tradeFk,
    member,
    market,
    instId,
    askAccountVersion,
    bidAccountVersion,
    orderFullFilledAccountVersion,
    referralCommission,
    dbTransaction,
  }) {
    /* !!! HIGH RISK (start) !!! */
    /**
     * 1. update DB order
     * 2. insert trade
     * 3. insert voucher
     * 4. update Accounts
     * 5. insert referralCommission (++ TODO verify)
     */
    let tradeId,
      voucherId,
      // referralCommissionId,
      newAskAccountVersion,
      newBidAccountVersion,
      newOrderFullFilledAccountVersion,
      dbTrade,
      dbVoucher,
      dbAccountVersions,
      dbReferrerCommission;
    // this.logger.debug(`updater`);
    try {
      if (dbOrder.state !== Database.ORDER_STATE_CODE.WAIT) {
        throw Error(`orderState is not wait`);
        // throw Error({
        //   message: `orderState is not wait`,
        //   code: Codes.ABNORMAL_ORDER,
        //   data: { dbOrder },
        // });
      }
      await this.database.updateOrder(updatedOrder, { dbTransaction });
      dbTrade = await this.database.getTradeByTradeFk(tradeFk);
      if (dbTrade) {
        tradeId = dbTrade.id;
        dbVoucher = await this.database.getVoucherByOrderIdAndTradeId(
          dbOrder.id,
          tradeId
        );
        dbAccountVersions =
          await this.database.getAccountVersionsByModifiableIds(
            [tradeId],
            Database.MODIFIABLE_TYPE.TRADE
          );
        throw Error(
          JSON.stringify({
            message: `dbTrade is exist`,
            dbTrade: dbTrade,
            dbVoucher: dbVoucher,
            dbAccountVersions: dbAccountVersions,
            code: Codes.DUPLICATE_PROCESS_OUTER_TRADE,
          })
        );
      }
      //  else {
      tradeId = await this.database.insertTrades(
        { ...trade, trade_fk: tradeFk },
        { dbTransaction }
      );
      let time = trade.updated_at.replace(/['"]+/g, "");
      let newTrade = {
        id: tradeId, // ++ verified 這裡的 id 是 DB trade id 還是  OKx 的 tradeId
        price: trade.price,
        volume: trade.volume,
        market: market.id,
        at: parseInt(SafeMath.div(new Date(time), "1000")),
        ts: new Date(time),
      };
      this._emitNewTrade({
        memberId: member.id,
        instId,
        market: market.id,
        trade: newTrade,
      });
      // this.logger.debug(`updater insertTrades success tradeId`, tradeId);
      // }
      // if (dbVoucher) {
      //   voucherId = dbVoucher.id;
      //   // this.logger.error("voucher exist voucher", voucher);
      //   // this.logger.error("voucher exist dbVoucher", dbVoucher);
      // } else {
      voucherId = await this.database.insertVouchers(
        {
          ...voucher,
          trade_id: tradeId,
        },
        { dbTransaction }
      );
      // this.logger.debug(
      //   `updater insertVouchers success voucherId`,
      //   voucherId
      // );
      // }
      // let dbAskAccountVersion =
      //   dbAccountVersions?.length > 0
      //     ? dbAccountVersions.find(
      //         (dbAccV) =>
      //           dbAccV.currency.toString() ===
      //           askAccountVersion.currency.toString()
      //       )
      //     : null;
      // if (dbAskAccountVersion) {
      // this.logger.error(`askAccountVersion exist`);
      // if (this.accountVersionVerifier(askAccountVersion, dbAskAccountVersion))
      //   newAskAccountVersion = dbAskAccountVersion;
      // else {
      //   // this.logger.error(`askAccountVersion`, askAccountVersion);
      //   // this.logger.error(`dbAskAccountVersion`, dbAskAccountVersion);
      //   throw Error(`db update amount is different from outer data`);
      // }
      // } else {
      newAskAccountVersion = await this._updateAccount(
        { ...askAccountVersion, modifiable_id: tradeId },
        dbTransaction
      );
      // this.logger.debug(
      //   `updater _updateAccount success askAccountVersion id`,
      //   newAskAccountVersion.id
      // );
      // }
      // let dbBidAccountVersion =
      //   dbAccountVersions?.length > 0
      //     ? dbAccountVersions.find(
      //         (dbAccV) =>
      //           dbAccV.currency.toString() ===
      //             bidAccountVersion.currency.toString() &&
      //           dbAccV.reason !== Database.REASON.ORDER_FULLFILLED
      //       )
      //     : null;
      // if (dbBidAccountVersion) {
      //   // this.logger.error(`bidAccountVersion exist`);
      //   if (this.accountVersionVerifier(bidAccountVersion, dbBidAccountVersion))
      //     newBidAccountVersion = dbBidAccountVersion;
      //   else {
      //     // this.logger.error(`newBidAccountVersion`, newBidAccountVersion);
      //     // this.logger.error(`dbBidAccountVersion`, dbBidAccountVersion);
      //     throw Error(`db update amount is different from outer data`);
      //   }
      // } else {
      newBidAccountVersion = await this._updateAccount(
        { ...bidAccountVersion, modifiable_id: tradeId },
        dbTransaction
      );
      // this.logger.debug(
      //   `updater _updateAccount success bidAccountVersion id`,
      //   newBidAccountVersion.id
      // );
      // }
      if (orderFullFilledAccountVersion) {
        // let dbOrderFullFilledAccountVersion =
        //   dbAccountVersions?.length > 0
        //     ? dbAccountVersions.find(
        //         (dbAccV) =>
        //           dbAccV.currency.toString() ===
        //             orderFullFilledAccountVersion.currency.toString() &&
        //           dbAccV.reason === Database.REASON.ORDER_FULLFILLED
        //       )
        //     : null;
        // if (dbOrderFullFilledAccountVersion) {
        //   // this.logger.error(`orderFullFilledAccountVersion exist`);
        //   if (
        //     this.accountVersionVerifier(
        //       orderFullFilledAccountVersion,
        //       dbOrderFullFilledAccountVersion
        //     )
        //   )
        //     newOrderFullFilledAccountVersion = dbOrderFullFilledAccountVersion;
        //   else {
        //     // this.logger.error(
        //     //   `newOrderFullFilledAccountVersion`,
        //     //   newOrderFullFilledAccountVersion
        //     // );
        //     // this.logger.error(
        //     //   `dbOrderFullFilledAccountVersion`,
        //     //   dbOrderFullFilledAccountVersion
        //     // );
        //     throw Error(`db update amount is different from outer data`);
        //   }
        // } else {
        newOrderFullFilledAccountVersion = await this._updateAccount(
          { ...orderFullFilledAccountVersion, modifiable_id: tradeId },
          dbTransaction
        );
        // this.logger.debug(
        //   `updater _updateAccount success orderFullFilledAccountVersion id`,
        //   newOrderFullFilledAccountVersion.id
        // );
        // }
      }
      if (referralCommission) {
        let rcs = await this.database.getReferralCommissionsByConditions({
          conditions: {
            voucherId,
            market: market.code,
            tradeMemberId: member.id,
          },
        });
        // this.logger.log(`updater rcs`, rcs);
        dbReferrerCommission = rcs[0];
        // this.logger.log(`updater dbReferrerCommission`, dbReferrerCommission);
        if (dbReferrerCommission) {
          // this.logger.error(`referralCommission exist`);
          if (
            !SafeMath.eq(
              dbReferrerCommission.referred_by_member_id,
              referralCommission.referredByMemberId
            ) ||
            !SafeMath.eq(
              dbReferrerCommission.ref_net_fee,
              referralCommission.refNetFee
            )
          ) {
            // this.logger.error(`referralCommission`, referralCommission);
            // this.logger.error(`dbReferrerCommission`, dbReferrerCommission);
            throw Error(
              `db update referralCommission is different from outer data`
            );
          }
          // referralCommissionId = dbReferrerCommission.id;
        } else {
          /**
           * ++ TODO after verify
           */
          // referralCommissionId = await this.database.insertReferralCommission(
          //   {
          //     ...referralCommission,
          //     voucherId,
          //   },
          //   { dbTransaction }
          // );
          // this.logger.debug(
          //   `updater insertReferralCommission success referralCommissionId`,
          //   referralCommissionId
          // );
        }
      }
      await this.updateOuterTrade({
        id: tradeFk,
        status: Database.OUTERTRADE_STATUS.DONE,
        currency: market.code,
        member,
        dbOrder,
        updatedOrder,
        trade: { ...trade, id: tradeId },
        voucher: { ...voucher, id: voucherId },
        askAccountVersion: newAskAccountVersion,
        bidAccountVersion: newBidAccountVersion,
        orderFullFilledAccountVersion: newOrderFullFilledAccountVersion,
        // referralCommission: { referralCommission, id: referralCommissionId },
        dbTransaction,
      });
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
  async processor(data) {
    let stop,
      market,
      memberId,
      orderId,
      member,
      order,
      orderDetail,
      result,
      referredByMember,
      memberReferral,
      dbTransaction = await this.database.transaction();
    // this.logger.debug(`processor data`, data);
    if (!stop) {
      try {
        // 1. 判斷收到的資料是否為此系統的資料
        // 需滿足下列條件，才為此系統的資料：
        // 1.1.可以從 data 解析出 orderId 及 memberId
        market =
          this.tickersSettings[data.instId.toLowerCase().replace("-", "")];
        let tmp = Utils.parseClOrdId(data.clOrdId);
        memberId = tmp.memberId;
        orderId = tmp.orderId;
        if (!memberId || !orderId) {
          if (data.tradeId) {
            await this.updateOuterTrade({
              id: data.tradeId,
              currency: market.code,
              status: Database.OUTERTRADE_STATUS.ClORDId_ERROR,
              dbTransaction,
            });
            await dbTransaction.commit();
          } else await dbTransaction.rollback();
          stop = true;
        }
        // 1.2.可以根據 orderId 從 database 取得 dbOrder
        if (!stop) {
          member = await this.database.getMemberByCondition({ id: memberId });
          order = await this.database.getOrder(orderId, { dbTransaction });
        }
        // 1.3. dbOrder.member_id 同 data 解析出的 memberId
        if (
          !stop &&
          (!order || order?.member_id.toString() !== member?.id.toString())
        ) {
          if (data.tradeId) {
            await this.updateOuterTrade({
              id: data.tradeId,
              currency: market.code,
              status: Database.OUTERTRADE_STATUS.OTHER_SYSTEM_TRADE,
              dbTransaction,
            });
            await dbTransaction.commit();
          } else await dbTransaction.rollback();
          stop = true;
        }
        // 2. 判斷收到的資料對應的 order是否需要更新
        // 2.1. 判斷收到的資料 state 不為 cancel
        if (!stop && data.state === Database.ORDER_STATE.CANCEL) {
          if (data.tradeId) {
            await this.updateOuterTrade({
              id: data.tradeId,
              currency: market.code,
              member,
              status: Database.OUTERTRADE_STATUS.API_ORDER_CANCEL,
              dbOrder: order,
              dbTransaction,
            });
            await dbTransaction.commit();
          } else await dbTransaction.rollback();
          stop = true;
        }
        // 2.2 dbOrder.state 不為 0
        if (
          !stop &&
          order &&
          order.state === Database.ORDER_STATE_CODE.CANCEL
        ) {
          if (data.tradeId) {
            await this.updateOuterTrade({
              id: data.tradeId,
              currency: market.code,
              status: Database.OUTERTRADE_STATUS.DB_ORDER_CANCEL,
              dbOrder: order,
              member,
              dbTransaction,
            });
            await dbTransaction.commit();
          } else await dbTransaction.rollback();
          stop = true;
          // this.logger.error(
          //   `!!! dbOrder.state 為 0[state: ${order.state}](stop:${stop})`,
          //   order
          // );
        }
        // 2.3 OKx api 回傳的 orderDetail state 不為 cancel
        if (!stop) {
          let apiResonse;
          switch (data.exchangeCode) {
            case Database.EXCHANGE.OKEX:
              apiResonse = await this.okexConnector.router("getOrderDetails", {
                query: {
                  instId: data.instId,
                  ordId: data.ordId,
                },
              });
              break;
            default:
              break;
          }
          if (apiResonse.success) {
            orderDetail = apiResonse.payload.shift();
            // this.logger.debug(`getOrderDetails orderDetail`, orderDetail);
            if (orderDetail.state === Database.ORDER_STATE.CANCEL) {
              if (data.tradeId) {
                await this.updateOuterTrade({
                  id: data.tradeId,
                  currency: market.code,
                  status: Database.OUTERTRADE_STATUS.API_ORDER_CANCEL,
                  dbOrder: order,
                  member,
                  dbTransaction,
                });
                await dbTransaction.commit();
              } else await dbTransaction.rollback();
              stop = true;
            }
          } else {
            // await this.updateOuterTrade({
            //   id: data.tradeId,
            //   status: Database.OUTERTRADE_STATUS.SYSTEM_ERROR,
            //   dbTransaction,
            // });
            await dbTransaction.rollback();
            stop = true;
          }
        }
        // 3. 此 data 為本系統的 data，根據 data 裡面的資料去就算對應要更新的 order 及需要新增的 trade、voucher、accounts
        if (!stop) {
          if (member.refer) {
            let tmp = await this.getMemberReferral(member);
            referredByMember = tmp.referredByMember;
            memberReferral = tmp.memberReferral;
            // this.logger.debug(`updater getMemberReferral`, tmp);
          }
          try {
            result = await this.calculator({
              market,
              member,
              dbOrder: order,
              orderDetail,
              data,
              referredByMember: referredByMember,
              memberReferral: memberReferral,
            });
          } catch (error) {
            this.logger.error(`calculator error`, error);
            // if (error.code === Codes.ABNORMAL_ORDER) {
            stop = true;
            try {
              await this.updateOuterTrade({
                id: data.tradeId,
                currency: market.code,
                status: Database.OUTERTRADE_STATUS.CALCULATOR_ERROR,
                dbOrder: order,
                member,
                dbTransaction,
              });
              await dbTransaction.commit();
            } catch (error) {
              throw error;
            }
          }
        }
        if (!stop && result) {
          // 3.1 計算完後會直接通知前端更新 order
          let time = result.updatedOrder.updated_at.replace(/['"]+/g, "");
          let updatedOrder = {
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
            at: parseInt(SafeMath.div(new Date(time).getTime(), "1000")),
            ts: new Date(time).getTime(),
            market: market.id,
            filled:
              result.updatedOrder.state === Database.ORDER_STATE_CODE.DONE,
            state_text:
              result.updatedOrder.state === Database.ORDER_STATE_CODE.DONE
                ? Database.ORDER_STATE_TEXT.DONE
                : result.updatedOrder.state === Database.ORDER_STATE_CODE.CANCEL
                ? Database.ORDER_STATE_TEXT.CANCEL
                : Database.ORDER_STATE_TEXT.WAIT,
            state:
              result.updatedOrder.state === Database.ORDER_STATE_CODE.DONE
                ? Database.ORDER_STATE.DONE
                : result.updatedOrder.state === Database.ORDER_STATE_CODE.CANCEL
                ? Database.ORDER_STATE.CANCEL
                : Database.ORDER_STATE.WAIT,
            state_code:
              result.updatedOrder.state === Database.ORDER_STATE_CODE.DONE
                ? Database.ORDER_STATE_CODE.DONE
                : result.updatedOrder.state === Database.ORDER_STATE_CODE.CANCEL
                ? Database.ORDER_STATE_CODE.CANCEL
                : Database.ORDER_STATE_CODE.WAIT,
          };
          this._emitUpdateOrder({
            memberId,
            instId: data.instId,
            market: market.id,
            order: updatedOrder,
          });
          // }
          // 4. 只有由 ExchangeHubService 呼叫的時候， type 為 Database.MODIFIABLE_TYPE.TRADE，才會有 tradeId（來自 OKx 的 tradeId） ，才可以對 DB 進行更新
          // trade 新增進 DB 後才可以得到我們的 trade id
          // db 更新的資料為 calculator 得到的 result
          if (data.tradeId) {
            try {
              await this.updater({
                ...result,
                member,
                dbOrder: order,
                tradeFk: data.tradeId,
                market,
                instId: data.instId,
                dbTransaction,
              });
              await dbTransaction.commit();
            } catch (error) {
              this.logger.error(`updater error`, error);
              if (error.code === Codes.DUPLICATE_PROCESS_OUTER_TRADE) {
                stop = true;
                await this.updateOuterTrade({
                  id: data.tradeId,
                  status: Database.OUTERTRADE_STATUS.DUPLICATE_PROCESS,
                  dbTransaction,
                });
                await dbTransaction.commit();
              } else throw error;
            }
            // this.logger.debug(`processor complete dbTransaction commit`);
          } else await dbTransaction.rollback();
        }
      } catch (error) {
        await dbTransaction.rollback();
        this.logger.error(`processor dbTransaction rollback`, error);
      }
    }
  }

  async worker() {
    const job = this.jobQueue.shift();
    if (job) {
      await job();
      await this.worker();
    } else {
      clearTimeout(this.jobTimer);
      this.jobTimer = setTimeout(() => this.worker(), 1000);
    }
  }

  processorHandler(data) {
    const job = () => {
      return new Promise(async (resolve, reject) => {
        try {
          await this.processor(data);
          resolve();
        } catch {
          reject();
        }
      });
    };
    this.jobQueue = [...this.jobQueue, job];
  }

  async getMembersLatestAccountVersions(memberIds) {
    let accountVersionIds =
      await this.database.getMembersLatestAccountVersionIds(memberIds);
    let accountVersions = await this.database.getMembersAccountVersionByIds(
      accountVersionIds
    );
    accountVersions =
      accountVersionIds.length > 0
        ? accountVersions.reduce((prev, curr) => {
            prev[curr.member_id] = curr;
            return prev;
          }, {})
        : [];
    return accountVersions;
  }

  async getMembersLatestAuditRecords(memberIds, groupByAccountId = false) {
    let auditRecordIds = await this.database.getMembersLatestAuditRecordIds(
      memberIds,
      groupByAccountId
    );
    let auditRecords =
      auditRecordIds.length > 0
        ? await this.database.getMembersAuditRecordByIds(auditRecordIds, true)
        : [];
    let auditRecord =
      auditRecords?.length > 0
        ? {
            ...auditRecords.sort(
              (a, b) => b.account_version_id_end - a.account_version_id_end
            )[0],
          }
        : null;
    let lastestAuditAccountVersionId = auditRecord?.account_version_id_end;
    auditRecords = auditRecords.reduce((prev, curr) => {
      if (!prev[groupByAccountId ? curr.account_id : curr.member_id])
        prev[groupByAccountId ? curr.account_id : curr.member_id] = curr;
      return prev;
    }, {});
    return {
      auditRecords: auditRecords,
      lastestAuditAccountVersionId: lastestAuditAccountVersionId,
    };
  }

  async auditAccountBalance(memberId, currency, lastestAuditAccountVersionId) {
    let auditAccountResult = await this.database.auditAccountBalance({
      memberId,
      currency,
      startId: lastestAuditAccountVersionId,
    });
    auditAccountResult = auditAccountResult.reduce((prev, curr) => {
      if (!prev[curr.account_id]) prev[curr.account_id] = curr;
      return prev;
    }, {});
    return auditAccountResult;
  }

  async auditorMemberAccounts({ query }) {
    let { memberId, currency } = query;
    let tmp,
      accounts,
      auditRecords,
      lastestAuditAccountVersionId,
      lastestAuditRecords,
      result = {
        memberId,
        accounts: {},
      };
    try {
      if (!memberId) throw Error(`memberId is required`);
      tmp = await this.getMembersLatestAuditRecords([memberId], true);
      auditRecords = tmp.auditRecords;
      lastestAuditAccountVersionId = tmp.lastestAuditAccountVersionId;
      lastestAuditRecords = await this.auditAccountBalance(
        memberId,
        currency,
        lastestAuditAccountVersionId
      );
      accounts = await this.database.getAccountsByMemberId(memberId, {
        options: { currency: currency },
      });
      accounts = accounts.reduce((prev, curr) => {
        if (!prev[curr.id]) prev[curr.id] = curr;
        return prev;
      }, {});

      if (Object.keys(accounts).length > 0) {
        for (let accountId of Object.keys(accounts)) {
          let account = accounts[accountId],
            correctBalance = SafeMath.plus(
              lastestAuditRecords[accountId]?.sum_balance || "0",
              auditRecords[accountId]?.expect_balance || "0"
            ),
            correctLocked = SafeMath.plus(
              lastestAuditRecords[accountId]?.sum_locked || "0",
              auditRecords[accountId]?.expect_locked || "0"
            );
          result.accounts[accountId] = {
            accountId,
            currency: this.coinsSettingsMap[account.currency]?.code,
            currencyId: this.coinsSettingsMap[account.currency]?.id,
            balance: {
              current: Utils.removeZeroEnd(account.balance),
              shouldBe: correctBalance,
              alert: !SafeMath.eq(account.balance, correctBalance),
            },
            locked: {
              current: Utils.removeZeroEnd(account.locked),
              shouldBe: correctLocked,
              alert: !SafeMath.eq(account.locked, correctLocked),
            },
            createdAt: new Date(account.created_at).toISOString(),
            updatedAt: new Date(account.updated_at).toISOString(),
          };
          /* !!! HIGH RISK (start) !!! */
          if (
            lastestAuditRecords[accountId]
            // && lastestAccountVersion.id > auditRecord.account_version_id_end
          ) {
            let now = `${new Date()
                .toISOString()
                .slice(0, 19)
                .replace("T", " ")}`,
              dbTransaction = await this.database.transaction();
            try {
              await this.database.insertAuditAccountRecord(
                {
                  account_id: accountId,
                  member_id: memberId,
                  currency: account.currency,
                  account_version_id_start:
                    lastestAuditRecords[accountId].oldest_id,
                  account_version_id_end:
                    lastestAuditRecords[accountId].lastest_id,
                  balance: account.balance,
                  expect_balance: correctBalance,
                  locked: account.locked,
                  expect_locked: correctLocked,
                  created_at: now,
                  updated_at: now,
                  issued_by: null,
                  fixed_at: null,
                },
                { dbTransaction }
              );
              await dbTransaction.commit();
            } catch (error) {
              this.logger.error(error);
              await dbTransaction.rollback();
            }
          }
          /* !!! HIGH RISK (end) !!! */
        }
      }
      return new ResponseFormat({
        message: "auditorAccounts",
        payload: result,
      });
    } catch (error) {
      return new ResponseFormat({
        message: `auditorAccounts ${JSON.stringify(error)}`,
        code: Codes.UNKNOWN_ERROR,
      });
    }
  }

  async getMembers({ query }) {
    let { email, limit = 10, offset } = query;
    let result,
      number,
      counts,
      members = [],
      memberIds = [],
      auditRecords,
      accountVersions,
      page;
    try {
      if (offset == 0 || email) counts = await this.database.countMembers();
      if (email) {
        // this.logger.debug("email", email);
        const member = await this.database.getMemberByCondition({
          email: email,
        });
        // this.logger.debug("member", member);
        if (member) {
          number = await this.database.countMembers({ before: member.id });
          page = Math.floor(number / limit) + 1;
          offset = (page - 1) * limit;
          // this.logger.debug("number", number);
          // this.logger.debug("page", page);
          // this.logger.debug("offset", offset);
        }
      }
      // this.logger.debug("offset == 0 || !!offset", offset == 0 || !!offset);
      if (offset == 0 || !!offset) {
        result = await this.database.getMembers({ limit, offset });
        members = result.map((r) => {
          memberIds = [...memberIds, r.id];
          let member = {
            ...r,
            activated: SafeMath.eq(r.activated, 1),
          };
          return member;
        });
        let tmp = await this.getMembersLatestAuditRecords(memberIds);
        // this.logger.debug(`tmp`, tmp);
        auditRecords = tmp.auditRecords;
        accountVersions = await this.getMembersLatestAccountVersions(memberIds);
        members = members.map((m) => {
          let lastestAccountAuditTime = auditRecords[m.id]
              ? new Date(auditRecords[m.id].updated_at).getTime()
              : null,
            lastestActivityTime = accountVersions[m.id]
              ? new Date(accountVersions[m.id].created_at).getTime()
              : null,
            alert =
              lastestActivityTime &&
              (!lastestAccountAuditTime ||
                SafeMath.gt(
                  SafeMath.minus(lastestActivityTime, lastestAccountAuditTime),
                  this.oneDayinMillionSeconds
                )),
            member = {
              ...m,
              lastestAccountAuditTime,
              lastestActivityTime,
              alert,
            };
          return member;
        });
      }
      return new ResponseFormat({
        message: "getMembers",
        payload: {
          counts,
          members,
          page,
        },
      });
    } catch (error) {
      this.logger.error(error);
      return new ResponseFormat({
        message: `getMembers ${JSON.stringify(error)}`,
        code: Codes.UNKNOWN_ERROR,
      });
    }
  }

  async fixAbnormalAccount({ params, email }) {
    // this.logger.debug(`fixAbnormalAccount email`, email, `params`, params);
    let result,
      account,
      auditRecord,
      currentUser = this.adminUsers.find((user) => user.email === email),
      dbTransaction;
    if (!currentUser.roles?.includes("root"))
      result = new ResponseFormat({
        message: `Permission denied`,
        code: Codes.INVALID_INPUT,
      });
    if (!params.id) {
      result = new ResponseFormat({
        message: "Account id is required",
        code: Codes.INVALID_INPUT,
      });
    }
    if (!result) {
      dbTransaction = await this.database.transaction();
      try {
        /******************************
         * 1. get latest audit account records
         *   1.1  檢查是否需要更新
         * 2. update account
         *   2.1 balance
         *   2.2 locked
         *   2.3 updated_at
         * 3. update audit_account_records
         *   3.1 fixed_at 稽核時間
         *   3.2 issued_by 經手人 email
         *******************************************/
        /* !!! HIGH RISK (start) !!! */
        //1. select * from accounts for update
        auditRecord = await this.database.getAccountLatestAuditRecord(
          params.id,
          dbTransaction
        );
        account = await this.database.getAccountsByMemberId(
          auditRecord.member_id,
          {
            options: { id: params.id },
            limit: 1,
            dbTransaction,
          }
        );
        // this.logger.debug(`fixAbnormalAccount auditRecord`, auditRecord);
        if (auditRecord) {
          let now = new Date().toISOString().slice(0, 19).replace("T", " ");
          // 2. update account
          let updateAccount = {
            id: params.id,
            balance: auditRecord.expect_balance,
            locked: auditRecord.expect_locked,
            updated_at: `"${now}"`,
          };
          // 3. update audit record
          let fixedAuditRecord = {
            account_id: auditRecord.account_id,
            member_id: auditRecord.member_id,
            currency: auditRecord.currency,
            audit_account_records_id: auditRecord.id,
            origin_balance: account.balance,
            balance: auditRecord.expect_balance,
            origin_locked: account.locked,
            locked: auditRecord.expect_locked,
            created_at: now,
            updated_at: now,
            issued_by: currentUser.email,
          };
          // this.logger.debug(`fixAbnormalAccount updateAccount`, updateAccount);
          // this.logger.debug(`fixAbnormalAccount fixedAuditRecord`, fixedAuditRecord);
          //
          await this.database.insertFixedAccountRecord(fixedAuditRecord, {
            dbTransaction,
          });

          await this.database.updateAccount(updateAccount, { dbTransaction });
          await dbTransaction.commit();
          /* !!! HIGH RISK (end) !!! */
          result = new ResponseFormat({
            message: "auditorAccounts",
            payload: {
              accountId: params.id,
              currency: this.coinsSettingsMap[auditRecord.currency]?.code,
              balance: {
                current: Utils.removeZeroEnd(auditRecord.expect_balance),
                shouldBe: Utils.removeZeroEnd(auditRecord.expect_balance),
                alert: false,
              },
              locked: {
                current: Utils.removeZeroEnd(auditRecord.expect_locked),
                shouldBe: Utils.removeZeroEnd(auditRecord.expect_locked),
                alert: false,
              },
              createdAt: new Date(auditRecord.created_at).toISOString(),
              updatedAt: now,
            },
          });
        }
      } catch (error) {
        this.logger.error(`fixAbnormalAccount error`, error);
        await dbTransaction.rollback();
        result = new ResponseFormat({
          message: `fixAbnormalAccount ${JSON.stringify(error)}`,
          code: Codes.UNKNOWN_ERROR,
        });
      }
    }
    // this.logger.debug(`fixAbnormalAccount result`, result);
    return result;
  }

  async auditOrder(order) {
    let tradesCounts,
      fundsReceived,
      fee = 0,
      volume,
      locked,
      baseUnitAccountVersions = [],
      quoteUnitAccountVersions = [],
      trades = [],
      vouchers = [],
      baseUnitBalDiffByOrder = 0,
      baseUnitLocDiffByOrder = 0,
      quoteUnitBalDiffByOrder = 0,
      quoteUnitLocDiffByOrder = 0,
      baseUnitBalDiffByAccV = 0,
      baseUnitLocDiffByAccV = 0,
      quoteUnitBalDiffByAccV = 0,
      quoteUnitLocDiffByAccV = 0,
      baseUnit = this.coinsSettingsMap[order.ask.toString()]?.code,
      quoteUnit = this.coinsSettingsMap[order.bid.toString()]?.code;
    // 1. getVouchers
    vouchers = await this.database.getVouchersByOrderId(order.id);
    vouchers = vouchers.map((v) => ({
      ...v,
      price: removeZeroEnd(v.price),
      volume: removeZeroEnd(v.volume),
      value: removeZeroEnd(v.value),
      ask_fee: removeZeroEnd(v.ask_fee),
      bid_fee: removeZeroEnd(v.bid_fee),
      // created_at: v.created_at.substring(0, 19).replace("T", " "),
    }));
    this.logger.debug(`vouchers`, vouchers);
    tradesCounts = vouchers.length;
    fundsReceived = vouchers.reduce((prev, curr) => {
      prev = SafeMath.plus(
        prev,
        order.type === Database.TYPE.ORDER_BID ? curr.volume : curr.value
      );
      return prev;
    }, 0);
    if (order.type === Database.TYPE.ORDER_BID) {
      // when order create 扣除可用餘額，增加鎖定餘額
      quoteUnitBalDiffByOrder = SafeMath.minus(
        quoteUnitBalDiffByOrder,
        order.origin_locked
      );
      quoteUnitLocDiffByOrder = SafeMath.plus(
        quoteUnitLocDiffByOrder,
        order.locked
      );
      // fee = vouchers.reduce((prev, curr) => {
      //   prev = SafeMath.plus(prev, curr.bid_fee);
      //   return prev;
      // }, 0);
      baseUnitBalDiffByOrder = SafeMath.plus(
        baseUnitBalDiffByOrder,
        SafeMath.minus(order.funds_received, fee)
      );
      if (order.state !== Database.ORDER_STATE_CODE.WAIT) {
        // cancel Order 解鎖 order 剩餘鎖定餘額  ||   done Order 返回 order 剩餘鎖定餘額
        quoteUnitBalDiffByOrder = SafeMath.plus(
          quoteUnitBalDiffByOrder,
          order.locked
        );
        quoteUnitLocDiffByOrder = SafeMath.minus(
          quoteUnitLocDiffByOrder,
          order.locked
        );
      }
    } else {
      // when order create 扣除可用餘額，增加鎖定餘額
      baseUnitBalDiffByOrder = SafeMath.minus(
        baseUnitBalDiffByOrder,
        order.origin_locked
      );
      baseUnitLocDiffByOrder = SafeMath.plus(
        baseUnitLocDiffByOrder,
        order.locked
      );
      // fee = vouchers.reduce((prev, curr) => {
      //   prev = SafeMath.plus(prev, curr.ask_fee);
      //   return prev;
      // }, 0);
      quoteUnitBalDiffByOrder = SafeMath.plus(
        quoteUnitBalDiffByOrder,
        SafeMath.minus(order.funds_received, fee)
      );
      if (order.state !== Database.ORDER_STATE_CODE.WAIT) {
        // cancel Order 解鎖 order 剩餘鎖定餘額 ||   done Order 返回 order 剩餘鎖定餘額
        baseUnitBalDiffByOrder = SafeMath.plus(
          baseUnitBalDiffByOrder,
          order.locked
        );
        baseUnitLocDiffByOrder = SafeMath.minus(
          baseUnitLocDiffByOrder,
          order.locked
        );
      }
    }
    // 2. getTrades
    let ids = vouchers.map((v) => v.trade_id);
    trades = await this.database.getTradesByIds(ids);
    // 3. getAccountVersions
    let accountVersionsByOrder =
      await this.database.getAccountVersionsByModifiableIds(
        [order.id],
        Database.MODIFIABLE_TYPE.ORDER
      );
    accountVersionsByOrder = accountVersionsByOrder.map((v) => ({
      ...v,
      currency: this.coinsSettingsMap[v.currency]?.code,
      balance: removeZeroEnd(v.balance),
      locked: removeZeroEnd(v.locked),
      fee: removeZeroEnd(v.fee),
      // created_at: v.created_at.substring(0, 19).replace("T", " "),
    }));
    this.logger.debug(`accountVersionsByOrder`, accountVersionsByOrder);
    let accountVersionsByTrade =
      await this.database.getAccountVersionsByModifiableIds(
        ids,
        Database.MODIFIABLE_TYPE.TRADE
      );
    accountVersionsByTrade = accountVersionsByTrade.map((v) => ({
      ...v,
      currency: this.coinsSettingsMap[v.currency]?.code,
      balance: removeZeroEnd(v.balance),
      locked: removeZeroEnd(v.locked),
      fee: removeZeroEnd(v.fee),
      // created_at: v.created_at.substring(0, 19).replace("T", " "),
    }));
    this.logger.debug(`accountVersionsByTrade`, accountVersionsByTrade);
    let accountVersions = accountVersionsByOrder.concat(accountVersionsByTrade);
    for (let accV of accountVersions) {
      if (SafeMath.eq(accV.currency, order.ask)) {
        baseUnitAccountVersions = [...baseUnitAccountVersions, accV];
      }
      if (SafeMath.eq(accV.currency, order.bid)) {
        quoteUnitAccountVersions = [...quoteUnitAccountVersions, accV];
      }
    }
    for (let bAccV of baseUnitAccountVersions) {
      baseUnitBalDiffByAccV = SafeMath.plus(
        baseUnitBalDiffByAccV,
        bAccV.balance
      );
      baseUnitLocDiffByAccV = SafeMath.plus(
        baseUnitBalDiffByAccV,
        bAccV.locked
      );
    }
    for (let qAccV of quoteUnitAccountVersions) {
      quoteUnitBalDiffByAccV = SafeMath.plus(
        quoteUnitBalDiffByAccV,
        qAccV.balance
      );
      quoteUnitLocDiffByAccV = SafeMath.plus(
        baseUnitBalDiffByAccV,
        qAccV.locked
      );
    }
    this.logger.debug(
      `typeof order.updated_at`,
      typeof order.updated_at,
      order.updated_at
    );
    return {
      baseUnitBalDiffByOrder,
      baseUnitBalDiffByAccV,
      baseUnitLocDiffByOrder,
      baseUnitLocDiffByAccV,
      quoteUnitBalDiffByOrder,
      quoteUnitBalDiffByAccV,
      quoteUnitLocDiffByOrder,
      quoteUnitLocDiffByAccV,
      tradesCounts,
      fundsReceived,
      order: {
        baseUnit,
        quoteUnit,
        ...order,
        // updated_at: order.updated_at.substring(0, 19).replace("T", " "),
      },
      vouchers,
      accountVersionsByOrder,
      accountVersionsByTrade,
      trades,
    };
  }

  /**
   * Audit
   * MemberBehavior: Deposit, Withdraw, Order(post or cancel)
   */
  async auditMemberBehavior({ query }) {
    let { memberId, currency, start, end } = query;
    let balanceDiff = 0,
      lockedDiff = 0,
      auditedOrder,
      auditedOrders = [];
    // 1. getDepositRecords
    let depositRecords = await this.database.getDepositRecords({
      memberId,
      currency,
      start,
      end,
    });
    for (let deposit of depositRecords) {
      balanceDiff = SafeMath.plus(balanceDiff, deposit.amount);
    }
    // this.logger.debug(`depositRecords`, depositRecords);
    // 2. getWithdrawRecords
    let withdrawRecords = await this.database.getWithdrawRecords({
      memberId,
      currency,
      start,
      end,
    });
    for (let withdraw of withdrawRecords) {
      balanceDiff = SafeMath.minus(balanceDiff, withdraw.amount);
    }
    // this.logger.debug(`withdrawRecords`, withdrawRecords);
    // 3. getOrderRecords
    let orderRecords = await this.database.getOrderRecords({
      currency,
      memberId,
      start,
      end,
    });
    // this.logger.debug(`orderRecords`, orderRecords);
    // orderRecords = orderRecords.filter(
    //   (order) =>
    //     SafeMath.eq(order.ask, currency) || SafeMath.eq(order.bid, currency)
    // );
    for (let order of orderRecords) {
      auditedOrder = await this.auditOrder(order);
      auditedOrders = [...auditedOrders, auditedOrder];
      // if (order.ask === currency) {
      //   balanceDiff = SafeMath.plus(
      //     balanceDiff,
      //     auditedOrder.baseUnitBalDiffByOrder
      //   );
      //   lockedDiff = SafeMath.plus(
      //     lockedDiff,
      //     auditedOrder.baseUnitLocDiffByOrder
      //   );
      // }
      // if (order.bid === currency) {
      //   balanceDiff = SafeMath.plus(
      //     balanceDiff,
      //     auditedOrder.quoteUnitBalDiffByOrder
      //   );
      //   lockedDiff = SafeMath.plus(
      //     lockedDiff,
      //     auditedOrder.quoteUnitLocDiffByOrder
      //   );
      // }
      if (
        (order.ask === currency && order.type === Database.TYPE.ORDER_BID) ||
        (order.bid === currency && order.type === Database.TYPE.ORDER_ASK)
      ) {
        balanceDiff = SafeMath.plus(balanceDiff, order.funds_received);
      } else if (
        (order.bid === currency && order.type === Database.TYPE.ORDER_BID) ||
        (order.ask === currency && order.type === Database.TYPE.ORDER_ASK)
      ) {
        // post Order 扣除可用餘額，增加鎖定餘額
        balanceDiff = SafeMath.minus(balanceDiff, order.origin_locked);
        lockedDiff = SafeMath.plus(lockedDiff, order.locked);
        if (order.state !== Database.ORDER_STATE_CODE.WAIT) {
          // cancel Order 解鎖 order 剩餘鎖定餘額 ||   done Order 返回 order 剩餘鎖定餘額
          balanceDiff = SafeMath.plus(balanceDiff, order.locked);
          lockedDiff = SafeMath.minus(lockedDiff, order.locked);
        }
      }
    }
    // 4. 與 accountVersions 比較
    let accVersR = await this.database.auditAccountBalance({
      memberId,
      currency,
      start,
      end,
    });
    let payload = {
      balanceDiff_records: accVersR.sum_balance,
      balanceDiff_behavior: balanceDiff,
      lockedDiff_records: accVersR.sum_locked,
      lockedDiff_behavior: lockedDiff,
      depositRecords,
      withdrawRecords,
      auditedOrders,
    };
    return new ResponseFormat({
      message: "auditMemberBehavior",
      payload,
    });
  }

  async _updateOrderDetail(formatOrder) {
    // this.logger.debug(
    //   ` ------------- [${this.constructor.name}] _updateOrderDetail [START]---------------`
    // );
    // this.logger.debug(`formatOrder`, formatOrder);
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
    // this.logger.debug(`memberId: ${memberId}, orderId: ${orderId}`);
    // this.logger.debug(`volume`, volume);
    // this.logger.debug(`filled`, filled);
    // this.logger.debug(`tickerSetting`, tickerSetting);
    // this.logger.debug(`updateBaseAccount`, updateBaseAccount);
    // this.logger.debug(`updateQuoteAccount`, updateQuoteAccount);
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
      // this.logger.debug(`updateOrder`, updateOrder);
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
        // this.logger.debug(`member.member_tag`, member.member_tag); // 1 是 vip， 2 是 hero
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
          // this.logger.debug(`baseAccBalDiff`, baseAccBalDiff);
          baseAccBal = SafeMath.plus(updateBaseAccount.balance, baseAccBalDiff);
          // this.logger.debug(`baseAccBal`, baseAccBal);
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
          // this.logger.debug(`quoteLocDiff`, quoteLocDiff);
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
          // this.logger.debug(`baseLocDiff`, baseLocDiff);
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
          // this.logger.debug(`quoteAccBalDiff`, quoteAccBalDiff);
          quoteAccBal = SafeMath.plus(
            updateQuoteAccount.balance,
            quoteAccBalDiff
          );
          // this.logger.debug(`quoteAccBal`, quoteAccBal);
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
    // this.logger.debug(
    //   ` ------------- [${this.constructor.name}] _updateOrderDetail [END]---------------`
    // );
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
            ? // ? (parseFloat(body.price) * 1.05).toString()
              body.price
            : null
          : body.price
          ? // ? (parseFloat(body.price) * 0.95).toString()
            body.price
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
    // this.logger.debug(`_updateAccount accountVersion`, accountVersion)
    let accountVersionId, newAccountVersion;
    const account = await this.database.getAccountsByMemberId(
      accountVersion.member_id,
      {
        options: { currency: accountVersion.currency },
        limit: 1,
        dbTransaction,
      }
    );
    if (SafeMath.lt(account.balance, accountVersion.locked))
      throw Error("Available balance is not enough.");
    const oriAccBal = account.balance;
    const oriAccLoc = account.locked;
    const newAccBal = SafeMath.plus(oriAccBal, accountVersion.balance);
    if (SafeMath.lt(newAccBal, "0"))
      throw Error("Available balance is not enough.");
    const newAccLoc = SafeMath.plus(oriAccLoc, accountVersion.locked);
    const amount = SafeMath.plus(newAccBal, newAccLoc);
    if (SafeMath.lt(amount, "0")) throw Error("System error.");
    const newAccount = {
      id: account.id,
      balance: newAccBal,
      locked: newAccLoc,
      updated_at: `"${accountVersion.created_at}"`,
    };
    const currency = this.coinsSettings.find(
      (curr) => curr.id === accountVersion.currency
    )?.code;
    newAccountVersion = {
      memberId: account.member_id,
      accountId: account.id,
      reason: accountVersion.reason,
      balance: accountVersion.balance,
      locked: accountVersion.locked,
      fee: accountVersion.fee,
      amount: amount,
      modifiableId: accountVersion.modifiable_id,
      modifiableType: accountVersion.modifiable_type,
      createdAt: accountVersion.created_at,
      updatedAt: accountVersion.updated_at,
      currency: account.currency,
      fun: accountVersion.fun,
    };
    accountVersionId = await this.database.insertAccountVersion(
      newAccountVersion,
      { dbTransaction }
    );
    await this.database.updateAccount(newAccount, { dbTransaction });
    this._emitUpdateAccount({
      memberId: accountVersion.member_id,
      account: {
        balance: newAccBal,
        locked: newAccLoc,
        currency: currency.toUpperCase(),
        total: amount,
      },
    });
    return { ...newAccountVersion, id: accountVersionId };
    /* !!! HIGH RISK (end) !!! */
  }

  /**
   *
   * @param {String} memberId
   * @param {String} instId
   * @param {String} market ex: ethusdt
   * @param {Object} order
   */
  _emitUpdateOrder({ memberId, instId, market, order }) {
    // this.logger.debug(`_emitUpdateOrder difference`, order);
    this.orderBook.updateByDifference(memberId, instId, {
      add: [order],
    });
    EventBus.emit(Events.order, memberId, market, {
      market: market,
      difference: this.orderBook.getDifference(memberId, instId),
    });
    // this.logger.debug(
    //   `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.order}] _emitUpdateOrder[market:${market}][memberId:${memberId}][instId:${instId}]`,
    //   this.orderBook.getDifference(memberId, instId)
    // );
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
    // this.logger.debug(`difference`, order);
    // this.logger.debug(
    //   `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.marketOrder}] _emitUpdateMarketOrder[market:${market}][memberId:${memberId}][instId:${instId}]`,
    //   this.orderBook.getDifference(memberId, instId)
    // );
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
    // this.logger.debug(`difference`, trade);
    // this.logger.debug(
    //   `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.trade}] _emitNewTrade[market:${market}][memberId:${memberId}][instId:${instId}]`,
    //   this.tradeBook.getDifference(instId)
    // );
  }

  _emitUpdateAccount({ memberId, account }) {
    this.accountBook.updateByDifference(memberId, account);
    EventBus.emit(
      Events.account,
      memberId,
      this.accountBook.getDifference(memberId)
    );
    // this.logger.debug(`difference`, account);
    // this.logger.debug(
    //   `[TO FRONTEND][${this.constructor.name}][EventBus.emit: ${Events.account}] _emitUpdateAccount[memberId:${memberId}]`,
    //   this.accountBook.getDifference(memberId)
    // );
  }

  async _eventListener() {
    EventBus.on(Events.account, (memberId, account) => {
      // this.logger.debug(
      //   `[${this.constructor.name}] EventBus.on(Events.account)`,
      //   memberId,
      //   account
      // );
      this.broadcastAllPrivateClient(memberId, {
        type: Events.account,
        data: account,
      });
    });

    EventBus.on(Events.order, (memberId, market, order) => {
      // this.logger.debug(
      //   `[${this.constructor.name}] EventBus.on(Events.order)`,
      //   memberId,
      //   market,
      //   order
      // );
      this.broadcastPrivateClient(memberId, {
        market,
        type: Events.order,
        data: order,
      });
    });

    EventBus.on(Events.userStatusUpdate, (memberId, userStatus) => {
      // this.logger.debug(
      //   `[${this.constructor.name}] EventBus.on(Events.userStatusUpdate)`,
      //   memberId,
      //   userStatus
      // );
      this.broadcastAllPrivateClient(memberId, {
        type: Events.userStatusUpdate,
        data: userStatus,
      });
    });

    EventBus.on(Events.trade, (memberId, market, tradeData) => {
      if (this._isIncludeTideBitMarket(market)) {
        // this.logger.debug(
        //   `[${this.constructor.name}] EventBus.on(Events.trade)`,
        //   memberId,
        //   market,
        //   tradeData
        // );
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

    EventBus.on(Events.publicTrades, (data) => {
      this.broadcastAllClient({
        type: Events.publicTrades,
        data: data,
      });
    });

    EventBus.on(Events.orderDetailUpdate, async (instType, formatOrders) => {
      if (instType === Database.INST_TYPE.SPOT) {
        // this.logger.debug(
        //   ` ------------- [${this.constructor.name}] EventBus.on(Events.orderDetailUpdate [START]---------------`
        // );
        // TODO: using message queue
        for (const formatOrder of formatOrders) {
          if (
            formatOrder.state !==
              Database.ORDER_STATE.CANCEL /* cancel order */ &&
            formatOrder.accFillSz !== "0" /* create order */
          ) {
            // 1. 工讀生將已被整理成 outerTrade 格式的需要更新的委託單寫到我們的系統
            // ++TODO id should be replaced by exchangeCode + tradeId, current is tradeId (需要避免與其他交易所碰撞)
            await this.exchangeHubService.insertOuterTrades([formatOrder]);
            // 2. 呼叫承辦員處理該筆 outerTrade
            this.processorHandler(formatOrder);
          } else if (formatOrder.state === Database.ORDER_STATE.CANCEL) {
            let result,
              orderId,
              memberId,
              transaction = await this.database.transaction();
            try {
              let parsedClOrdId = Utils.parseClOrdId(formatOrder.clOrdId);
              orderId = parsedClOrdId.orderId;
              memberId = parsedClOrdId.memberId;
            } catch (e) {
              this.logger.error(`ignore`);
            }
            if (orderId && memberId) {
              result = await this.updateOrderStatus({
                transaction,
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
                await transaction.commit();
              } else {
                await transaction.rollback();
              }
            }
          }
        }
        // this.logger.debug(
        //   ` ------------- [${this.constructor.name}] EventBus.on(Events.orderDetailUpdate [END]---------------`
        // );
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
