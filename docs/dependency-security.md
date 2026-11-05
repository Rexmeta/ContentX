# Dependency security remediation

## Scope and result (2026-11-05)

All 46 originally reported findings are resolved: 45 by patched dependency
versions, and one by an upstream advisory withdrawal.

- `braces@3.0.3` / `GHSA-vfj7-8cjw-p6xm` is retained because the advisory was
  [withdrawn by its publisher](https://osv.dev/vulnerability/GHSA-vfj7-8cjw-p6xm)
  on 2026-10-23 as not practically exploitable. No audit ignore was added.
- Vite stays on its patched 7.x line and Vitest on its patched 4.x line.
- The editor's `prosemirror-model` and `prosemirror-view` versions are aligned to
  avoid incompatible duplicate model types after updating the view.
- The latest Tailwind typography package still pins an affected selector parser;
  a parent-scoped override selects `postcss-selector-parser@6.1.5`.
- Express uses patched `body-parser` through a parent-scoped override.
- The existing esbuild override and its direct API build dependency both use
  `0.28.2`. The one-day minimum release age and install-script allowlist remain
  enabled.
- Orval is upgraded with its parsing dependencies; React Query v5 output is
  explicit because the generator cannot infer a version from `catalog:`.
  The client compiler includes DOM iterable types required by generated headers.

The fresh scan also found additional advisories beyond the original list.
Compatible fixes were included. One unrelated high-severity finding remains:
`zod@3.25.76`, `GHSA-mrhx-c7xc-m3w5`, fixed in `>=4.6.6`.
Migrating the shared Zod dependency to a new major is not included in this
dependency patch task; it needs separate compatibility verification for forms,
generated schemas, and database integrations.

## Verification

- Fresh dependency scan: no original active advisories remain; only the
  additional Zod finding above remains.
- Frozen-lockfile offline installation succeeds.
- All artifact production builds succeed with the build-time `PORT` and
  `BASE_PATH` supplied.
- API unit/API-route tests: 398 passed; real-database tests deliberately excluded
  so this dependency task does not mutate development data.
- Shared simulation contract tests: 6 passed.
- Frontend tests: 68 passed, 13 failed in `world-bridge.test.tsx`. An isolated
  checkout of the unchanged baseline with its original lockfile reproduces
  the same 13 failures (missing English “Scenario Library” button).
- Full typecheck stops at six pre-existing mockup template errors in
  `SwissGridCRMDashboard-ZK83Ro/App.tsx`; the original baseline reproduces these.
  The API's standalone typecheck also has pre-existing source/test errors.
  Baseline comparisons distinguish these from dependency-upgrade regressions.
