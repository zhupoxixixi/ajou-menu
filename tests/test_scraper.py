import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from bs4 import BeautifulSoup

from scraper import ai_client, translator, main
from scraper.fetcher import _parse_menu_text, extract_service_hours, RESTAURANTS, MEAL_MAP, MEAL_CN
from scraper.sync_site import sync_site, ASSETS


def restaurant(rid):
    return {'id': rid, **RESTAURANTS[rid], 'meals': {key: {'label_ko': label, 'label_cn': MEAL_CN[key], 'sections': []} for key, label in MEAL_MAP.items()}}


class TranslationTests(unittest.TestCase):
    def test_duplicates_use_one_request_and_keep_input_order(self):
        cache = {}
        with patch.object(translator, '_translate_and_review_batch', return_value=['泡菜', '白米饭']) as api, patch.object(translator, '_save_cache'):
            result = translator.translate_concurrent(['김치', '쌀밥', '김치'], 'test-key', 'https://example.invalid', cache)
        self.assertEqual(result, ['泡菜', '白米饭', '泡菜'])
        self.assertEqual(api.call_count, 1)
        self.assertEqual(api.call_args.args[0], ['김치', '쌀밥'])

    def test_failure_is_not_cached_and_next_run_retries(self):
        cache = {}
        with patch.object(translator, '_translate_and_review_batch', side_effect=translator.TranslationError('HTTP 429')), patch.object(translator, '_save_cache'):
            self.assertEqual(translator.translate_concurrent(['김치'], 'test-key', 'https://example.invalid', cache), [''])
        self.assertEqual(cache, {})
        with patch.object(translator, '_translate_and_review_batch', return_value=['泡菜']) as api, patch.object(translator, '_save_cache'):
            self.assertEqual(translator.translate_concurrent(['김치'], 'test-key', 'https://example.invalid', cache), ['泡菜'])
            self.assertEqual(api.call_count, 1)

    def test_bad_response_cannot_silently_misalign_translations(self):
        for content in ['["泡菜"]', '["泡菜", "쌀밥"]', '{"0":"泡菜"}', 'not JSON']:
            with self.subTest(content=content), self.assertRaises(translator.TranslationError):
                translator._parse_response(content, ['김치', '쌀밥'])

    def test_critical_menu_terms_preserve_meal_and_unspecified_ingredients(self):
        self.assertFalse(translator.is_valid_translation('증식(6,500원): 11:00~14:00', '加餐(6,500韩元): 11:00~14:00'))
        self.assertTrue(translator.is_valid_translation('증식(6,500원): 11:00~14:00', '午餐(6,500韩元): 11:00~14:00'))
        self.assertFalse(translator.is_valid_translation('장조림버터볶음밥', '酱牛肉黄油炒饭'))
        self.assertTrue(translator.is_valid_translation('소고기장조림', '酱卤牛肉'))

    def test_legacy_poisoned_cache_is_invalidated(self):
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory) / 'cache.json'
            cache.write_text(json.dumps({'김치': '김치'}), encoding='utf-8')
            with patch.object(translator, 'CACHE_PATH', cache):
                self.assertEqual(translator._load_cache(), {})
                translator._save_cache({'김치': '泡菜'})
                self.assertEqual(translator._load_cache(), {'김치': '泡菜'})
                self.assertEqual(translator._load_cache(model='other-model'), {})

    def test_rate_limit_retries_but_auth_error_does_not(self):
        response = Mock(ok=True, status_code=200)
        response.json.return_value = {'choices': [{'message': {'content': '["泡菜"]'}}]}
        limited = Mock(ok=False, status_code=429, headers={'Retry-After': '1'})
        client = Mock()
        client.post.side_effect = [limited, response]
        with patch.object(ai_client, '_session', return_value=client), patch.object(ai_client.time, 'sleep'):
            self.assertEqual(translator._call_batch(['김치'], 'test-key', 'https://example.invalid', 'test-model'), ['泡菜'])
        self.assertEqual(client.post.call_count, 2)
        client.post.reset_mock()
        client.post.side_effect = None
        client.post.return_value = Mock(ok=False, status_code=401)
        with patch.object(ai_client, '_session', return_value=client), self.assertRaises(translator.TranslationError):
            translator._call_batch(['김치'], 'test-key', 'https://example.invalid', 'test-model')
        self.assertEqual(client.post.call_count, 1)


