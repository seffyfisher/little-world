#!/usr/bin/env python3
"""Little World POC: local assets and small public-data adapters. No dependencies."""
from datetime import datetime, timezone, timedelta, time as day_time
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, urlencode, urljoin
from urllib.request import Request, build_opener, HTTPRedirectHandler
import ipaddress
import hashlib
import json
import re
import socket
import threading
import time
import xml.etree.ElementTree as ET
from zoneinfo import ZoneInfo

ROOT = Path(__file__).parent / "web"
CACHE = {}
IMAGE_CACHE = {}
LOCK = threading.Lock()
BOOK_LOCK = threading.Lock()
BOOK_CACHE_PATH = Path.home() / "Library" / "Caches" / "LittleWorldPOC" / "evrit-new-books.json"
BOOK_TIMEZONE = ZoneInfo("Asia/Jerusalem")
EVRIT_HOME = "https://www.e-vrit.co.il/"
LOCATIONS = {"tel-aviv": (32.0853, 34.7818, "Tel Aviv"),
             "jerusalem": (31.7683, 35.2137, "Jerusalem"),
             "london": (51.5074, -0.1278, "London"),
             "new-york": (40.7128, -74.0060, "New York")}


def public_url(url):
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.hostname or parts.username or parts.password:
        raise ValueError("Use a public http or https URL without embedded credentials.")
    if parts.port not in (None, 80, 443):
        raise ValueError("Only standard website ports are supported.")
    for result in socket.getaddrinfo(parts.hostname, parts.port or 443, type=socket.SOCK_STREAM):
        if not ipaddress.ip_address(result[4][0]).is_global:
            raise ValueError("Local and private network URLs are not supported.")
    return url


class PublicRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        public_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch_document(url):
    public_url(url)
    request = Request(url, headers={"User-Agent": "LittleWorldPOC/0.1 (personal desktop feed reader)",
                                    "Accept": "application/rss+xml, application/atom+xml, application/json, text/xml;q=0.9, */*;q=0.5"})
    with build_opener(PublicRedirect).open(request, timeout=12) as response:
        raw = response.read(1_000_001)
        if len(raw) > 1_000_000:
            raise ValueError("This feed is too large for the POC (1 MB limit).")
        return raw, response.headers.get_content_charset() or "utf-8", response.url


def fetch(url):
    return fetch_document(url)[0]


def cached(key, produce):
    with LOCK:
        previous = CACHE.get(key)
    if previous and time.monotonic() - previous[0] < 300:
        return previous[1]
    try:
        value = {**produce(), "updatedAt": datetime.now(timezone.utc).isoformat(), "stale": False}
        with LOCK:
            CACHE[key] = (time.monotonic(), value)
        return value
    except Exception:
        if previous:
            return {**previous[1], "stale": True}
        raise


def feed_data(url):
    def produce():
        raw = fetch(url)
        if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
            raise ValueError("This XML format is not supported.")
        root = ET.fromstring(raw)
        def local(tag):
            return tag.rsplit("}", 1)[-1]
        def child_text(element, name):
            return next(("".join(c.itertext()).strip() for c in element if local(c.tag) == name), "")
        entries = []
        for element in root.iter():
            if local(element.tag) not in ("item", "entry"):
                continue
            title = child_text(element, "title")
            link = child_text(element, "link")
            if not link:
                link = next((c.attrib.get("href", "") for c in element
                             if local(c.tag) == "link" and c.attrib.get("rel", "alternate") == "alternate"), "")
            if title:
                entries.append({"title": title[:350], "url": link if urlsplit(link).scheme in ("http", "https") else "",
                                "date": child_text(element, "pubDate") or child_text(element, "published")})
            if len(entries) >= 8:
                break
        if not entries:
            raise ValueError("No articles found. Use a direct RSS or Atom feed URL.")
        return {"items": entries, "adapter": "feed", "sourceURL": url}
    return cached(("feed", url), produce)


