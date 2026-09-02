import json, re, html, urllib.request, urllib.parse, hashlib, os
from datetime import datetime, timezone, timedelta
from pathlib import Path

OUT = Path("events.json")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

BOT_TOKEN = os.environ.get("TG_BOT_TOKEN")
CHAT_ID = os.environ.get("TG_CHAT_ID")

REGIONS = [
    (["кривий ріг", "кривой рог"], "Кривой Рог", 47.91, 33.39),
    (["біла церква", "белая церковь"], "Белая Церковь", 49.79, 30.11),
    (["краматорськ", "краматорск"], "Краматорск", 48.73, 37.58),
    (["покровськ", "покровск"], "Покровск", 48.28, 37.17),
    (["костянтинів", "константинов"], "Константиновка", 48.52, 37.70),
    (["київ", "киев"], "Киев", 50.45, 30.52),
    (["харків", "харьков"], "Харьков", 49.99, 36.23),
    (["дніпр", "днепр"], "Днепр", 48.46, 35.05),
    (["одес"], "Одесса", 46.48, 30.72),
    (["запоріж", "запорож"], "Запорожье", 47.84, 35.14),
    (["миколаїв", "николаев"], "Николаев", 46.97, 32.00),
    (["херсон"], "Херсон", 46.64, 32.62),
    (["сум", "суми", "сумы"], "Сумы", 50.91, 34.80),
    (["чернігів", "чернигов"], "Чернигов", 51.25, 32.00),
    (["полтав"], "Полтава", 49.59, 34.55),
    (["донец", "донеч"], "Донецкая область", 48.30, 37.80),
    (["луган"], "Луганская область", 48.57, 39.31),
    (["вінниц", "винниц"], "Винница", 49.23, 28.47),
    (["житомир"], "Житомир", 50.25, 28.66),
    (["кіровоград", "кропивниц", "кировоград"], "Кропивницкий", 48.51, 32.26),
    (["черкас"], "Черкассы", 49.44, 32.06),
    (["хмельниц"], "Хмельницкий", 49.42, 27.00),
    (["терноп", "тернопол"], "Тернополь", 49.55, 25.59),
    (["рівн", "ровн"], "Ровно", 50.62, 26.25),
    (["волин", "луцьк", "луцк"], "Луцк", 50.75, 25.34),
    (["львів", "львов"], "Львов", 49.84, 24.03),
    (["франківськ", "франковск"], "Ивано-Франковск", 48.92, 24.71),
    (["чернівц", "черновц"], "Черновцы", 48.29, 25.94)
]

KEYWORDS = ["атака", "удар", "обстрел", "попад", "оскол", "облом", "бпла", "беспилот", "поврежд", "погиб", "ранен", "пострад", "взрыв", "ракет", "каб", "ата", "обстр", "влуч", "улам", "загиб", "поран", "вибух"]

TG_CHANNELS = [("Труха⚡️Україна", "truexanewsua"), ("Труха⚡️Київ", "truexakyiv"), ("Труха⚡️Харків", "truexakharkiv"), ("UKR 2025", "ukr_2025_ru")]
RSS_FEEDS = [("Украинская Правда", "https://www.pravda.com.ua/rus/rss/"), ("УНИАН", "https://www.unian.net/detail/all_news.rss"), ("ТСН", "https://tsn.ua/ru/rss/full.rss")]

def get(u):
    r = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(r, timeout=20) as x: return x.read().decode("utf-8", "ignore")

def clean(s):
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<!\[CDATA\[|\]\]>|<[^>]+>", " ", s))).strip()

def send_alert(text):
    if not BOT_TOKEN or not CHAT_ID: return
    try:
        url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
        data = json.dumps({"chat_id": CHAT_ID, "text": text, "parse_mode": "HTML"}).encode('utf-8')
        req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
        urllib.request.urlopen(req, timeout=10)
    except: pass

