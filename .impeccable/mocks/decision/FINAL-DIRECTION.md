# Catch: final art direction (agreed 2026-10-12)

Sketches only. The real app (`index.html`) has not been rebuilt in these themes yet.
Next session: build the three themes into `index.html` on the `design-test` branch.

## What stays from the current app
Everything functional, plus the fixes already committed on `design-test`:
session numbering fix, Delete confirm, readable contrast, 16px inputs and 44px tap targets,
filters behind one toggle, shelf-first phone layout with the paste box docked at the bottom,
keyboard-reachable items, Esc closes Privacy, "No matches" state with Clear, invalid-link message,
"Saved." confirmation, sync banner with Try again.

## Three switchable themes, each with day and night
The theme switch replaces Leather / Sage. Day/night: follow the phone's light/dark setting, with a manual override.

| Theme | Idea | Night (reference sketch) | Day (reference sketch) | Unread mark |
|---|---|---|---|---|
| Oxblood Art Nouveau | Salon wall of framed, whimsical painted miniatures, newest slightly larger, empty nails for future frames | `r7/b-salon-v5.html` (dark wall; plaques have thin oxblood inner outline) | `r6/b-salon-v4.html` (light tan wall, ~60% tan / 40% oxblood; no plaque outline needed) | wine rosette on the frame |
| Green Hall | Two-row Art Nouveau bookshelf, flat graphic books in sage / olive-brown / gold / deep green, pale lily bookends that pop | `r7/c-shelf-v2.html` (deep green marble) | `r9/c-day-sage.html` (sage marble; gold rejected) | red ribbon bookmark on a pale tag |
| Dispatch | Stamps on the French Dispatch tiled floor, 3 columns, one row of empty slots, "newest" note, read links get a wavy postmark | `r9/d-night.html` (olive floor 60, charcoal stamps/border/dock 30, khaki edges/drawings/text 10) | `r9/d-day.html` (khaki floor 60, charcoal stamps/border/dock 30, olive stamp edges/text 10) | red hand-drawn circle (khaki halo at night) |

Palettes:
- Oxblood: #1A1519 #40101D #73303C #D9B88F #AC9B86
- Green Hall: #2A403A #748C76 #B1BFA3 #59523E #B09C70, accent #8C2020
- Dispatch: #BFB493 #403822 #393D3C #A69981, accent #8C2020

Rules: all text at least 4.5:1; spot colours only on light surfaces (or with a halo); every theme keeps the same controls (search, Filter, paste + Catch docked at the bottom).

## Per-link pictures (approved)
Auto-assign a picture from the link's address and title, using 36 subjects, each drawn in all three styles
(whimsical painting / spine emblem / stamp drawing):
music, instruments and gear, video, films and TV, podcasts and radio, maps and places, travel, food and recipes,
drinks, shopping, fashion, art and design, photography, books, articles and news, writing and notes, learning,
science and space, nature, code, AI and tech, apps and tools, games, sport, health, money, jobs, social,
email and newsletters, events and tickets, home, cars and transport, mysticism, kids, ideas, plus a fallback (a curious key).
- Per-link fixed variation from a hash of the link id (frame shape, colour, small extra detail).
- "Change picture" in the link's detail panel; the choice is saved with the link (new database column).
- Phase 2, later: fetch each site's preview image, or AI-painted miniatures via a server-side helper.

## Known issues to fix during the build
- In some sketches the drawings are mismatched (Vir MPC should be the drum machine, Roland Studio the synth).
- Keep the motion gentle (a frame swings once when hung, a ribbon settles, a postmark stamps).
