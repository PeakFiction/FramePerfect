# FramePerfect — Social & Mobile Tekken Toolkit

**FramePerfect** is a two-part prototype:
- **Vite website**: searchable move library, playlists, notes, combo maker (export), and share flows.
- **Overlay HUD**: stream/mentoring overlay that shows inputs, notations, and teaching prompts.

Together they support **learning, teaching, and sharing** in the fighting-game community.

---

## ✨ Core features (prototype scope)
- **Move Library**: fast search, sort by startup/on-hit/on-CH, text tokens, sticky table header, per-move notes.
- **Playlists**: add moves from the library, order them, share via encoded links; use playlists as lesson plans.
- **Favorites & Notes**: lightweight personal memory per move.
- **Combo Maker**: click/parse notation → icon strip; export .png for quick sharing (Discord/Twitter).
- **Overlay HUD**: on-stream guidance (inputs, step list), teaching prompts, “what to do next” hints.

Multi-user/social angle: users share playlists and combo images; mentors structure sessions; learners follow steps live.

---

## 🧪 Try it locally

### Prereqs
- Node 18+ and pnpm or npm

### Web app
```bash
cd web
pnpm i
pnpm dev   # or: npm install && npm run dev
