const tg=window.Telegram&&window.Telegram.WebApp;if(tg){tg.ready();tg.expand()}
const map=L.map("map",{zoomControl:false,zoomSnap:.5,minZoom:5,maxZoom:12,maxBounds:L.latLngBounds([[44.1,22],[52.6,40.3]]),maxBoundsViscosity:1}).setView([49,31.2],6);
L.control.zoom({position:"bottomright"}).addTo(map);L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"© OpenStreetMap contributors"}).addTo(map);
let E = [];
async function loadDataAndRender() {
    try {
        const response = await fetch('events.json', {cache: "no-store"});
        const D = await response.json();
        E = D.events || [];
        if (D.updated) {
            document.getElementById("date").textContent = "Обновлено: " + new Date(D.updated).toLocaleString("ru-RU", {day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit"});
        }
        render(); 
    } catch (e) {
        console.warn("Данные пока не загружены", e);
    }
}
loadDataAndRender();

const card=document.getElementById("card"),counter=document.getElementById("counter");let filter="all",markers=[];
function ic(e){let c=e.types.includes("dead")?"black":e.types.includes("injured")?"purple":e.types.includes("debris")?"orange":"red";return L.divIcon({className:"",html:`<div class="event-dot ${c}"></div>`,iconSize:[18,18],iconAnchor:[9,9]})}
function n(a,t){return a.filter(e=>e.types.includes(t)).length}function stats(a){return `<div class="stats"><div class="stat">🔴<b>${n(a,"hit")}</b>прилёты</div><div class="stat">🟠<b>${n(a,"debris")}</b>обломки</div><div class="stat">🔥<b>${n(a,"damage")}</b>ущерб</div><div class="stat">🩹<b>${n(a,"injured")}</b>раненые</div><div class="stat">⚫<b>${n(a,"dead")}</b>погибшие</div></div>`}
function show(e){card.innerHTML=`<h2>${e.region}</h2><span class="badge">${e.status}</span><span class="badge">🟢 высокий уровень доверия</span><p>${e.text}</p>${stats([e])}<div class="source"><b>Источник:</b> <a href="${e.url}" target="_blank" rel="noopener">${e.source}</a><br><small>${new Date(e.published).toLocaleString("ru-RU")}</small></div>`}
function render(){markers.forEach(m=>map.removeLayer(m));markers=[];let a=E.filter(e=>filter==="all"||e.types.includes(filter));counter.textContent=a.length;a.forEach(e=>{let m=L.marker([e.lat,e.lon],{icon:ic(e)}).addTo(map);m.bindPopup(`<b>${e.region}</b><br><small>${e.status}</small>`);m.on("click",()=>show(e));markers.push(m)})}
document.querySelectorAll("#filters button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll("#filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;render()}));
async function borders(){try{let r=await fetch("https://cdn.jsdelivr.net/gh/darmat1/ukraine-geo-data@main/geodata/Ukraine.geojson",{cache:"no-store"});let g=await r.json();L.geoJSON(g,{style:{color:"#64748b",weight:1.5,fillColor:"#60a5fa",fillOpacity:.08},onEachFeature:(f,l)=>{let p=f.properties||{},name=p.name||p.NAME||p.name_1||p.NAME_1;if(name){l.bindTooltip(name,{sticky:true});l.on("click",()=>{let a=E.filter(e=>e.region===name);card.innerHTML=`<h2>${name}</h2><span class="badge">Событий: ${a.length}</span>${stats(a)}<p>${a.length?"Смотрите события по маркерам на карте.":"В текущем наборе данных событий нет."}</p>`})}}}).addTo(map)}catch(e){console.warn(e)}}
function fix(){setTimeout(()=>map.invalidateSize(false),100);setTimeout(()=>map.invalidateSize(false),800)};borders();fix();window.addEventListener("resize",fix);document.addEventListener("visibilitychange",()=>{if(!document.hidden)fix()});
