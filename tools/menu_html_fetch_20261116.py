"""Temporary GitHub fetch: save official menu HTML without translation or publishing."""
import json
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scraper import fetcher

KST = timezone(timedelta(hours=9))
now = datetime.now(KST)
monday = date(2026, 11, 16)
source_dir = ROOT / 'output/local-translation-20261116/source-html'
source_dir.mkdir(exist_ok=True)
original_get = fetcher._SESSION.get

def school_get(url, *args, **kwargs):
    parts = urlsplit(url)
    if parts.scheme != 'https' or parts.netloc != 'www.ajou.ac.kr':
        raise RuntimeError('Only official school GET requests are allowed')
    response = original_get(url, *args, **kwargs)
    query = parse_qs(parts.query)
    name = f"{query['date'][0]}-{query['articleNo'][0]}.html"
    (source_dir / name).write_bytes(response.content)
    return response

fetcher._SESSION.get = school_get
print('FETCH_START', flush=True)
results = []for offset in range(7):
    date = (monday + timedelta(days=offset)).isoformat()
    restaurants = []
    for restaurant_id in fetcher.RESTAURANTS:
        restaurants.append(fetcher.fetch_menu(date, restaurant_id))
    results.append({'date': date, 'restaurants': restaurants})
    print(json.dumps({'date': date, 'fetched': len(restaurants)}, ensure_ascii=False), flush=True)

ROOT / 'output/local-translation-20261116/github-fetch.json'.write_text(json.dumps({'week_start': monday.isoformat(), 'days': results}, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'week_start': monday.isoformat(), 'pages': len(results) * len(fetcher.RESTAURANTS), 'translation_called': False, 'published': False}, ensure_ascii=False), flush=True)