class WebsiteParser(HTMLParser):
    """Read public HTML, without executing any remote scripts in the wallpaper."""
    ignored = {"script", "style", "noscript", "nav", "header", "footer", "aside", "svg", "form"}

    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base = base
        self.skip = []
        self.in_title = False
        self.title = ""
        self.description = ""
        self.feeds = []
        self.headings = []
        self.links = []
        self.heading = None
        self.anchor = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        # Feed discovery and metadata also work inside a site's header.
        if tag == "link" and "alternate" in attrs.get("rel", "").lower() and attrs.get("type", "") in ("application/rss+xml", "application/atom+xml"):
            self.feeds.append(urljoin(self.base, attrs.get("href", "")))
        if tag == "meta" and (attrs.get("name") == "description" or attrs.get("property") == "og:description"):
            self.description = attrs.get("content", "")[:500]
        if tag == "title":
            self.in_title = True
        if tag in self.ignored:
            self.skip.append(tag)
        if self.skip:
            return
        if tag in ("h1", "h2", "h3"):
            self.heading = {"tag": tag, "text": "", "url": self.base}
        if tag == "a" and attrs.get("href"):
            link = urljoin(self.base, attrs["href"])
            self.anchor = {"text": "", "url": link}
            if self.heading:
                self.heading["url"] = link

    def handle_data(self, text):
        if self.in_title:
            self.title += text
        if self.skip:
            return
        if self.heading is not None:
            self.heading["text"] += text + " "
        if self.anchor is not None:
            self.anchor["text"] += text + " "

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
        if tag in self.ignored and tag in self.skip:
            self.skip.remove(tag)
        if self.skip:
            return
        if self.heading and tag == self.heading["tag"]:
            self.headings.append(self.heading)
            self.heading = None
        if tag == "a" and self.anchor:
            self.links.append(self.anchor)
            self.anchor = None


def website_data(url):
    def produce():
        raw, encoding, final_url = fetch_document(url)
        # A user may paste a direct feed into the website input.
        if raw.lstrip().startswith((b"<?xml", b"<rss", b"<feed")):
            return feed_data(url)
        parser = WebsiteParser(final_url)
        parser.feed(raw.decode(encoding, errors="replace"))
        for feed_url in parser.feeds[:2]:
            try:
                data = feed_data(feed_url)
                return {**data, "discoveredFeed": feed_url, "pageTitle": parser.title.strip()[:200]}
            except Exception:
                continue
        seen = set()
        entries = []
        for candidate in parser.headings + parser.links:
            title = " ".join(candidate["text"].split())
            link = candidate["url"]
            if len(title) < 16 or title in seen or urlsplit(link).scheme not in ("http", "https"):
                continue
            seen.add(title)
            entries.append({"title": title[:350], "url": link, "date": ""})
            if len(entries) >= 8:
                break
        page_title = " ".join(parser.title.split())[:200]
        if not entries and (parser.description or page_title):
            entries = [{"title": parser.description or page_title, "url": final_url, "date": ""}]
        if not entries:
            raise ValueError("This website did not expose readable content. Try its RSS feed; JavaScript-only and sign-in pages need a dedicated adapter.")
        fingerprint = hashlib.sha256(json.dumps(entries, sort_keys=True).encode()).hexdigest()[:16]
        return {"adapter": "website", "items": entries, "pageTitle": page_title,
                "description": parser.description, "sourceURL": final_url, "fingerprint": fingerprint}
    return cached(("site", url), produce)


class EvritBooksParser(HTMLParser):
    """Read the homepage's new-books entry and real product cards in site order."""
    def __init__(self, base):
        super().__init__(convert_charrefs=True)
        self.base = base
        self.anchor = None
        self.current_product = None
        self.new_books_url = None
        self.books = {}

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "a":
            url = urljoin(self.base, attrs.get("href", ""))
            match = re.search(r"/product/(\d+)(?:/|$)", urlsplit(url).path, re.I)
            self.anchor = {"url": url, "text": "", "id": match.group(1) if match else None}
            if match:
                product_id = match.group(1)
                self.current_product = product_id
                self.books.setdefault(product_id, {"id": product_id, "title": "", "author": "", "url": url, "cover": "", "date": ""})
        if tag == "img" and self.anchor and self.anchor["id"]:
            book = self.books[self.anchor["id"]]
            cover = urljoin(self.base, attrs.get("src", ""))
            if urlsplit(cover).scheme == "https" and urlsplit(cover).hostname == "images.e-vrit.co.il":
                book["cover"] = cover
                book["title"] = attrs.get("alt", "").strip()[:200]

    def handle_data(self, text):
        if self.anchor:
            self.anchor["text"] += text + " "

    def handle_endtag(self, tag):
        if tag != "a" or not self.anchor:
            return
        anchor = self.anchor
        title = " ".join(anchor["text"].split())
        path = urlsplit(anchor["url"]).path
        if title == "ספרים חדשים" and re.match(r"/group/3(?:/|$)", path, re.I):
            self.new_books_url = anchor["url"]
        if anchor["id"] and title:
            book = self.books[anchor["id"]]
            if not book["title"]:
                book["title"] = title[:200]
        if path.lower().startswith("/author/") and self.current_product and title:
            book = self.books[self.current_product]
            authors = book["author"].split(" · ") if book["author"] else []
            if title not in authors:
                book["author"] = " · ".join(authors + [title])[:200]
        self.anchor = None

    def items(self):
        return [book for book in self.books.values() if book["title"] and book["cover"]][:12]


