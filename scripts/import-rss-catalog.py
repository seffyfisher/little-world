#!/usr/bin/env python3
"""Convert the pinned upstream OPML snapshot into a local, categorized JSON catalog."""
import hashlib
import json
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = "https://github.com/tuan3w/awesome-tech-rss"
REVISION = "cb81203ac637392b4dc3d829ad20b9bb189d7f51"
LABELS = {"Learning": "למידה", "Startup": "יזמות וסטארטאפים", "Tech News": "חדשות טכנולוגיה",
          "Products & Ideas": "מוצרים ורעיונות", "Engineering blogs": "פיתוח והנדסה",
          "Machine Learning": "בינה מלאכותית", "Design": "עיצוב וחוויית משתמש",
          "Psychology": "פסיכולוגיה", "Neuroscience": "מדעי המוח", "Science": "מדע",
          "Marketing": "שיווק", "Others": "עוד מקורות"}
FEEDER_URL = "https://feeder.co/knowledge-base/rss-content/popular-rss-feeds/"
FEEDER_SECTIONS = {
    "The 100 most-followed RSS feeds on Feeder": ("Feeder Popular", "Feeder · 100 הפופולריים"),
    "News RSS feeds from around the world": ("News", "חדשות מהעולם"),
    "Tech RSS feeds": ("Tech News", LABELS["Tech News"]),
    "Programming RSS feeds": ("Engineering blogs", LABELS["Engineering blogs"]),
    "AI RSS feeds": ("Machine Learning", LABELS["Machine Learning"]),
    "Science RSS feeds": ("Science", LABELS["Science"]),
    "Business and finance RSS feeds": ("Business & Finance", "כלכלה ועסקים"),
    "Sports RSS feeds": ("Sports", "ספורט"),
    "Gaming RSS feeds": ("Gaming", "משחקים וגיימינג"),
    "Webcomic RSS feeds": ("Comics", "קומיקס"),
    "Design RSS feeds": ("Design", LABELS["Design"]),
    "Food and recipe RSS feeds": ("Food", "אוכל ומתכונים"),
    "Culture, movie and music RSS feeds": ("Culture", "תרבות, קולנוע ומוזיקה"),
    "Podcast RSS feeds": ("Podcasts", "פודקאסטים"),
    "YouTube channels to follow with RSS": ("YouTube", "ערוצי YouTube"),
    "Reddit RSS feeds": ("Reddit", "קהילות Reddit"),
    "Is there a Reuters RSS feed?": ("News", "חדשות מהעולם"),
}


