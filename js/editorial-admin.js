(function(){
  "use strict";
  function init(){
    var dialog=document.getElementById("entityDialog");
    var form=document.getElementById("entityForm");
    var tabs=document.getElementById("editorialEntityTabs");
    if(!dialog||!form||!tabs)return;
    function select(name){
      form.dataset.activeEntityTab=name;
      tabs.querySelectorAll("[data-edit-tab]").forEach(function(button){
        button.setAttribute("aria-pressed",button.dataset.editTab===name?"true":"false");
      });
    }
    function opened(){
      var type=document.getElementById("entityTypeInput").value;
      var enabled=type==="series"||type==="subseries";
      tabs.hidden=!enabled;
      if(!enabled){form.removeAttribute("data-active-entity-tab");return;}
      var appearance=tabs.querySelector('[data-edit-tab="appearance"]');
      appearance.hidden=type!=="subseries";
      select("general");
    }
    tabs.querySelectorAll("[data-edit-tab]").forEach(function(button){
      button.addEventListener("click",function(){
        if(button.hidden)return;
        select(button.dataset.editTab);
      });
    });
    new MutationObserver(function(){
      if(dialog.open)opened();
    }).observe(dialog,{attributes:true,attributeFilter:["open"]});
    if(dialog.open)opened();
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);
  else init();
})();