# Design Process Overview

> A top-level narrative of how we designed FramePerfect to support **social (mentoring/sharing)** and **mobile (on-the-go lookup)** practice in Tekken. :contentReference[oaicite:2]{index=2}

## Summary
Teaching/learning Tekken is fragmented across wikis, discord, and streams. We prototyped a **Web app** (move library, playlists, combo maker) + an **Overlay HUD** for streams/mentoring. Together they let mentors build/share lesson plans and guide learners live. The experience is deliberately social (shared artifacts) and mobile (quick lookup, low friction).

## Process (highlights)
1) **Research → Requirements**
   - Interviews + usability sessions revealed needs to *organize lessons*, *reduce context switching*, and *share artifacts*.
   - Requirements: (R1) fast search & sorting, (R2) playlists as lessons, (R3) combo sharing, (R4) in-stream guidance, (R5) mobile-legible reading mode.

2) **Concepting & Lo-fi**
   - Sketches of a columnar move table with tokens, playlist bar as “lesson script”, and HUD wireframes (step list + input hints).
   - Chosen approach: separate prototypes that interoperate via shared links and (future) live sync.

3) **Interactive Prototypes**
   - **Web**: move list with sticky header + filters; per-move notes; playlist CRUD + share links; combo maker with iconography + PNG export.
   - **HUD**: lightweight overlay that displays steps, inputs, and teaching prompts; prepared to load playlists.

4) **User Evaluation**
   - 12 sessions + 6 interviews. Users valued organization (playlists), confidence on stream (HUD), and tangible sharing (combo PNGs).
   - Pain: site ↔ HUD switching; desire for mobile reading mode.

5) **Refinement**
   - Fixed playlist identity/keying; polished table alignment; hardened PNG export (CORS-safe assets).
   - Designed **Next**: “Send to HUD” & **drills** (auto-advance + progress logging).

## Social & Mobile Rationale
- **Social**: shared playlists and combo images act as **boundary objects**—portable artifacts that coordinate understanding in communities. Activity traces (notes, attempts) support coaching reflection.
- **Mobile**: learners often sit with a pad/phone—so we prioritize legibility, compact tokens, and minimal steps to share or favorite.

## Results (made-for-prototype)
- SUS ≈ 72; 9/12 “felt organized”, 3/3 mentors “more confident” on stream.
- Time to create/share a 3-move playlist: median 1m 40s.
- 10/12 successful combo exports; 2 with Safari issues (handled in fix).

## Limitations
- LocalStorage only, no cloud profiles.
- No live sync yet; simulated by manual reload on HUD.

## Who Did What
- A: Move Library UI, filtering, tokens
- B: Playlist model & share URLs, HUD integration
- C: Combo Maker & export
- D: Research, evaluation, poster & promo

## Links
- **Prototype (web)**: /web (see README)
- **Prototype (HUD)**: /overlay-hud (see README)
- **Poster**: see `/docs/Poster-and-Promo.md`
