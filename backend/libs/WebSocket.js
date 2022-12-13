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
      // this.logger.debug("heartbeat");
      this.ws.ping();
    }, this.heartBeatTime);
  }

  eventListener() {
    this.ws.on("pong", () => this.heartbeat());
    this.ws.on(
      "close",
      async (code, reason) => await this.clear({ type: "close", code, reason })
    );
    this.ws.on(
      "error",
      async (error) => await this.clear({ type: "error", error })
    );
  }

  async clear({ type, error, code, reason }) {
    clearTimeout(this.wsReConnectTimeout);
    if (type === "close")
      this.logger.debug(
        `Websocket] this.ws.on("close")`,
        new Date().toLocaleString(),
        code,
        reason
      );
    else if (type === "error")
      this.logger.debug(
        `Websocket] this.ws.on("error")`,
        new Date().toLocaleString(),
        error
      );
    // -- if type is close params is code and reson instead of event
    // if (event.wasClean) {
    //   this.logger.debug(
    //     `[WebSocket][close] Connection closed cleanly, code=${event.code} reason=${event.reason}`,
    //     new Date().toLocaleString()
    //   );
    //   clearTimeout(this.pingTimeout);
    // } else {
    // e.g. server process killed or network down
    // event.code is usually 1006 in this case
    this.wsReConnectTimeout = setTimeout(async () => {
      this.logger.debug(`[Websocket] called init`, new Date().toLocaleString());
      await this.init();
    }, 1000);
    // }
  }

  send(data, cb) {
    this.logger.debug(`webSocket custom send is called`);
    this.connection_resolvers.push({ data, cb });
    this.sendDataFromQueue();
  }

  sendDataFromQueue() {
    this.logger.debug(`webSocket sendDataFromQueue is called`);
    if (this.ws) {
      this.logger.debug(
        `this.connection_resolvers[${this.connection_resolvers.length}]`
      );
      if (this.ws.readyState === ws.OPEN) {
        const obj = this.connection_resolvers.shift();
        if (obj) {
          this.logger.debug(`this.ws.send`, obj.data);
          this.ws.send(obj.data, obj.cb);
          this.sendDataFromQueue();
        }
      } else {
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.sendDataFromQueue(), 1500);
      }
    }
  }

  /**
   * @param {{ (event: any): void; (event: any): void; (event: any): void; }} cb
   */
  set onmessage(cb) {
    this.logger.debug(`webSocket set onmessage`)
    this.cb = cb || this.cb;
    if (this.ws) this.ws.onmessage = cb;
  }

  init({ url, heartBeat = HEART_BEAT_TIME, options }) {
    this.logger.debug(
      `init is called url & options`,
      url,
      options,
      new Date().toLocaleString()
    );
    try {
      // ++ TODO #983 2022/12/09 NEW LEAD 👇
      if (!url && !this.url) {
        this.logger.debug(`Invalid input`, new Date().toLocaleString());
        throw new Error("Invalid input");
      }
      if (url) this.url = url;
      if (options) this.options = { ...options };
      this.heartBeatTime = heartBeat;
      if (Math.random() < 0.9) {
        this.logger.debug(`create test error`, new Date().toLocaleString());
        throw new Error("test");
      }
      if (!!this.options) {
        this.ws = new ws(this.url, this.options);
      } else this.ws = new ws(this.url);
      this.eventListener();
      // this.logger.debug(`[WebSocket] this.ws:`, this.ws);
      return new Promise((resolve) => {
        this.ws.onopen = (r) => {
          this.logger.debug(
            `[WebSocket] this.ws.onopen:`,
            this.url,
            new Date().toLocaleString()
          );
          this.heartbeat();
          this.sendDataFromQueue();
          return resolve(r);
        };
      });
    } catch (e) {
      this.logger.debug(`[WebSocket] init error:`, e);
      clearTimeout(this.wsReConnectTimeout);
      this.wsReConnectTimeout = setTimeout(async () => {
        this.logger.debug(
          `[Websocket] recursive init`,
          new Date().toLocaleString()
        );
        await this.init({ url, heartBeat, options });
      }, 1000);
    }
  }
}

module.exports = WebSocket;
