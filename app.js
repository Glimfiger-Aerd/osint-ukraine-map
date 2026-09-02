const tg = window.Telegram && window.Telegram.WebApp;
if (tg) { tg.ready(); tg.expand(); }

const map = L.map("map", { zoomControl: false, zoomSnap: .5, minZoom: 5, maxZoom: 12, maxBounds: L.latLngBounds([[44.1, 22], [52.6, 40.3]]), maxBoundsViscosity: 1 }).setView([49, 31.2], 6);
L.control.zoom({ position: "bottomright" }).addTo(map);

// 🌙 АВТОМАТИЧЕСКАЯ ТЕМНАЯ КАРТА
const isDark = tg && tg.colorScheme === 'dark';
const tileUrl = isDark 
    ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" // Спецслужба style
    : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);

let allEvents = [], E = [];
const card = document.getElementById("card"), counter = document.getElementById("counter");
let filter = "all", markers = [], heatLayer = null, chartInstance = null; 

function ic(e) { 
    let c = e.types.includes("dead") ? "black" : e.types.includes("injured") ? "purple" : e.types.includes("debris") ? "orange" : "red"; 
    return L.divIcon({ className: "", html: `<div class="event-dot ${c}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
}

function n(a, t) { return a.filter(e => e.types.includes(t)).length; }
function stats(a) { return `<div class="stats"><div class="stat">🔴<b>${n(a, "hit")}</b>прилёты</div><div class="stat">🟠<b>${n(a, "debris")}</b>обломки</div><div class="stat">🔥<b>${n(a, "damage")}</b>ущерб</div><div class="stat">🩹<b>${n(a, "injured")}</b>ранены</div><div class="stat">⚫<b>${n(a, "dead")}</b>погибли</div></div>`; }

function show(region, events) {
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    let newsList = events.map(e => `<div style="margin-top: 10px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0;"><p style="margin: 0 0 8px 0; font-size: 14px;">${e.text}</p><div class="source" style="font-size: 12px; color: #64748b;"><b>Источник:</b> <a href="${e.url}" target="_blank" style="color: #3b82f6;">${e.source}</a><br><small>${new Date(e.published).toLocaleString("ru-RU")}</small></div></div>`).join("");

    card.innerHTML = `<div style="display: flex; justify-content: space-between; align-items: center;"><h2 style="margin: 0;">${region}</h2><button id="shareBtn" style="background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; font-weight: bold;">📤 Share</button></div><span class="badge" style="margin-top: 10px;">Событий: ${events.length}</span>${stats(events)}<div style="max-height: 250px; overflow-y: auto; margin-top: 15px; padding-right: 5px;">${newsList}</div>`;

    document.getElementById("shareBtn").addEventListener("click", () => {
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('heavy');
        let shareText = `🇺🇦 OSINT: ${region}\n🔴 Прилётов: ${n(events, "hit")}\n\n`;
        events.slice(0, 3).forEach(e => shareText += `🔸 ${e.text.substring(0, 100)}...\n\n`);
        const shareUrl = `https://t.me/share/url?url=&text=${encodeURIComponent(shareText)}`;
        if (tg && tg.openTelegramLink) tg.openTelegramLink(shareUrl); else window.open(shareUrl, "_blank");
    });
}

function render() {
    markers.forEach(m => map.removeLayer(m)); markers = [];
    if (heatLayer) map.removeLayer(heatLayer);

    let a = E.filter(e => filter === "all" || e.types.includes(filter));
    if (counter) counter.textContent = a.length;

    let grouped = {}, heatPoints = []; 
    a.forEach(e => {
        if (!grouped[e.region]) grouped[e.region] = [];
        grouped[e.region].push(e);
        heatPoints.push([e.lat + (Math.random() - 0.5) * 0.2, e.lon + (Math.random() - 0.5) * 0.2, 1.0]); 
    });

    if (heatPoints.length > 0) heatLayer = L.heatLayer(heatPoints, { radius: 45, blur: 35, maxZoom: 8, gradient: { 0.2: 'blue', 0.6: 'lime', 1.0: 'red' } }).addTo(map);

    Object.keys(grouped).forEach(region => {
        let evs = grouped[region], first = evs[0], allTypes = [];
        evs.forEach(e => allTypes.push(...e.types));
        let m = L.marker([first.lat, first.lon], { icon: ic({ types: allTypes }) }).addTo(map);
        m.bindPopup(`<b>${region}</b>`); m.on("click", () => show(region, evs)); markers.push(m);
    });
}

