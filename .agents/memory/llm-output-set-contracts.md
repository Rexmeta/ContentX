---
name: LLM fixed-set output contracts
description: When an LLM endpoint promises a fixed set of items (e.g. one entry per dimension), enforce set completeness/uniqueness server-side, not just item shape.
---

Rule: if an API contract says an LLM-produced list covers a fixed vocabulary
(one item per dimension/category), zod item-shape validation is not enough —
also validate that every allowed key appears exactly once (no missing, no
duplicates) and surface violations as 502, before the response reaches clients.

**Why:** LLM output is nondeterministic; a schema that only checks item shape
lets production return an incomplete "complete analysis" that the UI presents
as exhaustive. Completion review rejected exactly this gap.

**How to apply:** put the set-completeness check in a small exported validator
called both inside the LLM wrapper and in the route (so tests that mock the
LLM function still exercise it). Also bound free-text inputs (length + trim)
at the request schema before they reach the LLM, matching what the lineage/
persistence layer enforces.
