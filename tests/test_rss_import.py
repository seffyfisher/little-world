import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('rss_import', ROOT / 'scripts/import-rss-catalog.py')
rss = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rss)


class RSSImportTests(unittest.TestCase):
    def test_merge_keeps_original_ids_names_urls_and_adds_every_feeder_url(self):
        original = rss.parse_catalog((ROOT / 'data/awesome-tech-rss.opml').read_text())
        old = {item['id']: (item['name'], item['url']) for item in original['sources']}
        snapshot = json.loads((ROOT / 'data/feeder-popular-rss.json').read_text())
        merged = rss.merge_feeder(original, snapshot)
        sources = {item['id']: item for item in merged['sources']}
        for id, (name, url) in old.items():
            self.assertEqual((sources[id]['name'], sources[id]['url']), (name, url))
        keys = [rss.canonical_url(item['url']) for item in sources.values()]
        self.assertEqual(len(keys), len(set(keys)))
        for row in snapshot['entries']:
            matches = [item for item in sources.values() if rss.canonical_url(item['url']) == rss.canonical_url(row['url'])]
            self.assertEqual(len(matches), 1)
            self.assertIn('Feeder', matches[0]['categories'])
            self.assertIn(row['category'], matches[0]['categories'])

    def test_table_parser_ignores_prose_code_and_decodes_full_query_strings(self):
        parser = rss.FeederTables()
        parser.feed('''<h3>Business and finance RSS feeds</h3><table><tr>
            <td><a href="/add">Yahoo Finance: S&amp;P 500</a></td>
            <td>Change <code>^GSPC</code> to another symbol.</td>
            <td><code>https://feeds.finance.yahoo.com/rss/2.0/headline?s=^GSPC&amp;region=US&amp;lang=en-US</code></td>
            </tr></table><p><code>https://example.com/not-a-feed</code></p>''')
        self.assertEqual(len(parser.rows), 1)
        self.assertEqual(parser.rows[0]['name'], 'Yahoo Finance: S&P 500')
        self.assertTrue(parser.rows[0]['url'].endswith('?s=^GSPC&region=US&lang=en-US'))

    def test_changed_page_structure_cannot_silently_erase_pinned_feeds(self):
        with self.assertRaises(ValueError):
            rss.feeder_snapshot('<html><h1>Sign in</h1></html>', '2026-11-07')


if __name__ == '__main__':
    unittest.main()
