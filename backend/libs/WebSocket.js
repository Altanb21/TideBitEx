const ws = require("ws");

const HEART_BEAT_TIME = 25000;

class WebSocket {
  wsReConnectTimeout;
  url;
  ws;
  options;
  heartBeatTime;
  connection_resolvers = [];
  constructor({ logger }) {
    this.logger = logger;
    return this;
  }

  heartbeat() {
    clearTimeout(this.pingTimeout);
    this.pingTimeout = setTimeout(() => {
      this.ws.ping();
    }, this.heartBeatTime);
  }

  eventListener() {
    this.ws.on("pong", () => this.heartbeat());
    this.ws.on(
      "close",
      async (code, reason) =>
        await this.reInitWs({ type: "close", code, reason })
    );
    this.ws.on(
      "error",
      async (error) => await this.reInitWs({ type: "error", error })
    );
  }

  async reInitWs({ type, error, code, reason }) {
    clearTimeout(this.wsReConnectTimeout);
    if (type === "close")
      this.logger.debug(
        `[${new Date().toLocaleString()}][Websocket] this.ws.on("close")`,
        code,
        reason
      );
    else if (type === "error")
      this.logger.debug(
        `[${new Date().toLocaleString()}][Websocket] this.ws.on("close")`,
        error
      );
    this.wsReConnectTimeout = setTimeout(async () => {
      this.logger.debug(
        `[${new Date().toLocaleString()}][Websocket] called init`
      );
      await this.init();
    }, 1000);
    // }
  }

  send(data, cb) {
    this.connection_resolvers.push({ data, cb });
    this.sendDataFromQueue();
  }

  sendDataFromQueue() {
    if (this.ws) {
      if (this.ws.readyState === ws.OPEN) {
        const obj = this.connection_resolvers.shift();
        if (obj) {
          try {
            this.ws.send(obj.data, obj.cb);
          } catch (error) {
            this.logger.debug(
              `[${new Date().toLocaleString()}][Websocket] this.ws.send`,
              obj.data,
              obj.cb
            );
          }
          this.sendDataFromQueue();
        }
      } else {
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.sendDataFromQueue(), 1500);
      }
    }
  }

  init({ url, heartBeat = HEART_BEAT_TIME, options, listener }) {
    try {
      if (!url && !this.url) {
        throw new Error("Invalid input");
      }
      if (url) this.url = url;
      if (options) this.options = { ...options };
      if (listener) this.listener = listener;
      this.heartBeatTime = heartBeat;
      if (!!this.options) this.ws = new ws(this.url, this.options);
      else this.ws = new ws(this.url);
      this.ws.onmessage = this.listener;
      this.eventListener();
      return new Promise((resolve) => {
        this.ws.onopen = (r) => {
          this.logger.debug(
            `[${new Date().toLocaleString()}][Websocket] this.ws.onopen: this.url${
              this.url
            }`
          );
          this.heartbeat();
          this.sendDataFromQueue();
          return resolve(r);
        };
      });
    } catch (e) {
      this.logger.debug(
        `[${new Date().toLocaleString()}][Websocket] init error:`,
        e
      );
      clearTimeout(this.wsReConnectTimeout);
      this.wsReConnectTimeout = setTimeout(async () => {
        await this.init({ url, heartBeat, options, listener });
      }, 1000);
    }
  }
}

module.exports = WebSocket;
