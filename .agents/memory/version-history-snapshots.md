---
name: Version-history snapshot rules
description: Invariants for population/rule version history and reproducible sampling
---

Rule: any mutation of a versioned definition must (1) idempotently snapshot the
PRE-mutation state (backfills legacy rows created before history existed) and
(2) build + validate its patch INSIDE the transaction from the row locked with
FOR UPDATE — never from a pre-transaction read.

**Why:** Completion review rejected two earlier attempts: legacy rows had no v1
snapshot so old pins became unresolvable after the first edit, and validating
against a stale pre-lock read let a concurrent population update commit a rule
referencing a removed dimension.

**How to apply:** When adding new mutation paths to populations/dependency
rules (or any pinned-version domain), pass a buildPatch/validate callback into
the serialized repository transaction and upsert the content-addressed
snapshot (onConflictDoNothing) both before and after the write.
