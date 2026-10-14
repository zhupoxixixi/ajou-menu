"""Rough estimates only: unknown dishes and notices have no calorie value."""
import re
from .nutrition_db import KOREAN_CALORIE_DB, HEURISTIC_SUFFIXES

_SORTED_KEYS = sorted(KOREAN_CALORIE_DB, key=len, reverse=True)
_NOTICE = re.compile(r'^\s*(?:[*※]|\()|위 메뉴|시장 상황|운영시간|예약 가능합니다|픽업시간|단일코너.*운영|원하는 토핑|간편식 판매|(?:중식|증식|석식|테이크아웃)\s*\([\d,]+원\)')
_COMPOUND = re.compile(r'[&*/,]')


def estimate_calories(item_name_ko: str) -> int | None:
    # A single keyword cannot reliably estimate mixed dishes, choices, or notices.
    if _NOTICE.search(item_name_ko) or _COMPOUND.search(item_name_ko):
        return None
    for keyword in _SORTED_KEYS:
        if keyword in item_name_ko and (len(keyword) > 1 or item_name_ko.endswith(keyword)):
            minimum, maximum = KOREAN_CALORIE_DB[keyword]
            return (minimum + maximum) // 2
    for suffix, (minimum, maximum) in HEURISTIC_SUFFIXES:
        if item_name_ko.endswith(suffix):
            return (minimum + maximum) // 2
    return None


def annotate_menu_with_calories(menu_data: list[dict]) -> list[dict]:
    for restaurant in menu_data:
        for meal in restaurant['meals'].values():
            for section in meal['sections']:
                for item in section['items']:
                    item['kind'] = 'note' if _NOTICE.search(item['ko']) else 'dish'
                    item['calories'] = estimate_calories(item['ko'])
                    item['calories_source'] = 'estimate' if item['calories'] is not None else None
    return menu_data
