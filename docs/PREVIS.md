# Hemisphere One V2: films and homepage

The homepage follows the client script (*HEMISPHERE ONE – V2 Intro Script*). Each scene is a **pre-rendered film** that plays full-screen as a section of the page (no player chrome: a section label, timed HTML type, a pause toggle and a slim progress line). Regular pages between the films carry the story on; there is no chapter numbering anywhere.

## Page order
1. Film 1: The apex of modern construction (`#story`)
2. Modern construction (`#modern`, light): what modern construction is and why it stands out, beside a playful cluster of glossy forms that slip out of the pointer's way (`src/site/three/Playground.tsx`, decorative, not about construction); then a cue into film 2
3. Film 2: The reality on the ground (`#film-2`)
4. Why it hasn't changed (`#why`, dark): five short staged lines with marked key words, over a kinetic tile wall that turns yellow under the pointer (`KineticTiles.tsx`); the light bridge panel (`#bridge`) then rises over it while its words arrive one by one
5. Film 3: The Hemisphere One bridge (`#film-3`)
6. The ecosystem (`#products`, light): a moving train of white cards, each with a live 3D product (one shared canvas, drei `View`); the bottom navigation centres a product and stops the train. Packaging is redrawn from the client's product shots: Actipour / Actimix-PR blue cans with red caps (50 kg net), Enermix-25 / Terramix sacks (25 kg), green Jet Formwork, dark basalt RTARIUM mesh, H1-561 Mini
7. Footer (`#contact`): closing call to action, V1 brand block, contact, sitemap (placeholder pages), offices, social, legal

Menu: a compact sidebar from the right on a light panel, with the inquiry form (all "Send an inquiry" buttons open it; it hands the message to the visitor's email app until a form backend exists). Tab icons: square marks cut from the logo (`public/favicon.ico`, `public/brand/*icon*`).

## Films (source of truth: `src/film/shots.ts`)
30 fps, hard cuts, one slow eased move per shot (push, truck or pull; no orbits or combined moves), full-frame lens values with architectural lens shift.

| Film | Shots (seconds) | Look |
|---|---|---|
| 1 · 19 s | Aluform push-in (4.6) · precast, low three-quarter view, one module set (4.4) · panelized, low oblique along the ribbed dock wall, the crane sets the last panel (4.4) · one long pull-back to the whole controlled environment (5.6) | white architectural-model city, blue data rings, the live construction site in full colour (Neutral tone mapping) |
| 2 · 19.5 s | crane-down from the skyline · plywood shuttering (medium) · RC frame · brickwork + plaster (lateral dolly) · site wide | warm late-afternoon sun, AgX (render pending the Mixamo cast) |
| 3 · 26 s | the wave turns the plot into a controlled site · green JET formwork · H1-561 MINI with Enermix pallet and Actipour cans · monolithic wall · the builder (modern neighbourhood, new daylight) · the bridge spreads: arcs land and JET houses, precast stacks with telescopic cranes and panelized halls build across the town (7.0) | golden hour, then clear modern daylight from the builder shot (`LOOK_3B`); render pending the Mixamo cast |

**Scene 1 controlled environment** (`src/world/campus/*`, `Tower.tsx`, `Precast.tsx`): a walled construction township of about 410 × 280 m inside the white city. Hero systems: the Aluform tower (22 floors), the precast block with its tower crane and trailer, the panelized data hall. Around them: three more Aluform towers at different stages with cranes, a finished precast block and one at podium level, the precast casting yard under a travelling gantry, a second panelized hall, raft pour with a boom pump, batching plant, excavation, site offices, labour colony, marshalling yard, laydown yards, trucks and crews. Every build event is timed to play inside the shot that shows it (`FLOORS_AT`, the precast lift list, `HERO_*` in `DataCenter.tsx`).

Construction in Scenes 2–3 runs on *story time* (`storyTime`), a per-film warp of film time that jumps only at cuts.

Text is never baked into the films. Titles, statements and tracking labels are HTML (`src/site/content.ts`), timed to the video; labels follow 3D anchors exported per frame.

## Render pipeline
1. Start the render server: `npx vite --config vite.render.config.ts` (port 5300; no file watching, so restart it after changing render or world code).
2. Films: `node tools/render/film.mjs --scene 1 --w 1920 --h 1080 --spp 16 --url http://localhost:5300` and the portrait cut `--portrait --w 720 --h 1280 --spp 16`. Drafts: `--w 960 --h 540 --spp 6 --frames 0,90,180 --dir name`.
3. Encode: `node tools/render/encode.mjs [--scenes 1,2]` writes `public/films/*` (MP4 1080, 720, portrait, posters, label anchors).
4. Review: `python tools/review/sheet.py renders/<dir> sheet.jpg` (contact sheet).
5. Characters: the Mixamo worker (`render-assets/mixamo/character.fbx`) and eight motion clips stored as compact JSON (`render-assets/mixamo/clips/*.json`: tablet, idle, working, kneeling, putting down, lifting, walking, thumbs up). The cast and its timing live in `src/world/Humans.tsx`. Render-only, git-ignored, never shipped.

## Open items
- H1-561 CORE and ECO specifications (not shown until verified). Premix bag weight is not printed until confirmed.
- Company figures are not shown until confirmed. RTARIUM links to https://rtarium.com (client decision).
