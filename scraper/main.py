"""Fetch the week's menus, translate once, and publish complete static assets."""
import copy
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
_env_path = BASE_DIR / '.env'
if _env_path.exists():
    for line in _env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip().strip('\"\''))

from .fetcher import fetch_menu, RESTAURANTS, MEAL_MAP, MEAL_CN, classify_menu_items, has_dishes
from .translator import translate_menu, is_valid_translation, iter_translation_fields, reasoning_effort, DEFAULT_ENDPOINT, DEFAULT_MODEL
from .sync_site import sync_site

KST = timezone(timedelta(hours=9))


def _load_previous() -> dict:
    try:
        text = (BASE_DIR / 'menu-data.js').read_text(encoding='utf-8')
        return json.loads(text.removeprefix('const MENU_DATA = ').strip().removesuffix(';'))
    except (OSError, ValueError):
        return {}


def _saved_restaurant(old: dict, old_day: dict, checked_at: str, reason: str) -> dict:
    restaurant = copy.deepcopy(old)
    restaurant.update(fetch_status='stale', stale_reason=reason, checked_at=checked_at)
    restaurant.setdefault('fetched_at', old_day.get('generated_at'))
    if has_dishes(restaurant):
        restaurant['menu_status'] = 'available'
    return restaurant


def classify_empty_day(restaurant: dict, date_str: str, today: str):
    """Describe an empty response without inventing an upstream retention policy."""
    if restaurant.get('menu_status') == 'closed':
        return
    date = datetime.strptime(date_str, '%Y-%m-%d').date()
    if date.weekday() >= 5:
        restaurant['menu_status'] = 'closed'
        restaurant['closure'] = {'source': 'weekend_no_menu'}
    else:
        restaurant['menu_status'] = 'not_published' if date_str >= today else 'unavailable'


def fetch_single_day(date_str: str, previous: dict | None = None, *, now: datetime | None = None) -> dict:
    print(f'[main] Fetching {date_str}')
    now = (now or datetime.now(KST)).astimezone(KST)
    checked_at = now.isoformat()
    restaurants = []
    old_days = {**(previous or {}).get('days', {}), **(previous or {}).get('next_week', {}).get('days', {})}
    old_day = old_days.get(date_str, {})
    for rid, info in RESTAURANTS.items():
        old = next((entry for entry in old_day.get('restaurants', []) if entry['id'] == rid and entry.get('fetch_status') != 'error'), None)
        try:
            restaurant = fetch_menu(date_str, rid)
            restaurant['fetch_status'] = 'ok'
            restaurant['fetched_at'] = checked_at
            restaurant['checked_at'] = checked_at
            if has_dishes(restaurant):
                restaurant['menu_status'] = 'available'
            elif restaurant.get('menu_status') != 'closed' and old and has_dishes(old):
                # An unconfirmed empty page must never erase published same-date food.
                restaurant = _saved_restaurant(old, old_day, checked_at, 'source_empty')
            else:
                classify_empty_day(restaurant, date_str, now.date().isoformat())
        except Exception as error:
            print(f'[main] Restaurant {rid} unavailable ({type(error).__name__})')
            if old:
                restaurant = _saved_restaurant(old, old_day, checked_at, 'fetch_error')
            else:
                restaurant = {'id': rid, **info, 'fetch_status': 'error', 'meals': {key: {'label_ko': label, 'label_cn': MEAL_CN[key], 'sections': []} for key, label in MEAL_MAP.items()}}
        restaurants.append(restaurant)
    classify_menu_items(restaurants)
    return {'date': date_str, 'generated_at': checked_at, 'restaurants': restaurants}


def translation_summary(restaurants: list[dict], model: str) -> dict:
    # Chinese cafeteria labels come from the static UI config; location fields
    # are not rendered. Coverage follows the translated menu-data fields shown
    # in Chinese: window names plus every dish or notice row.
    required_categories = {'window', 'menu_item'}
    fields = [
        (obj.get(source_field, ''), obj.get(target_field, ''))
        for obj, source_field, target_field, category in iter_translation_fields(restaurants)
        if category in required_categories and obj.get(source_field, '')
    ]
    translated = sum(is_valid_translation(source, result) for source, result in fields)
    total = len(fields)
    return {'model': model, 'reasoning_effort': reasoning_effort(model), 'total': total, 'translated': translated, 'status': 'complete' if translated == total else 'partial' if translated else 'unavailable'}


def _write_json(path: Path, data: dict, javascript: bool = False):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    content = json.dumps(data, ensure_ascii=False, indent=None if javascript else 2)
    temporary.write_text(f'const MENU_DATA = {content};\n' if javascript else content + '\n', encoding='utf-8')
    temporary.replace(path)


def run(date_str: str | None = None):
    today = datetime.strptime(date_str, '%Y-%m-%d') if date_str else datetime.now(KST)
    monday = today - timedelta(days=today.weekday())
    previous = _load_previous()
    weeks = []
    for offset in ([0, 7] if today.weekday() >= 5 else [0]):
        days = {}
        for number in range(7):
            day = (monday + timedelta(days=offset + number)).strftime('%Y-%m-%d')
            days[day] = fetch_single_day(day, previous)
        weeks.append(days)
    restaurants = [restaurant for days in weeks for day in days.values() for restaurant in day['restaurants']]
    if not any(restaurant.get('fetch_status') == 'ok' for restaurant in restaurants):
        raise RuntimeError('All restaurant fetches failed; keeping the previous published data')

    api_key = os.environ.get('TRANSLATE_API_KEY', '')
    endpoint = os.environ.get('TRANSLATE_API_ENDPOINT') or DEFAULT_ENDPOINT
    model = os.environ.get('TRANSLATE_MODEL') or DEFAULT_MODEL
    require_translation = os.environ.get('REQUIRE_TRANSLATION') == '1'
    if require_translation and not api_key:
        raise RuntimeError('TRANSLATE_API_KEY is required; configure the GitHub Actions secret')
    translate_menu(restaurants, api_key, endpoint, model)
    summary = translation_summary(restaurants, model)
    print(f'[main] Chinese menu coverage: {summary["translated"]}/{summary["total"]}')
    if require_translation and summary['total'] and summary['translated'] != summary['total']:
        raise RuntimeError('Chinese menu translations incomplete; keeping the previous published data')

    output = {'week_start': monday.strftime('%Y-%m-%d'), 'generated_at': datetime.now(KST).isoformat(), 'translation': summary, 'days': weeks[0]}
    if len(weeks) > 1:
        output['next_week'] = {'week_start': (monday + timedelta(days=7)).strftime('%Y-%m-%d'), 'days': weeks[1]}
    for days in weeks:
        for date, day in days.items():
            _write_json(BASE_DIR / 'data' / f'menu-{date}.json', day)
    _write_json(BASE_DIR / 'menu-data.js', output, javascript=True)
    sync_site(BASE_DIR)
    print('[main] Saved root and site/ menus')


if __name__ == '__main__':
    run()
