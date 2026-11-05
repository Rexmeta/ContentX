---
name: Dependency update compatibility
description: Non-obvious compatibility hazards when refreshing pnpm dependencies
---

Keep peer-dependent tooling and the editor model dependency deduplicated when
refreshing security patches.

**Why:** A recursive dependency refresh can resolve multiple versions of the
same peer or editor model. Even patch-level duplicates can create incompatible
TypeScript identities despite successful runtime builds. Catalog-based version
declarations can also prevent generators from detecting the target API version.

**How to apply:** Check resolved peer versions when a dependency update introduces
deep plugin/model type errors. Prefer aligning compatible versions over type
casts or disabling checks. Verify generators in isolation and explicitly declare
their target API version when catalog inference fails.
