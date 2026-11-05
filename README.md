# Little World

A living photographic clay world, as a **static website**. Two live-content screens, twelve new e-vrit books, a character who walks/climbs/reads and has occasional emotions, a digital clock, deep night, battery-reactive plants and a personal picture frame.

The published site is HTML, CSS, JavaScript, PNGs and JSON. **No app server, database, framework, package installation or secret is needed at runtime.** Browser settings and wall pictures stay in that browser's local storage. This web edition is independent of the macOS wallpaper's saved settings.

**Upload `web/` as-is to any static host. There is no required build step.** The refresh script and workflow are optional tools for updating the JSON automatically.

## Use it

- **Enter world**: click a particular book to read it or the floor to choose a destination. **Leave world / Esc** returns to browsing the page.
- **Focus view** fills the page with the room. **Full screen** is available in supporting browsers. Esc or **Back to page** restores the page.
- **Make it yours** edits appearance, screen assignments, published connections, lighting and battery previews. Add a wall picture by choosing or dropping a JPG/PNG/WebP.
- Automatic light follows system appearance. Hidden tabs suspend movement and scheduled JSON checks. Reduce Motion is respected.
- Actual battery reactions use the browser's optional Battery Status API. Unsupported/denied access is labeled unavailable; explicit previews still work.

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

`web/` contains all runtime source and PNG frames. The optional `scripts/build-static.mjs` copies a `dist/` package if desired. No original portrait/tattoo photos, native Mac bundle, source artwork atlases, GIF previews or credentials are included. Generated clay assets are bundled locally; no image-generation service runs in the site. Weather attribution: [Open-Meteo](https://open-meteo.com/), [CC BY4.0](https://creativecommons.org/licenses/by/4.0/).

Platform references: [GitHub Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [Cloudflare static assets](https://developers.cloudflare.com/workers/static-assets/get-started/), [browser battery support](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getBattery).
