# RSS catalog provenance

`awesome-tech-rss.opml` is the full OPML snapshot from https://github.com/tuan3w/awesome-tech-rss at commit `cb81203ac637392b4dc3d829ad20b9bb189d7f51` (imported2026-11-06). Its upstream CC0-1.0 license is retained in `awesome-tech-rss-LICENSE.txt`.

Run `python3 scripts/import-rss-catalog.py` to regenerate `web/data/rss-catalog.json`. All143 source records are retained; two equivalent HTTP/HTTPS pairs collapse into aliases, yielding141 selectable feeds. Categories preserve the original English names with separate Hebrew labels. The bundled OPML is parsed as data and never executed. It does not update automatically from upstream.
