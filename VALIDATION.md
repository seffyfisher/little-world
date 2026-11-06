# Static web validation — 2026-11-05

## Full landscape restored — 2026-11-06

- Landscape scene ignores all notch/home-indicator safe-area insets, as requested. Cover framing fills the full viewport; controls retain their safe-area placement. Original shirt artwork remains in place.
- The existing seven settings/layout checks and whitespace checks passed. Physical notched-phone validation remains unverified.

## Original shirt artwork — 2026-11-06

- Removed the duplicated, clipped hue-rotated shirt image from all character poses and the portrait rotation guide. Original sprite artwork and the sitting/climbing crossfade remain intact.
- Removed color swatches, tint masks and recoloring settings. Legacy saved shirt values are ignored during settings validation without resetting other visitor preferences; the existing migration test covers this.
-56 Node tests and3 Python tests passed, plus JS syntax/whitespace checks. Preview browser confirmed no tint layers, the original shirt in landscape and portrait, and Character settings without the color picker. No console warnings/errors were recorded.

## Notch-safe fill adjustment — 2026-11-06

- Kept the enlarged landscape cover framing, but removed its zero-inset override. The scene now uses the existing four device safe-area insets in landscape as well, reserving space around the notch and home indicator instead of drawing the world there.
- Existing seven settings/layout tests and CSS whitespace checks passed. Physical notched-phone validation remains unverified.

## Edge-to-edge landscape correction — 2026-11-06

- Reproduced the remaining letterboxing with a geometry regression: the contain framing failed the requirement to cover both viewport dimensions at844×390.
- Phone landscape up to600px high now uses cover framing across the full viewport, allowing outer scenery to crop without stretching the clay. The notch/home-indicator safe areas apply to controls, not to scene size. Desktop keeps the whole-room contain framing.
- Added a direct landscape fullscreen action using a user gesture and `navigationUI: hide`, plus a clear Home Screen fallback and standalone web-app metadata/manifest. The preview browser entered and exited fullscreen successfully through the button.
- Browser viewport verification at844×390 and667×375 showed the enlarged scene with both monitors and all12 book buttons inside the viewport. The latter crops outer plants/walls as expected. Portrait still shows only the rotation prompt. Physical mobile browser/address-bar behavior remains unverified.
-56 Node tests and3 Python tests passed. Cover regressions include six landscape sizes, including a short844×270 viewport. JavaScript syntax and whitespace checks passed.

## Mobile-first immersive entry — 2026-11-06

### Larger landscape framing and webcam monitors

- Final checks:55 Node tests and3 Python tests passed; JavaScript syntax and whitespace checks passed.

- Landscape now fits measured miniature bounds, excluding empty studio backdrop. At844×390 the world plate renders at856px wide rather than693px, while every part of the miniature remains inside the viewport. Unit checks also cover the750×369 notch-safe available rectangle. Dynamic viewport height and safe-area CSS remain enabled. No physical phone/notch hardware validation is claimed.
- Camera tests use an injected capture provider and synthetic640×360 canvas stream, never the user's actual camera. Browser verification showed both monitor videos playing with `readyState=4`, muted/inline, with one capture request and `audio:false`. Pause and portrait rotation stopped the tracks. Reload preserved both monitor choices without starting capture; simulated permission denial displayed an explicit retry message with no console error.
- Camera lifecycle regressions cover shared capture, last-monitor removal, pause/visibility resume, cancellation while permission is pending, denial without repeated prompts, camera disconnection, page disposal and safe reenablement during a pending request. Real camera permission/capture and physical iOS autoplay behavior remain unverified.

-45 Node tests and3 Python tests passed. New regressions cover durable preference round trips, existing saved-world compatibility, malformed/blocked/full storage and complete-image containment across eight phone/desktop dimensions.
- Real-browser viewport checks:844×390 and667×375 landscape display the entire scene;1440×900 desktop starts interactive with the toolbars hidden. Only the44px editor launcher is shown outside the scene. The390×844 portrait view shows the character and rotate-phone illustration; rotating restores the fitted world automatically. The room runtime is inactive during the portrait prompt and resumes in landscape. This is browser viewport verification, not physical iPhone/Safari hardware validation.
- Verified changes and reloaded: character name, Rose shirt, wandering off, selected mood, Dusk lighting,15% battery preview, disabled battery reactions, reversed monitor assignments, London weather, paused playback, Office destination and an embedded test photo were restored. Portrait editor bounds fit the viewport without horizontal overflow. Test preferences were left confined to the local preview origin.
- Fixed a warm-image-cache startup exception: the synchronous cached-room initialization now runs after sprite helper constants exist. Repeated warm reloads and orientation changes restored the photo and interactive scene without a new initialization error.

-41 Node checks and3 Python checks passed. Includes reading/book size, stable seating, moods, ladder ascent/descent/disappearance, visibility suspension, battery fallback, JSON refresh de-duplication, failed publication recovery and preserving actual source identity.
- Built a17MB runtime-only copy. Served it with Python's ordinary static file server, without the macOS app or API adapters. Source request log shows zero `/api/` calls; data comes from `data/world.json`.
- Browser inspected at1280×720: all12 real e-vrit cover images loaded, two RSS snapshots rendered, real digital clock/weather rendered, no horizontal overflow. Focus view and Enter/Leave world were exercised. Deep night follows system appearance. Browser battery reported an actual percentage and charging state.
- Verified local source management by adding a published BBC connection named Web test, then removing that test connection. No native wallpaper preferences were changed.
- The same static output loaded successfully under `/little-world/`, matching GitHub Pages project-site path behavior. The home link, assets and JSON are relative.
- The initial navigation on one test port missed loading a room-props script; a reload and a fresh repository-subpath navigation succeeded. No reproducible code error remained in the final successful navigation.
- No original personal reference photos, native bundle, source artwork atlases, GIFs, credentials, telemetry, account system or runtime image-generation service is included.
- Published the public repository at https://github.com/seffyfisher/little-world using the existing seffyfisher SSH identity. Enabled GitHub Actions as the Pages publishing source and saved `now.shinlamed.com` as its custom domain.
- [Pages publication42109882477](https://github.com/seffyfisher/little-world/actions/runs/42109882477), attempt2, succeeded after Pages was enabled. Its tests and public-data refresh succeeded. Direct requests to the Pages edge with the configured hostname returned200 for the HTML and JSON; the published snapshot contains8 Hacker News items,8 BBC items and12 real e-vrit books.
- Added Cloudflare CNAME `now` → `seffyfisher.github.io`, DNS only, Auto TTL. The authoritative nameserver and public resolvers1.1.1.1/8.8.8.8 return the new record. GitHub's Pages settings report **DNS check successful**.
- GitHub issued an approved certificate for `now.shinlamed.com` (expires2027-02-03), and **Enforce HTTPS** is enabled. Public-DNS requests to https://now.shinlamed.com/ and its JSON returned200 with TLS verification enabled. No certificate/security warning was bypassed.
- The local default DNS resolver retains an earlier negative/NXDOMAIN answer, with approximately10 minutes remaining at the final browser check. As a result, this Mac's browser still showed a DNS lookup error despite successful public DNS+HTTPS checks. The static UI itself was visually verified earlier using the identical published files; final public-hostname visual confirmation on this resolver awaits that cache expiry. No system DNS settings were changed.
