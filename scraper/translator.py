import json
import os
import time
import requests

CACHE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "translation_cache.json")


def _load_cache() -> dict:
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_cache(cache: dict):
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def translate_text(text: str, api_key: str, api_endpoint: str, cache: dict) -> str:
    if not text or not text.strip():
        return ""

    if text in cache:
        return cache[text]

    prompt = f"将以下韩文菜单名称翻译为中文，只返回翻译结果，不要解释：\n\n{text}"

    try:
        resp = requests.post(
            f"{api_endpoint}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "mimo-v2.5",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
            },
            timeout=30,
        )
        if resp.status_code != 200:
            print(f"[translator] API error {resp.status_code}")
            return text
        result = resp.json()["choices"][0]["message"]["content"].strip()
        cache[text] = result
        _save_cache(cache)
        time.sleep(0.3)
        return result
    except Exception as e:
        print(f"[translator] Translation failed: {e}")
        return text


def translate_menu(menu_data: list[dict], api_key: str, api_endpoint: str) -> list[dict]:
    if not api_endpoint:
        print("[translator] No API endpoint configured, skipping translation")
        return menu_data

    cache = _load_cache()

    for restaurant in menu_data:
        restaurant["name_cn"] = translate_text(restaurant["name_ko"], api_key, api_endpoint, cache)
        restaurant["location_cn"] = translate_text(restaurant["location_ko"], api_key, api_endpoint, cache)

        for meal in restaurant["meals"].values():
            for section in meal["sections"]:
                section["name_cn"] = translate_text(section["name_ko"], api_key, api_endpoint, cache)
                for item in section["items"]:
                    item["cn"] = translate_text(item["ko"], api_key, api_endpoint, cache)

    return menu_data
