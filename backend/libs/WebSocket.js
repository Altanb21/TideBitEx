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

  init({ url, heartBeat = HEART_BEAT_TIME, options }) {
    try {
      if (!url && !this.url) throw new Error("Invalid input");
      if (url) this.url = url;
      if (options) this.options = { ...options };
      this.heartBeatTime = heartBeat;
      this.logger.log("[WebSocket] connect url", this.url);
      if (!!this.options) {
        this.ws = new ws(this.url, this.options);
      } else this.ws = new ws(this.url);

      return new Promise((resolve) => {
        this.ws.onopen = (r) => {
          this.logger.log("[WebSocket] status", `onopen`);
          this.heartbeat();
          this.eventListener();
          return resolve(r);
        };
      });
    } catch (e) {
      console.log(`WebSocket init error:`, e);
      clearTimeout(this.wsReConnectTimeout);
      this.wsReConnectTimeout = setTimeout(async () => {
        await this.init({ url: this.url });
      }, 1000);
    }
  }

  eventListener() {
    this.ws.on("pong", () => this.heartbeat());
    this.ws.on("close", async (event) => await this.clear(event));
    this.ws.on("error", async (err) => {
      this.logger.error("custom WebSocket", err);
      clearTimeout(this.wsReConnectTimeout);
      this.wsReConnectTimeout = setTimeout(async () => {
        await this.init();
      }, 1000);
    });
  }

  heartbeat() {
    clearTimeout(this.pingTimeout);
    this.pingTimeout = setTimeout(() => {
      this.logger.debug("heartbeat");
      this.ws.ping();
    }, this.heartBeatTime);
  }

  async clear(event) {
    clearTimeout(this.wsReConnectTimeout);
    if (event.wasClean) {
      this.logger.debug(
        `[WebSocket][close] Connection closed cleanly, code=${event.code} reason=${event.reason}`
      );
      clearTimeout(this.pingTimeout);
    } else {
      // e.g. server process killed or network down
      // event.code is usually 1006 in this case
      this.logger.error("[WebSocket][close] Connection died");
      this.wsReConnectTimeout = setTimeout(async () => {
        await this.init({ url: this.url });
      }, 1000);
    }
  }

  send(data, cb) {
    this.connection_resolvers.push({ data, cb });
    this.sendDataFromQueue();
  }

  sendDataFromQueue() {
    if (this.ws) {
      if (this.ws.readyState === 1) {
        const obj = this.connection_resolvers.shift();
        if (obj) {
          this.ws.send(obj.data, obj.cb);
          this.sendDataFromQueue();
        }
      } else {
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.sendDataFromQueue(), 1500);
      }
    }
  }

  set onmessage(cb) {
    this.ws.onmessage = cb;
  }
}

module.exports = WebSocket;
