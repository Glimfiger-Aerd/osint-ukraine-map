import json, re, html, urllib.request, urllib.parse, hashlib
from datetime import datetime, timezone, timedelta
from pathlib import Path

OUT = Path("events.json")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"

# Корни городов и названия на РУССКОМ
REGIONS = [
    (["київ", "киев"], "Киевская область", 50.4501, 30.5234),
    (["чернігів", "чернигов"], "Черниговская область", 51.25, 32.00),
    (["сум", "суми", "сумы"], "Сумская область", 50.91, 34.80),
    (["харків", "харьков"], "Харьковская область", 49.99, 36.23),
    (["полтав"], "Полтавская область", 49.59, 34.55),
    (["дніпр", "днепр"], "Днепропетровская область", 48.46, 35.05),
    (["запоріж", "запорож"], "Запорожская область", 47.84, 35.14),
    (["донец", "донеч"], "Донецкая область", 48.30, 37.80),
    (["луган"], "Луганская область", 48.57, 39.31),
    (["херсон"], "Херсонская область", 46.64, 32.62),
    (["миколаїв", "николаев"], "Николаевская область", 46.97, 32.00),
    (["одес"], "Одесская область", 46.48, 30.72),
    (["вінниц", "винниц"], "Винницкая область", 49.23, 28.47),
    (["житомир"], "Житомирская область", 50.25, 28.66),
    (["кіровоград", "кропивниц", "кировоград"], "Кировоградская область", 48.51, 32.26),
    (["черкас"], "Черкасская область", 49.44, 32.06),
    (["хмельниц"], "Хмельницкая область", 49.42, 27.00),
    (["терноп", "тернопол"], "Тернопольская область", 49.55, 25.59),
    (["рівн", "ровн"], "Ровенская область", 50.62, 26.25),
    (["волин", "луцьк", "луцк"], "Волынская область", 50.75, 25.34),
    (["львів", "львов"], "Львовская область", 49.84, 24.03),
    (["франківськ", "франковск"], "Ивано-Франковская область", 48.92, 24.71),
    (["чернівц", "черновц"], "Черновицкая область", 48.29, 25.94)
]

# Ключевые слова на РУС и УКР
KEYWORDS = [
    "атака", "удар", "обстрел", "попад", "оскол", "облом", "бпла", "беспилот", "поврежд", "погиб", "ранен", "пострад", "взрыв", "ракет", "каб",
    "ата", "обстр", "влуч", "улам", "загиб", "поран", "вибух"
]

TRUXA_CHANNELS = [
    ("Труха⚡️Україна", "truexanewsua"),
    ("Труха⚡️Київ", "truexakyiv"),
    ("Труха⚡️Харків", "truexakharkiv")
]

# Русскоязычные RSS-ленты крупнейших СМИ
RSS_FEEDS = [
    ("Украинская Правда", "https://www.pravda.com.ua/rus/rss/"),
    ("УНИАН", "https://www.unian.net/detail/all_news.rss"),
    ("ТСН", "https://tsn.ua/ru/rss/full.rss")
]

def get(u):
    r = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(r, timeout=20) as x:
        return x.read().decode("utf-8", "ignore")

def clean(s):
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()

def process_text(text, source_name, url, old_events):
    low = text.lower()
    if not any(k in low for k in KEYWORDS): return
    
    reg = None
    for roots, ru_name, lat, lon in REGIONS:
        if any(root in low for root in roots):
            reg = (ru_name, lat, lon)
            break
            
    if not reg: return 
    ru_name, lat, lon = reg
    
    eid = "osint-" + hashlib.sha1((text + url).encode()).hexdigest()[:16]
    
    # Категоризация
    types = []
    if any(x in low for x in ["ата", "удар", "обстр", "влуч", "вибух", "ракет", "каб", "попад", "взрыв"]): types.append("hit")
    if any(x in low for x in ["улам", "оскол", "облом"]): types.append("debris")
    if any(x in low for x in ["пошкод", "руйн", "пожеж", "поврежд"]): types.append("damage")
    if any(x in low for x in ["постраж", "травм", "поран", "ранен"]): types.append("injured")
    if any(x in low for x in ["загин", "загиб", "погиб"]): types.append("dead")
    
    preview = text[:250] + "..." if len(text) > 250 else text
    
    old_events[eid] = {
        "id": eid, "region": ru_name, "lat": lat, "lon": lon,
        "types": list(dict.fromkeys(types or ["hit"])), 
        "status": "Зафиксировано", "confidence": "high" if "НПУ" in source_name or "RSS" in source_name else "medium",
        "text": preview, "published": datetime.now(timezone.utc).isoformat(),
        "source": source_name, "url": url
    }

