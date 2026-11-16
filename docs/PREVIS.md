# HEMISPHERE ONE V2 — Director's Previsualisation
**Film:** Democratising Modern Construction · **Reference duration:** 58 s · **One continuous camera. No cuts, fades or dissolves.**
The camera keys below are implemented in `src/film/shots.ts`, which is the single source of truth. This page explains them.

## 1. Audit summary
| Item | Finding | V2 decision |
|---|---|---|
| V1 stack | React 18 + Vite 5 + three 0.169 + GSAP 3.12 (custom engine, comic look) | V2 is a new, independent project: React 18 + **React Three Fiber 8** + drei + postprocessing + GSAP + Lenis. V1 is untouched. |
| Branding | Logo PNGs (white/ink), Yellow `#FCD301`, Ink `#0F1A20`, Paper `#F7F4EB`, Green `#47C13C`, Archivo + Manrope | Reused. Blue-green transformation = brand Green `#47C13C` + restrained technical blue `#3FB7E8`. |
| Product refs | Deck: JET formwork is green plastic with a ribbed back and 50 mm grid; H1-561 ECO/MINI/CORE/PRO are towable mixer-pumps with a yellow frame and charcoal panels | JET panels follow the sitemap widths (600/300/200/150/100) with pin & wedge, wing clamps, walers and soldiers. **The H1-561 is a provisional model** (ECO proportions estimated from deck renders) until OEM drawings arrive. |
| Reusable 3D | `rtarium-cell-t10.glb` (real RTARIUM cell); MPFB builder (Blender) | RTARIUM is used wherever mesh reinforcement shows. Humans are produced in Blender, then exported to GLB. |
| Sitemap (PDF) | Home · H1-561 (PRO/CORE/MINI/ECO) · JET Formwork · RTARIUM (external) · Concrete (Premix: ENERMIX, TERRAMIX; Chemicals: ACTIPOUR, ACTIMIX) · Solutions (Housing, Walling, Precast, Flooring, Infra) | All internal routes go to a branded "Engineering what's next" page. RTARIUM goes to https://rtarium.com. |
| Audio | — | No VO and no music. Optional synthesised SFX, off by default. |

## 2. World masterplan (metres, three.js Y-up; the journey travels toward −Z)
```
            +Z (behind start)
   camera start (34, 2, 44)  ●
                      ┌────┐
                      │ T  │  Aluform tower 26×26, 38 floors × 3.1 m = 118 m   centre (0, 0, 0)
                      └────┘
              ┌───┐
              │ P │           Volumetric precast mid-rise 21.6×18, 9 storeys      centre (−55, 0, −240)
              └───┘ ✚ tower crane (−32, 0, −240)
                         ┌──────────┐
                         │    F     │  Panelized factory, span 40 m, 20 bays × 7.5 m = 150 m long (along Z)
                         └──────────┘  x 25…65, z −400…−550, eave 12 m
   ════════════ ring road / district edge  z ≈ −620 ════════════
          open land: "the gap"   z −620…−900
   ░░░ semi-urban fringe: G+1/G+2 houses, palms, power lines   z −880…−1250 ░░░
                    ▣ S  traditional housing site, plot 9×15  centre (10, 0, −1000)
                      (front elevation faces −Z, so Scene 2 looks back toward +Z with the giants' skyline on the horizon)
            −Z
```
Background skyline: about 260 instanced LOD towers in a ring around the district (r 250–1600 m), kept out of the camera corridor. Fog provides aerial perspective.

**Sun:** one sun for the whole film, toward (0.55, 0.62, −0.55), about 38° elevation. Scene 1 is side-lit from camera-right. Scene 2 is ¾ front-lit with the skyline softly backlit. The shift from cool to warm comes from exposure, atmosphere and grade only; the sun's direction never changes.

