#!/usr/bin/env python3
"""Generate public JSON at build time. The deployed site runs no Python/server."""
import concurrent.futures
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
import data_sources as server


def refresh_source(source, previous, now):
    if source["kind"] == "evrit-books" and previous and not previous.get("stale"):
        try:
            if datetime.fromisoformat(previous["nextRefreshAt"]) > now:
                return previous
        except (KeyError, ValueError, TypeError):
            pass
    try:
        if source["kind"] == "evrit-books":
            return server.evrit_books_data()
        if source["kind"] == "website":
            return server.website_data(source["url"])
        return server.feed_data(source["url"])
    except Exception:
        if previous and previous.get("items"):
            return {**previous, "stale": True, "error": "The last refresh failed; showing the previous snapshot."}
        return {"items": [], "error": "This source could not be refreshed.", "stale": True}


def generate(sources, previous=None, now=None):
    now = now or datetime.now(timezone.utc)
    previous = previous or {}
    if not 1 <= len(sources) <= 20:
        raise ValueError("Choose between1 and20 public sources.")
    ids = set()
    for source in sources:
        if not re.fullmatch(r"[A-Za-z0-9-]{1,60}", source["id"]) or source["id"] in ids:
            raise ValueError("Each source needs a unique simple ID.")
        ids.add(source["id"])
        if source["kind"] not in ("feed", "website", "evrit-books") or source["room"] not in ("office", "library"):
            raise ValueError("Invalid source kind or room.")
    old_sources = {source["id"]: source for source in previous.get("sources", [])}
    def source_job(source):
        old = old_sources.get(source["id"])
        same = old and (old["url"], old["kind"]) == (source["url"], source["kind"])
        return source["id"], refresh_source(source, previous.get("feeds", {}).get(source["id"]) if same else None, now)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        feeds = dict(pool.map(source_job, sources))
    weather = {}
    for city in server.LOCATIONS:
        try:
            weather[city] = server.weather_data(city)
        except Exception:
            if city in previous.get("weather", {}):
                weather[city] = {**previous["weather"][city], "stale": True}
    return {"schemaVersion": 1, "generatedAt": now.isoformat(), "sources": sources, "feeds": feeds, "weather": weather}


def main():
    source_path = ROOT / "web/data/sources.json"
    output = ROOT / "web/data/world.json"
    sources = json.loads(source_path.read_text())["sources"]
    try:
        previous = json.loads(output.read_text())
    except (OSError, ValueError):
        previous = {}
    server.BOOK_CACHE_PATH = ROOT / ".static-cache/evrit-new-books.json"
    result = generate(sources, previous)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix(".tmp")
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(output)
    for source in sources:
        data = result["feeds"][source["id"]]
        print(f"{source['id']}: {len(data.get('items', []))} items" + (" (cached/unavailable)" if data.get("stale") else ""))


if __name__ == "__main__":
    main()