def evrit_books_data():
    # This cache survives app/server restarts and rolls over at midnight in Israel.
    # Holding the lock also prevents the editor and wallpaper fetching the same day twice.
    with BOOK_LOCK:
        now = datetime.now(BOOK_TIMEZONE)
        previous = None
        try:
            previous = json.loads(BOOK_CACHE_PATH.read_text())
            if previous.get("adapter") != "evrit-books" or not previous.get("items"):
                previous = None
        except (OSError, ValueError):
            pass
        if previous and previous.get("cacheDate") == now.date().isoformat():
            return {**previous, "stale": False}
        try:
            home_raw, encoding, home_url = fetch_document(EVRIT_HOME)
            home = EvritBooksParser(home_url)
            home.feed(home_raw.decode(encoding, errors="replace"))
            if not home.new_books_url:
                raise ValueError("The homepage's ספרים חדשים section could not be found. The shelf has not been replaced with a different collection.")
            listing_url = home.new_books_url
            if urlsplit(listing_url).hostname not in ("www.e-vrit.co.il", "e-vrit.co.il"):
                raise ValueError("The new-books collection points outside e-vrit.")
            raw, encoding, listing_url = fetch_document(listing_url)
            parser = EvritBooksParser(listing_url)
            parser.feed(raw.decode(encoding, errors="replace"))
            items = parser.items()
            if not items:
                raise ValueError("The new-books list did not expose any book covers. The previous shelf is kept if available.")
            next_refresh = datetime.combine(now.date() + timedelta(days=1), day_time.min, tzinfo=BOOK_TIMEZONE)
            value = {"adapter": "evrit-books", "sectionTitle": "ספרים חדשים", "homepageURL": EVRIT_HOME,
                     "sourceURL": listing_url, "items": items, "cacheDate": now.date().isoformat(),
                     "updatedAt": now.astimezone(timezone.utc).isoformat(), "nextRefreshAt": next_refresh.isoformat(), "stale": False}
            BOOK_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            temporary = BOOK_CACHE_PATH.with_suffix(".tmp")
            temporary.write_text(json.dumps(value, ensure_ascii=False))
            temporary.replace(BOOK_CACHE_PATH)
            return value
        except Exception:
            if previous:
                return {**previous, "stale": True}
            raise


def cover_image(url):
    """Same-origin cover textures for WebGL; only the public e-vrit image CDN."""
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.hostname != "images.e-vrit.co.il" or "/images/products/" not in parts.path.lower():
        raise ValueError("Only e-vrit book-cover images are supported.")
    with LOCK:
        previous = IMAGE_CACHE.get(url)
    if previous:
        return previous
    public_url(url)
    request = Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
        "Referer": EVRIT_HOME, "Accept": "image/png,image/jpeg,image/webp,image/*;q=0.8"})
    with build_opener(PublicRedirect).open(request, timeout=12) as response:
        content_type = response.headers.get_content_type()
        if urlsplit(response.url).hostname != "images.e-vrit.co.il" or content_type not in ("image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"):
            raise ValueError("The cover source did not return a supported image.")
        body = response.read(1_000_001)
        if len(body) > 1_000_000:
            raise ValueError("The cover image exceeds the POC size limit.")
    with LOCK:
        if len(IMAGE_CACHE) >= 64:
            IMAGE_CACHE.pop(next(iter(IMAGE_CACHE)))
        IMAGE_CACHE[url] = (body, content_type)
    return body, content_type


def weather_data(location):
    latitude, longitude, label = LOCATIONS.get(location, LOCATIONS["tel-aviv"])
    def produce():
        query = urlencode({"latitude": latitude, "longitude": longitude,
                           "current": "temperature_2m,weather_code,is_day,wind_speed_10m", "timezone": "auto"})
        data = json.loads(fetch("https://api.open-meteo.com/v1/forecast?" + query))
        return {"current": data["current"], "location": label}
    return cached(("weather", location), produce)

