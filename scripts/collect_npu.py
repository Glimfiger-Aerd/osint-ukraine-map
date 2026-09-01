# 1. Безопасное чтение JSON в начале main()
try:
    d = json.loads(OUT.read_text(encoding="utf-8"))
except (FileNotFoundError, json.JSONDecodeError):
    d = {"events": []}
old = {e["id"]: e for e in d.get("events", [])}

# ... (получение ссылок) ...

# 2. Оптимизация запросов в цикле (один запрос на URL)
for path in links[:80]:
    url = urllib.parse.urljoin(BASE, path)
    try:
        raw_html = get(url)
        t = clean(raw_html)
    except Exception as e:
        print(f"Skip {url}: {e}") # Теперь ошибки будут видны в логах Actions
        continue
        
    low = t.lower()
    # ... (проверка ключевых слов и региона) ...
    
    # 3. Поиск заголовка в уже загруженном HTML
    ru, lat, lon = reg
    title_match = re.search(r"<h1[^>]*>(.*?)</h1>", raw_html, re.I | re.S)
    title = clean(title_match[1]) if title_match else "Публикация НПУ"
