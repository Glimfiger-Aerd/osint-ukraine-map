const tg=window.Telegram&&window.Telegram.WebApp;if(tg){tg.ready();tg.expand();}
const map=L.map("map",{zoomControl:false}).setView([49.0,31.2],6);
L.control.zoom({position:"bottomright"}).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap contributors"}).addTo(map);
const card=document.getElementById("card"),counter=document.getElementById("counter");let filter="all",markers=[];
function icon(e){let c=e.types.includes("dead")?"black":e.types.includes("injured")?"purple":e.status==="Уточняется"?"orange":"red";return L.divIcon({className:"",html:`<div class="event-dot ${c}"></div>`,iconSize:[18,18],iconAnchor:[9,9]})}
function show(e){card.innerHTML=`<h2>${e.region}</h2><span class="badge">${e.status}</span><p>${e.text}</p><div class="source"><b>Источник:</b> <a href="${e.url}" target="_blank" rel="noopener">${e.source}</a></div>`}
function render(){markers.forEach(m=>map.removeLayer(m));markers=[];const list=EVENTS.filter(e=>filter==="all"||e.types.includes(filter));counter.textContent=list.length;list.forEach(e=>{const m=L.marker([e.lat,e.lon],{icon:icon(e)}).addTo(map);m.bindPopup(`<b>${e.region}</b><br><small>${e.status}</small>`);m.on("click",()=>show(e));markers.push(m)})}
document.querySelectorAll(".filters button").forEach(b=>b.addEventListener("click",()=>{document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");filter=b.dataset.filter;render()}));render();