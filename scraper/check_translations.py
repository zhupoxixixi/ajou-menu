"""翻译质量检查脚本 - 用 API 检查韩中翻译是否准确"""
import json
import os
import requests

_env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
if os.path.exists(_env_path):
    with open(_env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())

API_KEY = os.environ.get("TRANSLATE_API_KEY", "")
API_ENDPOINT = os.environ.get("TRANSLATE_API_ENDPOINT", "")


def check_translation(ko: str, cn: str, api_key: str, api_endpoint: str) -> dict:
    """用 API 检查单条翻译质量"""
    prompt = f"""你是韩中翻译审校专家。请评估以下韩国菜单翻译是否准确。

韩文原文：{ko}
中文翻译：{cn}

请用 JSON 格式回复：
{{
  "score": 1-5 (1=完全错误, 3=基本对但不自然, 5=完美),
  "issue": "问题描述（如果有的话）",
  "suggestion": "建议的翻译（如果需要修改）"
}}

只返回 JSON，不要其他内容。"""

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
            return {"score": 0, "issue": f"API error {resp.status_code}"}

        content = resp.json()["choices"][0]["message"]["content"].strip()
        # 提取 JSON
        if "{" in content:
            json_str = content[content.index("{"):content.rindex("}") + 1]
            return json.loads(json_str)
        return {"score": 0, "issue": "无法解析回复"}
    except Exception as e:
        return {"score": 0, "issue": str(e)}


def check_menu_translations(menu_data: dict, api_key: str, api_endpoint: str):
    """检查菜单中所有翻译"""
    issues = []

    for restaurant in menu_data.get("restaurants", []):
        # 检查餐厅名
        if restaurant.get("name_ko") and restaurant.get("name_cn"):
            result = check_translation(restaurant["name_ko"], restaurant["name_cn"], api_key, api_endpoint)
            if result.get("score", 5) < 4:
                issues.append({
                    "type": "restaurant",
                    "ko": restaurant["name_ko"],
                    "cn": restaurant["name_cn"],
                    **result
                })

        for meal_key, meal in restaurant.get("meals", {}).items():
            for section in meal.get("sections", []):
                # 检查分区名
                if section.get("name_ko") and section.get("name_cn"):
                    result = check_translation(section["name_ko"], section["name_cn"], api_key, api_endpoint)
                    if result.get("score", 5) < 4:
                        issues.append({
                            "type": "section",
                            "ko": section["name_ko"],
                            "cn": section["name_cn"],
                            **result
                        })

                # 检查菜品名
                for item in section.get("items", []):
                    if item.get("ko") and item.get("cn"):
                        result = check_translation(item["ko"], item["cn"], api_key, api_endpoint)
                        if result.get("score", 5) < 4:
                            issues.append({
                                "type": "item",
                                "ko": item["ko"],
                                "cn": item["cn"],
                                **result
                            })

    return issues


if __name__ == "__main__":
    if not API_ENDPOINT:
        print("请配置 TRANSLATE_API_KEY 和 TRANSLATE_API_ENDPOINT")
        exit(1)

    # 读取最新的菜单数据
    data_dir = os.path.join(os.path.dirname(__file__), "..", "data")
    menu_files = sorted([f for f in os.listdir(data_dir) if f.startswith("menu-") and f.endswith(".json")])

    if not menu_files:
        print("没有找到菜单数据")
        exit(1)

    latest = os.path.join(data_dir, menu_files[-1])
    print(f"检查文件: {latest}")

    with open(latest, "r", encoding="utf-8") as f:
        menu_data = json.load(f)

    print("正在检查翻译质量...")
    issues = check_menu_translations(menu_data, API_KEY, API_ENDPOINT)

    if issues:
        print(f"\n发现 {len(issues)} 个翻译问题：")
        for issue in issues:
            print(f"\n  [{issue['type']}] {issue['ko']}")
            print(f"    当前: {issue['cn']}")
            if issue.get("suggestion"):
                print(f"    建议: {issue['suggestion']}")
            print(f"    评分: {issue.get('score', '?')}/5")
    else:
        print("\n所有翻译质量良好！")
