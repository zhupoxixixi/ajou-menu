import re
import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

RESTAURANTS = {
    363910: {'name_ko': '기숙사식당', 'name_cn': '宿舍食堂', 'location_ko': '아주대학교 기숙사식당 1층', 'location_cn': '亚洲大学宿舍食堂 1 楼'},
    221904: {'name_ko': '교직원식당', 'name_cn': '教职工食堂', 'location_ko': '기숙사식당동 2층', 'location_cn': '宿舍食堂楼 2 层'},
}
URL_TEMPLATE = 'https://www.ajou.ac.kr/kr/life/food.do?mode=view&articleNo={article_no}&date={date}'
MEAL_MAP = {'breakfast': '아침', 'lunch': '점심', 'dinner': '저녁', 'snack': '분식'}
MEAL_CN = {'breakfast': '早餐', 'lunch': '午餐', 'dinner': '晚餐', 'snack': '小吃'}
MEAL_CSS_CLASS = {'breakfast': 'breakfast', 'lunch': 'lunch', 'dinner': 'dinner', 'snack': 'snackBar'}
_SECTION_HEADER_RE = re.compile(r'^\s*[<\[]\s*(.+?)\s*[>\]]\s*$')
_NO_MENU_RE = re.compile(r'등록된\s*식단이\s*없습니다')
_NOTICE_RE = re.compile(r'^\s*(?:[*※]|\()|위 메뉴|시장 상황|운영시간|예약 가능합니다|픽업시간|단일코너.*운영|원하는 토핑|간편식 판매|(?:중식|증식|석식|테이크아웃)\s*\([\d,]+원\)')
_SESSION = requests.Session()
_SESSION.mount('https://', HTTPAdapter(max_retries=Retry(total=2, backoff_factor=.75, status_forcelist=(429, 500, 502, 503, 504), allowed_methods=('GET',))))


def _parse_menu_text(raw_text: str) -> list[dict]:
    if not raw_text or _NO_MENU_RE.search(raw_text):
        return []
    sections = []
    current_section = None
    for line in raw_text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        match = _SECTION_HEADER_RE.match(stripped)
        if match:
            current_section = {'name_ko': match.group(1), 'name_cn': '', 'items': []}
            sections.append(current_section)
        else:
            if current_section is None:
                current_section = {'name_ko': '메인', 'name_cn': '主菜单', 'items': []}
                sections.append(current_section)
            current_section['items'].append({'ko': stripped, 'cn': ''})
    return sections


def classify_menu_items(menu_data: list[dict]):
    """Keep only menu text and notice classification, including stale fallback data."""
    for restaurant in menu_data:
        for meal in restaurant['meals'].values():
            for section in meal['sections']:
                section['items'] = [
                    {'ko': item['ko'], 'cn': item.get('cn', ''), 'kind': 'note' if _NOTICE_RE.search(item['ko']) else 'dish'}
                    for item in section['items']
                ]


def fetch_menu(date_str: str, restaurant_id: int) -> dict:
    info = RESTAURANTS[restaurant_id]
    url = URL_TEMPLATE.format(article_no=restaurant_id, date=date_str)
    response = _SESSION.get(url, timeout=(10, 20))
    response.raise_for_status()
    soup = BeautifulSoup(response.text, 'lxml')
    if not soup.select('div.b-menu-day'):
        raise ValueError('School page does not contain the expected menu structure')
    meals = {}
    for key, css_class in MEAL_CSS_CLASS.items():
        container = soup.select_one(f'div.b-menu-day.{css_class}')
        pre = container.find('pre') if container else None
        meals[key] = {'label_ko': MEAL_MAP[key], 'label_cn': MEAL_CN[key], 'sections': _parse_menu_text(pre.get_text('\n') if pre else '')}
    return {'id': restaurant_id, **info, 'source_url': url, 'meals': meals}
