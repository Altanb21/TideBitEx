import React, { useCallback, useState } from "react";

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const PopulateDates = (props) => {
  return props.daysInMonth.map((el) => (
    <div
      className={`date-picker__day${
        el?.date === props.selectedDate ? " selected" : ""
      }${el?.disable ? " disabled" : ""}`}
      onClick={() => {
        if (el?.date && !el?.disable) props.selectDate(el?.date);
      }}
    >{`${el?.date !== undefined ? el.date : " "}`}</div>
  ));
};

const DatePicker = (props) => {
  const [selectedDate, setSelectedDate] = useState(props.date.getDate());
  //   const [selectedDay, setSelectedDay] = useState(props.date.getDay()); // 0~6
  const [selectedMonth, setSelectedMonth] = useState(props.date.getMonth()); // 0 (January) to 11 (December).
  const [selectedYear, setSelectedYear] = useState(props.date.getFullYear());
  const [openDates, setOpenDates] = useState(false);

  const firstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = (year, month) => {
    // let currentDate = new Date();
    // currentDate = new Date(
    //   `${currentDate.getFullYear()}-${
    //     currentDate.getMonth() + 1
    //   }-${currentDate.getDate()}`
    // );
    let minDate = props.minDate,
      maxDate = props.maxDate;
    let day = firstDayOfMonth(year, month);
    console.log(`daysInMonth day`, day);
    let dateLength = new Date(year, month + 1, 0).getDate();
    console.log(`daysInMonth dateLength`, dateLength);
    let dates = [];
    for (let i = 0; i < dateLength; i++) {
      let dateTime = new Date(`${year}-${month + 1}-${i + 1}`).getTime();
      let date = {
        date: i + 1,
        disable: minDate
          ? dateTime < minDate.getTime()
            ? true
            : maxDate
            ? dateTime > maxDate.getTime()
              ? true
              : false
            : false
          : maxDate
          ? dateTime > maxDate.getTime()
            ? true
            : false
          : false,
      };
      console.log(`date`, date);
      dates.push(date);
    }
    console.log(`daysInMonth dates[${dates.length}]`, dates);
    dates = Array.apply(null, Array(day - 1)).concat(dates);
    console.log(`daysInMonth dates[${dates.length}]`, dates);
    return dates;
  };

  const formatDate = (obj) => {
    let day = obj.getDate();
    if (day < 10) {
      day = "0" + day;
    }
    let month = obj.getMonth() + 1;
    if (month < 10) {
      month = "0" + month;
    }
    let year = obj.getFullYear();
    return year + "/" + month + "/" + day;
  };

  const goToNextMonth = useCallback(() => {
    let month = selectedMonth;
    let year = selectedYear;
    month++;
    if (month > 11) {
      month = 0;
      year++;
    }
    setSelectedMonth(month);
    setSelectedYear(year);
    // props.setDate(new Date(`${year}-${month}-${selectedDate}`));
  }, [selectedMonth, selectedYear]);

  const goToPrevMonth = useCallback(() => {
    let month = selectedMonth;
    let year = selectedYear;
    month--;
    if (month < 0) {
      month = 11;
      year--;
    }
    setSelectedMonth(month);
    setSelectedYear(year);
    // props.setDate(new Date(`${year}-${month}-${selectedDate}`));
  }, [selectedMonth, selectedYear]);

  const selectDate = useCallback(
    (date) => {
      setSelectedDate(date);
      let newDate = new Date(`${selectedYear}-${selectedMonth}-${date}`);
      if (
        (props.minDate && newDate.getTime() >= props.minDate.getDate()) ||
        (props.maxDate && newDate.getTime() <= props.maxDate.getDate())
      ) {
        props.setDate(newDate);
        setOpenDates(false);
      }
    },
    [props, selectedMonth, selectedYear]
  );

  return (
    <div className={`date-picker${openDates ? " active" : ""}`}>
      <div
        className="date-picker__toggle"
        onClick={() => {
          setOpenDates((prev) => !prev);
        }}
      >
        <div className="date-picker__selected-date">
          {formatDate(props.date)}
        </div>
        <div className="date-picker__toggle--icon">
          <img src="/img/calender.svg" alt="" />
        </div>
      </div>
      <div className="date-picker__dates">
        <div className="date-picker__month">
          <div className="date-picker__mth">{`${months[selectedMonth]} ${selectedDate}`}</div>
          <div
            className="date-picker__arrows prev-mth"
            onClick={goToPrevMonth}
          ></div>
          <div
            className="date-picker__arrows next-mth"
            onClick={goToNextMonth}
          ></div>
        </div>
        <div className="date-picker__label">
          <div className="date-picker__day">S</div>
          <div className="date-picker__day">M</div>
          <div className="date-picker__day">T</div>
          <div className="date-picker__day">W</div>
          <div className="date-picker__day">T</div>
          <div className="date-picker__day">F</div>
          <div className="date-picker__day">S</div>
        </div>
        <div className="date-picker__days">
          <PopulateDates
            daysInMonth={daysInMonth(selectedYear, selectedMonth)}
            selectedDate={selectedDate}
            selectDate={selectDate}
          />
        </div>
      </div>
    </div>
  );
};

export default DatePicker;
