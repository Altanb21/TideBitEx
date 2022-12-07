const axios = require("axios");
class HTTPAgent {
  constructor({
    // userId,
    apiURL = "",
    apiVersion,
    apiKey,
    apiSecret,
  } = {}) {
    this.url = apiURL;
    this.apiVersion = apiVersion;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.axios = axios.create({
      headers: {
        // userId,
        "OK-ACCESS-KEY": apiKey,
      },
      baseURL: this.url + this.apiVersion,
    });
    this.rawAxios = axios.create({
      headers: {
        // userId,
        "OK-ACCESS-KEY": apiKey,
      },
      baseURL: this.url,
    });
    // this.axios.interceptors.request.use(
    //   config => {
    //     config.headers['userId'] = userId;
    //         return config;
    //     },
    //     error => {
    //         return Promise.reject(error);
    //     }
    // );
    // this.axios.defaults.headers.common["OK-ACCESS-KEY"] = apiKey;
    // this.axios.defaults.headers.common["USER-ID"] = userId;

    return this;
  }

  setInterceptor() {
    // TODO: retry, logger?
  }

  setToken(token) {
    this.axios.defaults.headers.common["token"] = token;
  }

  setCSRFToken(token) {
    this.axios.defaults.headers.common["X-CSRF-Token"] = token;
  }

  getToken() {
    try {
      const { token } = this.axios.defaults.headers.common;
      return token || null;
    } catch (e) {
      return null;
    }
  }

  _request(request) {
    return request().then((res) => {
      if (!res.data) {
        return {
          success: false,
        };
      }
      // console.log(res);
      return {
        success: res.data.success,
        data: res.data.payload,
        message: res.data.message,
        code: res.data.code,
      };
    });
  }

  get(path) {
    return this._request(() => this.axios.get(path));
  }

  post(path, body) {
    return this._request(() => this.axios.post(path, body));
  }

  delete(path, body) {
    return this._request(() => this.axios.delete(path, body));
  }

  put(path, body) {
    return this._request(() => this.axios.put(path, body));
  }

  request(options) {
    return this._request(() => this.axios(options));
  }

  rawRequest(options) {
    return this._request(() => this.rawAxios(options));
  }

  CSRFTokenRenew(options) {
    return this.axios(options);
  }

  _refreshToken() {
    //TODO:
  }
}

export default HTTPAgent;