document.querySelectorAll("#filters button").forEach(b => b.addEventListener("click", () => {
    if (b.id === "btn-analytics") return; // Игнорируем кнопку аналитики
    if (tg && tg.HapticFeedback) tg.HapticFeedback.selectionChanged();
    
    document.querySelectorAll("#filters button").forEach(x => x.classList.remove("active")); 
    b.classList.add("active"); filter = b.dataset.filter; render();
    
    // 💾 СОХРАНЯЕМ В ОБЛАКО ТЕЛЕГРАМ
    if (tg && tg.CloudStorage) tg.CloudStorage.setItem('filter', filter);
}));

// 📊 АНАЛИТИКА (График)
const modal = document.getElementById("analyticsModal");
document.getElementById("btn-analytics").addEventListener("click", () => {
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    modal.style.display = "flex";
    
    let dates = {}, labels = [], data = [];
    allEvents.forEach(e => {
        let d = e.published.split('T')[0];
        dates[d] = (dates[d] || 0) + 1;
    });
    Object.keys(dates).sort().slice(-14).forEach(d => { // Последние 14 дней
        labels.push(d.split('-').slice(1).join('.'));
        data.push(dates[d]);
    });

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(document.getElementById('chart'), {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'События', data: data, backgroundColor: '#ef4444', borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
});
document.getElementById("closeModal").addEventListener("click", () => modal.style.display = "none");

function filterByDate(dateStr) {
    E = allEvents.filter(e => e.published.startsWith(dateStr));
    let dateEl = document.getElementById("date");
    if (dateEl) dateEl.textContent = "Сводка за: " + dateStr.split('-').reverse().join('.');
    render();
}

async function borders() {
    try {
        let r = await fetch("https://cdn.jsdelivr.net/gh/darmat1/ukraine-geo-data@main/geodata/Ukraine.geojson", { cache: "no-store" });
        let g = await r.json();
        const ex = ["донец", "луган", "крым", "крим", "севастоп"];
        g.features = g.features.filter(f => !ex.some(root => JSON.stringify(f.properties || {}).toLowerCase().includes(root)));
        L.geoJSON(g, {
            style: { color: isDark ? "#475569" : "#64748b", weight: 1.5, fillColor: "#3b82f6", fillOpacity: .05 },
            onEachFeature: (f, l) => {
                let name = (f.properties || {}).name || "Регион";
                l.on("click", () => {
                    let a = E.filter(e => e.region === name);
                    if (a.length > 0) show(name, a);
                    else { if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error'); card.innerHTML = `<h2>${name}</h2><span class="badge">0</span><p>Нет событий.</p>`; }
                });
            }
        }).addTo(map);
    } catch (e) {}
}

async function loadDataAndRender() {
    const cal = document.getElementById("calendar");
    const today = new Date().toISOString().split('T')[0]; cal.value = today;
    
    // Восстанавливаем фильтр из облака
    if (tg && tg.CloudStorage) {
        tg.CloudStorage.getItem('filter', (err, val) => {
            if (!err && val && val !== "all") {
                document.querySelector(`button[data-filter="all"]`).classList.remove("active");
                let btn = document.querySelector(`button[data-filter="${val}"]`);
                if (btn) btn.classList.add("active");
                filter = val;
            }
        });
    }

    try {
        const response = await fetch('events.json', { cache: "no-store" });
        allEvents = (await response.json()).events || [];
        filterByDate(today);
    } catch (e) { console.warn(e); }

    cal.addEventListener("change", (e) => {
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('heavy');
        filterByDate(e.target.value);
    });
}

borders(); setTimeout(() => map.invalidateSize(), 500); loadDataAndRender();
