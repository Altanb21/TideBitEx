const Database = require("../constants/Database");
const SafeMath = require("./SafeMath");
// const path = require("path");
const Utils = require("./Utils");

const users = {};
let userGCInterval = 86400 * 1000;

// let adminUsers;
class TideBitLegacyAdapter {
  static usersGC() {
    // ++ removeUser //++ gc behavior （timer 清理）
    Object.keys(users).forEach((key) => {
      if (users[key].ts > userGCInterval) {
        delete users[key];
      }
    });
  }

  // static getAdminUsers(config) {
  //   try {
  //     const p = path.join(config.base.TideBitLegacyPath, "config/roles.yml");
  //     const users = Utils.fileParser(p);
  //     const formatUsers = users.map((user) => {
  //       return {
  //         ...user,
  //       };
  //     });
  //     console.log(`-*-*-*-*- getAdminUsers -*-*-*-*-`, formatUsers);
  //     return formatUsers;
  //   } catch (error) {
  //     console.error(error);
  //     process.exit(1);
  //   }
  // }

  static async parseMemberId(header, redisDomain) {
    let peatioSession = header?.peatioSession
        ? header.peatioSession
        : Utils.peatioSession(header),
      XSRFToken = header?.XSRFToken
        ? header.XSRFToken
        : Utils.XSRFToken(header),
      memberId = header?.memberId > -1 ? header.memberId : -1;

    if (peatioSession && memberId === -1) {
      try {
        // console.log(
        //   `!!! [TideBitLegacyAdapter parseMemberId] getMemberIdFromRedis`,
        //   redisDomain
        // );
        memberId = await Utils.getMemberIdFromRedis({
          redisDomain,
          peatioSession,
        });
      } catch (error) {
        console.error(
          `[TideBitLegacyAdapter] parseMemberId getMemberIdFromRedis error`,
          error
        );
      }
    }
    return { peatioSession, memberId, XSRFToken };
  }

  // ++ middleware
  static async getMemberId(ctx, next, redisDomain, database) {
    let peatioSession = Utils.peatioSession(ctx.header);

    if (
      (ctx.url === "/accounts" || ctx.url === "/settings") &&
      peatioSession !== ctx.session.token
    ) {
      const parsedResult = await TideBitLegacyAdapter.parseMemberId(
        ctx.header,
        redisDomain
      );
      if (parsedResult.memberId  && parsedResult.memberId !== -1) {
        let member;
        member = await database.getMemberByCondition({
          id: parsedResult.memberId,
        });
        ctx.session.token = parsedResult.peatioSession;
        ctx.session.member = {
          ...member,
        };
      }
    }
    if (
      ctx.url === "/signout" ||
      (ctx.url === "/signin" && peatioSession !== ctx.session.token) // -- redirect
    ) {
      delete ctx.session.token;
      delete ctx.session.member;
    }
    return next();
  }

  static peatioOrderBody({ header, body }) {
    let obj = {};
    if (body.kind === Database.ORDER_KIND.BID) {
      obj["order_bid[ord_type]"] = body.ordType;
      obj["order_bid[origin_volume]"] = body.volume;
      if (body.ordType === Database.ORD_TYPE.LIMIT) {
        obj["order_bid[price]"] = body.price;
        obj["order_bid[total]"] = SafeMath.mult(body.price, body.volume);
      }
    } else if (body.kind === Database.ORDER_KIND.ASK) {
      obj["order_ask[ord_type]"] = body.ordType;
      obj["order_ask[origin_volume]"] = body.volume;
      if (body.ordType === Database.ORD_TYPE.LIMIT) {
        obj["order_ask[price]"] = body.price;
        obj["order_ask[total]"] = SafeMath.mult(body.price, body.volume);
      }
    }
    const data = Object.keys(obj)
      .map((key) => `${key}=${encodeURIComponent(obj[key])}`)
      .join("&");

    return data;
  }
}

module.exports = TideBitLegacyAdapter;
