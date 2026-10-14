import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scraper import calories
from scraper.ai_client import AIRequestError


def menus(*names):
    return [{'meals': {'lunch': {'sections': [{'items': [{'ko': name, 'calories': 325, 'calories_source': 'estimate'} for name in names]}]}}}]


def items(data):
    return data[0]['meals']['lunch']['sections'][0]['items']


class NutritionTests(unittest.TestCase):
    def test_ranges_and_explicit_abstentions_preserve_names_and_units(self):
        rows = [{'name': '쌀밥', 'kcal_min': 132, 'kcal_max': 168}, {'name': '불명', 'kcal_min': None, 'kcal_max': None}]
        self.assertEqual(calories._parse_response(json.dumps(rows), ['쌀밥', '불명']), [{'kcal_min': 130, 'kcal_max': 170}, None])

    def test_bad_counts_names_and_numbers_never_reach_the_menu(self):
        for rows in [[], [{'name': 'different', 'kcal_min': 100, 'kcal_max': 200}]]:
            with self.subTest(rows=rows), self.assertRaises(AIRequestError):
                calories._parse_response(json.dumps(rows), ['쌀밥'])
        with self.assertRaises(AIRequestError):
            calories._parse_response(json.dumps([{'name': '쌀밥', 'kcal_min': 100, 'kcal_max': 200, 'basis': 'serving'}]), ['쌀밥'])
        for low, high in [(None, 10), (-5, 10), (True, 10), ('130', 170), (170, 130), (100, 901), (100, 100)]:
            with self.subTest(low=low, high=high), self.assertRaises(AIRequestError):
                calories._parse_response(json.dumps([{'name': '쌀밥', 'kcal_min': low, 'kcal_max': high}]), ['쌀밥'])

    def test_deduplication_removes_display_decorations_and_skips_choices(self):
        data = menus('쌀밥', '쌀밥', '★ 당일 조리 ★ 참치마요샌드위치 [11:00 ~ 14:00] 한정수량', '참치마요샌드위치', '흑미밥/백미밥', '배추김치&깍두기', '꾸러미세트(프로틴 / 숙취)', '*위 메뉴는 변경될 수 있습니다.')
        with patch.dict(os.environ, {'NUTRITION_ESTIMATION_ENABLED': '1'}), patch.object(calories, '_load_cache', return_value={}), patch.object(calories, '_save_cache'), patch.object(calories, 'request_batch', return_value=[{'kcal_min': 130, 'kcal_max': 170}, {'kcal_min': 200, 'kcal_max': 300}]) as api:
            summary = calories.annotate_menu_with_calories(data, 'test-key')
        self.assertEqual(api.call_args.args[0], ['쌀밥', '참치마요샌드위치'])
        self.assertEqual(summary['estimated'], 4)
        self.assertEqual(items(data)[0]['nutrition']['basis'], '100g')
        self.assertEqual(items(data)[0]['nutrition']['source'], 'ai_estimate')
        self.assertNotIn('calories', items(data)[0])
        self.assertTrue(all(item['nutrition'] is None for item in items(data)[4:]))
        self.assertEqual(items(data)[-1]['kind'], 'note')

    def test_failed_api_is_not_cached_and_retries_next_run(self):
        cache = {}
        with patch.dict(os.environ, {'NUTRITION_ESTIMATION_ENABLED': '1'}), patch.object(calories, '_load_cache', return_value=cache), patch.object(calories, '_save_cache'), patch.object(calories, 'request_batch', side_effect=AIRequestError('HTTP 429')):
            self.assertEqual(calories.annotate_menu_with_calories(menus('쌀밥'), 'test-key')['estimated'], 0)
        self.assertEqual(cache, {})
        with patch.dict(os.environ, {'NUTRITION_ESTIMATION_ENABLED': '1'}), patch.object(calories, '_load_cache', return_value=cache), patch.object(calories, '_save_cache'), patch.object(calories, 'request_batch', return_value=[{'kcal_min': 130, 'kcal_max': 170}]) as api:
            self.assertEqual(calories.annotate_menu_with_calories(menus('쌀밥'), 'test-key')['estimated'], 1)
        self.assertEqual(api.call_count, 1)

    def test_abstentions_are_cached_and_disabled_mode_clears_legacy_values(self):
        data = menus('쌀밥', '불명')
        cache = {'쌀밥': {'kcal_min': 130, 'kcal_max': 170}, '불명': None}
        with patch.dict(os.environ, {'NUTRITION_ESTIMATION_ENABLED': '1'}), patch.object(calories, '_load_cache', return_value=cache), patch.object(calories, 'request_batch') as api:
            self.assertEqual(calories.annotate_menu_with_calories(data, 'test-key')['estimated'], 1)
            api.assert_not_called()
        with patch.dict(os.environ, {'NUTRITION_ESTIMATION_ENABLED': '0'}), patch.object(calories, 'request_batch') as api:
            self.assertEqual(calories.annotate_menu_with_calories(data, 'test-key')['status'], 'disabled')
            self.assertTrue(all(item['nutrition'] is None for item in items(data)))
            api.assert_not_called()

    def test_cache_separates_models_and_discards_malformed_values(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(calories, 'CACHE_PATH', Path(directory) / 'cache.json'):
            calories._save_cache({'쌀밥': {'kcal_min': 130, 'kcal_max': 170}, 'bad': {'kcal_min': -5, 'kcal_max': 170}, 'unknown': None}, 'model-a', 'https://example.invalid')
            self.assertEqual(set(calories._load_cache('model-a', 'https://example.invalid')), {'쌀밥', 'unknown'})
            self.assertEqual(calories._load_cache('model-b', 'https://example.invalid'), {})
            self.assertEqual(calories._load_cache('model-a', 'https://other.invalid'), {})

    def test_missing_credentials_never_restore_legacy_per_serving_guesses(self):
        data = menus('쌀밥')
        with patch.object(calories, '_load_cache', return_value={}), patch.object(calories, 'request_batch') as api:
            summary = calories.annotate_menu_with_calories(data, '')
        self.assertEqual(summary['status'], 'unavailable')
        self.assertIsNone(items(data)[0]['nutrition'])
        self.assertNotIn('calories', items(data)[0])
        api.assert_not_called()
