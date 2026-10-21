import json
import os
import unittest
from unittest.mock import Mock, patch

from scraper import ai_client, main, translator


class AIConfigurationTests(unittest.TestCase):
    def client(self):
        response = Mock(ok=True, status_code=200)
        response.json.return_value = {'choices': [{'message': {'content': '["泡菜"]'}}]}
        client = Mock()
        client.post.return_value = response
        return client

    def test_translation_sends_haiku_55_and_max_to_the_gateway(self):
        client = self.client()
        with patch.dict(os.environ, {'TRANSLATE_REASONING_EFFORT': ''}), patch.object(ai_client, '_session', return_value=client):
            result = translator._call_batch(['김치'], 'test-key', 'https://example.invalid', translator.DEFAULT_MODEL)
        self.assertEqual(result, ['泡菜'])
        request = client.post.call_args.kwargs['json']
        self.assertEqual(request['model'], 'claude-haiku-5-5')
        self.assertEqual(request['reasoning_effort'], 'max')
        self.assertNotIn('temperature', request)
        self.assertEqual(client.post.call_args.args[0], 'https://example.invalid/chat/completions')

    def test_configured_effort_is_forwarded_and_isolates_the_cache(self):
        client = self.client()
        with patch.dict(os.environ, {'TRANSLATE_REASONING_EFFORT': 'max'}):
            maximum = translator._namespace(translator.DEFAULT_MODEL, 'https://example.invalid')
        with patch.dict(os.environ, {'TRANSLATE_REASONING_EFFORT': 'low'}), patch.object(ai_client, '_session', return_value=client):
            translator._call_batch(['김치'], 'test-key', 'https://example.invalid', translator.DEFAULT_MODEL)
            lower = translator._namespace(translator.DEFAULT_MODEL, 'https://example.invalid')
        self.assertNotEqual(maximum, lower)
        self.assertEqual(client.post.call_args.kwargs['json']['reasoning_effort'], 'low')

    def test_unspecified_effort_preserves_legacy_gpt_request_compatibility(self):
        client = self.client()
        with patch.object(ai_client, '_session', return_value=client):
            ai_client.request_batch(['김치'], 'test-key', 'https://example.invalid', 'gpt-6-luna', 'Translate', lambda content, _: json.loads(content))
        self.assertEqual(client.post.call_args.kwargs['json']['reasoning_effort'], 'none')
        self.assertNotIn('temperature', client.post.call_args.kwargs['json'])

    def test_published_translation_metadata_records_requested_effort(self):
        with patch.dict(os.environ, {'TRANSLATE_REASONING_EFFORT': 'max'}):
            summary = main.translation_summary([], translator.DEFAULT_MODEL)
        self.assertEqual(summary['model'], 'claude-haiku-5-5')
        self.assertEqual(summary['reasoning_effort'], 'max')

    def test_known_lunch_notice_typo_is_normalized_without_changing_other_sources(self):
        client = self.client()
        client.post.return_value.json.return_value = {'choices': [{'message': {'content': '["午餐(6,500韩元): 11:00~14:00", "加餐", "酱卤肉黄油炒饭"]'}}]}
        texts = ['증식(6,500원): 11:00~14:00', '증식', '장조림버터볶음밥']
        with patch.object(ai_client, '_session', return_value=client):
            result = translator._call_batch(texts, 'test-key', 'https://example.invalid', translator.DEFAULT_MODEL)
        sent = json.loads(client.post.call_args.kwargs['json']['messages'][1]['content'])
        self.assertEqual(sent, ['중식(6,500원): 11:00~14:00', '증식', '장조림버터볶음밥'])
        self.assertEqual(texts[0], '증식(6,500원): 11:00~14:00')
        self.assertEqual(result[0], '午餐(6,500韩元): 11:00~14:00')

    def test_notice_response_still_uses_original_source_validation(self):
        client = self.client()
        client.post.return_value.json.return_value = {'choices': [{'message': {'content': '["加餐(6,500韩元): 11:00~14:00"]'}}]}
        with patch.object(ai_client, '_session', return_value=client):
            result = translator._call_batch(['증식(6,500원): 11:00~14:00'], 'test-key', 'https://example.invalid', translator.DEFAULT_MODEL)
        self.assertEqual(result, [''])

    def test_korean_currency_suffix_is_localized_without_altering_the_amount(self):
        result = translator._parse_response('["午餐(6,500원): 11:00~14:00"]', ['증식(6,500원): 11:00~14:00'])
        self.assertEqual(result, ['午餐(6,500韩元): 11:00~14:00'])

    def test_currency_cleanup_does_not_accept_untranslated_food_or_wrong_lunch(self):
        for source, result in [('김치(500원)', '김치(500원)'), ('증식(6,500원): 11:00~14:00', '加餐(6,500원): 11:00~14:00')]:
            with self.subTest(source=source), self.assertRaises(translator.TranslationError):
                translator._parse_response(json.dumps([result]), [source])


if __name__ == '__main__':
    unittest.main()
