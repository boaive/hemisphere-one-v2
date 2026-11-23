# Hemisphere One V2: films and homepage

The homepage follows the client script (*HEMISPHERE ONE – V2 Intro Script*). Each scene is a **pre-rendered film** that plays full-screen as a section of the page (no player chrome: a section label, timed HTML type, a pause toggle and a slim progress line). Regular pages between the films carry the story on; there is no chapter numbering anywhere.

## Page order
1. Film 1: The apex of modern construction (`#story`)
2. Modern construction (`#modern`): a regular page. A live 3D material study (a cast wall section read by a slow light sweep, `src/site/three/MaterialStudy.tsx`), what modern construction is and why it stands out, then a cue into film 2
3. Film 2: The reality on the ground (`#film-2`)
4. Why it hasn't changed (`#why`): continuous prose over ambient 3D motion (`src/site/three/AmbientField.tsx`); the bridge panel (`#bridge`) then rises from the bottom edge over it (CSS sticky stacking) while its words arrive one by one
5. Film 3: The Hemisphere One bridge (`#film-3`)
6. The ecosystem (`#products`): a continuously moving train of product cards, each with a live 3D object (one shared canvas, drei `View` per card); the bottom navigation eases a product to the centre and stops the train. Products and wording follow V1 / hemisphere-one.com: H1-561 Mini (Mixers & Pump), Jet Formwork (Formwork, green), RTARIUM™ (Reinforcement), Actipour & Actimix (Chemicals, blue cans with red caps), Enermix & Terramix (Premix, white bags with the yellow band)
7. Footer (`#contact`): closing call to action, V1 brand block ("Construction. Integrated."), contact, sitemap (placeholder pages), offices, social, legal

Design: dark immersive canvas, Mona Sans, brand yellow as the only UI accent. The JET formwork product is shown in its real green.

## Films (source of truth: `src/film/shots.ts`)
30 fps, hard cuts, one slow eased move per shot (push, truck or pull; no orbits or combined moves), full-frame lens values with architectural lens shift.

| Film | Shots (seconds) | Look |
|---|---|---|
| 1 · 23 s | Aluform push-in on the climbing top floors (5.6) · precast truck right, one module lifted and set (5.2) · panelized truck right, the crane sets the last wall panel (5.2) · one long pull-back to the whole controlled environment (7.0) | white architectural-model city, blue data rings, the live construction site in full colour (Neutral tone mapping) |
| 2 · 19.5 s | skyline tilt-down to the site · plywood shuttering · RC frame · brickwork + plaster · site wide | warm late-afternoon sun, AgX (re-render pending: Mixamo cast, cameras) |
| 3 · 24 s | wave · Jet formwork · H1-561 MINI + premix · monolithic wall · the builder · ecosystem pull-back | same site, brand wave, AgX (rework pending) |

**Scene 1 controlled environment** (`src/world/campus/*`, `Tower.tsx`, `Precast.tsx`): a walled construction township of about 410 × 280 m inside the white city. Hero systems: the Aluform tower (22 floors), the precast block with its tower crane and trailer, the panelized data hall. Around them: three more Aluform towers at different stages with cranes, a finished precast block and one at podium level, the precast casting yard under a travelling gantry, a second panelized hall, raft pour with a boom pump, batching plant, excavation, site offices, labour colony, marshalling yard, laydown yards, trucks and crews. Every build event is timed to play inside the shot that shows it (`FLOORS_AT`, the precast lift list, `HERO_*` in `DataCenter.tsx`).

Construction in Scenes 2–3 runs on *story time* (`storyTime`), a per-film warp of film time that jumps only at cuts.

Text is never baked into the films. Titles, statements and tracking labels are HTML (`src/site/content.ts`), timed to the video; labels follow 3D anchors exported per frame.

## Render pipeline
1. Start the render server: `npx vite --config vite.render.config.ts` (port 5300; no file watching, so restart it after changing render or world code).
2. Films: `node tools/render/film.mjs --scene 1 --w 1920 --h 1080 --spp 16 --url http://localhost:5300` and the portrait cut `--portrait --w 720 --h 1280 --spp 16`. Drafts: `--w 960 --h 540 --spp 6 --frames 0,90,180 --dir name`.
3. Encode: `node tools/render/encode.mjs [--scenes 1,2]` writes `public/films/*` (MP4 1080, 720, portrait, posters, label anchors).
4. Review: `python tools/review/sheet.py renders/<dir> sheet.jpg` (contact sheet).
5. Characters: Mixamo FBX files live in `render-assets/mixamo/` (render-only, git-ignored, never shipped).

## Open items
- Mixamo animation clips for the cast of films 2 and 3 (the supplied Ch17 worker has a rig but no clips).
- H1-561 CORE and ECO specifications (not shown until verified). Premix bag weight is not printed until confirmed.
- Company figures are not shown until confirmed. RTARIUM links to https://rtarium.com (client decision).
