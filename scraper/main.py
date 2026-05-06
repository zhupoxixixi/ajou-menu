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


def run(date_str: str = None):
    if date_str is None:
        date_str = datetime.now(KST).strftime("%Y-%m-%d")

    print(f"[main] Scraping menus for {date_str}")

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

    output = {
        "date": date_str,
        "generated_at": datetime.now(KST).isoformat(),
        "restaurants": menu_data,
    }

    base_dir = os.path.join(os.path.dirname(__file__), "..")

    # Save JSON
    data_dir = os.path.join(base_dir, "data")
    os.makedirs(data_dir, exist_ok=True)
    json_path = os.path.join(data_dir, f"menu-{date_str}.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"[main] Saved {json_path}")

    # Save JS data file to root (for GitHub Pages)
    js_path = os.path.join(base_dir, "menu-data.js")
    with open(js_path, "w", encoding="utf-8") as f:
        f.write("const MENU_DATA = ")
        json.dump(output, f, ensure_ascii=False)
        f.write(";\n")
    print(f"[main] Saved {js_path}")


if __name__ == "__main__":
    run()