## 3. The one-take (camera keys; lens = full-frame 36 mm gauge)
| # | Time | Technique | Start → end position | Look-at | Lens | Text |
|---|---|---|---|---|---|---|
| 1 | 0–4 | Low-angle push-in + technocrane rise | (34, 2.0, 44) → (30, 26, 30) | tower base (2, 22, 0) → active floors (0, 100, 0); starts ~20° up | 24 | MODERN CONSTRUCTION. REDEFINED. |
| 2 | 4–8 | Ascending arc, 120° CCW around the tower | az 45° → 165°, r 42→46, h 26→104 | active forms (0, 112, 0); from 6.6 s it slides toward P | 24→33 | 01 / ALUFORM SYSTEMS · PRECISION / SPEED / SCALE |
| 3 | 8–13 | Parallax dolly + 75° arc, L→R across P's front | (−48, 70, −80) → (−100, 42, −190) → (−18, 30, −206) | module landing zone (−55, 26, −240) | 45→48 | 02 / VOLUMETRIC PRECAST · PREFABRICATED. PRECISE. |
| 4 | 13–19 | Low tracking along the bays → sweeping crane arc | (16, 2.6, −388) → (17, 6, −445) → (−32, 82, −470) | down the bays (32, 7, −470) → whole footprint (50, 0, −505) | 26→24 | 03 / PANELIZED CONSTRUCTION · BUILT FOR SCALE. |
| 5 | 19–23 | Descending crane **over** the site (the yaw turns while the camera looks straight down, so there's no visible spin) | (−10, 62, −760) → (8, 34, −985) → (17, 1.7, −1009.5) | fringe → site plan view → house front with the skyline beyond | 35 | (none) |
| 6 | 23–28 | Ground tracking L→R, 1.6 m | site-local (−7, 1.6, 6.5) → (−1, 1.6, 6.0) | worker A placing plywood on the extension column | 35→38 | HIGH CAPITAL. HIGH BARRIERS. |
| 7 | 28–33 | Human-scale lateral dolly L→R, 1.5 m | (1, 1.5, 4.2) → (4.6, 1.5, 4.0) | mason (fg) → plasterer (bg) | 50 | THE TECHNOLOGY GAP. |
| 8 | 33–37 | **Dolly zoom**: builder constant size, skyline compresses through the frame openings | distance 4.7 m → 7.64 m (= 4.7 × 65/40) | builder's head | 40→65 | MODERN TECHNOLOGY SHOULDN'T BELONG ONLY TO THE GIANTS. |
| 9 | 37–42 | Curved tracking push-in around the exposed corner, h 1.7→2.4 | → (−2.2, 2.4, 5.2) | extension column: plywood out → JET in | 35 | WE ARE HERE TO BRIDGE THE GAP. · JET FORMWORK |
| 10 | 42–46 | Motivated arc to the machinery, revealed past the sand heap and brick stack | → (−10.8, 2.0, 2.4) | H1-561 (−8.6, 1.0, −4.6) | 45 | ADVANCED CONCRETE. ON SITE. · H1-561 SERIES |
| 11 | 46–50 | Continuous lateral tracking L→R along the front wall | (−3, 1.6, 5) → (5.6, 1.6, 5.2) | brick/plaster bays → monolithic wall | 38 | PRECISION. WITHOUT COMPLEXITY. |
| 12 | 50–54 | Over-the-shoulder dolly arc to a ¾ face | behind the right shoulder → (8.9, 1.68, 1.2) | house past the shoulder → builder's face | 50→62 | (none, his reaction carries it) |
| 13 | 54–58 | Reverse crane pull-back; the network grows; logo resolves from the network lines | → (24, 120, 165) site-local | site → ecosystem centre | 32 | HEMISPHERE ONE · BUILDING FUTURE. TOGETHER. |
| — | 58+ | **Landing state:** the camera settles into a slow idle drift; the editorial index opens | — | — | 32 | H1-561 Series · JET Formwork · RTARIUM ↗ · Concrete · Solutions |

Site-local coordinates: world = (10 − lx, ly, −1000 − lz). The site group is rotated 180°.

### Continuity devices (instead of cuts)
- **1→2:** the same crane move simply keeps rising and starts to orbit.
- **2→3:** the tower's corner column wipes across the frame as the camera clears the tower, revealing P beyond it.
- **3→4:** the camera exits P's arc on the right; the factory's long roofline becomes the leading line.
- **4→5:** the crane sweep continues forward over the ring road. The fringe rises; a water tank and power lines pass close to the lens.
- **5→6:** the camera arrives at human height behind the bamboo scaffold, which wipes the frame.
- **8→9:** the dolly zoom releases into the curved push-in.
- **9→13:** one continuous ground-level path that finally lifts away.

## 4. Construction choreography (all pure functions of film time t; scrubbing is fully reversible)
- **Aluform (0–8 s):**
  1. rebar visible on the active floor;
  2. wall panels slide in, staggered;
  3. pins and wedges seat;
  4. deck panels and props assemble;
  5. a pour band (wet → cured shown as an obvious time-lapse);
  6. the forms strike and climb to the next floor (3 cycles).
- **Precast (8–13 s):** the tower crane hook lowers each module, which pauses 0.15 s above its bearings, seats and settles 8 mm. 8 modules in time-lapse; the facade then completes.
- **Panelized (13–19 s):** portal frames → purlins and girts → wall panels (staggered, lifted on a telehandler path) → roof panels → flashing.
- **Transformation (37–50 s):** a precise wave travels along the structural edges. The plywood releases, swings out and stacks; the JET panels arrive, align and clip; the machine is revealed and mixes; the brick bay becomes a monolithic wall. Geometry changes, not just colour.

## 5. Mobile
A separate set of camera offsets (`shots.ts → mobile`):
- the camera sits 12–20 % further back, with a narrower lateral travel;
- text sits in the top 12 % / bottom 18 % safe bands;
- the focal length is recalculated from the 36 mm gauge on the portrait height, so there's no fish-eye.
