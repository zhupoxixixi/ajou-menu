import json
import os
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from scraper import ai_client, main, translator
from scraper.fetcher import MEAL_CN, MEAL_MAP, RESTAURANTS


OUTPUT_DIR = Path(__file__).resolve().parents[1] / 'output' / 'luna-pipeline-20261022'
ENDPOINT = 'https://example.invalid/v1'


class TranslationPipelineTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    def test_rejected_or_failed_review_is_not_cached_after_single_retry(self):
        for failure in ('reject', 'exception'):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory(dir=OUTPUT_DIR) as directory:
                cache_path = Path(directory) / 'translation-cache.json'
                reviewer = Mock(return_value=['']) if failure == 'reject' else Mock(
                    side_effect=translator.TranslationError('review failed')
                )
                cache = {}

                with patch.object(translator, 'CACHE_PATH', cache_path), patch.object(
                    translator, '_call_batch', return_value=['泡菜']
                ) as translate, patch.object(translator, '_call_review_batch', reviewer):
                    result = translator.translate_concurrent(['김치'], 'test-key', ENDPOINT, cache)

                self.assertEqual(result, [''])
                self.assertEqual(cache, {})
                self.assertEqual(translate.call_count, 2)
                self.assertEqual(reviewer.call_count, 2)
                payload = json.loads(cache_path.read_text(encoding='utf-8'))
                self.assertEqual(payload['entries'], {})
                self.assertEqual(payload['pipeline'], 'translate-review-v1')

    def test_review_correction_is_the_only_value_saved_in_cache(self):
        with tempfile.TemporaryDirectory(dir=OUTPUT_DIR) as directory:
            cache_path = Path(directory) / 'translation-cache.json'
            cache = {}
            with patch.object(translator, 'CACHE_PATH', cache_path), patch.object(
                translator, '_call_batch', return_value=['泡菜']
            ) as translate, patch.object(
                translator, '_call_review_batch', return_value=['韩式泡菜']
            ) as review:
                result = translator.translate_concurrent(['김치'], 'test-key', ENDPOINT, cache)
                loaded = translator._load_cache(translator.DEFAULT_MODEL, ENDPOINT)

            self.assertEqual(result, ['韩式泡菜'])
            self.assertEqual(cache, {'김치': '韩式泡菜'})
            self.assertEqual(loaded, {'김치': '韩式泡菜'})
            translate.assert_called_once()
            review.assert_called_once()
            payload = json.loads(cache_path.read_text(encoding='utf-8'))
            self.assertEqual(payload['entries'], {'김치': '韩式泡菜'})
            self.assertNotIn('泡菜', payload['entries'].values())

    def test_completed_review_batches_survive_an_interruption(self):
        with tempfile.TemporaryDirectory(dir=OUTPUT_DIR) as directory:
            cache_path = Path(directory) / 'translation-cache.json'
            saved = threading.Event()
            save_cache = translator._save_cache

            def checkpoint(*args, **kwargs):
                save_cache(*args, **kwargs)
                saved.set()

            def batch(sources, *_args, **_kwargs):
                if sources == ['김치']:
                    return ['泡菜']
                if not saved.wait(2):
                    raise AssertionError('The approved batch was not checkpointed')
                raise KeyboardInterrupt()

            with patch.object(translator, 'CACHE_PATH', cache_path), patch.dict(
                os.environ, {'TRANSLATE_BATCH_SIZE': '1', 'TRANSLATE_MAX_WORKERS': '1'}
            ), patch.object(translator, '_translate_and_review_batch', side_effect=batch), patch.object(
                translator, '_save_cache', side_effect=checkpoint
            ):
                with self.assertRaises(KeyboardInterrupt):
                    translator.translate_concurrent(['김치', '쌀밥'], 'test-key', ENDPOINT, {})
                self.assertEqual(translator._load_cache(translator.DEFAULT_MODEL, ENDPOINT), {'김치': '泡菜'})

    def test_valid_cn_on_stale_records_is_still_submitted_for_review(self):
        menu = [{
            'fetch_status': 'stale',
            'stale_reason': 'fetch_error',
            'name_ko': '기숙사식당',
            'name_cn': '旧餐厅译名',
            'location_ko': '기숙사식당동 2층',
            'location_cn': '旧位置译名',
            'meals': {
                'lunch': {
                    'sections': [{
                        'name_ko': '메인',
                        'name_cn': '旧窗口译名',
                        'items': [{'ko': '김치', 'cn': '泡菜'}],
                    }],
                },
            },
        }]

        with patch.object(translator, '_load_cache', return_value={}), patch.object(
            translator,
            'translate_concurrent',
            side_effect=lambda texts, *_args, **_kwargs: [f'新译:{source}' for source in texts],
        ) as pipeline:
            translator.translate_menu(menu, 'test-key', ENDPOINT)

        sources = pipeline.call_args.args[0]
        self.assertEqual(sources, ['기숙사식당', '기숙사식당동 2층', '메인', '김치'])
        self.assertEqual(menu[0]['meals']['lunch']['sections'][0]['items'][0]['cn'], '新译:김치')

    def test_legacy_or_unmarked_cache_cannot_be_loaded_as_pipeline_cache(self):
        with tempfile.TemporaryDirectory(dir=OUTPUT_DIR) as directory:
            cache_path = Path(directory) / 'translation-cache.json'
            base = {
                'namespace': translator._namespace(translator.DEFAULT_MODEL, ENDPOINT),
                'entries': {'김치': '泡菜'},
            }
            invalid_payloads = [
                {'version': 3, **base},
                {'version': translator.CACHE_VERSION, **base},
            ]

            with patch.object(translator, 'CACHE_PATH', cache_path):
                for payload in invalid_payloads:
                    with self.subTest(payload=payload):
                        cache_path.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
                        self.assertEqual(translator._load_cache(translator.DEFAULT_MODEL, ENDPOINT), {})

                valid = {
                    'version': translator.CACHE_VERSION,
                    'namespace': translator._namespace(translator.DEFAULT_MODEL, ENDPOINT),
                    'pipeline': 'translate-review-v1',
                    'entries': {'김치': '泡菜'},
                }
                cache_path.write_text(json.dumps(valid, ensure_ascii=False), encoding='utf-8')
                self.assertEqual(translator._load_cache(translator.DEFAULT_MODEL, ENDPOINT), {'김치': '泡菜'})

    def test_expired_api_deadline_does_not_send_another_request(self):
        client = Mock()
        parser = Mock(return_value=['泡菜'])

        with patch.object(ai_client, '_session', return_value=client), patch.object(
            ai_client.time, 'monotonic', return_value=101.0
        ):
            with self.assertRaisesRegex(ai_client.AIRequestError, 'time budget exhausted'):
                ai_client.request_batch(
                    ['김치'], 'test-key', ENDPOINT, 'gpt-6-luna', 'Translate', parser,
                    reasoning_effort='max', deadline=100.0,
                )

        client.post.assert_not_called()
        parser.assert_not_called()

    def test_response_cannot_silently_change_effort_or_combine_assistant_messages(self):
        message = {'type': 'message', 'role': 'assistant', 'status': 'completed',
                   'content': [{'type': 'output_text', 'text': '["泡菜"]'}]}
        invalid = [
            {'output': [message], 'reasoning': {'effort': 'high'}},
            {'output': [message], 'model': 'different-model'},
            {'output': [message, message]},
            {'output': [{'type': 'message', 'role': 'assistant', 'status': 'incomplete',
                         'content': message['content']}]},
            [],
        ]
        for body in invalid:
            if isinstance(body, dict):
                body['status'] = 'completed'
            with self.subTest(body=body), self.assertRaises(ai_client.AIRequestError):
                ai_client._response_text(body, 'gpt-6-luna', 'max')
        with self.assertRaises(ai_client.AIRequestError):
            ai_client._response_text({'output': [message]}, 'gpt-6-luna', 'max')
        self.assertEqual(ai_client._response_text({'status': 'completed', 'output': [message], 'reasoning': {'effort': 'max'}}, 'gpt-6-luna', 'max'), '["泡菜"]')

    def test_responses_incomplete_is_rejected_even_when_output_text_exists(self):
        response = Mock(ok=True, status_code=200)
        response.json.return_value = {
            'status': 'incomplete',
            'output': [{
                'type': 'message',
                'role': 'assistant',
                'status': 'completed',
                'content': [{'type': 'output_text', 'text': '["泡菜"]'}],
            }],
        }
        client = Mock()
        client.post.return_value = response
        parser = Mock(return_value=['泡菜'])

        with patch.object(ai_client, '_session', return_value=client), patch.object(ai_client.time, 'sleep'):
            with self.assertRaises(ai_client.AIRequestError):
                ai_client.request_batch(
                    ['김치'], 'test-key', ENDPOINT, 'gpt-6-luna', 'Translate', parser,
                    reasoning_effort='max',
                )

        self.assertEqual(client.post.call_count, 3)
        parser.assert_not_called()

    def test_main_keeps_previous_publish_when_review_fails(self):
        with tempfile.TemporaryDirectory(dir=OUTPUT_DIR) as directory:
            base_dir = Path(directory)
            published = base_dir / 'menu-data.js'
            previous_text = 'const MENU_DATA = {"keep":"previous"};\n'
            published.write_text(previous_text, encoding='utf-8')
            cache_path = base_dir / 'translation-cache.json'

            def fake_fetch_menu(date, restaurant_id):
                meals = {
                    key: {'label_ko': label, 'label_cn': MEAL_CN[key], 'sections': []}
                    for key, label in MEAL_MAP.items()
                }
                if date == '2026-10-19' and restaurant_id == 363910:
                    meals['lunch']['sections'] = [{
                        'name_ko': '주요 메뉴',
                        'name_cn': '主菜单',
                        'items': [{'ko': '김치', 'cn': '泡菜'}],
                    }]
                return {'id': restaurant_id, **RESTAURANTS[restaurant_id], 'meals': meals}

            def draft_batch(sources, *_args, **_kwargs):
                return ['泡菜'] * len(sources)

            def reject_batch(sources, _drafts, *_args, **_kwargs):
                return [''] * len(sources)

            env = {
                'REQUIRE_TRANSLATION': '1',
                'TRANSLATE_API_KEY': 'test-key',
                'TRANSLATE_API_ENDPOINT': ENDPOINT,
                'TRANSLATE_MODEL': 'gpt-6-luna',
                'TRANSLATE_REASONING_EFFORT': 'max',
            }
            with patch.dict(os.environ, env), patch.object(main, 'BASE_DIR', base_dir), patch.object(
                main, '_load_previous', return_value={'days': {}}
            ), patch.object(main, 'fetch_menu', side_effect=fake_fetch_menu), patch.object(
                translator, 'CACHE_PATH', cache_path
            ), patch.object(translator, '_call_batch', side_effect=draft_batch), patch.object(
                translator, '_call_review_batch', side_effect=reject_batch
            ) as review, patch.object(main, '_write_json') as write_json, patch.object(
                main, 'sync_site'
            ) as sync_site:
                with self.assertRaisesRegex(RuntimeError, 'Chinese menu translations incomplete'):
                    main.run('2026-10-19')

            self.assertGreater(review.call_count, 0)
            write_json.assert_not_called()
            sync_site.assert_not_called()
            self.assertEqual(published.read_text(encoding='utf-8'), previous_text)


if __name__ == '__main__':
    unittest.main()