def main():
    try:
        d = json.loads(OUT.read_text(encoding="utf-8"))
    except Exception:
        d = {"events": []}
        
    old = {e["id"]: e for e in d.get("events", [])}
    
    # --- ОЧИСТКА СТАРЫХ СОБЫТИЙ (Оставляем только за последние 24 часа) ---
    now = datetime.now(timezone.utc)
    filtered_old = {}
    for eid, event in old.items():
        try:
            pub_time = datetime.fromisoformat(event["published"])
            if (now - pub_time) <= timedelta(hours=24):
                filtered_old[eid] = event
        except ValueError:
            pass # Если дата сломана, удаляем
    old = filtered_old
    
    # 1. Полиция (НПУ)
    try:
        page = get("https://npu.gov.ua/news")
        links = list(dict.fromkeys(re.findall(r'href=["\'](?:https://npu\.gov\.ua)?(/news/[^"\']+)["\']', page, re.I)))
        for path in links[:20]:
            url = urllib.parse.urljoin("https://npu.gov.ua", path)
            try:
                raw = get(url)
                title_match = re.search(r"<h1[^>]*>(.*?)</h1>", raw, re.I | re.S)
                title = clean(title_match[1]) if title_match else ""
                process_text(title, "Национальная полиция", url, old)
            except Exception: continue
    except Exception as e:
        print("Ошибка НПУ:", e)

    # 2. СМИ (RSS-ленты)
    for source_name, rss_url in RSS_FEEDS:
        try:
            xml_data = get(rss_url)
            # Простой парсинг XML без сторонних библиотек
            items = re.findall(r'<item>(.*?)</item>', xml_data, re.I | re.S)
            for item in items[:20]:
                t_match = re.search(r'<title>(.*?)</title>', item, re.I | re.S)
                d_match = re.search(r'<description>(.*?)</description>', item, re.I | re.S)
                l_match = re.search(r'<link>(.*?)</link>', item, re.I | re.S)
                
                if not t_match: continue
                
                title = clean(t_match[1])
                desc = clean(d_match[1]) if d_match else ""
                link = clean(l_match[1]) if l_match else rss_url
                
                process_text(title + " " + desc, source_name, link, old)
        except Exception as e:
            print(f"Ошибка RSS ({source_name}):", e)

    # 3. Труха (Telegram)
    for source_name, handle in TRUXA_CHANNELS:
        try:
            tg_page = get(f"https://t.me/s/{handle}")
            posts = re.findall(r'<div class="tgme_widget_message_text[^>]*>(.*?)</div>', tg_page, re.S | re.I)
            post_links = re.findall(r'<a class="tgme_widget_message_date" href="(https://t\.me/[^/]+/\d+)">', tg_page, re.I)
            
            for i, html_text in enumerate(posts):
                text = clean(html_text)
                url = post_links[i] if i < len(post_links) else f"https://t.me/{handle}"
                process_text(text, source_name, url, old)
        except Exception as e:
            print(f"Ошибка Telegram ({handle}):", e)

    # Сохранение
    d = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "source_policy": "Major News RSS + Telegram + NPU",
        "events": list(old.values())
    }
    OUT.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Stored", len(d["events"]), "events (last 24 hours)")

if __name__ == "__main__":
    main()
