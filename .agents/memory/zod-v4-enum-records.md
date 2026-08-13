---
name: Zod v4 enum-keyed records
description: z.record over an enum key demands ALL enum keys; use z.partialRecord for subsets.
---

In Zod v4, `z.record(z.enum([...]), value)` requires the object to contain EVERY enum key (exhaustive). For "any subset of these keys" semantics use `z.partialRecord(z.enum([...]), value)`.

**Why:** A valid single-category payload failed validation during simulation policy work because the enum-keyed record demanded all five state categories.

**How to apply:** Any hand-written zod schema keyed by an enum where partial maps are legal.
