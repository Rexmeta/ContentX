---
name: Simulation runtime layering
description: Generic runtime vs negotiation compat facade; interaction_events payload shapes are a compatibility contract.
---

The simulation domain has a generic runtime layer (Environment/Policy/Action/StateTransition generics with an environment-agnostic loop) and a negotiation compat facade (flat behavior shape with required utterance, the original public engine API).

**Rule:** persisted `interaction_events` payload shapes are a compatibility contract — decision events must keep `{action, concession, rationale}` and action events `{action, concession, newPosition, closed}` field names. That's why the negotiation action type keeps a field literally named `action` (not `kind`): the loop spreads the structured action into event payloads, and evaluators/projections read `payload["action"]` from stored traces.

**Why:** evaluators, the roleplayx projection adapter, and already-persisted traces all key off these payload fields; renaming breaks historical data silently.

**How to apply:** when adding a new Environment/Action implementation, pick action field names knowing they become persisted payload keys; when refactoring negotiation, never rename fields inside the action object. Utterance is optional in the generic runtime (no utterance event emitted when absent), but negotiation policies must always utter — that rule lives in the facade's flat-behavior validation, not the generic loop.
