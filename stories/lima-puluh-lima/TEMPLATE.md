# Template: "Kenapa sarang lebah bentuknya segi enam?" (2D → 3D → 2D)

A complete, working HyperFrames composition (1080×1920, 60 fps, ~19.9 s, Indonesian VO). Copy `index.html` into a fresh HyperFrames project, put the voiceover at `assets/vo.wav`, and replace the content section by section. `vo.txt` and `words.json` are the script and the aligned timings this version was built on (the VO audio itself is not bundled).

## Section map (search for these comment headers)
| Section | What it is | What to change for a new topic |
|---|---|---|
| `<style>` | caption engine CSS, overlay styles, scrim, vignette, warm bg + grid | usually nothing; colours per topic if needed |
| SVG `<defs>` | gradients (wax, slate, honey, cap, empty, bark, leaf, bee), blur, glow and shadow filters, `#beeDef` character | your materials and characters |
| SVG groups `#hook/#cam/#tiling/#flyHero/#finale` | 2D layers: hook world under a 2D camera, the tiling stage, the flying shared element, the finale bookend | your 2D scenes |
| `shared world data` | **one geometry list** (`tiles`) used by both the SVG and the three.js scene; the `TOP` / `FIN` projections; `MORPH_IN` / `MORPH_OUT`; the `WARP` table | your geometry, projections, morph times |
| `2D illustration` | `cellArt`, `branchArt`, `leaf`, `bee` builders; the hook comb, hero cell, bees | your illustration builders |
| `2D camera … with parallax` + `render2D(t)` | camera keys `CAMK` (focus + scale), parallax factors, bees, shared-element flight, tile pops, finale bees; every frame is computed from `t` | your keys and flights |
| `2D timeline` | wing flaps, hero walls closing, hand-off, seams, glows, 2D→3D and 3D→2D crossfades | your events |
| `captions (… on the root clock)` | `W` (token, start) + `PHR` (phrases, `em` = boxed token) built from the aligned VO; engine identical across videos | **always**: new words + phrases |
| `3D-section overlays` | tag, pinned counters, −7 % counter, flash, honey bg, formula card | your overlays |
| module script | three.js: renderer, lights, shadow ground; cells from wall panels (`makeCell`/`applyCell`); per-cell state `cellState(c,t)` (lineup flight, honey fill, explode-into-bars, comb growth, glow sweep); honey bubbles; camera keys `K` (spherical + `sh` pan, top-down keys via `hTop`); pinned counters; `renderAt(t)` gated to the 3D window | your 3D beats and camera |

## Clock model
- The animation was authored on its original (English) clock. The root timeline runs on the VO clock and drives the inner timeline `tl` through `warp(t)`; three.js renders at `warp(hf-seek time)`.
- **New film, no localisation**: author directly on your VO clock and set `WARP = [[0, 0], [END, END]]` (identity), or drop the root/inner split.
- **Re-voice or translate**: see `references/localization.md`.

## Numbers in this template
Equal-area cells (area = 1): perimeter triangle 4.56, square 4.00, hexagon 3.72; hexagon vs square = 7 % less wall. Projections: tilings at 55 px/unit (camera height 65.1), comb at 75 px/unit (camera height 47.8), both with fov 30° and pitch 89.9°.
