# Office wall assets

Generated with the built-in image-generation tool; no generation service runs in the app. The tool does not expose a verifiable model version.

## Monitor

Asset: `web/assets/office-wall-monitor-v1.png` (1536×1024, transparent).
Reference: `web/assets/photographic-clay-room-v3.png`.
Prompt: A single realistic handmade clay rectangular wall monitor, thick rounded oatmeal bezel with fingerprints, blank dark green screen, no stand, cables or people. Straight front view, warm upper-left studio light, transparent background. Match the reference room material. Display opening at approximately x13–87%, y17–80%.

## Window removal

Asset: `web/assets/office-no-window-v1.png` (1672×941).
Reference: `web/assets/photographic-clay-room-v3.png`.
Prompt: Precise object edit. Change ONLY the left office window: erase blue window, moon, clouds, frame, bars and sill; fill with continuous matching terracotta plasticine wall. Preserve canvas framing/aspect and positions/shapes of desk, monitors, teal lamp, keyboard, mouse, cup, clock, chair, bookshelves, floor and shadows. No new objects or monitors, no people. Photograph real clay, no CGI.

Only the window area is composited into the native eight-screen scene. The original desk monitor cases and teal lamp are opaque foreground silhouettes above the six rear screens. The settings map uses the same layout and foreground geometry. Browser mode retains its original window and two monitors.

## Office picture removal

Asset: `web/assets/office-no-picture-v1.png` (1672×941). Built-in image-generation edit. Only the office picture area is composited into the scene and the settings map, preserving all other room geometry. Uploaded personal photos now use the library frame; saved photos are retained.

Final prompt:

Use case: precise-object-edit. Asset type: photographic handmade clay room background for an app. Edit target: supplied full room photo. Primary request: completely REMOVE ONLY the SMALL FRAMED SUN-AND-GREEN-LEAF PICTURE on the ORANGE/TERRACOTTA office back wall, just to the LEFT of the digital clock and above the right desk monitor. Remove the entire picture, ALL its frame and its cast shadow, replacing it with continuous matching empty terracotta plasticine wall texture. Approximate removal area in the original 1672x941 canvas: x700–825, y180–325. Keep the LARGER picture on the GREEN library wall to the RIGHT of the clock unchanged. Constraints: keep original 1672x941 canvas framing/aspect ratio and camera exactly unchanged; preserve the left blue window, desk, two monitors, teal lamp, digital clock and its bezel, right wall picture, floor lamp, chair, bookcase, rug, table, room edges and every other object in their exact original positions and size. No added objects, people, text or monitors. Real photograph of handmade physical plasticine, visible fingerprints and warm studio lighting; no CGI look. Change only the small left office picture to a bare matching clay wall.
