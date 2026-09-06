---
name: Orval client EOF formatting
description: Why generated React API clients need an EOF normalization step before whitespace validation.
---

Orval may append multiple blank lines to the generated React client, causing `git diff --check` to fail even when generation and type checking succeed.

**Why:** Re-running API codegen repeatedly reintroduced the same EOF-only whitespace error after manual cleanup.

**How to apply:** Keep EOF normalization in the codegen pipeline before treating `git diff --check` as authoritative. Do not hand-edit generated output as the long-term fix.