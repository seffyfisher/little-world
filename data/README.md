# RSS catalog provenance

`awesome-tech-rss.opml` is the full OPML snapshot from https://github.com/tuan3w/awesome-tech-rss at commit `cb81203ac637392b4dc3d829ad20b9bb189d7f51` (imported2026-11-06). Its upstream CC0-1.0 license is retained in `awesome-tech-rss-LICENSE.txt`.

Run `python3 scripts/import-rss-catalog.py` to regenerate `web/data/rss-catalog.json`. All143 source records are retained; two equivalent HTTP/HTTPS pairs collapse into aliases, yielding141 selectable feeds. Categories preserve the original English names with separate Hebrew labels. The bundled OPML is parsed as data and never executed. It does not update automatically from upstream.


`feeder-popular-rss.json` contains the feed names, URLs and topic membership extracted from the tables on [Feeder’s popular RSS feeds page](https://feeder.co/knowledge-base/rss-content/popular-rss-feeds/) on2026-11-07. It includes all100 ranked rows and63 topic/Reuters rows, including Yahoo Finance’s full query string. It contains factual feed metadata rather than the article’s prose. The CC0 license file above applies to the Awesome Tech RSS snapshot, not the Feeder article.

The combined catalog has292 unique URLs across24 Hebrew-labeled categories:141 original entries plus151 new feeds. Equivalent URLs share an entry and category membership; original IDs, names and selected URLs remain stable. All161 unique Feeder URLs are selectable under **Feeder · כל ההמלצות**, with the top100 also grouped separately. Some sources offer headlines only, require a subscription for full articles, or may be temporarily unavailable; those are retained as catalog choices and the app shows the existing availability status.

To refresh this factual snapshot deliberately, download the page locally and run `python3 scripts/import-rss-catalog.py --feeder-html /path/to/page.html`. The importer verifies the100-row table before replacing the snapshot. Without the option, the command deterministically merges the pinned OPML and Feeder JSON, without accessing the network. Topic navigation links are not recursively crawled.
