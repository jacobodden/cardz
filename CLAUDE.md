# cardz

A card-game score keeper: a local-first PWA (Vite, React 19, Tailwind 4, Dexie) on GitHub
Pages under `/cardz/`. No server, no sync, no sign-in. `docs/architecture.html` is the
overview: stack, source layout, routes, the Dexie schema, the `CardGame` hooks, themes, PWA,
scripts, CI and deployment. Read it before you change an area you don't know.

Card game rules (HTML; read them as text):
- @docs/games/up-and-down.html
- @docs/games/pay-me.html
- @docs/games/high-score.html
- @docs/games/low-score.html

Work in a `wt` worktree on a `claude/<ticket>-<type>-<desc>` branch and open a PR
(`~/development/CLAUDE.md`).

## Code conventions
- All Dexie access goes through the singleton `db` from `src/db/dexie-db.ts`. Data access
  helpers live in `src/db/` (`sessions.ts`, `rounds.ts`).
- Components read with `useLiveQuery` (`dexie-react-hooks`), not `useEffect` + fetch.
- Game logic in `src/games/` is pure functions with no side effects. Game definitions live
  in code; `src/db/seed.ts` upserts them by slug on every load, so a changed game or config
  schema reaches installed copies without a migration.
- Unit tests for `src/games/` and `src/db/` go in `tests/unit/`. DB tests call `resetDb()`
  from `tests/unit/db-helpers.ts`, which awaits `dbReady` before it clears the tables.
- Tailwind v4 uses `@theme` in `src/index.css`; there is no `tailwind.config.*`. The `dark:`
  variant follows the `.dark` class on `<html>` (`@custom-variant dark` in `src/index.css`),
  not the system setting.
- Keep form controls at 16px text or larger, so iOS doesn't zoom on focus (an e2e test
  checks this).
- Keep the header felt in every theme: on iOS the status bar is transparent over it and its
  text is always white.
- To add a color theme: add its entry to `src/themes.ts` and both token blocks
  (`:root[data-palette="<id>"]` and `:root.dark[data-palette="<id>"]`) to `src/index.css`.
  `tests/unit/themes.test.ts` checks the blocks and 4.5:1 text contrast. Add visual
  snapshots for the theme too.

## What's new
When players would notice a change, add an entry at the top of `src/changelog.ts`, in plain
words for players. `id` is the release date, with a suffix for a second entry that day.
Never change a shipped `id`: it is what each installed copy remembers as seen, and a new top
entry is what shows the "Cardz updated" toast.

## Tests
- `npm run lint`, `npm run build`, `npm run test:unit` (Vitest), `npm run test:e2e`
  (Playwright, phone and desktop) and `npm run test:visual`.
- Visual tests run only in the pinned Playwright container
  (`scripts/playwright-container.sh`, podman), the same image as CI. Never update baselines
  from a host run.
- Before you push a change that players can see (UI, words, game rules, a changelog entry),
  run `npm run test:visual`. For each failure, open `test-results/.../*-diff.png` and
  confirm that the change is intended. Then update only those tests:
  `sh scripts/playwright-container.sh tests/visual --update-snapshots -g "<test name>"`.
  Never regenerate the whole suite to make it pass. A new changelog entry always changes
  the `what's new page` baselines (desktop and mobile).
- The visual tests allow a 1% pixel difference (`playwright.config.ts`), so a small text
  change can pass against an old baseline. Update the baselines whose content you changed,
  and look at each one: a rewrite can also pick up rendering noise in tests you didn't
  change. Restore those.

## Docs
Docs are HTML on the Worn Hoodie docs kit, with the nav in `docs/docs.json`. The kit in
`docs/assets/` is a copy: never edit it (`docs-sync kit` updates it). Edit only between a
page's `docs:content` markers, then run `docs-sync` and `docs-sync --check`. No Markdown
under `docs/`; `README.md` is a short stub that links to them.
- When you add a game, add its rules page under `docs/games/`: link it from
  `docs/games/index.html`, add it to the Games group in `docs/docs.json`, and list it in
  `README.md`.
- `docs/design-history/index.html` is generated. Edit the template in
  `tests/design-history/gallery.ts` (it rewrites only the content block), then run
  `npm run design:index` and `docs-sync`.
- The planning notes keep their original layouts in a `.legacy` wrapper, recoloured to kit
  tokens. New write-ups use the kit's components.

## Claude Code commands
Suggest these to the user when the moment fits. Claude can start `/wrapup`, `/code-review`,
`/simplify` and `/cleanup` itself when the user asks for that step.

- At the end of a piece of work, in this order:
  1. `/simplify` cleans up the new code (reuse, simpler forms, wasted work) and applies its
     fixes. After a feature lands over several commits, give it those commits.
  2. `/code-review high` reviews the uncommitted diff for bugs, so it also checks what
     `/simplify` changed. Use it when the change touches several files, `src/db` or a
     game's scoring.
  3. `/wrapup` runs lint, build, unit, e2e and the visual tests, commits, pushes and opens
     the PR with the Ran / Baselines / Not verified checklist.
- After the PR is open, the user can type `/ship` to review it and watch it (CI, conflicts,
  comments) until it is merged, or `/steward` to watch it without the review. Only the user
  starts these; Claude never merges.
- `/cleanup` after the merge removes the worktree and the branches and updates `main`.
- `/run` to see a change in the browser (`npm run dev`). A change to a mobile layout
  (scrolling, sticky bars, safe areas, the keyboard) also needs a check on a real phone:
  ask the user to run `npm run dev -- --host` and open the address it prints on the phone.
- Plan mode (Shift+Tab) before a new feature or a change to the game rules, so the user
  agrees to the plan before the code changes.
- `/rewind` to go back to a checkpoint after a wrong attempt, instead of undoing it by hand.
