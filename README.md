# Little World

**[Open Little World →](https://now.shinlamed.com/)**

A living photographic clay world, as a **static website**. Two live-content screens, twelve new e-vrit books, a character who walks/climbs/reads and has occasional emotions, a digital clock, deep night, battery-reactive plants and a personal picture frame.

The published site is HTML, CSS, JavaScript, PNGs and JSON. **No app server, database, framework, package installation or secret is needed at runtime.** Browser settings and wall pictures stay in that browser's local storage. This web edition is independent of the macOS wallpaper's saved settings.

**Upload `web/` as-is to any static host. There is no required build step.** The refresh script and workflow are optional tools for updating the JSON automatically.

The interface is in Hebrew with RTL settings and accessible labels. Feed headlines, source names and user content retain their original language. The physical room is never mirrored.

## Use it

- The site opens directly into the interactive world on desktop and landscape phones, with one small **Open full editor** button. Tap a particular book to read it or the floor to choose a destination. Phone landscape fills the entire viewport, including behind the notch, cropping outer scenery when necessary instead of shrinking the world to preserve its edges. Desktop retains the whole-room framing.
- The small expand button in landscape requests full screen with browser navigation hidden when supported. Where the browser does not offer page fullscreen, it explains how to open the site from **Add to Home Screen**. The web manifest and Apple standalone metadata support launching outside the browser tab. The scene ignores notch and home-indicator safe areas in landscape. Editor/fullscreen controls remain inside safe areas so they are easy to tap.
- Portrait phones show the character sitting on a handmade clay couch and reading, with a phone turning above his head and a Hebrew rotation prompt. Turning the phone sideways automatically reveals the world. A separate low-frequency reading loop runs only in visible portrait mode and stops while editing, paused, hidden, in landscape, in low-power mode or with Reduce Motion. The hidden full room stays suspended.
- **Connections** shows a visual office map: click a monitor in the picture to select its source or webcam. The selected monitor is saved. The browser keeps its two-screen room; the native Mac app has eight monitors, including a rear wall of six screens replacing the office window.
- **Open full editor** provides pause/resume, Enter/Leave world, room navigation, reading and full screen, plus appearance, screen assignments, published connections, lighting and battery previews. Add a picture to the library wall frame by choosing or dropping a JPG/PNG/WebP. The office wall picture is fully removed to leave room for monitors. Esc closes the editor or leaves interactive mode; the world-only presentation remains.
- Changes save automatically in localStorage: name, wandering, lighting, city, sources and monitor assignments, picture, battery preferences, pause state, room choice, mood selection and the last editor tab. Existing saved worlds keep the same storage key. If storage is blocked/full, the site reports that changes could not be saved. Enter World mode always starts enabled, and the editor always starts closed.
- The character uses the original shirt artwork in every pose and in the portrait rotation guide; shirt recoloring has been removed. Old saved color choices are ignored while other preferences remain.
- Automatic light follows system appearance. Hidden tabs suspend movement and scheduled JSON checks. Reduce Motion is respected.
- Actual battery reactions use the browser's optional Battery Status API. Unsupported/denied access is labeled unavailable; explicit previews still work.
- **Webcam monitors:** open the editor → **Connections** → choose **Webcam · this device** for either monitor. The browser requests video permission when you enable it. Both monitors can share one mirrored camera stream. Video stays on the device, with no microphone capture, recording or upload. Turn it off in the editor or switch the monitor back to a feed. Capture stops while hidden, paused or showing the portrait rotation prompt; a previously enabled session resumes when the world returns. The monitor choice is saved, but a new page visit needs a tap to enable capture again.

## Daily artwork

The library's wall frame can show a personal image or **יצירת הבוקר · מוזיאון קליבלנד** in World settings. Worlds with no personal image start in daily mode; existing personal photos stay selected. Clicking the frame opens its settings. A manual upload switches back to the personal image, and switching modes preserves both saved images.

Daily mode randomly selects from a bundled catalog of40 CC0 paintings from the [Cleveland Museum of Art](https://www.clevelandart.org/open-access). Original web-image dimensions must be within5% of the actual105:77 frame ratio and at least420×300. The browser decodes the selected image and checks its dimensions again. The whole image fits inside the frame without stretching or cropping. The editor shows the title, artist, date and museum link. **יצירה אחרת** selects another work, avoiding the most recent30 selections when possible.

The deadline is07:00 in the device's local timezone. Hidden worlds schedule no art work; an overdue update runs when the world becomes visible again. A failed load retains the previous successful picture, tries up to3 different candidates, then waits an hour before retrying while visible. Selection, image and history persist in localStorage and the Mac's existing saved configuration. The original personal photo is stored separately.

Only the selected image loads at runtime, from the same static host or local Mac bundle. This requires no API keys, account, proxy or running server on the public website. The image is cached locally as a small JPEG. The publication workflow refreshes the catalog weekly using `python3 scripts/refresh-art-catalog.py`; use `--force` for an explicit refresh. The builder uses Python3 and curl, fetches only CC0 records and their corresponding web images, and retains the last complete catalog on source failure. Metadata and source JPEGs are in `web/data/art-catalog.json` and `web/assets/art/`. These files are bundled with the Mac app too.

The initial Chicago integration was not shipped: its image endpoint returned an interactive Cloudflare challenge during actual browser testing. Cleveland's source images are published with the static app so museum CORS and availability do not block everyday use. Source/API documentation: [CMA Open Access API](https://openaccess-api.clevelandart.org/).

## Built-in RSS catalog

Connections includes a searchable, categorized catalog from [tuan3w/awesome-tech-rss](https://github.com/tuan3w/awesome-tech-rss) and [Feeder’s popular RSS feeds](https://feeder.co/knowledge-base/rss-content/popular-rss-feeds/). Select a monitor in the office picture, search by feed name, URL or Hebrew/English category, then choose the feed in **מקור התוכן למסך**. Selection applies immediately and is saved locally. There are292 unique feeds across24 categories. The original141 feeds are preserved; Feeder adds151 new choices from its top100 and topic tables, including sports, gaming, food, culture, podcasts, YouTube and Reddit. Duplicate URLs share one choice and original connection IDs stay stable. Search “Feeder” to see its full collection.

A catalog connection is added only when selected. Switching away removes unused, unmodified catalog connections; manual and customized connections are preserved. The Mac fetches only assigned catalog feeds, while the static website reads their published snapshots. Unavailable/cached web feeds are labeled in the picker; upstream failures retain previous real data when available. Catalog metadata is separate from the three default connections, so opening the site does not subscribe to292 feeds.

The pinned OPML, its CC0 license, and Feeder’s factual names/URLs snapshot are in `data/`; the generated index is `web/data/rss-catalog.json`. Run `python3 scripts/import-rss-catalog.py` after deliberately updating the OPML snapshot/revision, and `python3 scripts/refresh-static-data.py` to publish their data. The static builder refreshes with at most8 parallel requests and keeps the existing hourly schedule. No feed proxy or extra service is required at runtime.

## Content is JSON

Edit **`web/data/sources.json`** to manage the published RSS/Atom feeds and public websites. Each source has an ID, name, URL, kind (`feed`, `website`, `evrit-books`) and room (`office`, `library`).

**`web/data/world.json`** is the actual published data: source catalog, articles, books/covers, weather and timestamps. You can maintain it manually. The optional dependency-free Python script refreshes it from the public websites:

```sh
python3 scripts/refresh-static-data.py
python3 -m http.server 8788 --directory web
```

Open `http://localhost:8788`. Python only generates JSON before publication; an ordinary static file host serves the deployed site. There are no `/api` requests in browser mode. Book cover images load directly from e-vrit's CDN.

GitHub Actions refreshes RSS/weather and publishes hourly, at minute17 UTC, and on pushes/manual runs. GitHub may delay scheduled runs. E-vrit books keep their successful selection until the next Israel calendar day. Failed fetches keep the last successful real data and mark it cached; no invented replacements. Cached snapshots are retained between workflow runs. A visible tab checks for a newer published JSON every five minutes; its Refresh button checks the publication rather than fetching arbitrary websites.

Visitors can assign, rename and arrange published sources locally. A new arbitrary URL must first be added to the published source catalog and refreshed; this avoids needing a public proxy/backend or relying on RSS sites' CORS behavior. Local settings do not edit GitHub or other visitors' worlds.

## Hosting

**GitHub Pages:** put this repository's contents at its root, select **Settings → Pages → Source: GitHub Actions**, and use the included workflow. `web/CNAME` sets `now.shinlamed.com`; its DNS CNAME should point to `seffyfisher.github.io`. Enable HTTPS once GitHub issues the certificate. Relative asset/data URLs also work under a repository subpath.

**Cloudflare Pages:** publish `web/` with no build command. **Cloudflare Workers Static Assets:** the included `wrangler.jsonc` serves `web/` without a Worker script; deploy with `npx wrangler deploy`. Updating JSON requires publishing new files in this entirely static approach. `_headers` revalidates JSON after60 seconds on Cloudflare.

## Development

```sh
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py'
```

`web/` contains all runtime source and PNG frames. Landscape framing covers the full dynamic viewport with the miniature, preserving proportions and allowing outer scenery to crop. Device safe-area insets apply to controls rather than shrinking the scene. Desktop framing fits the complete miniature. The optional `scripts/build-static.mjs` copies a `dist/` package if desired. No original portrait/tattoo photos, native Mac bundle, source artwork atlases, GIF previews or credentials are included. Generated clay assets are bundled locally; no image-generation service runs in the site. Weather attribution: [Open-Meteo](https://open-meteo.com/), [CC BY4.0](https://creativecommons.org/licenses/by/4.0/).

Platform references: [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Cloudflare static assets](https://developers.cloudflare.com/workers/static-assets/get-started/), [browser battery support](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getBattery).
