import SafeMath from "./SafeMath";

export const wait = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const randomDates = (startDate, endDate) => {
  const dates = [];
  let currentDate = startDate;
  const addDays = function (days) {
    const date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
  };
  while (currentDate <= endDate) {
    const date = dateFormatter(currentDate.valueOf());
    // dates.push(`${date.month} ${date.day}`);
    dates.push(`${date.day}`);
    currentDate = addDays.call(currentDate, 1);
  }
  return dates;
};

export const randomData = (startTime, endTime) => {
  const dates = randomDates(startTime, endTime);
  const data = dates.map((date) => ({
    date,
    value: `${(Math.random() * 10).toFixed(2)}`,
  }));
  return data;
};

export const randomFixedDirectionData = (startTime, endTime) => {
  const dates = randomDates(startTime, endTime);
  const data = [];
  dates.forEach((date, index) =>
    data.push({
      date,
      value:
        index === 0
          ? `${(Math.random() * 100).toFixed(2)}`
          : Math.random() * 1 > 0.5
          ? SafeMath.plus(data[index - 1].value, (Math.random() * 1).toFixed(2))
          : SafeMath.minus(
              data[index - 1].value,
              (Math.random() * 1).toFixed(2)
            ),
    })
  );
  return data;
};

export const addressFormatter = (address, showLength = 6) => {
  if (address.length <= showLength * 2) return address;
  const prefix = address.slice(0, showLength);
  const suffix = address.slice(address.length - showLength, address.length);
  return prefix + "..." + suffix;
};

export const toDecimals = (amount, decimalLength) => {
  const splitChunck = amount.toString().split(".");
  if (splitChunck.length > 1) {
    splitChunck[1] = splitChunck[1].substring(0, decimalLength);
  }
  return splitChunck[1].length > 0
    ? `${splitChunck[0]}.${splitChunck[1]}`
    : splitChunck[0];
};

export const toFixed = (x) => {
  let e;
  if (Math.abs(x) < 1.0) {
    e = parseInt(x.toString().split("e-")[1]);
    if (e) {
      x *= Math.pow(10, e - 1);
      x = "0." + new Array(e).join("0") + x.toString().substring(2);
    }
  } else {
    e = parseInt(x.toString().split("+")[1]);
    if (e > 20) {
      e -= 20;
      x /= Math.pow(10, e);
      x += new Array(e + 1).join("0");
    }
  }
  return x;
};

