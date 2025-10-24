# Ethical Considerations

We applied the *Ethics for Interaction Design* lens across ideation → prototype → evaluation. Focus areas: privacy, consent, inclusion, and community impact. :contentReference[oaicite:3]{index=3}

## Stakeholders
- Mentors/streamers, learners, community moderators, bystanders (stream audiences).

## Data & Privacy
- Prototype stores **favorites/notes/playlists locally** (no server).
- Shared playlists are **URL-encoded** lists; users understand that opening a shared link imports content.
- During evaluation: informed consent, pseudonyms, no sensitive personal data recorded; screen/video capture optional.

## Inclusion & Access
- Legible typography; sticky headers; keyboard-accessible controls.
- Mobile-friendly reading mode prioritized for quick lookup.
- Clear language; avoid jargon in user-facing labels.

## Power & Fairness
- Mentors hold platform power during streams; we avoid dark patterns (no forced following/likes).
- Shared artifacts credit original author where applicable (in future: creator attribution).

## Risks & Mitigations
- **Stream pressure**: HUD avoids shaming; uses neutral prompts.
- **Harassment via sharing**: links are non-indexable; UI includes “clear playlist” and “remove” affordances.
- **Over-tracking** (future drills): keep logs client-side; if cloud needed, default to opt-in.

## Ethical Disclaimer (summary)
- This is a **proof-of-concept** to explore social/mobile learning. We deliberately minimize data collection and emphasize user control and clarity in sharing.

## Future Work
- Consent prompts when importing others’ playlists.
- Optional **visibility scopes** (private/unlisted/public) if cloud sync is added.
- Accessibility audit (WCAG quick pass) before any public release.
