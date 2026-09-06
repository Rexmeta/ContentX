---
name: Assessment v1 rich persona projection
description: How to preserve detailed AI-generated persona material without changing the RoleplayX assessment package version.
---

Keep `AssessmentScenarioPackageV1` and the RoleplayX receiver unchanged unless a version migration is explicitly in scope. Rich persona stance, goals, concession conditions, opening dialogue, and behavior guidance must be projected into the existing persona background/traits and simulation fields rather than dropped.

**Why:** RoleplayX publication forwards the canonical stored package, so information omitted during compilation cannot be recovered at publish time. Adding unversioned fields would also break the strict v1 contract.

**How to apply:** Any assessment generator or compiler change must test that rich source material survives compilation, immutable storage, and the exact publication payload through existing v1 fields.