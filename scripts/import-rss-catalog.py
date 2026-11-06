#!/usr/bin/env python3
"""Convert the pinned upstream OPML snapshot into a local, categorized JSON catalog."""
import hashlib
import json
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


if __name__ == "__main__":
    catalog = parse_catalog((ROOT / "data/awesome-tech-rss.opml").read_text())
    output = ROOT / "web/data/rss-catalog.json"
    output.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
    print(f"Imported {catalog['upstreamEntries']} OPML entries as {len(catalog['sources'])} unique feeds in {len(catalog['categories'])} categories")
