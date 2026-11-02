# Design History

Dated screenshots of the Cardz UI, captured with Playwright. The gallery is a
human-readable record of how the design changes over time; the Playwright
snapshots in `tests/visual/` are the machine-enforced regression guard.

## Capturing a new milestone

```bash
npm run design:capture
```

This writes JPEGs to `docs/design-history/<YYYY-MM-DD>/` and regenerates
`docs/design-history/index.html`. Run it when a visual milestone lands, review
the gallery, and commit the new dated folder plus the updated index.

Folders may carry a suffix (for example `2026-11-01-before-redesign`) to keep
two milestones from the same day distinct. The gallery lists every
`YYYY-MM-DD*` folder, newest first.

The capture is intentionally excluded from the normal test run and from CI.

## Visual regression baselines

```bash
npm run test:visual          # compare against committed baselines
npm run test:visual:update   # intentionally update baselines
```

Baselines live in `tests/visual/current-ui.spec.ts-snapshots/` and are
committed. When a visual change is intentional, run the update command, review
the new images, and commit them.

## Environment note

Visual snapshots are sensitive to font rendering. The committed baselines were
generated on Linux. Run `npm run test:visual` on the same platform (or in a
matching Playwright container) before trusting a diff. CI currently runs the
functional e2e suite only; visual baselines can be added to a containerized CI
job later if needed.