export const formateNumber = (number, decimalLength = 2) => {
  const _number = SafeMath.gte(number, 1.0e63)
    ? SafeMath.div(number, 1.0e63)
    : SafeMath.gte(number, 1.0e60)
    ? SafeMath.div(number, 1.0e60)
    : SafeMath.gte(number, 1.0e57)
    ? SafeMath.div(number, 1.0e57)
    : SafeMath.gte(number, 1.0e54)
    ? SafeMath.div(number, 1.0e54)
    : SafeMath.gte(number, 1.0e51)
    ? SafeMath.div(number, 1.0e51)
    : SafeMath.gte(number, 1.0e48)
    ? SafeMath.div(number, 1.0e48)
    : SafeMath.gte(number, 1.0e45)
    ? SafeMath.div(number, 1.0e45)
    : SafeMath.gte(number, 1.0e42)
    ? SafeMath.div(number, 1.0e42)
    : SafeMath.gte(number, 1.0e39)
    ? SafeMath.div(number, 1.0e39)
    : SafeMath.gte(number, 1.0e36)
    ? SafeMath.div(number, 1.0e36)
    : SafeMath.gte(number, 1.0e33)
    ? SafeMath.div(number, 1.0e33)
    : SafeMath.gte(number, 1.0e30)
    ? SafeMath.div(number, 1.0e30)
    : SafeMath.gte(number, 1.0e27)
    ? SafeMath.div(number, 1.0e27)
    : SafeMath.gte(number, 1.0e24)
    ? SafeMath.div(number, 1.0e24)
    : SafeMath.gte(number, 1.0e21)
    ? SafeMath.div(number, 1.0e21)
    : SafeMath.gte(number, 1.0e18)
    ? SafeMath.div(number, 1.0e18)
    : SafeMath.gte(number, 1.0e15)
    ? SafeMath.div(number, 1.0e15)
    : SafeMath.gte(number, 1.0e12)
    ? SafeMath.div(number, 1.0e12)
    : SafeMath.gte(number, 1.0e9)
    ? SafeMath.div(number, 1.0e9)
    : SafeMath.gte(number, 1.0e6)
    ? SafeMath.div(number, 1.0e6)
    : SafeMath.gte(number, 1.0e3)
    ? SafeMath.div(number, 1.0e3)
    : number;
  const splitChunck = _number.toString().split(".");

  return SafeMath.gte(number, 1.0e63) // 63 Zeroes for Vigintillion
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }vt`
    : SafeMath.gte(number, 1.0e60) // 60 Zeroes for Novemdecillion
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }ndc`
    : SafeMath.gte(number, 1.0e57) // 57 Zeroes for Octodecillion
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }otdc`
    : SafeMath.gte(number, 1.0e54) // 54 Zeroes for Septendecillion
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }stdc`
    : SafeMath.gte(number, 1.0e51) // 51 Zeroes for Sexdecillion
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }sdc`
    : SafeMath.gte(number, 1.0e48) // 48 Zeroes for Quindecillion
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }qdc`
    : SafeMath.gte(number, 1.0e45) // 45 Zeroes for Quattuordecillion
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }qtdc`
    : SafeMath.gte(number, 1.0e42) // 42 Zeroes for Tredecillion
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }tdc`
    : SafeMath.gte(number, 1.0e39) // 39 Zeroes for Duodecillion
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }ddc`
    : SafeMath.gte(number, 1.0e36) // 36 Zeroes for Undecillion
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }udc`
    : SafeMath.gte(number, 1.0e33) // 33 Zeroes for Decillion
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }dc`
    : SafeMath.gte(number, 1.0e30) // 30 Zeroes for Nonillion
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }nn`
    : SafeMath.gte(number, 1.0e27) // 27 Zeroes for Octillion
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }ot`
    : SafeMath.gte(number, 1.0e24) // 24 Zeroes for septillions
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }sp`
    : SafeMath.gte(number, 1.0e21) // 21 Zeroes for sextillions
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }st`
    : // 18 Zeroes for quintillions
    SafeMath.gte(number, 1.0e18)
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }qt`
    : // 15 Zeroes for quadrillions
    SafeMath.gte(number, 1.0e15)
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }qd`
    : // 12 Zeroes for tillions
    SafeMath.gte(number, 1.0e12)
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }t`
    : // Nine Zeroes for Billions
    SafeMath.gte(number, 1.0e9)
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }b`
    : // Six Zeroes for Millions
    SafeMath.gte(number, 1.0e6)
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }m`
    : // Three Zeroes for Thousands
    SafeMath.gte(number, 1.0e3)
    ? `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }k`
    : `${splitChunck[0]}.${
        splitChunck[1] ? splitChunck[1].substring(0, decimalLength) : "00"
      }`;
};

export const numberWithCommas = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const padDecimal = (n, length) => {
  let padR = n.toString();
  for (let i = padR.length; i < length; i++) {
    padR += "0";
  }
  return padR;
};

export const formateDecimal = (
  amount,
  { maxLength = 18, decimalLength = 2, pad = false, withSign = false }
) => {
  try {
    let _amount = parseFloat(amount);
    let formatAmount;
    // 非數字
    if (isNaN(_amount) || (_amount !== 0 && !_amount)) formatAmount = "--";
    else {
      formatAmount = _amount;
      // 以小數點為界分成兩部份
      const splitChunck = _amount.toString().split(".");
      // 限制總長度
      if (splitChunck[0].length < maxLength) {
        // 小數點前的長度不超過 maxLength
        const maxDecimalLength = maxLength - splitChunck[0].length;
        const _decimalLength =
          maxDecimalLength < decimalLength ? maxDecimalLength : decimalLength;
        if (splitChunck.length === 1) splitChunck[1] = "0";
        // 限制小數位數
        splitChunck[1] = splitChunck[1].substring(0, _decimalLength);
        // 小數補零
        if (pad) {
          splitChunck[1] = padDecimal(splitChunck[1], _decimalLength);
        }
        formatAmount =
          splitChunck[1].length > 0
            ? `${splitChunck[0]}.${splitChunck[1]}`
            : splitChunck[0];
      } else {
        // 小數點前的長度超過 maxLength
        // formatAmount = formateNumber(amount, decimalLength);
      }
      if (withSign && amount > 0) formatAmount = `+${formatAmount}`;
    }
    return formatAmount;
  } catch (error) {
    console.log(`formateDecimal error`, error, amount);
    return amount;
  }
};

