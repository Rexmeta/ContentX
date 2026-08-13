---
name: Import dedup must be atomic at the DB boundary
description: Lookup-then-insert dedup on JSONB fields races; use pg advisory xact locks (no NUL bytes in key text).
---

Deduplicating imports by a JSONB provenance field (no unique constraint possible) cannot be done with a separate lookup followed by insert — concurrent first imports both see "no row" and duplicate. 

**Why:** completion review rejected exactly this race in the MatrAIx importer.

**How to apply:** put lookup + insert-or-update in ONE transaction guarded by `pg_advisory_xact_lock(hashtextextended(<key>, 0))` keyed on the source identity, and compute any diff/previous-version from the row read under the lock. Note: PostgreSQL text params reject NUL (`\u0000`) bytes — use a printable separator in lock keys. Verify with real-DB Promise.all concurrency tests; mocks cannot catch this.
