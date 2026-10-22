import os
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scraper import main, translator
from scraper.fetcher import MEAL_CN, MEAL_MAP, RESTAURANTS


OUTPUT_DIR = Path(__file__).resolve().parents[1] / 'output' / 'fix-audit-20261022'
NOTICE = '증식(6,500원): 11:00~14:00'
VALID_NOTICE = '午餐（六千五百韩元）：十一点至十四点'
CHANGED_PRICE = '午餐（650韩元）：11:00~14:00'
CHANGED_TIME = '午餐（6,500韩元）：12:00~15:00'


class TranslationIntegrityTests(unittest.TestCase):
    def test_korean_menu_cannot_be_left_as_english_only(self):
        self.assertFalse(translator.is_valid_translation('그린샐러드', 'green salad'))
        self.assertTrue(translator.is_valid_translation('그린샐러드', '蔬菜沙拉'))
        self.assertTrue(translator.is_valid_translation('Foodist+', 'Foodist+'))

    def test_operating_notice_markers_cannot_disappear_during_review(self):
        source = '★ 당일 조리 ★ 에그마요샌드위치 [11:00 ~ 14:00] 한정수량'
        correct = '★ 当日制作 ★ 蛋黄酱鸡蛋三明治 [11:00 ~ 14:00] 限量供应'
        self.assertTrue(translator.is_valid_translation(source, correct))
        for wrong in [correct.replace('★', ''), correct.replace('当日制作', ''), correct.replace('限量供应', '')]:
            with self.subTest(wrong=wrong):
                self.assertFalse(translator.is_valid_translation(source, wrong))
                self.assertEqual(translator._parse_review_response(json.dumps([{'id': 0, 'translation': wrong, 'approved': True}]), [source], allow_partial=True), [''])
        self.assertFalse(translator.is_valid_translation('★ 직화 ★ 김치나베우동', '★ 泡菜锅烧乌冬面 ★'))

    def test_reproduced_food_concept_errors_are_rejected(self):
        cases = [
            ('쫄면', '辣拌米肠', '韩式辣拌劲道面'),
            ('쫄면순두부찌개', '辣炒年糕嫩豆腐汤', '劲道面嫩豆腐汤'),
            ('멘치까스', '门把牛排（炸猪排）', '日式炸肉饼'),
            ('난자완쓰', '难炸丸子（甜酸酱）', '南煎丸子'),
            ('계란파국', '鸡蛋海带汤', '鸡蛋葱花汤'),
            ('자몽보코치니샐러드', '西柚班戟沙拉', '西柚马苏里拉奶酪球沙拉'),
            ('톳밥*양념장', '藜麦饭*酱料', '羊栖菜饭*调味酱'),
            ('조랭이떡국', '千层年糕汤', '葫芦形年糕汤'),
            ('숙주미나리무침', '绿豆芽韭菜凉拌', '凉拌绿豆芽水芹'),
            ('건파래볶음', '炒干海带丝', '炒干海苔'),
            ('오복지&락교', '五福地&落葵', '什锦酱菜&糖醋藠头'),
            ('떡갈비브로콜리볶음', '炒年糕饼排骨西兰花', '西兰花炒韩式肉饼'),
            ('콘포테이토샌드위치', '薯泥鸡蛋三明治', '玉米土豆三明治'),
            ('후리가케밥', '饭团拌饭', '日式拌饭料米饭'),
            ('김말이튀김', '紫菜包饭炸物', '炸紫菜粉丝卷'),
            ('즉석라볶이', '即食辣炒年糕', '现做拉面炒年糕'),
            ('건새우무볶음', '干虾炒', '虾米炒萝卜'),
            ('부추적채겉절이', '韭菜丝拌菜', '韭菜紫甘蓝鲜拌菜'),
        ]
        for source, wrong, correct in cases:
            with self.subTest(source=source):
                self.assertFalse(translator.is_valid_translation(source, wrong))
                self.assertTrue(translator.is_valid_translation(source, correct))

    def test_prompt_changes_invalidate_otherwise_valid_cached_translations(self):
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=OUTPUT_DIR) as directory:
            cache_path = Path(directory) / 'cache.json'
            with patch.object(translator, 'CACHE_PATH', cache_path):
                translator._save_cache({'김치': '泡菜'})
                self.assertEqual(translator._load_cache(), {'김치': '泡菜'})
                with patch.object(translator, 'PROMPT_HASH', 'updated-prompt'):
                    self.assertEqual(translator._load_cache(), {})

    def test_force_retranslation_bypasses_both_existing_fields_and_cache(self):
        menu = [{'meals': {'lunch': {'sections': [{
            'name_ko': '특별 코너', 'name_cn': '特别窗口',
            'items': [{'ko': '김치', 'cn': '泡菜'}],
        }]}}}]
        with patch.object(translator, '_load_cache') as load, patch.object(
            translator, 'translate_concurrent', return_value=['主餐', '韩式泡菜']
        ) as translate:
            translator.translate_menu(menu, 'test-key', 'https://example.invalid', force=True)
        load.assert_not_called()
        self.assertEqual(translate.call_args.args[0], ['특별 코너', '김치'])
        self.assertEqual(translate.call_args.args[3], {})
        section = menu[0]['meals']['lunch']['sections'][0]
        self.assertEqual((section['name_cn'], section['items'][0]['cn']), ('主餐', '韩式泡菜'))

    def test_reference_phrases_still_use_api_translation_and_review(self):
        menu = [{'meals': {'lunch': {'sections': [{
            'name_ko': '메인', 'name_cn': '主菜单',
            'items': [
                {'ko': '그린샐러드/잡곡밥', 'cn': '西兰花沙拉/杂粮饭'},
                {'ko': '메추리알새송이조림', 'cn': '鹌鹑蛋新鲜香菇炖菜'},
                {'ko': '유부미소국', 'cn': '味噌海带豆腐汤'},
            ],
        }]}}}]
        drafts = ['主餐', '蔬菜沙拉/杂粮饭', '鹌鹑蛋炖杏鲍菇', '豆皮味噌汤']
        finals = ['主菜', '田园沙拉/杂粮饭', '鹌鹑蛋炖杏鲍菇', '豆皮味噌汤']
        with patch.object(translator, '_load_cache', return_value={}), patch.object(translator, '_call_batch', return_value=drafts) as api, patch.object(
            translator, '_call_review_batch', return_value=finals
        ) as review, patch.object(translator, '_save_cache'):
            translator.translate_menu(menu, 'test-key', 'https://example.invalid')
        api.assert_called_once()
        review.assert_called_once()
        section = menu[0]['meals']['lunch']['sections'][0]
        self.assertEqual(section['name_cn'], '主菜')
        self.assertEqual([item['cn'] for item in section['items']], finals[1:])

    def test_glossary_is_only_relevant_prompt_guidance(self):
        self.assertIn('蔬菜沙拉 / 杂粮饭', translator._reference_prompt(['그린샐러드  / 잡곡밥']))
        self.assertEqual(translator._reference_prompt(['그린샐러드 / 치킨']), '')
        for source, result in translator.REFERENCE_TRANSLATIONS.items():
            with self.subTest(source=source):
                self.assertTrue(translator.is_valid_translation(source, result))

    def test_amount_and_time_format_variants_are_equivalent(self):
        variants = [
            VALID_NOTICE,
            '午餐(6，500 韩元)：11时至14时',
            '午餐(6500韩元): 11:00 - 14:00',
            '午餐(₩6,500): 11:00～14:00',
        ]
        for result in variants:
            with self.subTest(result=result):
                self.assertTrue(translator.is_valid_translation(NOTICE, result))

    def test_changed_added_omitted_and_repeated_prices_or_times_are_rejected(self):
        cases = [
            (NOTICE, CHANGED_PRICE),
            (NOTICE, '午餐：11:00~14:00'),
            (NOTICE, CHANGED_TIME),
            (NOTICE, '午餐（6,500韩元）：11:00'),
            (NOTICE, '午餐（6,500韩元）：11:00~14:00，11:00'),
            (NOTICE, '午餐（6,500韩元、6,500韩元）：11:00~14:00'),
            ('김치', '泡菜（500韩元）'),
            ('김치', '泡菜，11:00'),
        ]
        for source, result in cases:
            with self.subTest(source=source, result=result):
                self.assertFalse(translator.is_valid_translation(source, result))

    def test_menu_counts_are_not_mistaken_for_prices_or_times(self):
        self.assertTrue(translator.is_valid_translation('3종', '三种'))
        self.assertTrue(translator.is_valid_translation('3종 김치', '三种泡菜'))
        self.assertTrue(translator.is_valid_translation('천원의 아침밥', '千韩元早餐'))

    def test_arabic_digits_with_chinese_price_units_are_parsed_as_a_whole(self):
        self.assertFalse(translator.is_valid_translation('10000원', '2万韩元'))
        self.assertTrue(translator.is_valid_translation('20000원', '2万韩元'))
        self.assertTrue(translator.is_valid_translation('6500원', '6.5千韩元'))
        self.assertFalse(translator.is_valid_translation('6000원', '6.5千韩元'))
        self.assertTrue(translator.is_valid_translation('12000원', '1万2千韩元'))

    def test_price_ranges_check_both_values_with_shared_currency_or_unit(self):
        self.assertFalse(translator.is_valid_translation(
            '1,000~2,000원', '1,500~2,000韩元'
        ))
        self.assertTrue(translator.is_valid_translation(
            '1,000~2,000원', '1,000~2,000韩元'
        ))
        self.assertFalse(translator.is_valid_translation(
            '1~2만원', '2~2万韩元'
        ))
        self.assertTrue(translator.is_valid_translation(
            '1~2만원', '1~2万韩元'
        ))

    def test_currency_amount_can_touch_korean_or_chinese_text(self):
        self.assertFalse(translator.is_valid_translation('샐러드6500원', '沙拉650韩元'))
        self.assertTrue(translator.is_valid_translation('중식(6500원)', '午餐6500韩元'))

    def test_postfixed_meridiem_and_pm_range_inheritance(self):
        self.assertTrue(translator.is_valid_translation('7:00 AM', '上午7:00'))
        self.assertTrue(translator.is_valid_translation('7:00 PM', '下午7:00'))
        self.assertFalse(translator.is_valid_translation('7:00 PM', '上午7:00'))
        self.assertTrue(translator.is_valid_translation('오후 1:00~5:00', '13:00~17:00'))
        self.assertTrue(translator.is_valid_translation('오후 1:00~5:00', '下午1:00~下午5:00'))
        self.assertTrue(translator.is_valid_translation('오후 1:00~오전 5:00', '下午1:00~上午5:00'))

    def test_long_unpriced_identifier_returns_without_regex_backtracking(self):
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        code = (
            'from scraper.translator import is_valid_translation; '
            "value = '123456789012345678901234567890'; "
            'assert is_valid_translation(value, value)'
        )
        environment = os.environ.copy()
        environment.update({
            'PYTHONDONTWRITEBYTECODE': '1',
            'TEMP': str(OUTPUT_DIR),
            'TMP': str(OUTPUT_DIR),
        })
        subprocess.run(
            [sys.executable, '-c', code],
            check=True,
            timeout=3,
            cwd=Path(__file__).resolve().parents[1],
            env=environment,
        )

    def test_response_parser_rejects_changed_explicit_details(self):
        for result in (CHANGED_PRICE, CHANGED_TIME):
            with self.subTest(result=result), self.assertRaises(translator.TranslationError):
                translator._parse_response(json.dumps([result], ensure_ascii=False), [NOTICE])
        self.assertEqual(
            translator._parse_response(json.dumps([VALID_NOTICE], ensure_ascii=False), [NOTICE]),
            [VALID_NOTICE],
        )

    def test_invalid_persisted_cache_entry_is_discarded(self):
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=OUTPUT_DIR) as directory:
            cache_path = Path(directory) / 'cache.json'
            cache_path.write_text(json.dumps({
                'version': translator.CACHE_VERSION,
                'namespace': translator._namespace(translator.DEFAULT_MODEL, translator.DEFAULT_ENDPOINT),
                'entries': {NOTICE: CHANGED_TIME},
            }), encoding='utf-8')
            with patch.object(translator, 'CACHE_PATH', cache_path):
                self.assertEqual(translator._load_cache(), {})

    def test_invalid_cache_values_are_retranslated_and_never_saved(self):
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        cache = {NOTICE: CHANGED_TIME}
        with patch.object(translator, '_translate_and_review_batch', return_value=[VALID_NOTICE]) as api, patch.object(translator, '_save_cache'):
            translated = translator.translate_concurrent([NOTICE], 'test-key', 'https://example.invalid', cache)
        self.assertEqual(translated, [VALID_NOTICE])
        self.assertEqual(api.call_count, 1)
        self.assertEqual(cache, {NOTICE: VALID_NOTICE})

        with tempfile.TemporaryDirectory(dir=OUTPUT_DIR) as directory:
            cache_path = Path(directory) / 'cache.json'
            with patch.object(translator, 'CACHE_PATH', cache_path):
                translator._save_cache({NOTICE: CHANGED_TIME, '김치': '泡菜'})
            payload = json.loads(cache_path.read_text(encoding='utf-8'))
        self.assertEqual(payload['entries'], {'김치': '泡菜'})

    def test_existing_cn_value_uses_the_same_integrity_check(self):
        menu = [{
            'meals': {'lunch': {'sections': [{
                'name_ko': '중식', 'name_cn': '午餐',
                'items': [{'ko': NOTICE, 'cn': CHANGED_TIME}],
            }]}}
        }]
        with patch.object(translator, '_load_cache', return_value={}), patch.object(
            translator, 'translate_concurrent', return_value=['午餐', VALID_NOTICE]
        ) as translate:
            translator.translate_menu(menu, 'test-key', 'https://example.invalid')
        self.assertEqual(translate.call_args.args[0], ['중식', NOTICE])
        self.assertEqual(menu[0]['meals']['lunch']['sections'][0]['items'][0]['cn'], VALID_NOTICE)

    def test_summary_counts_windows_and_every_menu_row_but_not_location_metadata(self):
        restaurants = [{
            'name_ko': '기숙사식당', 'name_cn': '',
            'location_ko': '기숙사식당동 2층', 'location_cn': '',
            'meals': {'lunch': {'sections': [{
                'name_ko': '특별 코너', 'name_cn': '',
                'items': [
                    {'ko': '3종', 'cn': '三种'},
                    {'ko': '운영 시간 11:00~14:00', 'cn': '营业时间 11:00至14:00'},
                ],
            }, {
                'name_ko': '隐藏窗口', 'name_cn': '',
                'items': [],
            }]}}
        }]
        summary = main.translation_summary(restaurants, translator.DEFAULT_MODEL)
        self.assertEqual(summary['total'], 3)
        self.assertEqual(summary['translated'], 2)
        self.assertEqual(summary['status'], 'partial')

    def test_main_publish_gate_stops_when_a_window_is_missing_translation(self):
        def fake_fetch_menu(date, restaurant_id):
            data = {
                'id': restaurant_id,
                **RESTAURANTS[restaurant_id],
                'meals': {
                    key: {'label_ko': label, 'label_cn': MEAL_CN[key], 'sections': []}
                    for key, label in MEAL_MAP.items()
                },
            }
            data['meals']['lunch']['sections'] = [{
                'name_ko': '특별 코너',
                'name_cn': '' if restaurant_id == 363910 else '特别窗口',
                'items': [{'ko': '김치', 'cn': '泡菜'}],
            }]
            return data

        settings = {
            'REQUIRE_TRANSLATION': '1',
            'TRANSLATE_API_KEY': 'test-key',
            'TRANSLATE_API_ENDPOINT': 'https://example.invalid',
            'TRANSLATE_MODEL': translator.DEFAULT_MODEL,
        }
        with patch.dict('os.environ', settings), patch.object(main, '_load_previous', return_value={}), patch.object(
            main, 'fetch_menu', side_effect=fake_fetch_menu
        ), patch.object(main, 'translate_menu') as translate, patch.object(
            main, '_write_json'
        ) as write_json, patch.object(main, 'sync_site') as sync_site:
            with self.assertRaisesRegex(RuntimeError, 'Chinese menu translations incomplete'):
                main.run('2026-10-19')

        translate.assert_called_once()
        write_json.assert_not_called()
        sync_site.assert_not_called()


if __name__ == '__main__':
    unittest.main()
