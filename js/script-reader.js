/* Reader Script mode: exact Letter-size pages on desktop, adaptive on phones. */
(function () {
  "use strict";
  var lastHost = null, controls = null, pages = null, mode = "";
  function button(text, value) {
    var el = document.createElement("button");
    el.type="button"; el.textContent=text;
    el.dataset.scriptView=value;
    el.addEventListener("click",function(){ switchView(value); });
    return el;
  }
  function switchView(next) {
    if (!lastHost || !pages) return;
    mode = next;
    controls.querySelectorAll("button[data-script-view]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.scriptView === mode));
    });
    pages.classList.toggle("is-adaptive", mode === "adaptive");
    if (mode === "adaptive") window.ScriptEngine.renderAdaptive(pages, window.ScriptEngine.parse(lastHost.dataset.scriptSource || ""));
    else window.ScriptEngine.render(pages,window.ScriptEngine.parse(lastHost.dataset.scriptSource || ""),{ editable:false });
  }
  function render(host, html) {
    if (!host || !window.ScriptEngine) return;
    reset();
    lastHost=host;
    host.dataset.scriptSource=String(html||"");
    controls=document.createElement("div");
    controls.className="script-reader-controls";
    controls.setAttribute("role","group");
    controls.setAttribute("aria-label","Script reader presentation");
    controls.appendChild(button("Exact Pages","exact"));
    controls.appendChild(button("Adaptive Reading","adaptive"));
    var print=button("Save as PDF / Print","print");
    print.addEventListener("click",function(){window.print();});
    controls.appendChild(print);
    var doc=document.createElement("div");
    doc.className="script-reader-pages";
    host.replaceChildren(controls,doc);
    pages=doc;
    var preferred;
    try { preferred=localStorage.getItem("archive_script_reader_view"); } catch (_) {}
    var narrow=window.matchMedia("(max-width:767px)").matches;
    switchView(preferred==="exact"||preferred==="adaptive"?preferred:(narrow?"adaptive":"exact"));
    controls.addEventListener("click",function(e){
      var b=e.target.closest("button[data-script-view]");
      if(b&&b.dataset.scriptView!=="print") {
        try { localStorage.setItem("archive_script_reader_view", b.dataset.scriptView); } catch (_) {}
      }
    });
  }
  function reset(){
    if(lastHost) lastHost.removeAttribute("data-script-source");
    lastHost=null;controls=null;pages=null;mode="";
  }
  window.ScriptReader={render:render,reset:reset};
})();
