---
name: Orval emits zod v4 syntax
description: Generated Zod file needs zod/v4 import; codegen script patches it
---

Orval v8 generates zod-v4 API calls (e.g. `zod.int()`, `zod.record(k, v)`), but the workspace `zod` root export is the v3 classic API (zod 3.25.x ships v4 under the `zod/v4` subpath).

**Why:** Typecheck failed with `TS2339: Property 'int' does not exist` after adding `type: integer` fields to the OpenAPI spec.

**How to apply:** The `codegen` script in `lib/api-spec/package.json` includes a `sed` step rewriting `from 'zod'` → `from 'zod/v4'` in `lib/api-zod/src/generated/api.ts`. Keep that step whenever touching the codegen pipeline; orval's `clean: true` regenerates the file each run.