class PartialTranslationTests(unittest.TestCase):
    def test_valid_batch_items_survive_and_only_missing_text_is_retried(self):
        cache = {}
        with patch.object(translator, '_translate_and_review_batch', side_effect=[['泡菜', ''], ['白米饭']]) as api, patch.object(translator, '_save_cache'):
            result = translator.translate_concurrent(['김치', '쌀밥', '김치'], 'test-key', 'https://example.invalid', cache)
        self.assertEqual(result, ['泡菜', '白米饭', '泡菜'])
        self.assertEqual([c.args[0] for c in api.call_args_list], [['김치', '쌀밥'], ['쌀밥']])

    def test_partial_parser_still_rejects_wrong_count(self):
        with self.assertRaises(translator.TranslationError):
            translator._parse_response('["泡菜"]', ['김치', '쌀밥'], allow_partial=True)
        self.assertEqual(translator._parse_response('["泡菜", "쌀밥"]', ['김치', '쌀밥'], allow_partial=True), ['泡菜', ''])


class FetchTests(unittest.TestCase):
    def test_failed_restaurant_keeps_its_id_and_explicit_status(self):
        def fetch(date, rid):
            if rid == 363910:
                raise TimeoutError()
            return restaurant(rid)
        with patch.object(main, 'fetch_menu', side_effect=fetch):
            day = main.fetch_single_day('2026-10-14')
        self.assertEqual([entry['id'] for entry in day['restaurants']], [363910, 221904])
        self.assertEqual([entry['fetch_status'] for entry in day['restaurants']], ['error', 'ok'])

    def test_stale_fallback_only_uses_the_same_day_and_copies_data(self):
        old = restaurant(363910)
        old['meals']['lunch']['sections'] = [{'name_ko': '중식', 'name_cn': '午餐', 'items': [{'ko': '쌀밥', 'cn': '白米饭', 'calories': 325}]}]
        previous = {'days': {'2026-10-14': {'restaurants': [old], 'generated_at': '2026-10-14T00:00:00+09:00'}}}
        with patch.object(main, 'fetch_menu', side_effect=TimeoutError()):
            day = main.fetch_single_day('2026-10-14', previous)
            other = main.fetch_single_day('2026-10-15', previous)
        self.assertEqual(day['restaurants'][0]['fetch_status'], 'stale')
        self.assertEqual(other['restaurants'][0]['fetch_status'], 'error')
        self.assertNotIn('fetch_status', old)
        item = day['restaurants'][0]['meals']['lunch']['sections'][0]['items'][0]
        self.assertEqual(item, {'ko': '쌀밥', 'cn': '白米饭', 'kind': 'dish'})
        self.assertEqual(old['meals']['lunch']['sections'][0]['items'][0]['calories'], 325)

    def test_parser_preserves_unsectioned_notices_and_menu_text(self):
        sections = _parse_menu_text('* 운영 안내\n<중식>\n쌀밥\n김치')
        self.assertEqual(len(sections), 2)
        self.assertEqual(sections[1]['items'][1]['ko'], '김치')
        self.assertEqual(_parse_menu_text('등록된 식단이 없습니다'), [])

    def test_sync_covers_every_public_asset(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            for asset in ASSETS:
                (base / asset).write_text(asset, encoding='utf-8')
            sync_site(base)
            for asset in ASSETS:
                self.assertEqual((base / 'site' / asset).read_text(encoding='utf-8'), asset)

    def test_service_hours_prefer_daily_notices_over_location_and_fallbacks(self):
        soup = BeautifulSoup('<div class="b-location-box"><pre>아침 08:00 - 09:50\n점심 11:00 - 14:00\n저녁 16:30 - 18:30</pre></div><div class="b-menu-day breakfast"><pre>조식: 7:00~8:00\n중식(6500원): 11:00~13:30</pre></div>', 'lxml')
        hours = extract_service_hours(soup, 363910)
        self.assertEqual(hours['breakfast'], {'start': '07:00', 'end': '08:00', 'source': 'daily_menu'})
        self.assertEqual(hours['lunch']['end'], '13:30')
        self.assertEqual(hours['dinner']['end'], '18:30')

    def test_staff_hours_ignore_seasonal_overview_and_handle_typo_and_closure(self):
        soup = BeautifulSoup('<div class="b-location-box"><pre>중식: 11:00~14:00 / 석식: 17:00~19:00\n방학중 석식: 미운영</pre></div><div class="b-menu-day breakfast"><pre>증식(6,500원): 11:00~14:00\n석식(6500원): 16:30~18:40\n테이크아웃: 11:00~14:00</pre></div>', 'lxml')
        hours = extract_service_hours(soup, 221904)
        self.assertNotIn('breakfast', hours)
        self.assertEqual(hours['dinner'], {'start': '16:30', 'end': '18:40', 'source': 'daily_menu'})
        closed = BeautifulSoup('<div class="b-menu-day"><pre>석식: 미운영</pre></div>', 'lxml')
        self.assertIsNone(extract_service_hours(closed, 221904)['dinner'])


if __name__ == '__main__':
    unittest.main()