def process_text(search_text, display_text, source_name, url, img_url, old_events, new_alerts):
    low = search_text.lower()
    if not any(k in low for k in KEYWORDS): return
    
    reg = next((r for roots, r, _, _ in REGIONS if any(rt in low for rt in roots)), None)
    if not reg: return 
    ru_name, lat, lon = next((r, lat, lon) for roots, r, lat, lon in REGIONS if r == reg)
    
    eid = "osint-" + hashlib.sha1((display_text + url).encode()).hexdigest()[:16]
    
    types = []
    if any(x in low for x in ["ата", "удар", "обстр", "влуч", "вибух", "ракет", "каб", "попад"]): types.append("hit")
    if any(x in low for x in ["улам", "оскол", "облом"]): types.append("debris")
    if any(x in low for x in ["пошкод", "руйн", "пожеж", "поврежд"]): types.append("damage")
    if any(x in low for x in ["постраж", "травм", "поран", "ранен"]): types.append("injured")
    if any(x in low for x in ["загин", "загиб", "погиб"]): types.append("dead")
    
    weapons = []
    if any(x in low for x in ["шахед", "бпла", "беспилот", "мопед", "дрон"]): weapons.append("drone")
    if any(x in low for x in ["ракет", "искандер", "кинжал", "баллист", "калибр"]): weapons.append("missile")
    if any(x in low for x in ["каб", "фаб", "авиабомб"]): weapons.append("bomb")
    if any(x in low for x in ["артил", "рсзв", "град", "мином"]): weapons.append("artillery")
    
    if eid not in old_events and ("dead" in types or "injured" in types):
        new_alerts.append(f"🚨 <b>OSINT: {ru_name}</b>\n\n{display_text[:500]}...\n\n<a href='{url}'>Источник</a>")
    
    old_events[eid] = {
        "id": eid, "region": ru_name, "lat": lat, "lon": lon,
        "types": list(set(types or ["hit"])), "weapons": list(set(weapons)),
        "status": "Зафиксировано", "confidence": "high" if "НПУ" in source_name or "RSS" in source_name else "medium",
        "text": display_text[:250] + "...", "image": img_url,
        "published": datetime.now(timezone.utc).isoformat(), "source": source_name, "url": url
    }

def main():
    try: d = json.loads(OUT.read_text(encoding="utf-8"))
    except: d = {"events": []}
    old = {e["id"]: e for e in d.get("events", []) if (datetime.now(timezone.utc) - datetime.fromisoformat(e["published"])) <= timedelta(days=30)}
    new_alerts = []
    
    try:
        page = get("https://npu.gov.ua/news")
        for path in list(dict.fromkeys(re.findall(r'href=["\'](/news/[^"\']+)["\']', page, re.I)))[:20]:
            try:
                url = "https://npu.gov.ua" + path
                raw = get(url)
                title = clean(re.search(r"<h1[^>]*>(.*?)</h1>", raw, re.I | re.S).group(1)) if re.search(r"<h1[^>]*>(.*?)</h1>", raw, re.I | re.S) else clean(raw)[:100]
                img = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', raw, re.I)
                img_url = urllib.parse.urljoin("https://npu.gov.ua", img.group(1)) if img else ""
                process_text(clean(raw), title, "Национальная полиция", url, img_url, old, new_alerts)
            except: continue
    except: pass

    for name, rss_url in RSS_FEEDS:
        try:
            for item in re.findall(r'<item>(.*?)</item>', get(rss_url), re.I | re.S)[:20]:
                t = re.search(r'<title>(.*?)</title>', item, re.I | re.S)
                if not t: continue
                title = clean(t.group(1))
                desc = clean(re.search(r'<description>(.*?)</description>', item, re.I | re.S).group(1)) if re.search(r'<description>', item) else ""
                img = re.search(r'url=["\']([^"\']+)["\']', item, re.I)
                img_url = img.group(1) if img else ""
                process_text(title + " " + desc, title, name, clean(re.search(r'<link>(.*?)</link>', item, re.I | re.S).group(1)), img_url, old, new_alerts)
        except: pass

    for name, handle in TG_CHANNELS:
        try:
            tg_page = get(f"https://t.me/s/{handle}")
            blocks = re.findall(r'<div class="tgme_widget_message "[^>]*>(.*?)<div class="tgme_widget_message_info">', tg_page, re.S | re.I)
            for block in blocks:
                text_m = re.search(r'<div class="tgme_widget_message_text[^>]*>(.*?)</div>', block, re.S | re.I)
                if not text_m: continue
                text = clean(text_m.group(1))
                link_m = re.search(r'<a class="tgme_widget_message_date" href="(https://t\.me/[^/]+/\d+)">', block, re.I)
                img_m = re.search(r"background-image:url\('([^']+)'\)", block)
                process_text(text, text, name, link_m.group(1) if link_m else f"https://t.me/{handle}", img_m.group(1) if img_m else "", old, new_alerts)
        except: pass

    for alert in new_alerts[:3]: send_alert(alert)

    OUT.write_text(json.dumps({"updated": datetime.now(timezone.utc).isoformat(), "source_policy": "NPU + RSS + TG", "events": list(old.values())}, ensure_ascii=False, indent=2), encoding="utf-8")

if __name__ == "__main__": main()
