import json, re, html, urllib.request, urllib.parse, hashlib
from datetime import datetime, timezone
from pathlib import Path

OUT = Path("events.json")
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
REGIONS = [("Київ","город Киев",50.4501,30.5234),("Київська","Киевская область",50.10,30.65),("Чернігівська","Черниговская область",51.25,32.00),("Сумська","Сумская область",50.91,34.80),("Харківська","Харьковская область",49.99,36.23),("Полтавська","Полтавская область",49.59,34.55),("Дніпропетровська","Днепропетровская область",48.46,35.05),("Запорізька","Запорожская область",47.84,35.14),("Донецька","Донецкая область",48.30,37.80),("Луганська","Луганская область",48.57,39.31),("Херсонська","Херсонская область",46.64,32.62),("Миколаївська","Николаевская область",46.97,32.00),("Одеська","Одесская область",46.48,30.72),("Вінницька","Винницкая область",49.23,28.47),("Житомирська","Житомирская область",50.25,28.66),("Кіровоградська","Кировоградская область",48.51,32.26),("Черкаська","Черкасская область",49.44,32.06),("Хмельницька","Хмельницкая область",49.42,27.00),("Тернопільська","Тернопольская область",49.55,25.59),("Рівненська","Ровенская область",50.62,26.25),("Волинська","Волынская область",50.75,25.34),("Львівська","Львовская область",49.84,24.03),("Івано-Франківська","Ивано-Франковская область",48.92,24.71),("Чернівецька","Черновицкая область",48.29,25.94)]
KEYWORDS = ["ата", "удар", "обстр", "влуч", "улам", "бпла", "пошкод", "загиб", "поран", "постраж"]

def get(u):
    r = urllib.request.Request(u, headers={"User-Agent": UA})
    with urllib.request.urlopen(r, timeout=20) as x:
        return x.read().decode("utf-8", "ignore")

def clean(s):
    s = re.sub(r"<br\s*/?>", " ", s, flags=re.I) # Сохраняем пробелы вместо переносов строк
    s = re.sub(r"<[^>]+>", " ", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()

def process_text(text, source_name, url, old_events):
    low = text.lower()
    if not any(k in low for k in KEYWORDS): return
    
    reg = None
    for ua, ru, lat, lon in REGIONS:
        if ua.lower() in low or ru.lower() in low:
            reg = (ru, lat, lon)
            break
            
    if not reg: return
    ru, lat, lon = reg
    
    eid = "osint-" + hashlib.sha1(text.encode()).hexdigest()[:16]
    types = []
    if any(x in low for x in ["ата","удар","обстр","влуч"]): types.append("hit")
    if "улам" in low: types.append("debris")
    if any(x in low for x in ["пошкод","руйн","пожеж"]): types.append("damage")
    if any(x in low for x in ["постраж","травм","поран"]): types.append("injured")
    if any(x in low for x in ["загин","загиб"]): types.append("dead")
    
    # Ограничиваем длину текста для карточки
    preview = text[:200] + "..." if len(text) > 200 else text
    
    old_events[eid] = {
        "id": eid, "region": ru, "lat": lat, "lon": lon,
        "types": list(dict.fromkeys(types or ["hit"])), 
        "status": "Требует проверки", "confidence": "medium", # Для ТГ снижаем доверие
        "text": preview, "published": datetime.now(timezone.utc).isoformat(),
        "source": source_name, "url": url
    }

def main():
    try:
        d = json.loads(OUT.read_text(encoding="utf-8"))
    except Exception:
        d = {"events": []}
    old = {e["id"]: e for e in d.get("events", [])}
    
    # --- 1. Парсинг НПУ ---
    try:
        page = get("https://npu.gov.ua/news")
        links = list(dict.fromkeys(re.findall(r'href=["\'](?:https://npu\.gov\.ua)?(/news/[^"\']+)["\']', page, re.I)))
        for path in links[:20]: # Уменьшил до 20, чтобы не тормозило
            url = urllib.parse.urljoin("https://npu.gov.ua", path)
            try:
                raw = get(url)
                title_match = re.search(r"<h1[^>]*>(.*?)</h1>", raw, re.I | re.S)
                title = clean(title_match[1]) if title_match else ""
                process_text(title, "Национальная полиция", url, old)
            except Exception: continue
    except Exception as e:
        print("Ошибка НПУ:", e)

    # --- 2. Парсинг Труха (через Web View) ---
    try:
        tg_page = get("https://t.me/s/truxa_coca_cola")
        # Ищем блоки с текстом сообщений
        posts = re.findall(r'<div class="tgme_widget_message_text[^>]*>(.*?)</div>', tg_page, re.S | re.I)
        # Ищем ссылки на эти посты (чтобы добавить в источник)
        post_links = re.findall(r'<a class="tgme_widget_message_date" href="(https://t\.me/truxa_coca_cola/\d+)">', tg_page)
        
        for i, html_text in enumerate(posts):
            text = clean(html_text)
            url = post_links[i] if i < len(post_links) else "https://t.me/truxa_coca_cola"
            process_text(text, "Труха⚡️Украина", url, old)
    except Exception as e:
        print("Ошибка Telegram:", e)

    # Сохраняем
    d = {
        "updated": datetime.now(timezone.utc).isoformat(),
        "source_policy": "Mixed (Official + Telegram)",
        "events": list(old.values())[-300:] # Храним последние 300
    }
    OUT.write_text(json.dumps(d, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Stored", len(d["events"]), "events")

if __name__ == "__main__":
    main()
