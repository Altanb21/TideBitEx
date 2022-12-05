import { decode } from "jsonwebtoken";
import { apiVersion, apiKey, apiSecret } from "../constant/Config";
import Codes from "../constant/Codes";

import HTTPAgent from "../utils/HTTPAgent";

// retry
class Communicator {
  constructor() {
    // constructor({ userId }) {
    // this._userId = userId;
    this.httpAgent = new HTTPAgent({
      // userId,
      apiURL: ``,
      apiVersion: apiVersion,
      apiKey: apiKey,
      apiSecret: apiSecret,
    });
    this.token = null;
    this.tokenSecret = null;
    this.tokenRenewTimeout = null;
    this.CSRFToken = null;
    this.CSRFTokenRenewTimeout = null;
    // this.msgList = [];
    return this;
  }

  // 0. User Token Renew
  /**
   * accessTokenRenew
   * @returns {
   *  token: string,
   *  tokenSecret: string
   * }
   */
  async accessTokenRenew({ token, tokenSecret }) {
    try {
      const body = {
        token,
        tokenSecret,
      };
      const res = await this.httpAgent.post("/token/renew", body);
      if (res.success) {
        this._setInfo(res.data.token, res.data.tokenSecret);
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  async CSRFTokenRenew() {
    try {
      const res = await this.httpAgent.CSRFTokenRenew({
        method: "GET",
        url: `${window.location.href.replace(`markets`, "markets_origin")}`,
      });
      const csrfTag = res.data.match(
        /(?:<meta name="csrf-token" content=").*(?=" \/>)/g
      );
      let csrfToken;
      if (csrfTag.length > 0)
        csrfToken = csrfTag[0].replace('<meta name="csrf-token" content="', "");
      this._setCSRFToken(csrfToken);
      return csrfToken;
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  async logout() {
    try {
      // ++ TODO
      const res = await this._get(`/logout`);
      console.log(`res`);
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  // Public
  /**
   * instruments
   * @param {String} instType SPOT,MARGIN,SWAP,FUTURES,OPTION
   * @returns [{
   * ...
   * }]
   */
  async instruments(instType = "SPOT") {
    try {
      if (!instType) return { message: "instType cannot be null" };
      const res = await this._get(`/public/instruments?instType=${instType}`);
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  /**
   * [deprecated] 2022/10/28
   */
  async getExchangeRates() {
    try {
      const res = await this._request({
        method: "GET",
        url: `/public/exchange-rates`,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  // Market
  async ticker(id) {
    try {
      if (!id) return { message: "id cannot be null" };
      const res = await this._request({
        method: "GET",
        url: `/market/ticker?id=${id}`,
      });
      // const res = await this._get(`/market/ticker?id=${id}`);
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  // Market
  async tickers(instType, from, limit) {
    try {
      if (!instType)
        return Promise.reject({ message: "instType cannot be null" });
      // const res = await this._get(
      //   `/market/tickers?instType=${instType}${from ? `&from=${from}` : ""}${
      //     limit ? `&limit=${limit}` : ""
      //   }`
      // );
      const res = await this._request({
        method: "GET",
        url: `/market/tickers?instType=${instType}${
          from ? `&from=${from}` : ""
        }${limit ? `&limit=${limit}` : ""}`,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  // Market
  async getDepthBooks({ market, sz, lotSz }) {
    if (!sz) sz = 50;
    try {
      if (!market) return { message: "market cannot be null" };
      // const res = await this._get(
      //   `/market/books?id=${id}${sz ? `&sz=${sz}` : ""}`
      // );
      const res = await this._request({
        method: "GET",
        url: `/market/books?market=${market}${sz ? `&sz=${sz}` : ""}${
          lotSz ? `&lotSz=${lotSz}` : ""
        }`,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  // Market
  async getTrades({ market, limit, lotSz }) {
    if (!limit) limit = 100;
    try {
      if (!market) return { message: "id cannot be null" };
      // const res = await this._get(
      //   `/market/trades?id=${id}${limit ? `&limit=${limit}` : ""}`
      // );
      const res = await this._request({
        method: "GET",
        url: `/market/trades?market=${market}${limit ? `&limit=${limit}` : ""}${
          lotSz ? `&lotSz=${lotSz}` : ""
        }`,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  // Market
  async candles(instId, bar, after, before, limit) {
    try {
      if (!instId) return { message: "instId cannot be null" };
      // const res = await this._get(
      //   `/market/candles?instId=${instId}&bar=${bar}${
      //     after ? `&after=${after}` : ""
      //   }${before ? `&before=${before}` : ""}${limit ? `&limit=${limit}` : ""}`
      // );
      const res = await this._request({
        method: "GET",
        url: `/market/candles?instId=${instId}&bar=${bar}${
          after ? `&after=${after}` : ""
        }${before ? `&before=${before}` : ""}${limit ? `&limit=${limit}` : ""}`,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }
  // Trade

  async getOrders(options) {
    try {
      const url = `/trade/orders?${
        options?.market ? `&market=${options.market}` : ""
      }${options?.instId ? `&instId=${options.instId}` : ""}${
        options?.instType ? `&instType=${options.instType}` : ""
      }${options?.ordType ? `&ordType=${options.ordType}` : ""}${
        options?.state ? `&state=${options.state}` : ""
      }${options?.after ? `&after=${options.after}` : ""}${
        options?.before ? `&before=${options.before}` : ""
      }${options?.limit ? `&limit=${options.limit}` : ""}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  async getOrderList(options) {
    try {
      const url = `/trade/orders-pending?${
        options?.market ? `&market=${options.market}` : ""
      }${options?.instId ? `&instId=${options.instId}` : ""}${
        options?.instType ? `&instType=${options.instType}` : ""
      }${options?.ordType ? `&ordType=${options.ordType}` : ""}${
        options?.state ? `&state=${options.state}` : ""
      }${options?.after ? `&after=${options.after}` : ""}${
        options?.before ? `&before=${options.before}` : ""
      }${options?.limit ? `&limit=${options.limit}` : ""}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  // Trade
  /**
   * [deprecated] 2022/11/17
   */
  async getOrderHistory(options) {
    try {
      const url = `/trade/orders-history?${
        options?.market ? `&market=${options.market}` : ""
      }${options?.instId ? `&instId=${options.instId}` : ""}${
        options?.instType ? `&instType=${options.instType}` : "&instType=SPOT"
      }${options?.ordType ? `&ordType=${options.ordType}` : ""}${
        options?.state ? `&state=${options.state}` : ""
      }${options?.after ? `&after=${options.after}` : ""}${
        options?.before ? `&before=${options.before}` : ""
      }${options?.limit ? `&limit=${options.limit}` : ""}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  // Account
  async getAccounts(ccy) {
    try {
      const url = `/account/balance?${ccy ? `&ccy=${ccy}` : ""}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      // console.error(`[getAccounts] error`, error);
      return Promise.reject({ ...error });
    }
  }

  /**
   * [deprecated] 2022/10/14
   */
  // Account
  async getUsersAccounts() {
    try {
      const url = `/users/account/list`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      // console.error(`[getAccounts] error`, error);
      return Promise.reject({ ...error });
    }
  }

  /**
   * [deprecated] 2022/10/14
   */
  async getExAccounts(exchange) {
    try {
      const url = `/users/subaccount/list?exchange=${exchange}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      // console.error(`[getAccounts] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async getOuterTradesProfits({ instId, exchange, start, end }) {
    try {
      if (!exchange) return { message: "exchange cannot be null" };
      const url = `/trade/profits?instId=${instId}&exchange=${exchange}&start=${start}&end=${end}`;
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  async getOuterTradeFills({ instId, exchange, start, end, limit, offset }) {
    try {
      if (!exchange) return { message: "exchange cannot be null" };
      const url = `/trade/fill-history?instId=${instId}&exchange=${exchange}&start=${start}&end=${end}&offset=${offset}&limit=${limit}`;
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  async getOuterPendingOrders({ instId, exchange, before, after }) {
    try {
      if (!exchange) return { message: "exchange cannot be null" };
      let arr = [];
      arr.push(`exchange=${exchange}`);
      if (instId) arr.push(`instId=${instId}`);
      if (before) arr.push(`before=${before}`);
      if (after) arr.push(`after=${after}`);
      const qs = !!arr.length ? `?${arr.join("&")}` : "";
      const url = `/trade/pending-orders${qs}`;
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  // Trade
  async order(order) {
    try {
      // const res = await this._post(`/trade/order`, order);
      const res = await this._request({
        method: "POST",
        url: `/trade/order`,
        data: { ...order, "X-CSRF-Token": this.CSRFToken },
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  // Trade
  async cancel(orderId) {
    try {
      // const res = await this._post(`/trade/cancel-order`, order);
      const res = await this._request({
        method: "POST",
        url: `/trade/cancel-order`,
        data: { orderId, "X-CSRF-Token": this.CSRFToken },
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  async forceCancelOrder(order) {
    try {
      const res = await this._request({
        method: "POST",
        url: `/trade/force-cancel-order`,
        data: {
          memberId: order.memberId,
          orderId: order.innerOrder?.orderId,
          orderExchange: order.outerOrder.exchange,
        },
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  async cancelOrders(options) {
    try {
      // const res = await this._post(`/trade/cancel-orders`, options);
      const res = await this._request({
        method: "POST",
        url: `/trade/cancel-orders`,
        data: { ...options, "X-CSRF-Token": this.CSRFToken },
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      return Promise.reject({ ...error });
    }
  }

  async getOptions() {
    try {
      const url = `/market/options`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[getOptions] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async getAdminUser(id) {
    try {
      const url = `/admin/admin-users/${id}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[getAdminUser] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async getAdminUsers() {
    try {
      const url = `/admin/admin-users`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[getAdminUsers] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async addAdminUser(newAdminUser) {
    try {
      const url = `/admin/admin-users`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "POST",
        url,
        data: { newAdminUser: { ...newAdminUser } },
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[addAdminUser] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async deleteAdminUser(user) {
    try {
      const url = `/admin/admin-users/${user.id}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "DELETE",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[deleteAdminUser] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async updateAdminUser(updateAdminUser) {
    try {
      const url = `/admin/admin-users/${updateAdminUser.id}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "PUT",
        url,
        data: {
          updateAdminUser: { ...updateAdminUser },
        },
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[updateAdminUser] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async getCoinsSettings() {
    try {
      const url = `/admin/coins-settings`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[getCoinsSettings] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async updateCoinsSettings(visible) {
    try {
      const url = `/admin/coins-settings/`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "PUT",
        url,
        data: {
          visible,
        },
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[updateCoinsSettings] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async updateCoinSetting(id, visible) {
    try {
      const url = `/admin/coins-settings/${id}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "PUT",
        url,
        data: {
          visible,
        },
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[updateCoinSetting] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async updateDepositSetting(id, type, data) {
    try {
      const url = `/admin/deposits-settings/${id}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "PUT",
        url,
        data: {
          type,
          data,
        },
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[updateCoinSetting] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async updateWithdrawSetting(id, type, data) {
    try {
      const url = `/admin/withdraws-settings/${id}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "PUT",
        url,
        data: {
          type,
          data,
        },
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[updateCoinSetting] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async getTickersSettings() {
    try {
      const url = `/admin/tickers-settings`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[getTickersSettings] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async updateTickerSetting(id, type, data) {
    try {
      const url = `/admin/tickers-settings/${id}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "PUT",
        url,
        data: {
          type,
          data,
        },
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[updateTickerSetting] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async getPlatformAssets() {
    try {
      const url = `/admin/platform-assets`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[getPlatformAssets] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async updatePlatformAsset(id, data) {
    try {
      const url = `/admin/platform-assets/${id}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "PUT",
        url,
        data,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[updatePlatformAsset] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async getDashboardData() {
    try {
      const url = `/admin/dashboard`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[getDashboardData] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async getMembers({ email, offset, limit }) {
    try {
      let arr = [],
        qs;
      if (offset !== undefined) arr = [...arr, `offset=${offset}`];
      if (limit) arr = [...arr, `limit=${limit}`];
      if (email) arr = [...arr, `email=${email}`];
      qs = !!arr.length ? `?${arr.join("&")}` : "";
      const url = `/private/members${qs}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[getMembers] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async auditorMemberAccounts({ memberId, currency }) {
    try {
      let arr = [],
        qs;
      if (memberId) arr = [...arr, `memberId=${memberId}`];
      if (currency) arr = [...arr, `currency=${currency}`];
      qs = !!arr.length ? `?${arr.join("&")}` : "";
      const url = `/private/audit-accounts${qs}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "GET",
        url,
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[auditorMemberAccounts] error`, error);
      return Promise.reject({ ...error });
    }
  }

  async fixAccountHandler(accountId) {
    try {
      const url = `/private/audit-accounts/${accountId}`;
      // const res = await this._get(url);
      const res = await this._request({
        method: "PUT",
        url,
        data: { id: accountId },
      });
      if (res.success) {
        return res.data;
      }
      return Promise.reject({ message: res.message, code: res.code });
    } catch (error) {
      console.error(`[fixAccountHandler] error`, error);
      return Promise.reject({ ...error });
    }
  }

  // use for need jwt request
  async _get(url) {
    try {
      let res = await this.httpAgent.get(url);
      if (res.code === Codes.EXPIRED_ACCESS_TOKEN) {
        await this.accessTokenRenew({
          token: this.token,
          tokenSecret: this.tokenSecret,
        });
        res = await this.httpAgent.get(url);
      }
      return res;
    } catch (e) {
      if (e.code === Codes.EXPIRED_ACCESS_TOKEN) {
        try {
          await this.accessTokenRenew({
            token: this.token,
            tokenSecret: this.tokenSecret,
          });
          return this.httpAgent.get(url);
        } catch (error) {
          return Promise.reject(e);
        }
      }
      return Promise.reject(e);
    }
  }

  // use for need jwt request
  async _post(url, body) {
    try {
      let res = await this.httpAgent.post(url, body);
      if (res.code === Codes.EXPIRED_ACCESS_TOKEN) {
        await this.accessTokenRenew({
          token: this.token,
          tokenSecret: this.tokenSecret,
        });
        res = await this.httpAgent.post(url, body);
      }
      return res;
    } catch (e) {
      if (e.code === Codes.EXPIRED_ACCESS_TOKEN) {
        try {
          await this.accessTokenRenew({
            token: this.token,
            tokenSecret: this.tokenSecret,
          });
          return this.httpAgent.post(url, body);
        } catch (error) {
          return Promise.reject(e);
        }
      }
      return Promise.reject(e);
    }
  }

  // use for need jwt request
  async _delete(url, body) {
    try {
      let res = await this.httpAgent.delete(url, body);
      if (res.code === Codes.EXPIRED_ACCESS_TOKEN) {
        await this.accessTokenRenew({
          token: this.token,
          tokenSecret: this.tokenSecret,
        });
        res = await this.httpAgent.delete(url, body);
      }
      return res;
    } catch (e) {
      if (e.code === Codes.EXPIRED_ACCESS_TOKEN) {
        try {
          await this.accessTokenRenew({
            token: this.token,
            tokenSecret: this.tokenSecret,
          });
          return this.httpAgent.delete(url, body);
        } catch (error) {
          return Promise.reject(e);
        }
      }
      return Promise.reject(e);
    }
  }

  // use for need jwt request
  async _put(url, body) {
    try {
      let res = await this.httpAgent.put(url, body);
      if (res.code === Codes.EXPIRED_ACCESS_TOKEN) {
        await this.accessTokenRenew({
          token: this.token,
          tokenSecret: this.tokenSecret,
        });
        res = await this.httpAgent.put(url, body);
      }
      return res;
    } catch (e) {
      if (e.code === Codes.EXPIRED_ACCESS_TOKEN) {
        try {
          await this.accessTokenRenew({
            token: this.token,
            tokenSecret: this.tokenSecret,
          });
          return this.httpAgent.put(url, body);
        } catch (error) {
          return Promise.reject(e);
        }
      }
      return Promise.reject(e);
    }
  }

  //https://hackernoon.com/how-to-improve-your-backend-by-adding-retries-to-your-api-calls-83r3udx
  async _request({ method, url, data, retries = 3, backoff = 300 }) {
    let response,
      requestRetry,
      // retryCodes = [408, 500, 502, 503, 504, 522, 524],
      retryCodes = [
        Codes.API_UNKNOWN_ERROR,
        Codes.THIRD_PARTY_API_ERROR,
        Codes.UNKNOWN_ERROR,
      ],
      options = { method, url, data };
    try {
      response = await this.httpAgent.request(options);
      // console.log(`[Communicator] _request url`, url);
      // console.log(`[Communicator] _request response`, response);
      if (response.code === Codes.EXPIRED_ACCESS_TOKEN) {
        await this.CSRFTokenRenew();
        requestRetry = true;
      }
      if (!requestRetry && response.success) return response;
      else if (
        !response.success &&
        retries > 0 &&
        retryCodes.includes(response.code)
      ) {
        console.log(`[Communicator] _request retries`, retries);
        setTimeout(() => {
          return this._request({
            method,
            url,
            data,
            retries: retries - 1,
            backoff: backoff * 2,
          });
        }, backoff);
      } else return Promise.reject(response);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  _setInfo(token, tokenSecret) {
    this.token = token;
    this.tokenSecret = tokenSecret;
    this.httpAgent.setToken(token);
    try {
      const data = decode(token);
      const time = data.exp * 1000 - Date.now() - 5000;
      if (this.tokenRenewTimeout) {
        clearTimeout(this.tokenRenewTimeout);
        this.tokenRenewTimeout = null;
      }
      this.tokenRenewTimeout = setTimeout(async () => {
        await this.accessTokenRenew({ token, tokenSecret });
      }, time);
    } catch (error) {
      this.tokenRenewTimeout = null;
    }
  }

  _setCSRFToken(token) {
    this.CSRFToken = token;
    this.httpAgent.setCSRFToken(token);
    try {
      const time = 1 * 60 * 60 * 1000;
      if (this.CSRFTokenRenewTimeout) {
        clearTimeout(this.CSRFTokenRenewTimeout);
        this.CSRFTokenRenewTimeout = null;
      }
      this.CSRFTokenRenewTimeout = setTimeout(async () => {
        await this.CSRFTokenRenew();
      }, time);
    } catch (error) {
      this.CSRFTokenRenewTimeout = null;
    }
  }

  // sendMsg(op, args, needAuth) {
  //   if (needAuth) {
  //     this.msgList.push(
  //       JSON.stringify({
  //         op,
  //         args: {
  //           ...args,
  //           token: this.CSRFToken,
  //         },
  //       })
  //     );
  //   } else {
  //     this.msgList.push(
  //       JSON.stringify({
  //         op,
  //         args,
  //       })
  //     );
  //   }
  // }

  // connectWS(callback) {
  //   const ws = new WebSocket(Config[Config.status].websocket);
  //   let interval;
  //   ws.addEventListener("open", () => {
  //     clearInterval(interval);
  //     const data = this.msgList.shift();
  //     if (data) ws.send(data);
  //     interval = setInterval(() => {
  //       const data = this.msgList.shift();
  //       if (data) ws.send(data);
  //     }, 1000);
  //   });
  //   ws.addEventListener("close", (msg) => {
  //     clearInterval(interval);
  //     console.log(
  //       "Socket is closed. Reconnect will be attempted in 1 second.",
  //       msg.reason
  //     );
  //     setTimeout(function () {
  //       this.connectWS(callback);
  //     }, 1000);
  //   });
  //   ws.addEventListener("message", (msg) => {
  //     callback(msg);
  //   });
  // }
}

export default Communicator;
