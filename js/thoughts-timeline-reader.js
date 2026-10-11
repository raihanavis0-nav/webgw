/* Editorial zig-zag Timeline for Reader; text-first, keyboard friendly, zero dependencies. */
(function () {
  "use strict";
  var yearChoice = "all", newest = false, current = null, resizeBound = false, lastColumns = 0;
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = String(text);
    return node;
  }
  function columns() {
    return window.innerWidth < 700 ? 1 : window.innerWidth < 1080 ? 2 : 3;
  }
  function render(options) {
    current = options;
    var T = window.ArchiveTimeline;
    var host = options && options.host;
    if (!T || !host) return 0;
    host.replaceChildren();
    var items = T.entries(options.stories,options.seriesId,options.subseriesId);
    if (!items.length) return 0;
    lastColumns = columns();

    var heading = el("div","timeline-wave-toolbar");
    var count = el("span","timeline-wave-count",items.length + (items.length === 1 ? " episode" : " episodes") + " in story chronology");
    heading.appendChild(count);
    var controls = el("div","timeline-wave-controls");
    var selector = el("select","timeline-wave-select");
    selector.setAttribute("aria-label","Filter timeline by year");
    var all = el("option","", "All years"); all.value = "all"; selector.appendChild(all);
    var validYears = Array.from(new Set(items.map(function (item) { return item.date.year ? String(item.date.year) : "legacy"; })));
    validYears.forEach(function (year) {
      var option = el("option","",year === "legacy" ? "Other dates" : year);
      option.value = year; selector.appendChild(option);
    });
    if (yearChoice !== "all" && !validYears.includes(yearChoice)) yearChoice = "all";
    selector.value = yearChoice;
    selector.addEventListener("change",function () {yearChoice = selector.value; render(current);});
    var order = el("button","timeline-wave-sort",newest ? "Newest first ↓" : "Oldest first ↑");
    order.type = "button";
    order.setAttribute("aria-label","Toggle chronological order");
    order.addEventListener("click",function () {newest = !newest;render(current);});
    controls.appendChild(selector); controls.appendChild(order); heading.appendChild(controls);
    host.appendChild(heading);

    if (newest) items.reverse();
    var grouped = T.groups(items);
    if (yearChoice !== "all") grouped = grouped.filter(function (g) { return g.key === yearChoice; });
    grouped.forEach(function (year,index) {
      var detail = el("details","timeline-wave-year");
      detail.open = true;
      var summary = el("summary","timeline-wave-year-head");
      var label = el("span","timeline-wave-year-label",year.label);
      var length = el("span","timeline-wave-year-count",year.count + (year.count === 1 ? " episode" : " episodes"));
      summary.appendChild(label);summary.appendChild(length);
      var chevron = el("span","timeline-wave-chevron","⌄");chevron.setAttribute("aria-hidden","true");
      summary.appendChild(chevron);
      detail.appendChild(summary);
      var body = el("div","timeline-wave-year-body");
      var laneNo = 0;
      year.periods.forEach(function (period) {
        var periodLanes = [];
        var stack = el("section","timeline-wave-period");
        var periodLabel = el("h3","timeline-wave-period-title",period.label);
        stack.appendChild(periodLabel);
        for (var i=0;i<period.items.length;i+=lastColumns) {
          var chunk = period.items.slice(i,i+lastColumns);
          var row = el("ol","timeline-wave-lane");
          row.classList.add(laneNo%2 ? "is-reverse" : "is-forward");
          row.style.setProperty("--lane-columns",String(lastColumns));
          chunk.forEach(function (entry) {
            var story = entry.story;
            var cell = el("li","timeline-wave-cell");
            var card = el("a","timeline-wave-card");
            card.href = options.storyUrl(story.slug);
            var top = el("span","timeline-wave-card-top");
            top.appendChild(el("span","timeline-wave-card-date",T.caption(entry.date)));
            var epNo = Number(story.order);
            if (Number.isInteger(epNo) && epNo>0) top.appendChild(el("span","timeline-wave-card-number","EP. " + String(epNo).padStart(2,"0")));
            card.appendChild(top);
            card.appendChild(el("strong","timeline-wave-card-name",story.title || "Untitled episode"));
            var sub = options.subseriesById && options.subseriesById(story.subseriesId);
            var series = options.seriesById && options.seriesById(story.seriesId);
            var meta = [series && series.name, sub && sub.name].filter(Boolean).join(" / ");
            if (meta) card.appendChild(el("small","timeline-wave-card-meta",meta));
            if (story.synopsis) card.appendChild(el("span","timeline-wave-card-description",story.synopsis));
            var arrow=el("span","timeline-wave-card-arrow","Read episode ↗");
            card.appendChild(arrow);
            cell.appendChild(card);row.appendChild(cell);
          });
          stack.appendChild(row);periodLanes.push(row);laneNo++;
        }
        periodLanes.forEach(function (row,i) {if (i < periodLanes.length-1) row.classList.add("has-next");});
        body.appendChild(stack);
      });
      detail.appendChild(body);
      host.appendChild(detail);
    });

    if (!resizeBound) {
      resizeBound = true;
      window.addEventListener("resize",function () {
        var count=columns();
        if (count!==lastColumns && current) render(current);
      },{passive:true});
    }
    return items.length;
  }
  window.ArchiveTimelineReader = {render:render};
})();
