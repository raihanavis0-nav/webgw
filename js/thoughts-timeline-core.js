/* Timeline date model shared by Admin and Reader. Story publication date stays separate. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ArchiveTimeline = api;
})(typeof window === "undefined" ? null : window, function () {
  "use strict";
  var MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var SEASONS = ["spring","summer","autumn","winter"];
  var PRECISIONS = ["day","month","season","year"];
  function num(value) {
    if (value === "" || value == null) return 0;
    var n = Number(value);
    return Number.isInteger(n) ? n : NaN;
  }
  function seasonOfMonth(month) {
    if (month === 12 || month <= 2) return "winter";
    if (month <= 5) return "spring";
    if (month <= 8) return "summer";
    return "autumn";
  }
  function seasonNumber(season) {
    return {spring:3,summer:6,autumn:9,winter:12}[season] || 0;
  }
  function isValidDay(year, month, day) {
    if (!Number.isInteger(day) || day < 1 || day > 31) return false;
    var date = new Date(0);
    date.setUTCHours(0,0,0,0);
    date.setUTCFullYear(year,month-1,day);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month-1 && date.getUTCDate() === day;
  }
  function read(story) {
    story = story || {};
    var year = num(story.timelineYear);
    var month = num(story.timelineMonth);
    var day = num(story.timelineDay);
    var season = String(story.timelineSeason || "").toLowerCase();
    var precision = String(story.timelinePrecision || "").toLowerCase();
    if (!PRECISIONS.includes(precision)) {
      precision = year ? (day ? "day" : month ? "month" : season ? "season" : "year") : "";
    }
    return {enabled:story.timelineEnabled === true,year:year,month:month,day:day,
      season:season,precision:precision,legacyLabel:String(story.timelineLabel || "").trim()};
  }
  function validate(input) {
    var p = input || {};
    if (!p.enabled) return "";
    if (!Number.isInteger(p.year) || p.year < 1 || p.year > 9999) return "Choose a valid year (1–9999).";
    if (!PRECISIONS.includes(p.precision)) return "Select a date precision.";
    if (p.precision === "season" && !SEASONS.includes(p.season)) return "Select a season.";
    if (p.precision === "month" || p.precision === "day") {
      if (!Number.isInteger(p.month) || p.month < 1 || p.month > 12) return "Select a month.";
    }
    if (p.precision === "day" && !isValidDay(p.year,p.month,p.day)) return "Choose a real calendar day.";
    return "";
  }
  function caption(value) {
    var p = value && Object.prototype.hasOwnProperty.call(value, "year") ? value : read(value);
    if (!p.year) return p.legacyLabel || "Not scheduled";
    if (p.precision === "day") return p.day + " " + MONTHS[p.month-1] + " " + p.year;
    if (p.precision === "month") return MONTHS[p.month-1] + " " + p.year;
    if (p.precision === "season") return p.season.charAt(0).toUpperCase() + p.season.slice(1) + " " + p.year;
    return String(p.year);
  }
  function bucket(p) {
    if (p.precision === "season") return {key:p.season,label:p.season.charAt(0).toUpperCase()+p.season.slice(1),position:seasonNumber(p.season)*32};
    if (p.precision === "day" || p.precision === "month") {
      // Months stay precise on episode cards, while seasonal grouping
      // dramatically reduces the number of horizontal lanes.
      var season = seasonOfMonth(p.month);
      return {key:season,label:season.charAt(0).toUpperCase()+season.slice(1),position:p.month*32};
    }
    return {key:"year",label:"Year only",position:0};
  }
  function orderValue(p) {
    if (p.precision === "season") return seasonNumber(p.season)*32;
    if (p.precision === "year") return 0;
    return p.month*32 + (p.precision === "day" ? p.day : 0);
  }
  function entries(stories, seriesId, subseriesId) {
    return (Array.isArray(stories) ? stories : [])
      .filter(function (story) {
        return story && story.timelineEnabled === true && story.published !== false &&
          (!seriesId || String(story.seriesId) === String(seriesId)) &&
          (!subseriesId || String(story.subseriesId) === String(subseriesId));
      })
      .map(function (story) { return {story:story,date:read(story)}; })
      .filter(function (entry) { return !validate(entry.date) || (!entry.date.year && entry.date.legacyLabel); })
      .sort(function (a,b) {
        if (!a.date.year && b.date.year) return 1;
        if (a.date.year && !b.date.year) return -1;
        var dateDiff = (a.date.year - b.date.year) || (orderValue(a.date) - orderValue(b.date));
        if (dateDiff) return dateDiff;
        var manual = (Number(a.story.timelineOrder)||0) - (Number(b.story.timelineOrder)||0);
        if (manual) return manual;
        var storyOrder = (Number(a.story.order)||0) - (Number(b.story.order)||0);
        return storyOrder || String(a.story.title||"").localeCompare(String(b.story.title||""));
      });
  }
  function groups(items) {
    var years = [],last = null;
    (items || []).forEach(function (entry) {
      var yearKey = entry.date.year ? String(entry.date.year) : "legacy";
      if (!last || last.key !== yearKey) {
        last = {key:yearKey,label:entry.date.year ? String(entry.date.year) : "Other dates",periods:[],count:0};
        years.push(last);
      }
      last.count++;
      var period = entry.date.year ? bucket(entry.date) : {key:"legacy",label:"Unspecified",position:0};
      var current = last.periods[last.periods.length-1];
      if (!current || current.key !== period.key) {
        current = {key:period.key,label:period.label,position:period.position,items:[]};
        last.periods.push(current);
      }
      current.items.push(entry);
    });
    return years;
  }
  function patch(story, date) {
    var p = date || {};
    return Object.assign({},story,{
      timelineEnabled:!!p.enabled,
      timelineYear:p.year || 0,
      timelineMonth:(p.precision === "day" || p.precision === "month") ? p.month || 0 : 0,
      timelineDay:p.precision === "day" ? p.day || 0 : 0,
      timelineSeason:p.precision === "season" ? p.season || "" : "",
      timelinePrecision:p.precision || "year"
    });
  }
  return {MONTHS:MONTHS,SEASONS:SEASONS,PRECISIONS:PRECISIONS,read:read,validate:validate,
    caption:caption,bucket:bucket,entries:entries,groups:groups,patch:patch,isValidDay:isValidDay,num:num};
});
