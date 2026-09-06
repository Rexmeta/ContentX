---
name: Lease-fenced publication recovery
description: Ownership and transaction rules for safely recovering remote publication work after process failure.
---

Lease ownership must fence every local mutation caused by a remote publication, including mutation of related domain lifecycle state. A worker may retain only the token it proposed when acquisition reports success; it must never adopt a token returned on an in-progress row. Expired work is resumed with the persisted remote idempotency identity rather than a newly generated one.

**Why:** A stale worker can return after takeover, or a failure path can observe another worker's active row. Guarding only the publication row still allows stale or non-owning requests to mutate related package state.

**How to apply:** Put lease-guarded publication finalization and related lifecycle transitions in one transaction. Require owner token plus unexpired lease on all transitions, and cover active observers, expired takeover races, stale transitions, and stale finalization with real-DB tests.