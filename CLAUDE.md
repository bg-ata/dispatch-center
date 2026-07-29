# RENMAD Dispatch Center — rules for every session working in this repo

Static multi-page app (no build step) + Supabase (project `dxgvbufsifgowwfggvmr`, RLS-enforced tiers).
Live at https://dispatch.renmad.com. ~18 real users — this is a production system for the whole team.

## The growth rulebook (agreed with Belén, 29 Jul 2026 — UX audit)

1. **No new top-level nav tabs.** A new capability lands as a tab INSIDE an existing area
   (Me / Projects / Team / Money / SPX / Impact / Tools / CRM / 🔔). A new area is only born
   when Belén explicitly approves it. Coming services (commissions, CRM expansions) follow
   this rule too — tabs first, re-grouping later when the shape is visible.
2. **No tab ships empty.** If the data is not there on day one, the tab does not appear
   (gate it like Impact gates on weekly data). An empty tab teaches the team to stop exploring.
3. **One concept, one home, N views.** Every dataset has a canonical page; anywhere else it
   appears is a VIEW that links back (e.g. Money→Sponsorship is a read-only window on the SPX
   board). When you must duplicate logic across pages, comment BOTH ends with a keep-in-sync
   pointer — and prefer lifting the helper into store.js.
4. **One navigation pattern.** Sub-views inside a page = hash-tabs (`#year`, `#requests` style,
   linkable, like Money/Inbox). Sibling PAGES in one area = the level-1 pill switcher (like
   Money↔Invoicing, Team↔HR admin). Actions: **+ Add top-left, ⬇ Excel top-right**, always.
5. **New audience → gate a tab, don't add a page.** Reuse the existing flags
   (access / finance / hr / billing / canSeeHR / isBelenP) and mirror the gate in RLS.
6. **Replaced pages become redirect stubs**, never dead links (see finance/holidays/hours/tickets.html).
7. **Signpost multi-view concepts.** When a concept shows in Me AND an admin area, each side
   gets a one-line pointer to the other.
8. **Language per audience, never mixed on one page.** Team-wide surfaces = English;
   accounting-facing surfaces (facturación) = Spanish.

## Deploy ritual (hard rules)

- Deploys happen **after 18:00** (Belén's rule) via `..\dispatch-backup\deploy_dispatch.ps1 -Go -Ref <sha>`
  — always from a COMMIT, never the working tree.
- **Bump the `store.js?v=` cache-buster on ALL 16 pages AND `version.json` in the same commit.**
  version.json drives the in-app "new version — tap to reload" banner; forgetting it means
  open tabs never learn about the deploy.
- Pre-flight before any deploy that touches store.js: every column in the COLS whitelists must
  exist in the DB (left-join against information_schema.columns via the Supabase MCP).
- DDL goes to Supabase BEFORE the code deploy. `_sql/` is gitignored — SQL files live on disk only.
- The deploy script never DELETES server files — removing a file from the repo does not remove it live.

## Working alongside co-sessions (this repo usually has more than one active)

- `git log` + `git status` + file mtimes BEFORE building and AFTER; re-check every page's `?v=`.
- **Stage explicit files (`git add <files>`), NEVER `git add -A`** — it commits another
  session's work-in-progress under your message (it happened 29 Jul).
- Expect your WIP to be swept into someone else's commit anyway: before deploying, verify
  HEAD **content** (grep for your markers), not just your own commit.
- Do not edit a file another session touched in the last ~30 min (check mtimes) without
  checking what it is doing.

## Testing

- Never test against live data: copy the repo to a scratchpad rig, blank `SUPABASE_URL` in the
  copy (→ offline/localStorage mode), serve with python http.server, drive with browser tools.
- Screenshots wedge on the wide Gantt pages — verify via read_page / javascript instead.
- PS5.1: commit messages via `git commit -F msgfile` (never -m with here-strings); ASCII only
  in deploy_dispatch.ps1; use [IO.File] APIs for UTF-8 writes.
