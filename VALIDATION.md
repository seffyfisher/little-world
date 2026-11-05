# Static web validation — 2026-11-05

-41 Node checks and3 Python checks passed. Includes reading/book size, stable seating, moods, ladder ascent/descent/disappearance, visibility suspension, battery fallback, JSON refresh de-duplication, failed publication recovery and preserving actual source identity.
- Built a17MB runtime-only copy. Served it with Python's ordinary static file server, without the macOS app or API adapters. Source request log shows zero `/api/` calls; data comes from `data/world.json`.
- Browser inspected at1280×720: all12 real e-vrit cover images loaded, two RSS snapshots rendered, real digital clock/weather rendered, no horizontal overflow. Focus view and Enter/Leave world were exercised. Deep night follows system appearance. Browser battery reported an actual percentage and charging state.
- Verified local source management by adding a published BBC connection named Web test, then removing that test connection. No native wallpaper preferences were changed.
- The same static output loaded successfully under `/little-world/`, matching GitHub Pages project-site path behavior. The home link, assets and JSON are relative.
- The initial navigation on one test port missed loading a room-props script; a reload and a fresh repository-subpath navigation succeeded. No reproducible code error remained in the final successful navigation.
- No original personal reference photos, native bundle, source artwork atlases, GIFs, credentials, telemetry, account system or runtime image-generation service is included.
- Public repository creation, GitHub Pages deployment, custom-domain DNS and HTTPS remain pending authentication. The existing SSH identity is seffyfisher, while the existing GitHub CLI session is evritapp. Cloudflare's saved CLI login is expired and lacked DNS-write scope. Publication is not claimed by local validation.
