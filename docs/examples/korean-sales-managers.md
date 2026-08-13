# Example — "Korean Sales Managers" population → 10 sampled characters

End-to-end walkthrough of Phase 4–6: define a population over registered
dimensions, add statistical dependency rules, and deterministically sample
10 characters (same seed → identical characters).

## 1. Create the population

```bash
curl -X POST /api/v1/populations -H 'content-type: application/json' -d '{
  "name": "Korean Sales Managers",
  "domain": "sales",
  "dimensions": ["age","gender","occupation","authority_level",
                 "years_experience","risk_tolerance","communication_style"],
  "distributions": {
    "age":            {"type":"normal","min":28,"max":58,"mean":41,"stddev":7,"integer":true},
    "gender":         {"type":"categorical","weights":{"male":0.55,"female":0.44,"nonbinary":0.005,"unspecified":0.005}},
    "occupation":     {"type":"categorical","weights":{"sales manager":0.7,"regional sales director":0.3}},
    "authority_level":{"type":"categorical","weights":{"low":0.2,"medium":0.5,"high":0.25,"very_high":0.05}},
    "years_experience":{"type":"uniform","min":3,"max":30,"integer":true},
    "risk_tolerance": {"type":"categorical","weights":{"very_low":0.05,"low":0.25,"medium":0.4,"high":0.25,"very_high":0.05}},
    "communication_style":{"type":"categorical","weights":{"direct":0.35,"diplomatic":0.3,"analytical":0.2,"expressive":0.1,"reserved":0.05}}
  }
}'
```

Rules enforced at creation: every dimension must be registered in the
dimension registry, every non-array dimension needs a distribution, and
categorical weights must sum to 1.

## 2. Add dependency rules (statistical, NOT semantic)

Directors skew to high authority (conditional distribution):

```bash
curl -X POST /api/v1/dependencies -H 'content-type: application/json' -d '{
  "populationId": "<population_id>",
  "sourceDimension": "occupation",
  "targetDimension": "authority_level",
  "type": "conditional",
  "conditions": [{"equals": "regional sales director"}],
  "effect": {"distribution": {"type":"categorical",
             "weights": {"high":0.72,"very_high":0.2,"medium":0.08}}}
}'
```

Age correlates with experience (numeric correlation, strength 0.8):

```bash
curl -X POST /api/v1/dependencies -H 'content-type: application/json' -d '{
  "populationId": "<population_id>",
  "sourceDimension": "age", "targetDimension": "years_experience",
  "type": "correlation", "conditions": [{"min": 28}],
  "effect": {}, "strength": 0.8
}'
```

Rules that would create a cycle in the dependency graph are rejected with
400 at write time.

## 3. Sample deterministically

```bash
curl -X POST /api/v1/sampling -H 'content-type: application/json' -d '{
  "populationId": "<population_id>",
  "sampleSize": 10,
  "strategy": "conditional",
  "seed": 20260813
}'
```

The response is a **sampling run audit**: requested vs achieved
distribution, created `characterIds`, and the exact
`populationVersion` / `schemaVersion` / `dependencyGraphVersion` that
produced the sample. Re-running with the same seed and versions creates
characters with identical attributes.

Each created character carries sampling provenance:

```json
{
  "operation": "sample", "sourceType": "population",
  "populationId": "population_…", "seed": 20260813,
  "populationVersion": 1, "schemaVersion": "1",
  "dependencyGraphVersion": "2-597bb9a2", "sampleIndex": 0,
  "strategy": "conditional"
}
```

## Strategies

| strategy | weights | dependency rules | targetDistribution |
|---|---|---|---|
| random | ignored (uniform) | ignored | — |
| weighted | applied | ignored | — |
| conditional | applied | applied (topological order) | — |
| stratified | applied | applied | required; marginals enforced exactly (largest remainder) |