export const randomID = (n) => {
  var ID = "";
  var text = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  n = parseInt(n);
  if (!(n > 0)) {
    n = 8;
  }
  while (ID.length < n) {
    ID = ID.concat(text.charAt(parseInt(Math.random() * text.length)));
  }
  return ID;
};

export const openInNewTab = (url) => {
  const newWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (newWindow) newWindow.opener = null;
};

export const to = (promise) => {
  return promise
    .then((data) => {
      return [null, data];
    })
    .catch((err) => [err, null]);
};

const monthNames = [
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

export const pad = (n) => {
  return n < 10 ? "0" + n : n;
};

export const dateFormatter = (timestamp, t24) => {
  const dateTime = new Date(timestamp);
  const date = dateTime.getDate();
  const month = dateTime.getMonth();
  const year = dateTime.getFullYear();
  let hours = dateTime.getHours();
  const minutes = dateTime.getMinutes();
  const seconds = dateTime.getSeconds();
  // let suffix = "AM";
  // if (!t24 && hours - 12 > 0) {
  //   hours -= 12;
  //   suffix = "PM";
  // }
  const mmddyyyykkmm =
    monthNames[month] +
    " " +
    pad(date) +
    ", " +
    year +
    " " +
    hours +
    ":" +
    pad(minutes);
  // +
  // " " +
  // suffix;
  return {
    text: mmddyyyykkmm,
    date: monthNames[month] + " " + pad(date) + ", " + year,
    time:
      // !t24
      // ? hours + ":" + pad(minutes) + ":" + pad(seconds) + " " + suffix
      // :
      hours + ":" + pad(minutes) + ":" + pad(seconds),
    month: monthNames[month],
    day: pad(date),
    year: year,
  };
};

export const sliceData = (data, splitLength = 64) => {
  let _data = data.toString().replace("0x", "");

  let array = [];
  for (let n = 0; n < _data.length; n += splitLength) {
    let _array = _data.slice(n, n + splitLength);
    array.push(_array);
  }
  return array;
};

/**
 * https://www.codegrepper.com/code-examples/javascript/hex+to+ascii+function+javascript
 * @param {string | hex} hex
 * @returns
 */
export const hexToAscii = (hex) => {
  let _hex = hex.toString().replace("0x", "");
  let str = "";
  for (let n = 0; n < _hex.length; n += 2) {
    if (_hex.substr(n, 2) === "00") continue;
    let _str = String.fromCharCode(parseInt(_hex.substr(n, 2), 16));
    str += _str;
  }
  return str;
};

export const toggleSidebar = (toggle = true) => {
  console.log(`toggleSidebar toggle`, toggle);
  if (
    Array.from(
      document.querySelector(".ui.sidebar.vertical").classList
    ).includes("visible")
  ) {
    document.querySelector(".ui.sidebar.vertical").classList.remove("uncover");
    document.querySelector(".ui.sidebar.vertical").classList.remove("visible");
    document.querySelector("#pusher.pusher").classList.remove("dimmed");
    document.querySelector(".ui.left.sidebar ~ .pusher").style.transform =
      "translate3d(0, 0, 0)";
  } else if (toggle) {
    document.querySelector(".ui.sidebar.vertical").classList.add("uncover");
    document.querySelector(".ui.sidebar.vertical").classList.add("visible");
    document.querySelector("#pusher.pusher").classList.add("dimmed");
    document.querySelector(
      ".ui.visible.left.sidebar ~ .pusher"
    ).style.transform = "translate3d(145px, 0, 0)";
  }
};

export const addPushableContainer = () => {};
