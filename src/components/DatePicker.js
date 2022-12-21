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
  return props.daysInMonth.map((el) => {
    let date = el
      ? new Date(`${props.selectedYear}-${props.selectedMonth + 1}-${el.date}`)
      : null;
    // console.log(
    //   `date:${date?.getTime()}`,
    //   date,
    //   `${new Date(props.selectedTime)}`,
    //   props.selectedTime
    // );
    let isSelected = date?.getTime()
      ? date.getTime() === props.selectedTime
      : false;
    return (
      <div
        className={`date-picker__day${
          // el?.date === props.selectedDate ? " selected" : ""
          isSelected ? " selected" : ""
        }${el?.disable ? " disabled" : ""}`}
        onClick={() => {
          if (el?.date && !el?.disable) props.selectDate(el);
        }}
      >{`${el?.date !== undefined ? el.date : " "}`}</div>
    );
  });
};

const DatePicker = (props) => {
  // const [selectedDate, setSelectedDate] = useState(props.date.getDate());
  //   const [selectedDay, setSelectedDay] = useState(props.date.getDay()); // 0~6
  const [selectedMonth, setSelectedMonth] = useState(props.date.getMonth()); // 0 (January) to 11 (December).
  const [selectedYear, setSelectedYear] = useState(props.date.getFullYear());
  const [openDates, setOpenDates] = useState(false);

  const firstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = (year, month) => {
    let minDate = props.minDate,
      maxDate = props.maxDate;
    let day = firstDayOfMonth(year, month);
    let dateLength = new Date(year, month + 1, 0).getDate();
    let dates = [];
    for (let i = 0; i < dateLength; i++) {
      let dateTime = new Date(`${year}-${month + 1}-${i + 1}`).getTime();
      let date = {
        date: i + 1,
        time: dateTime,
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
      dates.push(date);
    }
    dates = Array.apply(null, Array(day)).concat(dates);
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
    (el) => {
      // console.log(`selectDate time`, el.time);
      // setSelectedDate(el.date);
      let newDate = new Date(el.time);
      newDate = new Date(
        `${newDate.getFullYear()}-${
          newDate.getMonth() + 1
        }-${newDate.getDate()} 08:00:00`
      );
      // console.log(
      //   `selectDate newDate`,
      //   newDate,
      //   newDate.toISOString().substring(0, 10)
      // );
      // if (
      //   (props.minDate && newDate.getTime() >= props.minDate.getDate()) ||
      //   (props.maxDate && newDate.getTime() <= props.maxDate.getDate())
      // ) {
      props.setDate(newDate);
      setOpenDates(false);
      // }
    },
    [props]
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
          <div className="date-picker__mth">{`${months[selectedMonth]} ${selectedYear}`}</div>
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
            selectedTime={new Date(formatDate(props.date)).getTime()}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            selectDate={selectDate}
          />
        </div>
      </div>
    </div>
  );
};

export default DatePicker;
