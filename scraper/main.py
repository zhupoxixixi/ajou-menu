import json
import os
from datetime import datetime, timezone, timedelta

# Load .env file for local development
_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

from .fetcher import fetch_menu, RESTAURANTS
from .calories import annotate_menu_with_calories
from .translator import translate_menu

KST = timezone(timedelta(hours=9))

RESTAURANT_IDS = [363910, 221904]

API_KEY = os.environ.get("TRANSLATE_API_KEY", "")
API_ENDPOINT = os.environ.get("TRANSLATE_API_ENDPOINT", "")


def fetch_single_day(date_str: str) -> dict:
    """爬取单天菜单"""
    print(f"[main] Fetching menus for {date_str}")

    menu_data = []
    for rid in RESTAURANT_IDS:
        try:
            data = fetch_menu(date_str, rid)
            menu_data.append(data)
            print(f"[main] Fetched restaurant {rid}")
        except Exception as e:
            print(f"[main] Failed to fetch restaurant {rid}: {e}")

    annotate_menu_with_calories(menu_data)

    if API_ENDPOINT:
        translate_menu(menu_data, API_KEY, API_ENDPOINT)
    else:
        print("[main] No translation API endpoint set, using Korean only")

    return {
        "date": date_str,
        "generated_at": datetime.now(KST).isoformat(),
        "restaurants": menu_data,
    }


def run(date_str: str = None):
    if date_str is None:
        date_str = datetime.now(KST).strftime("%Y-%m-%d")

    base_dir = os.path.join(os.path.dirname(__file__), "..")
    data_dir = os.path.join(base_dir, "data")
    os.makedirs(data_dir, exist_ok=True)

    # 爬取本周所有数据（周一到周五）
    from datetime import datetime as dt, timedelta
    today = dt.strptime(date_str, "%Y-%m-%d")
    weekday = today.weekday()  # 0=周一, 6=周日

    # 计算本周一的日期
    monday = today - timedelta(days=weekday)

    week_data = {}
    for i in range(5):  # 周一到周五
        day = monday + timedelta(days=i)
        day_str = day.strftime("%Y-%m-%d")
        day_data = fetch_single_day(day_str)
        week_data[day_str] = day_data

        # 保存单天 JSON
        json_path = os.path.join(data_dir, f"menu-{day_str}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(day_data, f, ensure_ascii=False, indent=2)
        print(f"[main] Saved {json_path}")

    # 保存一周数据到 JS 文件
    js_path = os.path.join(base_dir, "menu-data.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("const MENU_DATA = ")
        json.dump({
            "week_start": monday.strftime("%Y-%m-%d"),
            "generated_at": datetime.now(KST).isoformat(),
            "days": week_data,
        }, f, ensure_ascii=False)
        f.write(";\n")
    print(f"[main] Saved {js_path}")


if __name__ == "__main__":
    run()
