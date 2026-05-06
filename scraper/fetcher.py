import re
import requests
from bs4 import BeautifulSoup

RESTAURANTS = {
    363910: {"name_ko": "기숙사식당", "location_ko": "아주대학교 기숙사식당1층"},
    221904: {"name_ko": "교직원식당", "location_ko": "기숙사식당동 2층"},
}

URL_TEMPLATE = "https://www.ajou.ac.kr/kr/life/food.do?mode=view&articleNo={article_no}&date={date}"

MEAL_MAP = {
    "breakfast": "아침",
    "lunch": "점심",
    "dinner": "저녁",
    "snack": "분식",
}

MEAL_CN = {
    "breakfast": "早餐",
    "lunch": "午餐",
    "dinner": "晚餐",
    "snack": "小吃",
}

MEAL_CSS_CLASS = {
    "breakfast": "breakfast",
    "lunch": "lunch",
    "dinner": "dinner",
    "snack": "snackBar",
}

# Section header patterns - must match full trimmed line
_SECTION_HEADER_RE = re.compile(r"^\s*[<\[]\s*(.+?)\s*[>\]]\s*$")
_NO_MENU_RE = re.compile(r"등록된\s*식단이\s*없습니다")


def _parse_menu_text(raw_text: str) -> list[dict]:
    if not raw_text or _NO_MENU_RE.search(raw_text):
        return []

    sections = []
    current_section = None

    for line in raw_text.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue

        match = _SECTION_HEADER_RE.match(stripped)
        if match:
            current_section = {"name_ko": match.group(1), "name_cn": "", "items": []}
            sections.append(current_section)
        else:
            if current_section is None:
                current_section = {"name_ko": "메인", "name_cn": "主菜", "items": []}
                sections.append(current_section)
            current_section["items"].append({"ko": stripped, "cn": "", "calories": 0})

    return sections


def fetch_menu(date_str: str, restaurant_id: int) -> dict:
    info = RESTAURANTS[restaurant_id]
    url = URL_TEMPLATE.format(article_no=restaurant_id, date=date_str)

    resp = requests.get(url, timeout=15)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")

    meals = {}
    for meal_key, css_class in MEAL_CSS_CLASS.items():
        container = soup.find("div", class_=f"b-menu-day {css_class}")
        if not container:
            meals[meal_key] = {
                "label_ko": MEAL_MAP[meal_key],
                "label_cn": MEAL_CN[meal_key],
                "sections": [],
            }
            continue

        pre = container.find("pre")
        raw = pre.get_text("\n") if pre else ""
        sections = _parse_menu_text(raw)

        meals[meal_key] = {
            "label_ko": MEAL_MAP[meal_key],
            "label_cn": MEAL_CN[meal_key],
            "sections": sections,
        }

    return {
        "id": restaurant_id,
        "name_ko": info["name_ko"],
        "name_cn": "",
        "location_ko": info["location_ko"],
        "location_cn": "",
        "meals": meals,
    }
