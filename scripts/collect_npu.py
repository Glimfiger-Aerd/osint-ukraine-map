import json,re,html,urllib.request,urllib.parse,hashlib
from datetime import datetime,timezone
from pathlib import Path

BASE="https://npu.gov.ua"
OUT=Path("events.json")
UA="Mozilla/5.0 (compatible; OSINT-Ukraine-Map/4.0)"
REGIONS=[("Київ","город Киев",50.4501,30.5234),("Київська","Киевская область",50.10,30.65),("Чернігівська","Черниговская область",51.25,32.00),("Сумська","Сумская область",50.91,34.80),("Харківська","Харьковская область",49.99,36.23),("Полтавська","Полтавская область",49.59,34.55),("Дніпропетровська","Днепропетровская область",48.46,35.05),("Запорізька","Запорожская область",47.84,35.14),("Донецька","Донецкая область",48.30,37.80),("Луганська","Луганская область",48.57,39.31),("Херсонська","Херсонская область",46.64,32.62),("Миколаївська","Николаевская область",46.97,32.00),("Одеська","Одесская область",46.48,30.72),("Вінницька","Винницкая область",49.23,28.47),("Житомирська","Житомирская область",50.25,28.66),("Кіровоградська","Кировоградская область",48.51,32.26),("Черкаська","Черкасская область",49.44,32.06),("Хмельницька","Хмельницкая область",49.42,27.00),("Тернопільська","Тернопольская область",49.55,25.59),("Рівненська","Ровенская область",50.62,26.25),("Волинська","Волынская область",50.75,25.34),("Львівська","Львовская область",49.84,24.03),("Івано-Франківська","Ивано-Франковская область",48.92,24.71),("Чернівецька","Черновицкая область",48.29,25.94)]

def get(u):
 r=urllib.request.Request(u,headers={"User-Agent":UA})
 with urllib.request.urlopen(r,timeout=20) as x:return x.read().decode("utf-8","ignore")

def clean(s):
 s=re.sub(r"<script.*?</script>|<style.*?</style>"," ",s,flags=re.S|re.I);s=re.sub(r"<[^>]+>"," ",s);return re.sub(r"\s+"," ",html.unescape(s)).strip()

def main():
 try:
  d=json.loads(OUT.read_text(encoding="utf-8"))
 except Exception:
  d={"events": []}
 old={e["id"]:e for e in d.get("events",[])}
 
 page=get(BASE+"/news")
 links=list(dict.fromkeys(re.findall(r'href=["\'](?:https://npu\.gov\.ua)?(/news/[^"\']+)["\']',page,re.I)))
 for path in links[:80]:
  url=urllib.parse.urljoin(BASE,path)
  try:t=clean(get(url))
  except Exception:continue
  low=t.lower()
  if not any(k in low for k in ["ата","удар","обстр","влуч","улам","бпла","пошкод","загиб","поран","постраж"]):continue
  reg=None
  for ua,ru,lat,lon in REGIONS:
   if ua.lower() in low or ru.lower() in low:reg=(ru,lat,lon);break
  if not reg:continue
  ru,lat,lon=reg; title=(re.search(r"<h1[^>]*>(.*?)</h1>",get(url),re.I|re.S) or [None,"Публикация НПУ"])[1];title=clean(title)
  eid="npu-"+hashlib.sha1(url.encode()).hexdigest()[:16]
  types=[];types+=["hit"] if any(x in low for x in ["ата","удар","обстр","влуч"]) else [];types+=["debris"] if "улам" in low else [];types+=["damage"] if any(x in low for x in ["пошкод","руйн","пожеж"]) else [];types+=["injured"] if any(x in low for x in ["постраж","травм","поран"]) else [];types+=["dead"] if any(x in low for x in ["загин","загиб"]) else []
  old[eid]={"id":eid,"region":ru,"lat":lat,"lon":lon,"types":list(dict.fromkeys(types or ["hit"])), "status":"Подтверждено","confidence":"high","text":title,"published":datetime.now(timezone.utc).isoformat(),"source":"Национальная полиция Украины","url":url}
 
 d={"updated":datetime.now(timezone.utc).isoformat(),"source_policy":"Official NPU publications; regional/city level only.","events":list(old.values())[-300:]}
 OUT.write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding="utf-8")
 print("Stored",len(d["events"]),"events")

if __name__=="__main__":main()
