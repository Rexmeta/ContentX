---
name: Postgres timestamp CAS precision
description: Why optimistic ownership checks cannot rely on exact PostgreSQL timestamp equality through JavaScript Date.
---

Do not use exact equality between a PostgreSQL timestamp and a JavaScript `Date` as the sole compare-and-swap condition. PostgreSQL preserves microseconds while JavaScript preserves milliseconds, so an unchanged row can fail an equality check.

**Why:** A real workflow execution claim was rejected even without a concurrent writer because the inserted timestamp contained sub-millisecond precision that disappeared when read into JavaScript.

**How to apply:** Use a real revision token or exact domain-state predicates for ownership. If a timestamp window is needed to bridge driver precision, pair it with exact equality on the state that must remain unchanged.