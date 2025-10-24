# Research Synthesis

## Methods
- 6 semi-structured **interviews** (3 mentors, 3 learners; 30–45 min each)
- 12-participant **usability sessions** (web + overlay HUD; 25–35 min)
- Short **post-session survey** (SUS + open text; n=12)
- **Contextual observation**: 2 mentoring streams (Twitch/Discord; 90 min each)

## Participants (summary)
- Mentors: streamer-coaches (2), club leader (1)
- Learners: intermediate players aiming to coach peers
- Devices: desktop (10), laptop (2); OBS usage by mentors (3)

## Key Findings (feelings & value)
1) **Feeling organized**: “Playlists make lesson flow less chaotic.” (9/12)
2) **Confidence booster**: “Seeing steps in the overlay keeps me calm on stream.” (3/3 mentors)
3) **Momentum in learning**: Combo Maker PNGs “make progress tangible” to share (10/12).
4) **Friction**: jumping between web and overlay “breaks rhythm” (8/12).
5) **Social proof**: shared playlists “signal what matters” in a character (7/12).

## Pain Points
- Switching contexts (browser ↔ OBS) interrupts teaching.
- Combo export failed in Safari for 2 participants (resource tainting).
- Learners want **mobile-first** viewing for quick lookup while sitting with a pad.

## Quant (lightweight)
- SUS (quick, prototype-level): mean **72.1**
- Time-on-task (find + add 3 moves to playlist): median **1m 40s**
- Combo Maker (write → export): success **10/12** (2 browser issues)

## Design Implications
- **Deeper integration** between site & HUD:
  - “Send to HUD” from web (websocket or shared local server).
  - Auto-advance steps on HUD when mentor presses hotkey.
- **Mobile reading mode**: ultra-legible move cards & playlists.
- **Playable scripts**: playlists as timed “drills” that log attempts.
- **Share-first patterns**: one-click share buttons with preview.

## Next Steps
- Prototype a **link channel** (web → HUD) for live lesson syncing.
- Build a **mobile layout** with focus on tokens/frames & fewer columns.
- Add **activity traces**: session recap (moves covered, attempts, comments).

