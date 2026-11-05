from datetime import datetime, timezone, timedelta
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('static_builder', Path(__file__).resolve().parents[1] / 'scripts/refresh-static-data.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
SOURCE = {'id': 'news', 'url': 'https://example.com/rss', 'kind': 'feed', 'room': 'office'}


class StaticDataTests(unittest.TestCase):
    def test_upstream_failure_keeps_previous_items_with_original_timestamp(self):
        previous = {'items': [{'title': 'Previous real item'}], 'updatedAt': '2026-11-05T00:00:00Z'}
        with patch.object(builder.server, 'feed_data', side_effect=OSError('offline')):
            result = builder.refresh_source(SOURCE, previous, datetime.now(timezone.utc))
        self.assertTrue(result['stale'])
        self.assertEqual(result['items'], previous['items'])
        self.assertEqual(result['updatedAt'], previous['updatedAt'])

    def test_books_reuse_the_same_israel_calendar_day_snapshot(self):
        now = datetime.now(timezone.utc)
        previous = {'items': [{'title': 'Real book'}], 'nextRefreshAt': (now + timedelta(hours=1)).isoformat()}
        with patch.object(builder.server, 'evrit_books_data') as fetch:
            self.assertEqual(builder.refresh_source({**SOURCE, 'kind': 'evrit-books'}, previous, now), previous)
        fetch.assert_not_called()

    def test_reusing_source_id_with_another_url_never_publishes_old_source_content(self):
        previous = {'sources': [SOURCE], 'feeds': {'news': {'items': [{'title': 'Wrong website'}]}}}
        with patch.object(builder.server, 'feed_data', side_effect=OSError('offline')), patch.object(builder.server, 'weather_data', side_effect=OSError('offline')):
            result = builder.generate([{**SOURCE, 'url': 'https://other.example/rss'}], previous)
        self.assertEqual(result['feeds']['news']['items'], [])


if __name__ == '__main__':
    unittest.main()
