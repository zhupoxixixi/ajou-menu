import copy
import unittest
from datetime import datetime
from unittest.mock import Mock, patch

from scraper import fetcher, main


NOW = datetime(2026, 10, 17, 12, tzinfo=main.KST)
NO_MENU = '<div class="b-menu-day b-no-menu">등록된 식단이 없습니다.</div>'


def response(html):
    result = Mock(text=html)
    result.raise_for_status.return_value = None
    return result


def published_restaurant(rid):
    return {
        'id': rid, **fetcher.RESTAURANTS[rid], 'fetch_status': 'ok',
        'fetched_at': '2026-10-16T03:45:00+09:00',
        'meals': {meal: {'sections': []} for meal in fetcher.MEAL_MAP} | {
            'lunch': {'sections': [{'name_ko': 'A', 'name_cn': 'A',
                                    'items': [{'ko': '쌀밥', 'cn': '白米饭', 'kind': 'dish'}]}]}
        },
    }


class MenuStateTests(unittest.TestCase):
    def test_no_menu_html_does_not_claim_a_closure(self):
        with patch.object(fetcher._SESSION, 'get', return_value=response(NO_MENU)):
            value = fetcher.fetch_menu('2026-10-28', 363910)
        self.assertEqual(value['menu_status'], 'empty')
        self.assertNotIn('closure', value)
        self.assertFalse(fetcher.has_dishes(value))

    def test_successful_empty_response_preserves_same_day_food_and_original_timestamp(self):
        old = [published_restaurant(rid) for rid in fetcher.RESTAURANTS]
        previous = {'days': {'2026-10-12': {'restaurants': old}}}
        original = copy.deepcopy(previous)
        with patch.object(fetcher._SESSION, 'get', return_value=response(NO_MENU)):
            day = main.fetch_single_day('2026-10-12', previous, now=NOW)
        for saved in day['restaurants']:
            self.assertTrue(fetcher.has_dishes(saved))
            self.assertEqual(saved['fetch_status'], 'stale')
            self.assertEqual(saved['stale_reason'], 'source_empty')
            self.assertEqual(saved['menu_status'], 'available')
            self.assertEqual(saved['fetched_at'], '2026-10-16T03:45:00+09:00')
            self.assertEqual(saved['checked_at'], NOW.isoformat())
            self.assertEqual(saved['meals']['lunch']['sections'][0]['items'][0]['cn'], '白米饭')
        self.assertEqual(previous, original)

    def test_empty_response_preserves_previously_published_next_week_food_too(self):
        previous = {'next_week': {'days': {'2026-10-21': {'restaurants': [published_restaurant(363910)]}}}}
        with patch.object(fetcher._SESSION, 'get', return_value=response(NO_MENU)):
            day = main.fetch_single_day('2026-10-21', previous, now=NOW)
        self.assertEqual(day['restaurants'][0]['fetch_status'], 'stale')
        self.assertTrue(fetcher.has_dishes(day['restaurants'][0]))
        self.assertEqual(day['restaurants'][1]['menu_status'], 'not_published')

    def test_no_menu_states_depend_on_date_without_inventing_a_retention_window(self):
        previous = {'days': {'2026-10-12': {'restaurants': [published_restaurant(363910)]}}}
        for date, expected in [('2026-10-13', 'unavailable'), ('2026-10-28', 'not_published'),
                               ('2026-10-17', 'closed'), ('2026-10-18', 'closed')]:
            with self.subTest(date=date), patch.object(fetcher._SESSION, 'get', return_value=response(NO_MENU)):
                day = main.fetch_single_day(date, previous, now=NOW)
            for value in day['restaurants']:
                self.assertEqual(value['fetch_status'], 'ok')
                self.assertEqual(value['menu_status'], expected)
                self.assertFalse(fetcher.has_dishes(value))
                if expected == 'closed':
                    self.assertEqual(value['closure']['source'], 'weekend_no_menu')

    def test_current_weekday_without_menu_is_not_published(self):
        now = datetime(2026, 10, 16, 8, tzinfo=main.KST)
        with patch.object(fetcher._SESSION, 'get', return_value=response(NO_MENU)):
            day = main.fetch_single_day('2026-10-16', now=now)
        self.assertEqual(day['restaurants'][0]['menu_status'], 'not_published')

    def test_explicit_daily_closure_is_distinct_from_an_unconfirmed_empty_page(self):
        html = '<div class="b-menu-day b-no-menu">※금일 식당 전체 휴무입니다.※</div>'
        previous = {'days': {'2026-10-28': {'restaurants': [published_restaurant(363910)]}}}
        with patch.object(fetcher._SESSION, 'get', return_value=response(html)):
            day = main.fetch_single_day('2026-10-28', previous, now=NOW)
        value = day['restaurants'][0]
        self.assertEqual(value['fetch_status'], 'ok')
        self.assertEqual(value['menu_status'], 'closed')
        self.assertEqual(value['closure']['source'], 'daily_menu')
        self.assertFalse(fetcher.has_dishes(value))

    def test_partial_meal_closure_and_recurring_notice_do_not_close_an_entire_weekday(self):
        for text in ['석식: 미운영', '* 공휴일은 휴무입니다.']:
            html = f'<div class="b-menu-day breakfast"><pre>{text}</pre></div>'
            with self.subTest(text=text), patch.object(fetcher._SESSION, 'get', return_value=response(html)):
                value = fetcher.fetch_menu('2026-10-28', 363910)
            self.assertEqual(value['menu_status'], 'empty')
            self.assertFalse(fetcher.has_dishes(value))

    def test_all_scheduled_meals_explicitly_closed_is_a_daily_closure(self):
        html = '<div class="b-menu-day breakfast"><pre>중식: 미운영\n석식: 휴무</pre></div>'
        with patch.object(fetcher._SESSION, 'get', return_value=response(html)):
            value = fetcher.fetch_menu('2026-10-28', 221904)
        self.assertEqual(value['menu_status'], 'closed')
        self.assertEqual(value['closure']['source'], 'daily_menu')

    def test_malformed_or_unexplained_blank_containers_are_errors_and_keep_old_food(self):
        previous = {'days': {'2026-10-12': {'restaurants': [published_restaurant(363910)]}}}
        for html in ['<div class="b-menu-day"><p>unknown structure</p></div>',
                     '<div class="b-menu-day lunch"><pre></pre></div>']:
            with self.subTest(html=html), patch.object(fetcher._SESSION, 'get', return_value=response(html)):
                with self.assertRaises(ValueError):
                    fetcher.fetch_menu('2026-10-12', 363910)
                day = main.fetch_single_day('2026-10-12', previous, now=NOW)
            self.assertTrue(fetcher.has_dishes(day['restaurants'][0]))
            self.assertEqual(day['restaurants'][0]['stale_reason'], 'fetch_error')
            self.assertEqual(day['restaurants'][1]['fetch_status'], 'error')

    def test_valid_menu_is_available_and_closure_words_are_not_dishes(self):
        html = '<div class="b-menu-day lunch"><pre>&lt;A&gt;\n쌀밥\n김치\n* 운영 안내</pre></div>'
        with patch.object(fetcher._SESSION, 'get', return_value=response(html)):
            value = fetcher.fetch_menu('2026-10-16', 363910)
        self.assertEqual(value['menu_status'], 'available')
        self.assertTrue(fetcher.has_dishes(value))
        self.assertEqual(value['meals']['lunch']['sections'][0]['items'][-1]['kind'], 'note')


if __name__ == '__main__':
    unittest.main()
