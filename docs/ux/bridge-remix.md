# Bridge Remix — UX

Bridge Story lets a user connect two saved stories: pick Story A (source) and
Story B (target) in the Library, review an AI connection analysis, adjust
transition requirements, generate bridge candidates, and save the chosen
bridge as a normal reusable scenario.

## Where it lives

World page → **Scenario Library** tab. The toolbar has two remix modes side by
side:

- **Synthesize Mode** (existing Element Remix) — multi-select + element picking.
- **Bridge Mode** (new) — select exactly two stories *in order*.

The two modes are mutually exclusive; entering one exits the other.

## Flow

1. **Pick A then B.** In Bridge Mode each library row shows an order chip:
   the first clicked story becomes **A** (source, filled chip), the second
   **B** (target, outlined chip). Clicking a selected story deselects it.
   The action button narrates progress: "Pick Source (A)" → "Pick Target (B)"
   → "Analyze Connection".

2. **Connection analysis.** The Bridge panel opens with an A → Bridge → B
   header and an explicit "Analyze Connection" step (LLM, ~1 min). The result
   shows:
   - a summary of *why* a bridge is needed;
   - nine gap dimensions (timeline, location, characters, goals, conflict,
     relationships, knowledge, unresolved threads, contradictions), each with
     ✓ compatible / ⚠ requires transition / ✕ conflict, an explanation, and a
     draft requirement where applicable.

3. **Adjust requirements.** The draft transition requirements are prefilled
   into an editable textarea (one per line). A free-text instruction field is
   below. "Re-analyze" is available if the user wants a fresh read.

4. **Generate & compare candidates.** "Generate Bridge Story" produces a
   draft and lands the user in the Scenario Draft screen. The candidate bar
   (labelled **Bridge Candidates**) reuses the existing candidate/reroll
   pattern: "Re-run Same Ingredients" adds another candidate with the same
   A/B/requirements/instruction recipe; Compare shows candidates side by side;
   manual edits to the viewed candidate are preserved when switching.

5. **Review A → Bridge → B.** A review strip above the draft shows
   Source A → *Bridge title* → Target B plus the transition requirement chips,
   so the connection being saved is always visible. It also renders when a
   saved bridge is reopened from the library.

6. **Save.** "Save to Library" persists the bridge as a normal scenario with
   server-validated bridge lineage. From there it behaves like any scenario:
   it can be edited, classified, used for graph generation/projection, and
   selected again as material for synthesis or another bridge.

## Lineage visualization

- **Library list**: bridge scenarios carry a `BRIDGE (A → B)` badge (accent
  color, link icon) instead of the `SYNTHESIZED (n)` badge.
- **Lineage tab (family tree)**: a bridge child appears under both parents
  with a `bridge` badge and a per-edge role label — "bridged from (A)" under
  the source, "bridged into (B)" under the target — so A → Bridge → B reads
  clearly and is visually distinct from element-remix nodes (merge icon +
  "took \<elements\>" chips).

## Out of scope (deliberate)

- Story Chain composition UI (future).
- Draft auto-persistence across reloads and parallel candidate generation —
  bridge candidates intentionally follow the existing in-memory
  candidate/reroll pattern.
