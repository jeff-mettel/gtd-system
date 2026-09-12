# GTD System — working notes for Claude

- Read `docs/architecture.md` first; `docs/decisions.md` is the running log — append a
  line there for every design decision made in conversation.
- `frontend/commitment-ledger.html` is a single self-contained file. Keep it that way
  until a back-end exists. Publish updates to the existing artifact URL in `README.md`
  (pass `url` to the Artifact tool) — never create a second artifact.
- Demo "today" is Mon 14 Sep 2026; dates in example data are relative to `TODAY`.
- Trust invariants are not negotiable in the UI: the AI never sends, books, or deletes
  without approval; every AI write is tagged; "what approving does" is declared, not
  model-written.
- `wiki/` follows the Karpathy conventions in `docs/wiki.md` (same as `knowledge/`):
  frontmatter, `index.md` line and `log.md` entry for every page change; never edit
  inside `<!-- compiled:… -->` fences by hand — that's the compile job's territory.
- Charts follow the dataviz palette already in the file (`--s1..--s3`, `--o1..--o4`).
  Status colors are separate from the accent and always come with a label.
