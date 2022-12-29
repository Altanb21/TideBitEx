const path = require("path");
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
          return prev;
        }, {});
        this.depositsSettings = formatDepositsSettings;
      } catch (error) {
        process.exit(1);
      }
    }
    return this.depositsSettings;
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
          return prev;
        }, {});
        this.withdrawsSettings = formatWithdrawsSettings;
      } catch (error) {
        process.exit(1);
      }
    }
    return this.withdrawsSettings;
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
            //++ TODO 2022/12/22 處理 [coinSetting.code] 不存在的情況
          }
        }
        result = new ResponseFormat({
          message: "getPlatformAssets",
          payload: coins,
        });
        // 需要有紀錄水位限制的檔案，預計加在 coins.yml
      } catch (error) {
        let message = error.message;
        result = new ResponseFormat({
          message,
          code: Codes.API_UNKNOWN_ERROR,
        });
      }
    }
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
            this.logger.debug(
              `[${new Date().toLocaleTimeString()}][${
                this.constructor.name
              }] updatePlatformAsset yamlUpdate ERROR!`,
              `params`,
              params,
              `email:${email}`,
              `body`,
              body,
              `updatedCoinsSettings`,
              updatedCoinsSettings,
              `error`,
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
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }] updatePlatformAsset ERROR!`,
        `params`,
        params,
        `email:${email}`,
        `body`,
        body,
        `error`,
        e
      );
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
            this.logger.debug(
              `[${new Date().toLocaleTimeString()}][${
                this.constructor.name
              }] updateTickerSetting yamlUpdate ERROR!`,
              `params`,
              params,
              `email:${email}`,
              `body`,
              body,
              `updatedTickersSettings`,
              updatedTickersSettings,
              `error`,
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
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }] updateTickerSetting ERROR!`,
        `params`,
        params,
        `email:${email}`,
        `body`,
        body,
        `error`,
        e
      );
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
            this.logger.debug(
              `[${new Date().toLocaleTimeString()}][${
                this.constructor.name
              }] updateCoinSetting yamlUpdate ERROR!`,
              `params`,
              params,
              `email:${email}`,
              `body`,
              body,
              `updateCoinSetting`,
              updatedCoinsSettings,
              `error`,
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
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }] updateCoinSetting ERROR!`,
        `params`,
        params,
        `email:${email}`,
        `body`,
        body,
        `error`,
        e
      );
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
          this.logger.debug(
            `[${new Date().toLocaleTimeString()}][${
              this.constructor.name
            }] updateCoinsSettings yamlUpdate ERROR!`,
            `email:${email}`,
            `body`,
            body,
            `updatedTickersSettings`,
            updatedCoinsSettings,
            `error`,
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
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }] updateCoinsSettings ERROR!`,
        `email:${email}`,
        `body`,
        body,
        `error`,
        e
      );
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
            this.logger.debug(
              `[${new Date().toLocaleTimeString()}][${
                this.constructor.name
              }] updateDepositSetting yamlUpdate ERROR!`,
              `email:${email}`,
              `body`,
              body,
              `updatedDepositsSettings`,
              updatedDepositsSettings,
              `error`,
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
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }] updateDepositSetting ERROR!`,
        `email:${email}`,
        `body`,
        body,
        `error`,
        e
      );
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
            this.logger.debug(
              `[${new Date().toLocaleTimeString()}][${
                this.constructor.name
              }] updateWithdrawSetting yamlUpdate ERROR!`,
              `params`,
              params,
              `email:${email}`,
              `body`,
              body,
              `updatedWithdrawsSettings`,
              updatedWithdrawsSettings,
              `error`,
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
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }] updateWithdrawSetting ERROR!`,
        `params`,
        params,
        `email:${email}`,
        `body`,
        body,
        `error`,
        e
      );
      result = new ResponseFormat({
        message: "Internal server error",
        code: Codes.UNKNOWN_ERROR,
      });
    }
    return Promise.resolve(result);
  }

  async getMemberReferral(member) {
    let referredByMember, memberReferral;
    try {
      referredByMember = await this.database.getMemberByCondition({
        referCode: member.refer,
      });
      if (referredByMember) {
        memberReferral = await this.database.getMemberReferral({
          referrerId: referredByMember.id,
          refereeId: member.id,
        });
      } else {
        this.logger.error(
          `[${new Date().toLocaleTimeString()}][${
            this.constructor.name
          }] !!! ERROR getMemberReferral did not get referredByMember with refer_code[${
            member.refer
          }]`,
          `member`,
          member
        );
        throw Error(
          `member[${member.id}]did not get referredByMember with refer_code[${member.refer}]`
        );
      }
    } catch (error) {
      this.logger.error(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }] !!! ERROR getMemberReferral 出錯`,
        `member`,
        member,
        `error`,
        error
      );
      throw error;
    }

    return { referredByMember, memberReferral };
  }

  async getReferrerCommissionPlan(referral) {
    // expose :referrer_commission_plan do |member|
    // ::APIv2::Entities::CommissionPlan.represent(
    //   Referral::CommissionService.get_default_commission_plan(member: member),
    //   { enabled_policies_only: true }
    // )
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
                this.logger.debug(
                  `[${new Date().toLocaleTimeString()}][${
                    this.constructor.name
                  }] addAdminUser yamlUpdate ERROR!`,
                  `email:${email}`,
                  `body`,
                  body,
                  `updateAdminUsers`,
                  updateAdminUsers,
                  `error`,
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
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }] addAdminUser ERROR!`,
        `email:${email}`,
        `body`,
        body,
        `error`,
        e
      );
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
              this.logger.debug(
                `[${new Date().toLocaleTimeString()}][${
                  this.constructor.name
                }] updateAdminUser yamlUpdate ERROR!`,
                `email:${email}`,
                `body`,
                body,
                `updateAdminUsers`,
                updateAdminUsers,
                `error`,
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
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }] updateAdminUser ERROR!`,
        `email:${email}`,
        `body`,
        body,
        `error`,
        e
      );
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
            this.logger.debug(
              `[${new Date().toLocaleTimeString()}][${
                this.constructor.name
              }] deleteAdminUser yamlUpdate ERROR!`,
              `email:${email}`,
              `params`,
              params,
              `updateAdminUsers`,
              updateAdminUsers,
              `error`,
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
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }] deleteAdminUser yamlUpdate ERROR!`,
        `email:${email}`,
        `params`,
        params,
        `error`,
        e
      );
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
      this.logger.debug(
        `[${new Date().toLocaleTimeString()}][${
          this.constructor.name
        }] getTidebitMarkets from "config/markets/markets.yml" ERROR!`,
        error
      );
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
      state: query.state,
    });
    for (let dbOrder of dbOrders) {
      let order,
        price = dbOrder.price ? Utils.removeZeroEnd(dbOrder.price) : "market",
        avgFillPrice;
      if (dbOrder.state === Database.ORDER_STATE_CODE.DONE) {
        if (dbOrder.type === Database.TYPE.ORDER_ASK) {
          avgFillPrice = SafeMath.gt(
            SafeMath.minus(dbOrder.origin_volume, dbOrder.volume),
            0
          )
            ? SafeMath.div(
                dbOrder.funds_received,
                SafeMath.minus(dbOrder.origin_volume, dbOrder.volume)
              )
            : null;
        }
        if (dbOrder.type === Database.TYPE.ORDER_BID) {
          avgFillPrice = SafeMath.gt(dbOrder.funds_received, 0)
            ? SafeMath.div(
                SafeMath.minus(dbOrder.origin_locked, dbOrder.locked),
                dbOrder.funds_received
              )
            : null;
        }
      }
      order = {
        id: dbOrder.id,
        member_id: dbOrder.member_id,
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
        avgFillPrice: avgFillPrice,
        origin_volume: Utils.removeZeroEnd(dbOrder.origin_volume),
        volume: Utils.removeZeroEnd(dbOrder.volume),
        origin_locked: Utils.removeZeroEnd(dbOrder.origin_locked),
        locked: Utils.removeZeroEnd(dbOrder.locked),
        funds_received: Utils.removeZeroEnd(dbOrder.funds_received),
        state_code: dbOrder.state,
        state: Database.DB_STATE_CODE[dbOrder.state],
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
        created_at: dbOrder.created_at,
        updated_at: dbOrder.updated_at,
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
  //     }
  //     return res.data;
  //   } catch (e) {}
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
          return new ResponseFormat({
            message: "",
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
      } catch (error) {
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
          return new ResponseFormat({
            message: "",
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
        this.tickerBook.updateAll(okexTickers, tidebitTickers);
      } catch (error) {
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
          return new ResponseFormat({
            message: "",
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
      } catch (error) {
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
          return new ResponseFormat({
            message: "",
            code: Codes.API_UNKNOWN_ERROR,
          });
        }
        this.tickerBook.updateAll(okexTickers, tidebitTickers);
      } catch (error) {
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

  formateDailyProfitChart = (exchange, dbOuterTrades) => {
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
      switch (exchange) {
        case SupportedExchange.OKEX:
          let outerTradeData = JSON.parse(dbOuterTrade.data),
            outerFee = outerTradeData.avgPx
              ? outerTradeData.fillFee // data source is OKx order
              : outerTradeData.fee,
            profit = SafeMath.minus(
              SafeMath.minus(dbOuterTrade.voucher_fee, Math.abs(outerFee)),
              Math.abs(dbOuterTrade.referral)
            );
          if (profit) {
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
            while (nextDailyBarTime <= time) {
              lastDailyBar = new Date(nextDailyBarTime);
              nextDailyBarTime = Utils.getNextDailyBarTime(
                lastDailyBar.getTime()
              );
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
            let price = this.tickerBook.getPrice(
              dbOuterTrade.voucher_fee_currency
            );
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
          break;
        case SupportedExchange.TIDEBIT:
        default:
          break;
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

  getTsfromDBDate(dbTime) {
    return new Date(`${dbTime.toISOString().substring(0, 10)} 00:00:00`);
  }

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
      dbOuterTrades =
        exchange === SupportedExchange.TIDEBIT
          ? await this.database.getTrades({
              type: Database.TIME_RANGE_TYPE.BETWEEN,
              currency: tickerSetting.code,
              start: startDate,
              end: endtDate,
              asc: true,
            })
          : await this.database.getOuterTrades({
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
          (dbOuterTrade) => {
            let ts = new Date(
              `${(exchange === SupportedExchange.TIDEBIT
                ? dbOuterTrade.created_at
                : dbOuterTrade.create_at
              )
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
          (dbOuterTrade) => {
            let ts = new Date(
              `${(exchange === SupportedExchange.TIDEBIT
                ? dbOuterTrade.created_at
                : dbOuterTrade.create_at
              )
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
          (dbOuterTrade) => {
            let ts = new Date(
              `${(exchange === SupportedExchange.TIDEBIT
                ? dbOuterTrade.created_at
                : dbOuterTrade.create_at
              )
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
          (dbOuterTrade) => {
            let ts = new Date(
              `${(exchange === SupportedExchange.TIDEBIT
                ? dbOuterTrade.created_at
                : dbOuterTrade.create_at
              )
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
    result = this.formateDailyProfitChart(exchange, dbOuterTrades);
    console.log(`formateDailyProfitChart result`, result);
    chartData = result?.chartData;
    profits = result?.profits;
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

  formateOuterTrade(dbOuterTrade) {
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

    let trade = {
      id: dbOuterTrade.id,
      instId: outerTradeData.instId,
      memberId: dbOuterTrade.memberId,
      email: dbOuterTrade.email,
      status: dbOuterTrade.status,
      orderId: dbOuterTrade.order_id,
      voucherId: dbOuterTrade.voucher_id,
      marketCode: tickerSetting.code,
      // kind: dbOuterTrade?.kind,
      outerTrade,
      innerTrade,
      fillPrice: dbOuterTrade.voucher_price || outerTradeData.fillPx,
      fillVolume: dbOuterTrade.voucher_volume || outerTradeData.fillSz,
      fee: dbOuterTrade.voucher_fee
        ? SafeMath.plus(dbOuterTrade.voucher_fee, outerTradeData.fee)
        : dbOuterTrade.voucher_fee,
      side: outerTradeData.side,
      exchange: SupportedExchange.OKEX,
      feeCurrency: outerTradeData.feeCcy || dbOuterTrade.voucher_fee_currency,
      ts: new Date(dbOuterTrade.create_at).getTime(),
      alert: false,
    };
    return trade;
  }

  formateTrade(rawTrade, tickerSetting, side) {
    let trade = {
      id: rawTrade.id,
      instId: tickerSetting.instId,
      memberId: rawTrade[`${side}_member_id`],
      email: null,
      orderId: rawTrade[`${side}_id`],
      voucherId: null,
      marketCode: tickerSetting.code,
      // kind: dbOuterTrade?.kind,
      outerTrade: null,
      innerTrade: {
        orderId: rawTrade[`${side}_id`],
        exchange: SupportedExchange.TIDEBIT,
        price: null,
        volume: null,
        fillPrice: Utils.removeZeroEnd(rawTrade.price),
        fillVolume: Utils.removeZeroEnd(rawTrade.volume),
        fee: null,
        state: null, //Database.DB_STATE_CODE[order.state],
      },
      fillPrice: Utils.removeZeroEnd(rawTrade.price),
      fillVolume: Utils.removeZeroEnd(rawTrade.volume),
      fee: null,
      side: Database.ORDER_SIDE[side],
      exchange: SupportedExchange.TIDEBIT,
      feeCurrency: tickerSetting.quoteUnit,
      ts: new Date(rawTrade.created_at).getTime(),
      alert: false,
    };
    return trade;
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
      memberIds = [],
      emails,
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
            let trade = this.formateOuterTrade(dbOuterTrade);
            if (dbOuterTrade.order_id && dbOuterTrade.voucher_id) {
              orderIds = [...orderIds, dbOuterTrade.order_id];
              voucherIds = [...voucherIds, dbOuterTrade.voucher_id];
            }
            trades = [...trades, trade];
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
      case SupportedExchange.TIDEBIT:
        try {
          let countTrades = await this.database.countTrades({
            currency: tickerSetting.code,
            type: Database.TIME_RANGE_TYPE.BETWEEN,
            start: startDate,
            end: endtDate,
          });
          counts = countTrades["counts"];
          if (counts > 0) {
            let rawTrades = await this.database.getTrades({
              currency: tickerSetting.code,
              type: Database.TIME_RANGE_TYPE.BETWEEN,
              start: startDate,
              end: endtDate,
              limit,
              offset,
            });
            this.logger.debug(`getOuterTradeFills rawTrades`, rawTrades);
            trades = [];
            orderIds = {};
            for (let rawTrade of rawTrades) {
              if (!orderIds[rawTrade.ask_id])
                orderIds = { ...orderIds, [rawTrade.ask_id]: rawTrade.ask_id };
              if (!orderIds[rawTrade.bid_id])
                orderIds = { ...orderIds, [rawTrade.bid_id]: rawTrade.bid_id };
              if (!memberIds[rawTrade.ask_member_id])
                memberIds = {
                  ...memberIds,
                  [rawTrade.ask_member_id]: rawTrade.ask_member_id,
                };
              if (!memberIds[rawTrade.bid_member_id])
                memberIds = {
                  ...memberIds,
                  [rawTrade.bid_member_id]: rawTrade.bid_member_id,
                };
              let askTrade = this.formateTrade(
                rawTrade,
                tickerSetting,
                Database.ORDER_KIND.ASK
              );
              let bidTrade = this.formateTrade(
                rawTrade,
                tickerSetting,
                Database.ORDER_KIND.BID
              );
              trades = [...trades, askTrade, bidTrade];
            }
            this.logger.debug(`getOuterTradeFills trades`, trades);
          }
          this.logger.debug(
            `getOuterTradeFills Object.values(orderIds)`,
            Object.values(orderIds)
          );
          // getOrdersByIds
          orders = await this.database.getOrdersByIds(Object.values(orderIds));
          orders = orders.reduce(
            (acc, curr) => ({ ...acc, [curr.id]: curr }),
            {}
          );
          emails = await this.database.getEmailsByMemberIds(
            Object.values(memberIds)
          );
          this.logger.debug(`getOuterTradeFills emails`, emails);
          emails = emails.reduce(
            (acc, curr) => ({ ...acc, [curr.memberId]: curr }),
            {}
          );
          this.logger.debug(`getOuterTradeFills emails`, emails);
          // getVouchersByOrderIds
          vouchers = await this.database.getVouchersByOrderIds(
            Object.values(orderIds)
          );
          this.logger.debug(`getOuterTradeFills vouchers`, vouchers);
          // getReferralCommissionsByMarkets
          referralCommissions =
            await this.database.getReferralCommissionsByMarkets({
              markets: [tickerSetting.code],
              start,
              end,
            });
          processTrades = [];
          for (let trade of trades) {
            let order = orders[trade.orderId];
            let voucher = vouchers.find(
              (v) =>
                SafeMath.eq(v.order_id, trade.orderId) &&
                SafeMath.eq(v.trade_id, trade.id)
            );
            processTrades = [
              ...processTrades,
              {
                ...trade,
                email: emails[order.member_id],
                voucherId: voucher.id,
                innerTrade: {
                  ...trade.innerTrade,
                  price: Utils.removeZeroEnd(order.price),
                  volume: Utils.removeZeroEnd(order.volume),
                  fee: Utils.removeZeroEnd(voucher[`${voucher.trend}_fee`]),
                  state: Database.DB_STATE_CODE[order.state],
                },
                fee: Utils.removeZeroEnd(voucher[`${voucher.trend}_fee`]),
              },
            ];
          }
          this.logger.debug(`getOuterTradeFills processTrades`, processTrades);
        } catch (error) {
          this.logger.debug(`getOuterTradeFills`, error);
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

  formatInnerOrder(dbOrder) {
    let innerOrder = dbOrder
      ? {
          orderId: dbOrder.id,
          exchange: SupportedExchange.TIDEBIT,
          price: dbOrder.price,
          avgFillPrice: dbOrder.avgFillPrice,
          volume: dbOrder.volume,
          accFillVolume: SafeMath.minus(dbOrder.origin_volume, dbOrder.volume),
          state: dbOrder.state,
          expect:
            dbOrder.kind === Database.ORDER_KIND.BID
              ? dbOrder.origin_volume
              : dbOrder.price
              ? SafeMath.mult(dbOrder.price, dbOrder.origin_volume)
              : null,
          received: dbOrder.funds_received,
        }
      : null;
    return innerOrder;
  }
  formatOkxOrder(order) {
    let outerOrder = {
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
    return outerOrder;
  }

  async getOuterPendingOrders({ query }) {
    let // dbOrders = [],
      orders = [],
      orderIds = [],
      emails = [],
      pendingOrders = [],
      memberIds = {},
      id = query.instId.replace("-", "").toLowerCase(),
      tickerSetting = this.tickersSettings[id],
      dbOrders = await this.getOrdersFromDb({
        ...query,
        state: Database.ORDER_STATE_CODE.WAIT,
        tickerSetting,
      });
    switch (query.exchange) {
      case SupportedExchange.OKEX:
        // ++ TODO 2022/11/25 (需處理 pendingOrders 超過100筆的情況)
        const res = await this.okexConnector.router("getAllOrders", {
          query: { ...query, instType: Database.INST_TYPE.SPOT },
        });
        if (res.success) {
          for (let order of res.payload) {
            let parsedClOrdId,
              memberId,
              orderId,
              outerOrder,
              innerOrder,
              alert = false;
            outerOrder = this.formatOkxOrder(order);
            parsedClOrdId = Utils.parseClOrdId(order.clOrdId);
            if (parsedClOrdId) {
              memberId = parsedClOrdId.memberId;
              if (!memberIds[memberId]) memberIds[memberId] = memberId;
              orderId = parsedClOrdId.orderId;
              orderIds = [...orderIds, orderId];
              let index = dbOrders.findIndex(
                (dbOrder) =>
                  SafeMath.eq(dbOrder.member_id, memberId) &&
                  SafeMath.eq(dbOrder.id, orderId)
              );
              let dbOrder = dbOrders.splice(index, 1).shift();
              innerOrder = this.formatInnerOrder(dbOrder);
            }
            if (
              !SafeMath.eq(
                outerOrder.accFillVolume,
                innerOrder.accFillVolume
              ) ||
              !SafeMath.eq(outerOrder.expect, innerOrder.expect) ||
              !SafeMath.eq(outerOrder.received, innerOrder.received) ||
              outerOrder.state !== innerOrder.state
            ) {
              alert = true;
            }
            let processedOrder = {
              id: (innerOrder.orderId || outerOrder.outerOrder).toString(),
              clOrdId: order.clOrdId,
              instId: order.instId,
              memberId,
              kind: order.ordType,
              side: order.side,
              outerOrder,
              innerOrder,
              price: innerOrder.price || outerOrder.price,
              volume: innerOrder.volume || outerOrder.volume,
              exchange: SupportedExchange.OKEX,
              feeCurrency: order.feeCcy,
              ts: parseInt(order.cTime),
              alert,
            };
            orders = [...orders, processedOrder];
          }
          for (let dbOrder of dbOrders) {
            let innerOrder = this.formatInnerOrder(dbOrder);
            if (!memberIds[dbOrder.member_id])
              memberIds[dbOrder.member_id] = dbOrder.member_id;
            let processedOrder = {
              id: innerOrder.orderId.toString(),
              instId: tickerSetting.instId,
              memberId: dbOrder.member_id,
              kind: dbOrder.ordType,
              side: Database.ORDER_SIDE[dbOrder.kind],
              outerOrder: null,
              innerOrder,
              price: innerOrder.price,
              volume: innerOrder.volume,
              exchange: SupportedExchange.OKEX,
              feeCurrency:
                dbOrder.kind === Database.ORDER_KIND.ASK
                  ? tickerSetting.quoteUnit
                  : tickerSetting.baseUnit,
              ts: new Date(
                dbOrder.created_at.toString().replace(/[-]/g, "/")
              ).getTime(),
              alert: true,
            };
            orders = [...orders, processedOrder];
          }
          // getOrdersByIds
          // dbOrders = await this.database.getOrdersByIds(orderIds);
          emails = await this.database.getEmailsByMemberIds(
            Object.values(memberIds)
          );
          for (let order of orders) {
            let email = emails.find((obj) =>
              SafeMath.eq(obj.id, order.memberId)
            )?.email;
            pendingOrders = [
              ...pendingOrders,
              {
                ...order,
                email: email,
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
  async postPlaceOrder({ header, body, memberId }) {
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
          formatedBody,
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
          try {
            order = await this.database.insertOrder({
              ...orderData,
              dbTransaction: t,
            });
          } catch (error) {
            this.logger.error(
              `[${new Date().toISOString()}][${
                this.constructor.name
              }]!!!ERROR postPlaceOrder OKEX ticker insertOrder 出錯, memberId:[${memberId}] body`,
              body,
              `orderData`,
              orderData
            );
            throw error;
          }
          orderId = order[0];
          clOrdId = `${this.okexBrokerId}${memberId}m${orderId}o`.slice(0, 32);
          // clOrdId = 377bd372412fSCDE60977m247674466o
          // brokerId = 377bd372412fSCDE
          // memberId = 60976
          // orderId = 247674466
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
          try {
            this.logger.debug(
              `[${new Date().toISOString()}][${
                this.constructor.name
              }]_updateAccount`,
              accountVersion,
              `accountVersion`
            );
            await this._updateAccount(accountVersion, t);
          } catch (error) {
            this.logger.error(
              `[${new Date().toISOString()}][${
                this.constructor.name
              }]!!!ERROR postPlaceOrder OKEX ticker _updateAccount 出錯, memberId:[${memberId}] body`,
              body,
              `orderData`,
              orderData
            );
            throw error;
          }
          //   * 5. commit transaction
          await t.commit();
          //   * 6. 建立 OKX order 單
          formatedBody = {
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
          };
          response = await this.okexConnector.router("postPlaceOrder", {
            memberId,
            orderId,
            body: formatedBody,
          });
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
            }
          } else {
            this.logger.error(
              `[${new Date().toISOString()}][${
                this.constructor.name
              }]!!!ERROR postPlaceOrder this.okexConnector.router("postPlaceOrder") 出錯 (memberId[${memberId}]`,
              `formatedBody`,
              formatedBody
            );
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
              this.logger.error(
                `[${new Date().toISOString()}][${
                  this.constructor.name
                }]!!!ERROR postPlaceOrder this.okexConnector.router("postPlaceOrder") 出錯後更新 order 狀態為 "canceled" 失敗 (memberId[${memberId}]`,
                `updateOrder`,
                updateOrder
              );
              response = new ResponseFormat({
                message: "DB ERROR",
                code: Codes.DB_OPERATION_ERROR,
              });
            }
          }
        } catch (error) {
          this.logger.error(
            `[${new Date().toISOString()}][${
              this.constructor.name
            }]!!!ERROR postPlaceOrder SupportedExchange.OKEX 出錯 (memberId[${memberId}]`,
            `body`,
            body,
            `error`,
            error
          );
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
  /**
   * [deprecated] 2022/11/17
   */
  // async getOrderList({ query, memberId }) {
  //   const tickerSetting = this.tickersSettings[query.id];
  //   if (memberId !== -1) {
  //     switch (tickerSetting?.source) {
  //       case SupportedExchange.OKEX:
  //         const res = await this.okexConnector.router("getOrderList", {
  //           query: {
  //             ...query,
  //             instId: tickerSetting?.instId,
  //             market: tickerSetting,
  //             memberId,
  //           },
  //         });
  //         const list = res.payload;
  //         if (Array.isArray(list)) {
  //           const newList = list.filter((order) =>
  //             order.clOrdId.includes(`${memberId}m`)
  //           ); // 可能發生與brokerId, randomId碰撞
  //           res.payload = newList;
  //         }
  //         return res;
  //       case SupportedExchange.TIDEBIT:
  //         if (!this.fetchedOrders[memberId]) this.fetchedOrders[memberId] = {};
  //         let ts = Date.now();
  //         if (
  //           !this.fetchedOrders[memberId][tickerSetting?.instId] ||
  //           SafeMath.gt(
  //             SafeMath.minus(
  //               ts,
  //               this.fetchedOrders[memberId][tickerSetting?.instId]
  //             ),
  //             this.fetchedOrdersInterval
  //           )
  //         )
  //           try {
  //             const orders = await this.getOrdersFromDb({
  //               ...query,
  //               memberId,
  //               instId: tickerSetting?.instId,
  //               market: tickerSetting,
  //             });
  //             this.orderBook.updateAll(memberId, tickerSetting?.instId, orders);
  //             this.fetchedOrders[memberId][tickerSetting?.instId] = ts;
  //           } catch (error) {
  //             const message = error.message;
  //             return new ResponseFormat({
  //               message,
  //               code: Codes.API_UNKNOWN_ERROR,
  //             });
  //           }
  //         return new ResponseFormat({
  //           message: "getOrderList",
  //           payload: this.orderBook.getSnapshot(
  //             memberId,
  //             tickerSetting?.instId,
  //             "pending"
  //           ),
  //         });
  //       default:
  //         return new ResponseFormat({
  //           message: "getOrderList",
  //           payload: null,
  //         });
  //     }
  //   }
  //   return new ResponseFormat({
  //     message: "getOrderList",
  //     payload: null,
  //   });
  // }

  /**
   * [deprecated] 2022/11/17
   */
  // async getOrderHistory({ query, memberId }) {
  //   const tickerSetting = this.tickersSettings[query.id];
  //   if (!memberId || memberId === -1) {
  //     return new ResponseFormat({
  //       message: "getOrderHistory",
  //       payload: null,
  //     });
  //   }
  //   switch (tickerSetting?.source) {
  //     case SupportedExchange.OKEX:
  //     case SupportedExchange.TIDEBIT:
  //       if (!this.fetchedOrders[memberId]) this.fetchedOrders[memberId] = {};
  //       let ts = Date.now();
  //       if (
  //         !this.fetchedOrders[memberId][tickerSetting?.instId] ||
  //         SafeMath.gt(
  //           SafeMath.minus(
  //             ts,
  //             this.fetchedOrders[memberId][tickerSetting?.instId]
  //           ),
  //           this.fetchedOrdersInterval
  //         )
  //       ) {
  //         try {
  //           const orders = await this.getOrdersFromDb({
  //             ...query,
  //             memberId,
  //             tickerSetting,
  //           });
  //           this.orderBook.updateAll(memberId, tickerSetting?.instId, orders);
  //           this.fetchedOrders[memberId][tickerSetting?.instId] = ts;
  //         } catch (error) {
  //           const message = error.message;
  //           return new ResponseFormat({
  //             message,
  //             code: Codes.API_UNKNOWN_ERROR,
  //           });
  //         }
  //       }
  //       return new ResponseFormat({
  //         message: "getOrderHistory",
  //         payload: this.orderBook.getSnapshot(
  //           memberId,
  //           tickerSetting?.instId,
  //           "history"
  //         ),
  //       });
  //     default:
  //       return new ResponseFormat({
  //         message: "getOrderHistory",
  //         payload: null,
  //       });
  //   }
  // }

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
        try {
          await this.database.updateOrder(newOrder, {
            dbTransaction: transaction,
          });
        } catch (error) {
          this.logger.error(
            `[${new Date().toISOString()}][${
              this.constructor.name
            }]!!!ERROR updateOrderStatus 將 order(orderId:${orderId}, memberId:${memberId}) 狀態改成 canceled 出錯 => this.database.updateOrder`,
            `orderData`,
            orderData,
            `dbOrder`,
            dbOrder,
            `newOrder`,
            newOrder,
            `tickerSetting`,
            tickerSetting
          );
          throw error;
        }
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
        try {
          await this._updateAccount(accountVersion, transaction);
        } catch (error) {
          this.logger.error(
            `[${new Date().toISOString()}][${
              this.constructor.name
            }]!!!ERROR updateOrderStatus 將 order(orderId:${orderId}, memberId:${memberId}) 狀態改成 canceled 出錯 => this.database.updateOrder`,
            `orderData`,
            orderData,
            `dbOrder`,
            dbOrder,
            `newOrder`,
            newOrder,
            `accountVersion`,
            accountVersion,
            `tickerSetting`,
            tickerSetting
          );
          throw error;
        }
        updatedOrder = {
          ...order,
          clOrdId: orderData.clOrdId,
          instId: _tickerSetting?.instId,
          state: Database.ORDER_STATE.CANCEL,
          state_text: Database.ORDER_STATE_TEXT.CANCEL,
          at: parseInt(SafeMath.div(Date.now(), "1000")),
          ts: Date.now(),
        };
        success = true;
      }
    } catch (error) {
      success = false;
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!!ERROR updateOrderStatus 將 order(orderId:${orderId}, memberId:${memberId}) 狀態改成 canceled 出錯 => this.database.updateOrder`,
        `orderData`,
        orderData,
        `dbOrder`,
        dbOrder,
        `tickerSetting`,
        tickerSetting
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
      if (!dbOrder || !SafeMath.eq(dbOrder?.member_id, memberId)) {
        this.logger.error(
          `[${new Date().toISOString()}][${
            this.constructor.name
          }]!!!ERROR postCancelOrder dbOrder(orderId:${orderId}) 的 dbOrder.member_id:${
            dbOrder.member_id
          }) 與 call postCancelOrder 的 memberId(${memberId}) 不匹配`,
          `body`,
          body,
          `dbOrder`,
          dbOrder
        );
        throw Error("Order not found");
      }
      tickerSetting = Object.values(this.tickersSettings).find((ts) =>
        SafeMath.eq(ts.code, dbOrder.currency)
      );
      if (!tickerSetting) {
        this.logger.error(
          `[${new Date().toISOString()}][${
            this.constructor.name
          }]!!!ERROR postCancelOrder Can't find ticker [memberId(${memberId})]`,
          `body`,
          body,
          `dbOrder`,
          dbOrder
        );
        throw Error("Can't find ticker");
      }
      switch (tickerSetting?.source) {
        case SupportedExchange.OKEX:
          // 1. updateDB
          /* !!! HIGH RISK (start) !!! */
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
            this.logger.error(
              `[${new Date().toISOString()}][${
                this.constructor.name
              }]!!!ERROR postCancelOrder [memberId(${memberId})] updateOrderStatus出錯`,
              `body`,
              body,
              `dbOrder`,
              dbOrder
            );
          } else {
            // 2. performTask (Task: cancel)
            apiR = await this.okexConnector.router("postCancelOrder", {
              params,
              query,
              memberId,
              body: {
                instId: tickerSetting.instId,
                clOrdId,
              },
            });
          }
          if (!result) {
            if (!apiR?.success) {
              this.logger.error(
                `[${new Date().toISOString()}][${
                  this.constructor.name
                }]!!!ERROR postCancelOrder this.okexConnector.router("postCancelOrder") 出錯 (memberId[${memberId}], instId[${
                  tickerSetting.instId
                }])`,
                `clOrdId`,
                clOrdId
              );
              await transaction.rollback();
            } else {
              await transaction.commit();
              // 3. informFrontEnd
              this._emitUpdateOrder({
                memberId,
                instId: tickerSetting.instId,
                market: tickerSetting.market,
                order: {
                  ...dbUpdateR.updatedOrder,
                  ordId: apiR.payload[0].ordId,
                },
              });
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
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!!ERROR postCancelOrder [memberId(${memberId})]取消訂單失敗了`,
        `body`,
        body,
        `dbOrder`,
        dbOrder
      );
      result = new ResponseFormat({
        message: error.message,
        code: Codes.CANCEL_ORDER_FAIL,
      });
    }
    return result;
  }

  async forceCancelOrder({ body, email }) {
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
                  this.logger.error(
                    `[${new Date().toISOString()}][${
                      this.constructor.name
                    }]!!!ERROR forceCancelOrder [memberId(${memberId})] updateOrderStatus出錯`,
                    `body`,
                    body,
                    `dbOrder`,
                    dbOrder
                  );
                }
              }
              if (!result) {
                // 2. performTask (Task: cancel)
                apiR = await this.okexConnector.router("postCancelOrder", {
                  body: {
                    instId: tickerSetting.instId,
                    clOrdId,
                  },
                });
                if (!apiR?.success) {
                  this.logger.error(
                    `[${new Date().toISOString()}][${
                      this.constructor.name
                    }]!!!ERROR forceCancelOrder this.okexConnector.router("postCancelOrder") 出錯 (memberId[${memberId}], instId[${
                      tickerSetting.instId
                    }])`,
                    `clOrdId`,
                    clOrdId
                  );
                  await dbTransaction.rollback();
                } else {
                  await dbTransaction.commit();
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
        this.logger.error(
          `[${new Date().toISOString()}][${
            this.constructor.name
          }]!!!ERROR forceCancelOrder [memberId(${memberId})]取消訂單失敗了`,
          `body`,
          body,
          `dbOrder`,
          dbOrder
        );
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
    // memberTag // 1 是 vip， 2 是 hero
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
    this.logger.debug(
      `[!!! deprecated][${new Date().toLocaleTimeString()}][${
        this.constructor.name
      }] emitter return!`
    );
    return;
    // if (!instId || !market || !memberId) throw Error("missing arguments");
    // try {
    //   if (updatedOrder) {
    //     let time = updatedOrder.updated_at.replace(/['"]+/g, "");
    //     let order = {
    //       ...updatedOrder,
    //       at: parseInt(SafeMath.div(new Date(time).getTime(), "1000")),
    //       ts: new Date(time).getTime(),
    //       market: market.id,
    //       filled: updatedOrder.state === Database.ORDER_STATE_CODE.DONE,
    //       state_text:
    //         updatedOrder.state === Database.ORDER_STATE_CODE.DONE
    //           ? Database.ORDER_STATE_TEXT.DONE
    //           : updatedOrder.state === Database.ORDER_STATE_CODE.CANCEL
    //           ? Database.ORDER_STATE_TEXT.CANCEL
    //           : Database.ORDER_STATE_TEXT.WAIT,
    //       state:
    //         updatedOrder.state === Database.ORDER_STATE_CODE.DONE
    //           ? Database.ORDER_STATE.DONE
    //           : updatedOrder.state === Database.ORDER_STATE_CODE.CANCEL
    //           ? Database.ORDER_STATE.CANCEL
    //           : Database.ORDER_STATE.WAIT,
    //       state_code:
    //         updatedOrder.state === Database.ORDER_STATE_CODE.DONE
    //           ? Database.ORDER_STATE_CODE.DONE
    //           : updatedOrder.state === Database.ORDER_STATE_CODE.CANCEL
    //           ? Database.ORDER_STATE_CODE.CANCEL
    //           : Database.ORDER_STATE_CODE.WAIT,
    //     };
    //     this._emitUpdateOrder({
    //       memberId,
    //       instId,
    //       market: market.id,
    //       order,
    //     });
    //   }
    //   let tmp = this.accountBook.getSnapshot(memberId, instId);
    //   if (!tmp) {
    //     tmp = [];
    //     tmp[0] = await this.database.getAccountsByMemberId(
    //       askAccountVersion.member_id,
    //       {
    //         options: { currency: askAccountVersion.currency },
    //         limit: 1,
    //         dbTransaction,
    //       }
    //     );
    //   }
    //   let balance, locked, total;
    //   if (askAccountVersion) {
    //     let askAccount = tmp ? tmp[0] : null;
    //     balance = SafeMath.plus(askAccount.balance, askAccountVersion.balance);
    //     locked = SafeMath.plus(askAccount.locked, askAccountVersion.locked);
    //     total = SafeMath.plus(balance, locked);
    //     this._emitUpdateAccount({
    //       memberId,
    //       account: {
    //         balance,
    //         locked,
    //         currency: market.ask.currency.toUpperCase(),
    //         total,
    //       },
    //     });
    //   }
    //   if (bidAccountVersion) {
    //     let bidAccount = tmp ? tmp[1] : null;
    //     balance = SafeMath.plus(bidAccount.balance, askAccountVersion.balance);
    //     locked = SafeMath.plus(bidAccount.locked, askAccountVersion.locked);
    //     total = SafeMath.plus(balance, locked);
    //     if (orderFullFilledAccountVersion) {
    //       balance = SafeMath.plus(
    //         balance,
    //         orderFullFilledAccountVersion.balance
    //       );
    //       locked = SafeMath.plus(locked, orderFullFilledAccountVersion.locked);
    //       total = SafeMath.plus(balance, locked);
    //     }
    //     this._emitUpdateAccount({
    //       memberId,
    //       account: {
    //         balance,
    //         locked,
    //         currency: market.ask.currency.toUpperCase(),
    //         total,
    //       },
    //     });
    //   }
    // } catch (error) {
    //   ++ TODO "Fail to inform frontend"
    // }
  }

  async abnormalOrderHandler({ dbOrder, apiOrder }) {
    let now = `${new Date().toISOString().slice(0, 19).replace("T", " ")}`,
      updatedOrder,
      orderState,
      orderLocked,
      orderFundsReceived,
      orderVolume,
      orderTradesCount,
      doneAt = null;
    try {
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
      this.logger.debug(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!! NOTICE abnormalOrderHandler updatedOrder`,
        `dbOrder`,
        dbOrder,
        `apiOrder`,
        apiOrder,
        `updatedOrder`,
        updatedOrder
      );
    } catch (error) {
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!!ERROR abnormalOrderHandler 出錯`,
        `dbOrder`,
        dbOrder,
        `apiOrder`,
        apiOrder,
        `error`,
        error
      );
      throw error;
    }
    return updatedOrder;
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
      if (SafeMath.eq(orderVolume, "0")) {
        orderState = Database.ORDER_STATE_CODE.DONE;
        doneAt = now;
        // 5. 當更新的 order 已完全撮合，需要將剩餘鎖定的金額全部釋放還給對應的 account，此時會新增一筆 account version 的紀錄，這邊將其命名為 orderFullFilledAccountVersion
        // if (SafeMath.gt(orderLocked, 0)) {
        // orderLocked = "0"; // !!!!!! ALERT 剩餘鎖定金額的紀錄保留在 order裡面 （實際有還給 account 並生成憑證）
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

      if (referredByMember) {
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
        }
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
    } catch (error) {
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!!ERROR calculator 出錯`,
        `market`,
        market,
        `member`,
        member,
        `dbOrder`,
        dbOrder,
        `orderDetail`,
        orderDetail,
        `data`,
        data,
        `referredByMember`,
        referredByMember,
        `memberReferral`,
        memberReferral,
        `error`,
        error
      );
      throw error;
    }
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
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!!ERROR updateOuterTrade 出錯`,
        `error`,
        error,
        `member`,
        member,
        `status`,
        status,
        `id`,
        id,
        `currency`,
        currency,
        `trade`,
        trade,
        `dbOrder`,
        dbOrder,
        `voucher`,
        voucher,
        `askAccountVersion`,
        askAccountVersion,
        `bidAccountVersion`,
        bidAccountVersion,
        `orderFullFilledAccountVersion`,
        orderFullFilledAccountVersion,
        `referralCommission`,
        referralCommission
      );
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
    try {
      if (dbOrder.state !== Database.ORDER_STATE_CODE.WAIT) {
        throw Error(`orderState is not wait`);
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
      voucherId = await this.database.insertVouchers(
        {
          ...voucher,
          trade_id: tradeId,
        },
        { dbTransaction }
      );
      newAskAccountVersion = await this._updateAccount(
        { ...askAccountVersion, modifiable_id: tradeId },
        dbTransaction
      );
      newBidAccountVersion = await this._updateAccount(
        { ...bidAccountVersion, modifiable_id: tradeId },
        dbTransaction
      );
      if (orderFullFilledAccountVersion) {
        newOrderFullFilledAccountVersion = await this._updateAccount(
          { ...orderFullFilledAccountVersion, modifiable_id: tradeId },
          dbTransaction
        );
      }
      if (referralCommission) {
        let rcs = await this.database.getReferralCommissionsByConditions({
          conditions: {
            voucherId,
            market: market.code,
            tradeMemberId: member.id,
          },
        });
        dbReferrerCommission = rcs[0];
        if (dbReferrerCommission) {
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
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!!ERROR updater 出錯`,
        `dbOrder`,
        dbOrder,
        `updatedOrder`,
        updatedOrder,
        `voucher`,
        voucher,
        `trade`,
        trade,
        `tradeFk`,
        tradeFk,
        `member`,
        member,
        `market`,
        market,
        `instId`,
        instId,
        `askAccountVersion`,
        askAccountVersion,
        `bidAccountVersion`,
        bidAccountVersion,
        `orderFullFilledAccountVersion`,
        orderFullFilledAccountVersion,
        `referralCommission`,
        referralCommission,
        `error`,
        error
      );
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
            this.logger.error(
              `[${new Date().toISOString()}][${
                this.constructor.name
              }]!!!ERROR processor => calculator 出錯`,
              `data`,
              data,
              `error`,
              error
            );
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
              this.logger.error(
                `[${new Date().toISOString()}][${
                  this.constructor.name
                }]!!!ERROR processor => updater 出錯`,
                `data`,
                data,
                `error`,
                error
              );
              // if (error.code === Codes.DUPLICATE_PROCESS_OUTER_TRADE) {
              stop = true;
              await this.updateOuterTrade({
                id: data.tradeId,
                status: Database.OUTERTRADE_STATUS.SYSTEM_ERROR,
                currency: market.code,
                dbTransaction,
              });
              await dbTransaction.commit();
              // } else throw error;
            }
          } else await dbTransaction.rollback();
        }
      } catch (error) {
        await dbTransaction.rollback();
        this.logger.error(
          `[${new Date().toISOString()}][${
            this.constructor.name
          }]!!!ERROR processor 出錯`,
          `data`,
          data,
          `error`,
          error
        );
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
        const member = await this.database.getMemberByCondition({
          email: email,
        });

        if (member) {
          number = await this.database.countMembers({ before: member.id });
          page = Math.floor(number / limit) + 1;
          offset = (page - 1) * limit;
        }
      }

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
    return result;
  }

  async auditOrder(order) {
    let alert = false,
      trades = [],
      vouchers = [],
      baseUnit = this.coinsSettingsMap[order.ask.toString()]?.code,
      quoteUnit = this.coinsSettingsMap[order.bid.toString()]?.code,
      auditedOrder = {
        baseUnit,
        quoteUnit,
        ...order,
        type: Database.ORDER_SIDE[order.type],
        state: Database.DB_STATE_CODE[order.state],
        price: Utils.removeZeroEnd(order.price),
        volume: Utils.removeZeroEnd(order.volume),
        origin_volume: Utils.removeZeroEnd(order.origin_volume),
        locked: Utils.removeZeroEnd(order.locked),
        origin_locked: Utils.removeZeroEnd(order.origin_locked),
        funds_received: Utils.removeZeroEnd(order.funds_received),
        updated_at: order.updated_at
          .toString()
          .substring(0, 19)
          .replace("T", " "),
        // accountVersions: accountVersionsByOrder,
      };
    // 1. getVouchers
    vouchers = await this.database.getVouchersByOrderIds(order.id);
    // 2. getTrades
    let ids = vouchers.map((v) => v.trade_id);
    trades = await this.database.getTradesByIds(ids);
    auditedOrder.trades_count = {
      expect: auditedOrder.trades_count,
      real: vouchers.length,
      alert:
        !SafeMath.eq(auditedOrder.trades_count, vouchers.length) ||
        trades.length !== vouchers.length,
    };
    let fundsReceived = vouchers.reduce((prev, curr) => {
      prev = SafeMath.plus(
        prev,
        order.type === Database.TYPE.ORDER_BID ? curr.volume : curr.value
      );
      return prev;
    }, 0);
    auditedOrder.funds_received = {
      expect: fundsReceived,
      real: auditedOrder.funds_received,
      alert: !SafeMath.eq(auditedOrder.funds_received, fundsReceived),
    };
    // 3. getAccountVersions
    let accountVersionsByOrder =
      await this.database.getAccountVersionsByModifiableIds(
        [auditedOrder.id],
        Database.MODIFIABLE_TYPE.ORDER
      );
    auditedOrder.accountVersions = accountVersionsByOrder.map((v) => ({
      ...v,
      currency: this.coinsSettingsMap[v.currency]?.code,
      balance: Utils.removeZeroEnd(v.balance),
      locked: Utils.removeZeroEnd(v.locked),
      fee: Utils.removeZeroEnd(v.fee),
      // created_at: v.created_at.toString().substring(0, 19).replace("T", " "),
    }));
    let accountVersionsByTrade =
      await this.database.getAccountVersionsByModifiableIds(
        ids,
        Database.MODIFIABLE_TYPE.TRADE
      );
    vouchers = vouchers.map((v) => {
      let add,
        sub,
        expectValue,
        realValue,
        expectVolume,
        realVolume,
        isValueCorrect,
        isVolumeCorrect,
        accountVersions,
        accountVersionAdds = [],
        accountVersionSubs = [];
      accountVersions = accountVersionsByTrade
        .filter(
          (acc) =>
            SafeMath.eq(acc.member_id, auditedOrder.member_id) &&
            SafeMath.eq(acc.modifiable_id, v.trade_id)
        )
        .map((v) => {
          if (v.reason === Database.REASON.STRIKE_ADD)
            accountVersionAdds = [...accountVersionAdds, v];
          if (v.reason === Database.REASON.STRIKE_SUB)
            accountVersionSubs = [...accountVersionSubs, v];
          return {
            ...v,
            currency: this.coinsSettingsMap[v.currency]?.code,
            balance: Utils.removeZeroEnd(v.balance),
            locked: Utils.removeZeroEnd(v.locked),
            fee: Utils.removeZeroEnd(v.fee),
            // created_at: v.created_at
            //   .toString()
            //   .substring(0, 19)
            //   .replace("T", " "),
          };
        });
      add = accountVersionAdds.reduce((prev, accV) => {
        prev = SafeMath.plus(prev, SafeMath.plus(accV.balance, accV.fee));
        return prev;
      }, 0);
      sub = accountVersionSubs.reduce((prev, accV) => {
        prev = SafeMath.plus(prev, accV.locked);
        return prev;
      }, 0);
      realValue = Utils.removeZeroEnd(v.value);
      realVolume = Utils.removeZeroEnd(v.volume);
      if (order.type === Database.TYPE.ORDER_BID) {
        expectVolume = add;
        expectValue = SafeMath.mult(sub, "-1");
      } else {
        expectVolume = SafeMath.mult(sub, "-1");
        expectValue = add;
      }
      isValueCorrect = SafeMath.eq(expectValue, realValue);
      isVolumeCorrect = SafeMath.eq(expectVolume, realVolume);
      if (
        auditedOrder.trades_count.alert ||
        auditedOrder.funds_received.alert ||
        !isValueCorrect ||
        !isVolumeCorrect
      )
        alert = true;
      return {
        ...v,
        price: Utils.removeZeroEnd(v.price),
        volume: {
          expect: expectVolume,
          real: realVolume,
          alert: !isVolumeCorrect,
        },
        value: { expect: expectValue, real: realValue, alert: !isValueCorrect },
        ask_fee: Utils.removeZeroEnd(v.ask_fee),
        bid_fee: Utils.removeZeroEnd(v.bid_fee),
        // created_at: v.created_at.toString().substring(0, 19).replace("T", " "),
        accountVersions,
      };
    });
    return {
      alert,
      order: auditedOrder,
      vouchers,
      trades,
    };
  }

  /**
   * Audit
   * MemberBehavior: Deposit, Withdraw, Order(post or cancel)
   */
  async auditMemberBehavior({ query }) {
    let { memberId, currency, start, end } = query;
    let auditedOrder,
      auditedOrders = [];
    // 1. getDepositRecords
    let depositRecords = await this.database.getDepositRecords({
      memberId,
      currency,
      start,
      end,
    });
    depositRecords = depositRecords.map((d) => ({
      ...d,
      amount: Utils.removeZeroEnd(d.amount),
      fee: Utils.removeZeroEnd(d.fee),
      currency: this.coinsSettingsMap[d.currency]?.code,
    }));
    // for (let deposit of depositRecords) {
    //   balanceDiff = SafeMath.plus(balanceDiff, deposit.amount);
    // }
    // 2. getWithdrawRecords
    let withdrawRecords = await this.database.getWithdrawRecords({
      memberId,
      currency,
      start,
      end,
    });
    withdrawRecords = withdrawRecords.map((w) => ({
      ...w,
      amount: Utils.removeZeroEnd(w.amount),
      fee: Utils.removeZeroEnd(w.fee),
      currency: this.coinsSettingsMap[w.currency]?.code,
    }));
    // for (let withdraw of withdrawRecords) {
    //   balanceDiff = SafeMath.minus(balanceDiff, withdraw.amount);
    // }
    // 3. getOrderRecords
    let orderRecords = await this.database.getOrderRecords({
      currency,
      memberId,
      start,
      end,
    });
    for (let order of orderRecords) {
      auditedOrder = await this.auditOrder(order);
      auditedOrders = [...auditedOrders, auditedOrder];
    }
    let payload = {
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

          baseAccBal = SafeMath.plus(updateBaseAccount.balance, baseAccBalDiff);

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

          quoteAccBal = SafeMath.plus(
            updateQuoteAccount.balance,
            quoteAccBalDiff
          );

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
  }

  async _getPlaceOrderData(memberId, body, tickerSetting) {
    let orderData;
    try {
      if (!tickerSetting) {
        this.logger.error(
          `[${new Date().toISOString()}][${
            this.constructor.name
          }]!!!ERROR 將 postPlaceOrder API收到 body 轉成 DB 要用的格式出錯(_getPlaceOrderData) tickersetting not found memberId:[${memberId}] body`,
          body
        );
        throw new Error(`this ticker ${body.instId} can be found.`);
      }
      const { id: bid } = this.coinsSettings.find(
        (curr) => curr.code === tickerSetting.quoteUnit
      );
      const { id: ask } = this.coinsSettings.find(
        (curr) => curr.code === tickerSetting.baseUnit
      );
      if (!bid) {
        this.logger.error(
          `[${new Date().toISOString()}][${
            this.constructor.name
          }]!!!ERROR 將 postPlaceOrder API收到 body 轉成 DB 要用的格式出錯(_getPlaceOrderData) bid[tickerSetting.quoteUnit:${
            tickerSetting.quoteUnit
          }] not found memberId:[${memberId}] body`,
          body,
          `tickerSetting`,
          tickerSetting
        );
        throw new Error(`bid not found`);
      }
      if (!ask) {
        this.logger.error(
          `[${new Date().toISOString()}][${
            this.constructor.name
          }]!!!ERROR 將 postPlaceOrder API收到 body 轉成 DB 要用的格式出錯(_getPlaceOrderData) ask[tickerSetting.baseUnit:${
            tickerSetting.baseUnit
          }] not found memberId:[${memberId}] body`,
          body,
          `tickerSetting`,
          tickerSetting
        );
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
      orderData = {
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
    } catch (error) {
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!!ERROR 將 postPlaceOrder API收到 body 轉成 DB 要用的格式出錯(_getPlaceOrderData) memberId:[${memberId}] body`,
        body,
        `tickerSetting`,
        tickerSetting
      );
    }
    return orderData;
  }

  async _updateAccount(accountVersion, dbTransaction) {
    /* !!! HIGH RISK (start) !!! */
    let accountVersionId, newAccountVersion, newAccount;
    const account = await this.database.getAccountsByMemberId(
      accountVersion.member_id,
      {
        options: { currency: accountVersion.currency },
        limit: 1,
        dbTransaction,
      }
    );
    if (!account) {
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!!ERROR 更新餘額出錯(_updateAccount) Account not found`,
        `accountVersion`,
        accountVersion
      );
      throw Error("Account not found.");
    }
    if (SafeMath.lt(account.balance, accountVersion.locked)) {
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!!ERROR 更新餘額出錯(_updateAccount) => account.balance[:${
          account.balance
        }] < accountVersion.locked[:${accountVersion.locked}] `,
        `account`,
        account,
        `accountVersion`,
        accountVersion
      );
      throw Error("Available balance is not enough.");
    }
    const oriAccBal = account.balance;
    const oriAccLoc = account.locked;
    const newAccBal = SafeMath.plus(oriAccBal, accountVersion.balance);
    if (SafeMath.lt(newAccBal, "0")) {
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!!ERROR 更新餘額出錯(_updateAccount) => SafeMath.plus(oriAccBal[:${oriAccBal}], accountVersion.balance[:${
          accountVersion.balance
        }]) = newAccBal[:${newAccBal}] < "0"`,
        `account`,
        account,
        `accountVersion`,
        accountVersion
      );
      throw Error("Available balance is not enough.");
    }
    const newAccLoc = SafeMath.plus(oriAccLoc, accountVersion.locked);
    const amount = SafeMath.plus(newAccBal, newAccLoc);
    if (SafeMath.lt(amount, "0")) {
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!!ERROR 更新餘額出錯(_updateAccount) => SafeMath.plus(newAccBal[:${newAccBal}], newAccLoc[:${newAccLoc}]) = amount[:${amount}] < "0"`,
        `account`,
        account,
        `accountVersion`,
        accountVersion
      );
      throw Error("System error.");
    }
    const currency = this.coinsSettings?.find(
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
    try {
      accountVersionId = await this.database.insertAccountVersion(
        newAccountVersion,
        { dbTransaction }
      );
    } catch (error) {
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!!ERROR insertAccountVersion 出錯(_updateAccount)`,
        `accountVersion`,
        accountVersion
      );
      throw error;
    }
    // const newAccount = {
    //   id: account.id,
    //   balance: newAccBal,
    //   locked: newAccLoc,
    //   updated_at: `"${accountVersion.created_at}"`,
    // };
    try {
      // await this.database.updateAccount(newAccount, { dbTransaction });
      await this.database.updateAccountByAccountVersion(
        account.id,
        accountVersion.created_at,
        { dbTransaction }
      );
    } catch (error) {
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
          // }]!!!ERROR updateAccount 出錯(_updateAccount)`,
        }]!!!ERROR updateAccountByAccountVersion 出錯(_updateAccount)`,
        `accountVersion`,
        accountVersion
      );
      throw error;
    }
    try {
      newAccount = await this.database.getAccountsByMemberId(
        accountVersion.member_id,
        {
          options: { currency: accountVersion.currency },
          limit: 1,
          dbTransaction,
        }
      );
    } catch (error) {
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
          // }]!!!ERROR updateAccount 出錯(_updateAccount)`,
        }]!!!ERROR getAccountsByMemberId 出錯(_updateAccount) memberId[${
          accountVersion.member_id
        }] currency[${accountVersion.currency}]`
      );
      throw error;
    }
    try {
      this._emitUpdateAccount({
        memberId: accountVersion.member_id,
        account: {
          balance: newAccount.balance,
          locked: newAccount.locked,
          currency: currency.toUpperCase(),
          total: SafeMath.plus(newAccount.balance, newAccount.locked),
        },
      });
    } catch (error) {
      this.logger.error(
        `[${new Date().toISOString()}][${
          this.constructor.name
        }]!!!ERROR 前端通知出錯(_updateAccount) => _emitUpdateAccount (memberId[${
          accountVersion.member_id
        }], currency[${currency}], newAccBal[${newAccBal}], newAccLoc[${newAccLoc}], amount[${amount}])`,
        `accountVersion`,
        accountVersion
      );
      throw error;
    }
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
    this.orderBook.updateByDifference(memberId, instId, {
      add: [order],
    });
    EventBus.emit(Events.order, memberId, market, {
      market: market,
      difference: this.orderBook.getDifference(memberId, instId),
    });
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
  }

  _emitUpdateAccount({ memberId, account }) {
    this.accountBook.updateByDifference(memberId, account);
    EventBus.emit(
      Events.account,
      memberId,
      this.accountBook.getDifference(memberId)
    );
  }

  async _eventListener() {
    EventBus.on(Events.account, (memberId, account) => {
      this.broadcastAllPrivateClient(memberId, {
        type: Events.account,
        data: account,
      });
    });

    EventBus.on(Events.order, (memberId, market, order) => {
      this.broadcastPrivateClient(memberId, {
        market,
        type: Events.order,
        data: order,
      });
    });

    EventBus.on(Events.userStatusUpdate, (memberId, userStatus) => {
      this.broadcastAllPrivateClient(memberId, {
        type: Events.userStatusUpdate,
        data: userStatus,
      });
    });

    EventBus.on(Events.trade, (memberId, market, tradeData) => {
      if (this._isIncludeTideBitMarket(market)) {
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
