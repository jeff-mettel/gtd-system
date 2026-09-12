# GTD System — working notes for Claude

- Read `docs/architecture.md` first; `docs/decisions.md` is the running log — append a
  line there for every design decision made in conversation.
- `frontend/` is a Vite project in plain ES modules — no framework, no TypeScript yet.
  One module per view (`src/views`), drawer (`src/drawers`) and concern; example data in
  `src/data/example.js`; derived reads in `src/model.js`; the Replay (event log → fold →
  three.js scene) in `src/replay`. Run `npm run dev` from `frontend/`; `npm test` and
  `npm run lint` must pass before publishing. Publish with `npm run build:artifact`, then
  the Artifact tool with `frontend/dist/artifact.html`, `root: frontend/dist`, the
  `assets/*` files (not the `.map`s), and the existing artifact `url` from `README.md` —
  never create a second artifact.
- One session in this checkout at a time. A parallel session that commits with
  `git add -A` sweeps another session's half-finished work into unrelated commits.
- Demo "today" is Mon 14 Sep 2026; dates in example data are relative to `TODAY`.
- Trust invariants are not negotiable in the UI: the AI never sends, books, or deletes
  without approval; every AI write is tagged; "what approving does" is declared, not
  model-written.
- `wiki/` follows the Karpathy conventions in `docs/wiki.md` (same as `knowledge/`):
  frontmatter, `index.md` line and `log.md` entry for every page change; never edit
  inside `<!-- compiled:… -->` fences by hand — that's the compile job's territory.
- Charts follow the dataviz palette already in the file (`--s1..--s3`, `--o1..--o4`).
  Status colors are separate from the accent and always come with a label.
