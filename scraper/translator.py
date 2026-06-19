import json
import os
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

CACHE_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "translation_cache.json")

MAX_WORKERS = 50  # 并发数，API 支持 100，留点余量

GLOSSARY = """
韩国菜名标准翻译参考：
**餐次名称（重要！不要翻错！）：**
- 중식 → 午餐（韩国食堂称呼，不是"中式"！）
- 석식 → 晚餐（韩国食堂称呼，不是"石锅饭"！）
- 아침 → 早餐, 점심 → 午餐, 저녁 → 晚餐, 분식 → 小吃/面食

**菜品名称：**
- 김치 → 泡菜, 비빔밥 → 拌饭, 불고기 → 烤肉
- 삼겹살 → 五花肉, 된장찌개 → 大酱汤, 김치찌개 → 泡菜汤
- 라면 → 拉面, 떡볶이 → 炒年糕, 순두부찌개 → 嫩豆腐汤
- 갈비찜 → 炖排骨, 잡채 → 杂菜, 전 → 煎饼
- 고기 → 肉, 돼지 → 猪肉, 소 → 牛肉, 닭 → 鸡肉
- 새우 → 虾, 오징어 → 鱿鱼, 두부 → 豆腐
- 계란 → 鸡蛋, 밥 → 饭, 국 → 汤, 찌개 → 汤/炖汤
- 볶음 → 炒, 구이 → 烤, 조림 → 炖/红烧, 무침 → 凉拌
- 샐러드 → 沙拉, 죽 → 粥, 빵 → 面包
"""


def _load_cache() -> dict:
    if os.path.exists(CACHE_PATH):
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _save_cache(cache: dict):
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def _call_api(text: str, api_key: str, api_endpoint: str) -> str:
    """单条翻译 API 调用"""
    prompt = f"""你是一个专业的韩国菜单翻译专家。请将以下韩文菜单名称翻译为自然流畅的中文。

要求：
1. 使用中国大陆常用的韩国菜名翻译
2. 参考术语表：{GLOSSARY}
3. 只返回翻译结果，不要解释

请翻译：{text}"""

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
                "temperature": 0.1,
            },
            timeout=30,
        )
        if resp.status_code != 200:
            print(f"[translator] API error {resp.status_code} for: {text}")
            return text
        return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[translator] Failed: {text} -> {e}")
        return text


def translate_concurrent(texts: list[str], api_key: str, api_endpoint: str, cache: dict) -> list[str]:
    """并发翻译 - 充分利用 API 并发能力"""
    results = [None] * len(texts)
    to_translate = []

    # 先从缓存取
    for i, text in enumerate(texts):
        if not text or not text.strip():
            results[i] = ""
        elif text in cache:
            results[i] = cache[text]
        else:
            to_translate.append((i, text))

    if not to_translate:
        return results

    print(f"[translator] Translating {len(to_translate)} items concurrently (workers={MAX_WORKERS})")

    # 并发调用 API
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(_call_api, text, api_key, api_endpoint): (idx, text)
            for idx, text in to_translate
        }
        for future in as_completed(futures):
            idx, text = futures[future]
            try:
                result = future.result()
                results[idx] = result
                cache[text] = result
            except Exception as e:
                print(f"[translator] Error for '{text}': {e}")
                results[idx] = text

    _save_cache(cache)
    return results


def translate_menu(menu_data: list[dict], api_key: str, api_endpoint: str) -> list[dict]:
    if not api_endpoint:
        print("[translator] No API endpoint configured, skipping translation")
        return menu_data

    cache = _load_cache()

    # 收集所有需要翻译的文本
    all_texts = []
    text_map = []  # (type, obj, field)

    for restaurant in menu_data:
        all_texts.extend([restaurant["name_ko"], restaurant["location_ko"]])
        text_map.extend([
            ("field", restaurant, "name_cn"),
            ("field", restaurant, "location_cn"),
        ])

        for meal in restaurant["meals"].values():
            for section in meal["sections"]:
                all_texts.append(section["name_ko"])
                text_map.append(("field", section, "name_cn"))

                for item in section["items"]:
                    all_texts.append(item["ko"])
                    text_map.append(("field", item, "cn"))

    # 一次性并发翻译所有内容
    translated = translate_concurrent(all_texts, api_key, api_endpoint, cache)

    # 回填结果
    for i, (tp, obj, field) in enumerate(text_map):
        obj[field] = translated[i]

    return menu_data
