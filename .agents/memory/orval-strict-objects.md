---
name: Orval ignores additionalProperties:false
description: Generated zod objects strip unknown keys instead of rejecting them
---
Orval's zod output does not emit `.strict()` for `additionalProperties: false` — unknown keys are silently stripped by `safeParse`.

**Why:** Discovered when route-level 400s for unknown character attribute groups never fired; the domain validator only saw the stripped copy.

**How to apply:** When an endpoint must reject unknown keys, forward the raw `req.body` field to a domain-level validator instead of relying on the generated zod schema (see `routes/characters.ts` rawAttributes pattern).
