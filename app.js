const tg=window.Telegram&&window.Telegram.WebApp;
if(tg){tg.ready();tg.expand();}

const CDN_BASE="https://cdn.jsdelivr.net/gh/darmat1/ukraine-geo-data@main/geodata";
const UKRAINE_CENTER=[49.0,31.2];
const UKRAINE_BOUNDS=L.latLngBounds([[44.1,22.0],[52.6,40.3]]);

const map=L.map("map",{zoomControl:false,zoomSnap:.5,minZoom:5,maxZoom:12,maxBounds:UKRAINE_BOUNDS,maxBoundsViscosity:1}).setView(UKRAINE_CENTER,6);
L.control.zoom({position:"bottomright"}).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);

let DATA={events:[]};
try{DATA=JSON.parse(document.getElementById("events-data").textContent)}catch(e){}
const EVENTS=DATA.events||[];
document.getElementById("date").textContent=DATA.updated?new Date(DATA.updated).toLocaleString("ru-RU",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}):"Данные загружаются";

const card=document.getElementById("card"),counter=document.getElementById("counter");
let filter="all",markers=[],oblastLayer=null,selectedLayer=null,geoLoaded=false;

function eventIcon(e){
 let c=e.types.includes("dead")?"black":e.types.includes("injured")?"purple":e.status==="Уточняется"?"orange":"red";
 return L.divIcon({className:"",html:`<div class="event-dot ${c}"></div>`,iconSize:[18,18],iconAnchor:[9,9]});
}
function regionEvents(name){return EVENTS.filter(e=>e.region===name)}
function statsHTML(list){
 const n=t=>list.filter(e=>e.types.includes(t)).length;
 return `<div class="stats">
 <div class="stat">🔴<b>${n("hit")}</b>прилёты</div>
 <div class="stat">🟠<b>${n("debris")}</b>обломки</div>
 <div class="stat">🔥<b>${n("damage")}</b>ущерб</div>
 <div class="stat">🩹<b>${n("injured")}</b>раненые</div>
 <div class="stat">⚫<b>${n("dead")}</b>погибшие</div>
 </div>`;
}
function showRegion(name){
 const list=regionEvents(name);
 card.innerHTML=`<h2>${name}</h2><span class="badge">Событий: ${list.length}</span>${statsHTML(list)}
 ${list.length?list.map(e=>`<p><b>${e.status}</b> — ${e.text}<br><span class="muted">${e.source}</span></p>`).join(""):"<p>В текущем наборе данных событий нет.</p>"}`;
}
function showEvent(e){
 card.innerHTML=`<h2>${e.region}</h2><span class="badge">${e.status}</span><p>${e.text}</p>${statsHTML([e])}<div class="source"><b>Источник:</b> <a href="${e.url}" target="_blank" rel="noopener">${e.source}</a></div>`;
}
function featureName(f){
 const p=f.properties||{};
 return p.name||p.NAME||p.name_en||p.NAME_1||"Область";
}
function oblastStyle(){return {className:"oblast",color:"#64748b",weight:1.5,fillColor:"#60a5fa",fillOpacity:.10}}
function oblastSelectedStyle(){return {className:"oblast selected",color:"#1d4ed8",weight:3,fillColor:"#60a5fa",fillOpacity:.28}}

async function loadOblasts(){
 try{
   const r=await fetch(`${CDN_BASE}/Ukraine.geojson`,{cache:"no-store"});
   if(!r.ok)throw new Error("GeoJSON "+r.status);
   const geo=await r.json();
   oblastLayer=L.geoJSON(geo,{style:oblastStyle,onEachFeature:(f,l)=>{
     const name=featureName(f);
     l.bindTooltip(name,{sticky:true,direction:"center"});
     l.on("click",()=>{
       if(selectedLayer)selectedLayer.setStyle(oblastStyle());
       selectedLayer=l;l.setStyle(oblastSelectedStyle());
       showRegion(name);
     });
   }}).addTo(map);
   geoLoaded=true;
 }catch(e){
   console.warn("Не удалось загрузить границы областей",e);
 }
}

function renderMarkers(){
 markers.forEach(m=>map.removeLayer(m));markers=[];
 const list=EVENTS.filter(e=>filter==="all"||e.types.includes(filter));
 counter.textContent=list.length;
 list.forEach(e=>{
   const m=L.marker([e.lat,e.lon],{icon:eventIcon(e)}).addTo(map);
   m.bindPopup(`<b>${e.region}</b><br><small>${e.status}</small>`);
   m.on("click",()=>showEvent(e));
   markers.push(m);
 });
}
document.querySelectorAll("#filters button").forEach(b=>b.addEventListener("click",()=>{
 document.querySelectorAll("#filters button").forEach(x=>x.classList.remove("active"));
 b.classList.add("active");filter=b.dataset.filter;renderMarkers();
}));

function fixMap(){setTimeout(()=>map.invalidateSize(false),100);setTimeout(()=>map.invalidateSize(false),700);setTimeout(()=>map.invalidateSize(false),1600)}
renderMarkers();loadOblasts();fixMap();
window.addEventListener("resize",fixMap);
document.addEventListener("visibilitychange",()=>{if(!document.hidden)fixMap()});