class FeederTables(HTMLParser):
    """Extract factual feed names/URLs from tables, without article prose or scripts."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.heading = None
        self.heading_text = []
        self.section = None
        self.in_table = False
        self.cells = None
        self.cell = None
        self.in_anchor = False
        self.in_code = False
        self.rows = []

    def handle_starttag(self, tag, attrs):
        if tag in ('h2', 'h3'):
            self.heading = tag
            self.heading_text = []
        if tag == 'table':
            self.in_table = True
        if self.in_table and tag == 'tr':
            self.cells = []
        if self.cells is not None and tag == 'td':
            self.cell = {'text': [], 'anchor': [], 'code': []}
        if self.cell is not None:
            if tag == 'a':
                self.in_anchor = True
            if tag == 'code':
                self.in_code = True

    def handle_data(self, text):
        if self.heading:
            self.heading_text.append(text)
        if self.cell is not None:
            self.cell['text'].append(text)
            if self.in_anchor:
                self.cell['anchor'].append(text)
            if self.in_code:
                self.cell['code'].append(text)

    def handle_endtag(self, tag):
        if tag == self.heading:
            self.section = FEEDER_SECTIONS.get(''.join(self.heading_text).strip())
            self.heading = None
        if tag == 'a':
            self.in_anchor = False
        if tag == 'code':
            self.in_code = False
        if tag == 'td' and self.cell is not None:
            self.cells.append(self.cell)
            self.cell = None
        if tag == 'tr' and self.cells is not None:
            if self.section and self.cells:
                urls = [''.join(c['code']).strip() for c in self.cells if c['code'] and ''.join(c['code']).strip().startswith(('https://', 'http://'))]
                names = [''.join(c['anchor']).strip() for c in self.cells if c['anchor']]
                if len(urls) == 1 and names:
                    canonical_url(urls[0])
                    self.rows.append({'name': names[0], 'url': urls[0], 'category': self.section[0]})
            self.cells = None
        if tag == 'table':
            self.in_table = False


def feeder_snapshot(html, retrieved_at):
    parser = FeederTables()
    parser.feed(html)
    if sum(row['category'] == 'Feeder Popular' for row in parser.rows) != 100:
        raise ValueError('Expected exactly100 popular feed rows; inspect a changed source page before importing.')
    categories = dict([('Feeder', 'Feeder · כל ההמלצות'), *FEEDER_SECTIONS.values()])
    return {'origin': {'id': 'feeder-popular', 'url': FEEDER_URL, 'retrievedAt': retrieved_at},
            'categories': [{'id': key, 'label': label} for key, label in categories.items()], 'entries': parser.rows}


def canonical_url(url):
    p = urlsplit(url.strip())
    if p.scheme not in ("http", "https") or not p.hostname or p.username or p.password or p.port not in (None, 80, 443):
        raise ValueError("Catalog entries must use public HTTP feed URLs without credentials.")
    return urlunsplit(("https", p.netloc.lower(), p.path.rstrip("/") or "/", p.query, ""))


def parse_catalog(raw):
    if "<!DOCTYPE" in raw.upper() or "<!ENTITY" in raw.upper():
        raise ValueError("Unsupported OPML declarations.")
    entries = {}
    count = 0
    for group in ET.fromstring(raw).find("body"):
        category = group.get("text", "Others").strip()
        for item in group.iter("outline"):
            if not item.get("xmlUrl"):
                continue
            count += 1
            url = item.get("xmlUrl").strip()
            key = canonical_url(url)
            if key not in entries:
                entries[key] = {"id": "catalog-rss-" + hashlib.sha256(key.encode()).hexdigest()[:12],
                                "name": item.get("title", item.get("text", url)).strip(), "url": url,
                                "kind": "feed", "room": "office", "categories": [], "aliases": []}
            entry = entries[key]
            if category not in entry["categories"]:
                entry["categories"].append(category)
            if url not in entry["aliases"]:
                entry["aliases"].append(url)
            if url.startswith("https:"):
                entry["url"] = url
    return {"schemaVersion": 1, "origin": {"url": UPSTREAM, "commit": REVISION, "license": "CC0-1.0"},
            "upstreamEntries": count, "categories": [{"id": key, "label": value} for key, value in LABELS.items()],
            "sources": list(entries.values())}


def merge_feeder(catalog, snapshot):
    """Keep every existing ID, URL and name; merge shared URLs and topic membership."""
    entries = {canonical_url(source['url']): source for source in catalog['sources']}
    categories = {category['id']: category for category in catalog['categories']}
    categories.update({category['id']: category for category in snapshot['categories']})
    for item in snapshot['entries']:
        url = item['url'].strip()
        key = canonical_url(url)
        if key not in entries:
            entries[key] = {'id': 'catalog-rss-' + hashlib.sha256(key.encode()).hexdigest()[:12],
                            'name': item['name'].strip(), 'url': url, 'kind': 'feed', 'room': 'office',
                            'categories': [], 'aliases': []}
        source = entries[key]
        for category in ['Feeder', item['category']]:
            if category not in categories:
                raise ValueError('Unknown Feeder category')
            if category not in source['categories']:
                source['categories'].append(category)
        if url not in source['aliases']:
            source['aliases'].append(url)
    return {**catalog, 'origins': [catalog['origin'], snapshot['origin']],
            'additionalEntries': len(snapshot['entries']), 'categories': list(categories.values()),
            'sources': list(entries.values())}


if __name__ == "__main__":
    import argparse
    from datetime import datetime, timezone
    parser = argparse.ArgumentParser()
    parser.add_argument('--feeder-html', type=Path, help='Refresh the pinned factual list from a downloaded Feeder page')
    args = parser.parse_args()
    snapshot_path = ROOT / 'data/feeder-popular-rss.json'
    if args.feeder_html:
        snapshot = feeder_snapshot(args.feeder_html.read_text(), datetime.now(timezone.utc).isoformat())
        snapshot_path.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n')
    catalog = parse_catalog((ROOT / "data/awesome-tech-rss.opml").read_text())
    if snapshot_path.exists():
        catalog = merge_feeder(catalog, json.loads(snapshot_path.read_text()))
    output = ROOT / "web/data/rss-catalog.json"
    output.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {catalog['upstreamEntries']} OPML + {catalog.get('additionalEntries', 0)} Feeder rows as {len(catalog['sources'])} unique feeds in {len(catalog['categories'])} categories")
