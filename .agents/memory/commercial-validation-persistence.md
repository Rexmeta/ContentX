---
name: Commercial validation persistence
description: Rules for durable evidence checksums and generated SaaS resource IDs.
---

Evidence packages stored in PostgreSQL JSONB must be checksummed from canonical JSON with recursively sorted object keys; JSONB does not preserve insertion order. Keep verification backward-compatible when older packages used non-canonical serialization.

**Why:** A checksum calculated from ordinary JSON.stringify passed in memory but changed after a server restart because PostgreSQL reordered JSONB object keys.

**How to apply:** Use the same canonical serializer for package creation and verification, and test verification after an API restart rather than only in the creating process.

Generated organization, project, and member IDs must include a monotonic per-process suffix in addition to the timestamp.

**Why:** Date.now() alone can collide during same-millisecond requests, silently replacing one tenant/resource and invalidating isolation tests.

**How to apply:** Centralize generated-ID creation in the owning service; preserve explicit caller-provided IDs for fixtures and imports.