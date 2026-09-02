const tg = window.Telegram && window.Telegram.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const map = L.map("map", { 
    zoomControl: false, 
    zoomSnap: .5, 
    minZoom: 5, 
    maxZoom: 12, 
    maxBounds: L.latLngBounds([[44.1, 22], [52.6, 40.3]]), 
    maxBoundsViscosity: 1 
}).setView([49, 31.2], 6);

L.control.zoom({ position: "bottomright" }).addTo(map);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { 
    maxZoom: 19, 
    attribution: "© OpenStreetMap contributors" 
}).addTo(map);

let allEvents = []; // Хранилище за все 30 дней
let E = []; // Активные события для отрисовки
const card = document.getElementById("card");
const counter = document.getElementById("counter");
let filter = "all";
let markers = [];
let heatLayer = null; 

function ic(e) { 
    let c = e.types.includes("dead") ? "black" : 
            e.types.includes("injured") ? "purple" : 
            e.types.includes("debris") ? "orange" : "red"; 
    return L.divIcon({ className: "", html: `<div class="event-dot ${c}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
}

function n(a, t) { return a.filter(e => e.types.includes(t)).length; }

function stats(a) { 
    return `<div class="stats">
        <div class="stat">🔴<b>${n(a, "hit")}</b>прилёты</div>
        <div class="stat">🟠<b>${n(a, "debris")}</b>обломки</div>
        <div class="stat">🔥<b>${n(a, "damage")}</b>ущерб</div>
        <div class="stat">🩹<b>${n(a, "injured")}</b>раненые</div>
        <div class="stat">⚫<b>${n(a, "dead")}</b>погибшие</div>
    </div>`; 
}

function show(region, events) {
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');

    let newsList = events.map(e => `
        <div style="margin-top: 10px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;">
            <p style="margin: 0 0 8px 0; font-size: 14px;">${e.text}</p>
            <div class="source" style="font-size: 12px; color: #64748b;">
                <b>Источник:</b> <a href="${e.url}" target="_blank" rel="noopener" style="color: #3b82f6;">${e.source}</a><br>
                <small>${new Date(e.published).toLocaleString("ru-RU")}</small>
            </div>
        </div>
    `).join("");

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <h2 style="margin: 0;">${region}</h2>
            <button id="shareBtn" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold;">📤 Поделиться</button>
        </div>
        <span class="badge" style="display: inline-block; margin-top: 10px;">Событий: ${events.length}</span>
        ${stats(events)}
        <div style="max-height: 250px; overflow-y: auto; margin-top: 15px; padding-right: 5px;">
            ${newsList}
        </div>
    `;

    // Логика кнопки "Поделиться"
    document.getElementById("shareBtn").addEventListener("click", () => {
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('heavy');
        
        let shareText = `🇺🇦 Сводка OSINT: ${region}\n`;
        shareText += `🔴 Прилётов: ${n(events, "hit")} | 🟠 Обломки: ${n(events, "debris")}\n\n`;
        events.slice(0, 3).forEach(e => {
            shareText += `🔸 ${e.text.substring(0, 100)}...\nИсточник: ${e.source}\n\n`;
        });
        shareText += `Подробнее в приложении OSINT Ukraine Map.`;

        const shareUrl = `https://t.me/share/url?url=&text=${encodeURIComponent(shareText)}`;
        if (tg && tg.openTelegramLink) {
            tg.openTelegramLink(shareUrl);
        } else {
            window.open(shareUrl, "_blank");
        }
    });
}

function render() {
    markers.forEach(m => map.removeLayer(m)); 
    markers = [];
    
    if (heatLayer) {
        map.removeLayer(heatLayer);
    }

    let a = E.filter(e => filter === "all" || e.types.includes(filter));
    if (counter) counter.textContent = a.length;

    let grouped = {};
    let heatPoints = []; 

    a.forEach(e => {
        if (!grouped[e.region]) grouped[e.region] = [];
        grouped[e.region].push(e);

        let jLat = e.lat + (Math.random() - 0.5) * 0.2;
        let jLon = e.lon + (Math.random() - 0.5) * 0.2;
        heatPoints.push([jLat, jLon, 1.0]); 
    });

    if (heatPoints.length > 0) {
        heatLayer = L.heatLayer(heatPoints, {
            radius: 45, 
            blur: 35, 
            maxZoom: 8, 
            gradient: { 0.2: 'blue', 0.4: 'cyan', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red' } 
        }).addTo(map);
    }

    Object.keys(grouped).forEach(region => {
        let evs = grouped[region];
        let first = evs[0]; 
        
        let allTypes = [];
        evs.forEach(e => allTypes.push(...e.types));

        let m = L.marker([first.lat, first.lon], { icon: ic({ types: allTypes }) }).addTo(map);
        m.bindPopup(`<b>${region}</b><br><small>Новостей: ${evs.length}</small>`);
        m.on("click", () => show(region, evs));
        markers.push(m);
    });
}

document.querySelectorAll("#filters button").forEach(b => b.addEventListener("click", () => { 
    if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    document.querySelectorAll("#filters button").forEach(x => x.classList.remove("active")); 
    b.classList.add("active"); 
    filter = b.dataset.filter; 
    render(); 
}));

function filterByDate(dateStr) {
    E = allEvents.filter(e => e.published.startsWith(dateStr));
    let dateEl = document.getElementById("date");
    if (dateEl) {
        dateEl.textContent = "Сводка за: " + dateStr.split('-').reverse().join('.');
    }
    render();
}

async function borders() {
    try {
        let r = await fetch("https://cdn.jsdelivr.net/gh/darmat1/ukraine-geo-data@main/geodata/Ukraine.geojson", { cache: "no-store" });
        let g = await r.json();

        const excludedRoots = [
            "донец", "донець", "donets", 
            "луган", "luhans", "lugans", 
            "крым", "крим", "krym", "crimea", 
            "севастоп", "sevastop"
        ];
        
        g.features = g.features.filter(f => {
            let propsStr = JSON.stringify(f.properties || {}).toLowerCase();
            return !excludedRoots.some(root => propsStr.includes(root));
        });

        L.geoJSON(g, {
            style: { color: "#64748b", weight: 1.5, fillColor: "#60a5fa", fillOpacity: .08 },
            onEachFeature: (f, l) => {
                let p = f.properties || {};
                let name = p.name || p.NAME || p.name_1 || p.NAME_1 || p.shapeName || "Регион";
                
                if (name) {
                    l.bindTooltip(name, { sticky: true });
                    l.on("click", () => {
                        let a = E.filter(e => e.region === name);
                        if (a.length > 0) show(name, a);
                        else {
                            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
                            card.innerHTML = `<h2>${name}</h2><span class="badge">Событий: 0</span>${stats([])}<p>В выбранную дату событий нет.</p>`;
                        }
                    });
                }
            }
        }).addTo(map);
    } catch (e) { console.warn(e); }
}

function fix() { 
    setTimeout(() => map.invalidateSize(false), 100); 
    setTimeout(() => map.invalidateSize(false), 800); 
}

async function loadDataAndRender() {
    try {
        const response = await fetch('events.json', { cache: "no-store" });
        const D = await response.json();
        allEvents = D.events || [];
        
        const cal = document.getElementById("calendar");
        const today = new Date().toISOString().split('T')[0]; 
        cal.value = today; 
        
        filterByDate(today);
        
        cal.addEventListener("change", (e) => {
            if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('heavy');
            filterByDate(e.target.value);
        });
        
    } catch (e) {
        console.warn("Данные пока не загружены", e);
    }
}

borders(); 
fix(); 
window.addEventListener("resize", fix); 
document.addEventListener("visibilitychange", () => { if (!document.hidden) fix(); });
loadDataAndRender();
