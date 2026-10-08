(function(){
"use strict";
var loaded=Object.create(null);
var suggestions=["Inter","Roboto","Open Sans","Lato","Montserrat","Poppins","Nunito","DM Sans","Manrope","Outfit","Work Sans","Source Sans 3","IBM Plex Sans","Space Grotesk","Urbanist","Rubik","Figtree","Quicksand","Raleway","Oswald","Archivo","Karla","Mulish","Barlow","Jost","Plus Jakarta Sans","Newsreader","EB Garamond","Lora","Merriweather","Playfair Display","Cormorant Garamond","Libre Baskerville","Crimson Text","DM Serif Display","Bitter","Literata","Spectral","Noto Serif","Alegreya","Fraunces","Cinzel","Cardo","Prata","Vollkorn","PT Serif"];
function validColor(v,f){return /^#[0-9a-fA-F]{6}$/.test(String(v||""))?String(v).toUpperCase():f}
function validFont(v){var s=String(v||"").trim();return s.length<=70&&/^[a-zA-Z0-9][a-zA-Z0-9 +&.'-]*$/.test(s)?s:""}
function ink(bg){var hex=validColor(bg,"#FFFDF7").slice(1),l=[0,2,4].map(function(n){var x=parseInt(hex.slice(n,n+2),16)/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4)});return .2126*l[0]+.7152*l[1]+.0722*l[2]>.22?"#202020":"#F8F6F0"}
function loadFont(name){var s=validFont(name);if(!s||loaded[s]||!document.head)return;loaded[s]=true;var a=document.createElement("link");a.rel="stylesheet";a.href="https://fonts.googleapis.com/css2?family="+encodeURIComponent(s).replace(/%20/g,"+")+"&display=swap";a.onerror=function(){loaded[s]=false};document.head.appendChild(a)}
function applyUi(el,theme){if(!el)return;var bg=validColor(theme&&theme.background,""),font=validFont(theme&&theme.font);el.classList.toggle("subseries-ui-themed",!!(bg||font));if(bg){el.style.setProperty("--subseries-ui-bg",bg);el.style.setProperty("--subseries-ui-ink",ink(bg))}else{el.style.removeProperty("--subseries-ui-bg");el.style.removeProperty("--subseries-ui-ink")}if(font){loadFont(font);el.style.setProperty("--subseries-ui-font",'"'+font+'", Georgia, sans-serif')}else el.style.removeProperty("--subseries-ui-font")}
function applyPaper(el,theme){if(!el)return;var bg=validColor(theme&&theme.background,"#FFFDF7");el.style.setProperty("--chapter-paper-bg",bg);el.style.setProperty("--chapter-paper-ink",ink(bg))}
window.SubseriesThemes={validColor:validColor,validFont:validFont,ink:ink,loadFont:loadFont,applyUi:applyUi,applyPaper:applyPaper,suggestions:suggestions};
})();
