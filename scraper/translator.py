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

    # 韩国菜名术语表 - 确保翻译一致性
    glossary = """
韩国菜名标准翻译参考：
**餐次名称（重要！）：**
- 아침 → 早餐, 점심 → 午餐, 저녁 → 晚餐
- 중식（중식）→ 午餐（不是"中式"！是韩国食堂对午餐的称呼）
- 석식（석식）→ 晚餐（不是"石锅饭"！是韩国食堂对晚餐的称呼）
- 분식 → 小吃/面食

**菜品名称：**
- 김치 → 泡菜, 비빔밥 → 拌饭, 불고기 → 烤肉
- 삼겹살 → 五花肉, 된장찌개 → 大酱汤, 김치찌개 → 泡菜汤
- 라면 → 拉面, 떡볶이 → 炒年糕, 순두부찌개 → 嫩豆腐汤
- 갈비찜 → 炖排骨, 콩나물국 → 豆芽汤, 미역국 → 海带汤
- 잡채 (japchae) → 杂菜/炒粉丝
- 전 (jeon) → 煎饼
- 고기 (gogi) → 肉
- 돼지 (dwaeji) → 猪肉
- 소 (so) → 牛肉
- 닭 (dak) → 鸡肉
- 새우 (saeu) → 虾
- 오징어 (ojingeo) → 鱿鱼
- 두부 (dubu) → 豆腐
- 계란 (gyeran) → 鸡蛋
- 밥 (bap) → 饭
- 국 (guk) → 汤
- 찌개 (jjigae) → 汤/炖汤
- 볶음 (bokkeum) → 炒
- 구이 (gui) → 烤
- 조림 (jorim) → 炖/红烧
- 무침 (muchim) → 凉拌
- 샐러드 → 沙拉
- 죽 (juk) → 粥
- 빵 (ppang) → 面包
- 우유 (uyu) → 牛奶
- 주스 → 果汁
- 커피 → 咖啡
- 차 (cha) → 茶
"""

    prompt = f"""你是一个专业的韩国菜单翻译专家。请将以下韩文菜单名称翻译为自然流畅的中文。

要求：
1. 使用中国大陆常用的韩国菜名翻译
2. 保持原意，但要符合中文表达习惯
3. 如果是菜品，参考以下术语表：{glossary}
4. 只返回翻译结果，不要解释

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
                "temperature": 0.1,  # 更低的温度确保翻译一致性
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


def translate_batch(texts: list[str], api_key: str, api_endpoint: str, cache: dict) -> list[str]:
    """批量翻译 - 提供更多上下文，提高翻译准确性"""
    # 从缓存中取出已翻译的
    results = []
    to_translate = []
    indices = []

    for i, text in enumerate(texts):
        if not text or not text.strip():
            results.append("")
        elif text in cache:
            results.append(cache[text])
        else:
            results.append(None)
            to_translate.append(text)
            indices.append(i)

    if not to_translate:
        return results

    # 批量翻译未缓存的内容
    glossary = """
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
"""

    batch_text = "\n".join([f"{i+1}. {t}" for i, t in enumerate(to_translate)])

    prompt = f"""你是一个专业的韩国菜单翻译专家。请将以下韩文菜单名称逐条翻译为自然流畅的中文。

要求：
1. 使用中国大陆常用的韩国菜名翻译
2. 参考术语表：{glossary}
3. 保持原意，符合中文表达习惯
4. 每行一个翻译结果，保持序号格式
5. 不要添加解释

请翻译：
{batch_text}"""

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
            timeout=60,
        )
        if resp.status_code != 200:
            print(f"[translator] API error {resp.status_code}")
            return results

        content = resp.json()["choices"][0]["message"]["content"].strip()
        # 解析批量翻译结果
        translated = []
        for line in content.split("\n"):
            line = line.strip()
            if line:
                # 移除序号
                if ". " in line:
                    line = line.split(". ", 1)[1]
                translated.append(line)

        # 填充翻译结果
        for i, idx in enumerate(indices):
            if i < len(translated):
                results[idx] = translated[i]
                cache[texts[idx]] = translated[i]

        _save_cache(cache)
        time.sleep(0.3)

    except Exception as e:
        print(f"[translator] Batch translation failed: {e}")

    return results


def translate_menu(menu_data: list[dict], api_key: str, api_endpoint: str) -> list[dict]:
    if not api_endpoint:
        print("[translator] No API endpoint configured, skipping translation")
        return menu_data

    cache = _load_cache()

    for restaurant in menu_data:
        # 批量翻译餐厅名称和位置
        texts = [restaurant["name_ko"], restaurant["location_ko"]]
        translated = translate_batch(texts, api_key, api_endpoint, cache)
        restaurant["name_cn"] = translated[0]
        restaurant["location_cn"] = translated[1]

        for meal in restaurant["meals"].values():
            for section in meal["sections"]:
                # 批量翻译分区名称和菜品
                texts = [section["name_ko"]]
                texts.extend([item["ko"] for item in section["items"]])
                translated = translate_batch(texts, api_key, api_endpoint, cache)
                section["name_cn"] = translated[0]
                for i, item in enumerate(section["items"]):
                    item["cn"] = translated[i + 1]

    return menu_data
