import re
from .nutrition_db import KOREAN_CALORIE_DB, HEURISTIC_SUFFIXES

_NO_CALORIE_KEYWORDS = re.compile(
    r"위 메뉴|시장 상황|변경|예약|가능|한정수량|판매|토팡|셀프라면|택\d|운영시간|테이크아웃|원\)"
)


def estimate_calories(item_name_ko: str) -> int:
    if _NO_CALORIE_KEYWORDS.search(item_name_ko):
        return 0

    # Sort by key length descending for longest-match-first
    sorted_keys = sorted(KOREAN_CALORIE_DB.keys(), key=len, reverse=True)
    for keyword in sorted_keys:
        if keyword in item_name_ko:
            min_cal, max_cal = KOREAN_CALORIE_DB[keyword]
            return (min_cal + max_cal) // 2

    # Heuristic suffix fallback
    for suffix, (min_cal, max_cal) in HEURISTIC_SUFFIXES:
        if item_name_ko.endswith(suffix):
            return (min_cal + max_cal) // 2

    # Default for unknown items
    return 150


def annotate_menu_with_calories(menu_data: dict) -> dict:
    for restaurant in menu_data:
        for meal in restaurant["meals"].values():
            for section in meal["sections"]:
                for item in section["items"]:
                    item["calories"] = estimate_calories(item["ko"])
    return menu_data
