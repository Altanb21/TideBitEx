class TideBitWS {
  currentUser;
  currentMarket;
  timeout;
  connection_resolvers = [];
  wsReConnectTimeout;
  constructor() {
    return this;
  }

  setCurrentUser(userInfo) {
    this.currentUser = userInfo;
    // console.log(`setCurrentUser userInfo`, userInfo)
    this.send({
      op: "userStatusUpdate",
      args: {
        ...userInfo,
      },
    });
  }

  setCurrentMarket(market, lotSz) {
    this.currentMarket = market;
    this.send({
      op: "switchMarket",
      args: {
        market,
        lotSz,
      },
    });
  }

  registerMarket(market) {
    this.send({
      op: "registerMarket",
      args: {
        market,
      },
    });
  }
  clear(msg) {
    // console.log(
    //   "Socket is closed. Reconnect will be attempted in 1 second.",
    //   msg.reason
    // );
    clearTimeout(this.wsReConnectTimeout);
    // in case connection is broken
    if (msg.code === 1006 || msg.reason === "" || msg.wasClean === false)
      this.wsReConnectTimeout = setTimeout(async () => {
        await this.init({ url: this.url });
      }, 1000);
  }

  eventListener() {
    if (this.ws) {
      this.ws.onclose = (msg) => this.clear(msg);
      this.ws.onerror = async (err) => {
        // console.error(`[TideBitWS] this.ws.onerror`, err);
        clearTimeout(this.wsReConnectTimeout);
        this.wsReConnectTimeout = setTimeout(async () => {
          await this.init({ url: this.url });
        }, 1000);
      };
    }
  }

  send(data) {
    this.connection_resolvers
      // ++ TODO avoid duplicate event
      // .filter((d) => {
      //   let result;
      //   if (data.op === "registerMarket") {
      //     result = d.args.market !== data.args.market;
      //   } else {
      //     result = d.op !== data.op;
      //   }
      //   return result;
      // })
      .push(data);
    // console.log(`this.connection_resolvers`, this.connection_resolvers);
    this.sendDataFromQueue();
  }

  sendDataFromQueue() {
    if (this.ws) {
      if (this.ws.readyState === 1) {
        const data = this.connection_resolvers.shift();
        if (data) {
          this.ws.send(JSON.stringify(data));
          this.sendDataFromQueue();
        }
      } else {
        clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.sendDataFromQueue(), 1500);
      }
    }
  }

  /**
   * @param {(msg: any) => void} cb
   */
  set onmessage(cb) {
    this.cb = cb || this.cb;
    if (this.ws) this.ws.onmessage = cb;
  }

  init({ url }) {
    try {
      if (!url) throw new Error("Invalid input");
      this.url = url;
      this.ws = new WebSocket(url);
      this.eventListener();
      this.onmessage = this.cb;
      return new Promise((resolve) => {
        if (this.ws)
          this.ws.onopen = (r) => {
            // console.log("Socket is open");
            if (this.currentMarket) {
              this.setCurrentMarket(this.currentMarket);
            }
            if (this.currentUser) {
              this.setCurrentUser(this.currentUser);
            }
            return resolve(r);
          };
      });
    } catch (e) {
      // console.log(`middleman ws init error:`, e);
      clearTimeout(this.wsReConnectTimeout);
      this.wsReConnectTimeout = setTimeout(async () => {
        await this.init({ url: this.url });
      }, 1000);
    }
  }
}

export default TideBitWS;
