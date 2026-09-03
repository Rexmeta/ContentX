# P9.1: Evidence Package v4 (`contentx.evidence.v4`) Specification

## 1. Structure & 22 Sub-Artifacts

Evidence Package v4 cryptographically encapsulates all 15 stages of the customer validation pipeline into 22 immutable sub-artifacts:

| Index | Artifact File | Description |
|:---|:---|:---|
| `01` | `01_customer-profile.json` | Agent identity, version, `secretRef`, endpoints |
| `02` | `02_server-attestation.json` | Server-verified legal and operator attestation |
| `03` | `03_preflight-report.json` | 8-step protocol & SLA preflight verification |
| `04` | `04_benchmark-definition.json` | SimulationSpec canonical contract and dimensions |
| `05` | `05_population-snapshot.json` | Actor and persona population snapshot |
| `06` | `06_expanded-human-gold-set.json` | Multi-expert gold standard annotations ($N \ge 50$) |
| `07` | `07_calibration-report.json` | Pearson $r$, Cohen's $\kappa$, MAE calibration stats |
| `08` | `08_calibration-drift.json` | Longitudinal calibration drift comparison report |
| `09` | `09_pilot-benchmark-results.json` | Full pilot execution runs (100~300 trajectories) |
| `10` | `10_failure-discovery.json` | Discovered failure clusters and divergence traces |
| `11` | `11_adaptive-stress.json` | Vulnerability amplification and stress cohort logs |
| `12` | `12_customer-failure-review.json` | Client QA leadership review confirmation log |
| `13` | `13_hardened-candidate-profile.json` | Hardened candidate v2 deployment metadata |
| `14` | `14_pilot-retest-results.json` | Retest execution logs with 0.0% target recurrence |
| `15` | `15_canonical-regression-corpus.json` | RoleplayX Canonical Regression Corpus (R01~R08) |
| `16` | `16_confusion-matrix.json` | TP, TN, FP, FN, Precision, Recall, FPR metrics |
| `17` | `17_regression-comparison.json` | Regression delta against candidate baseline |
| `18` | `18_deployment-gate-decision.json` | Formal automated deployment gating decision |
| `19` | `19_segregated-telemetry.json` | 4-way isolated latency and cost metrics |
| `20` | `20_quality-certificate.json` | Issued Quality Certificate with CertificationScope |
| `21` | `21_15-stage-provenance-chain.json` | Cryptographic 15-stage lineage provenance manifest |
| `22` | `22_SHA256SUMS` | SHA-256 content integrity manifest for all artifacts |

---

## 2. Cryptographic Integrity Verification

The package root checksum is calculated by hashing the canonical JSON string of the `22_SHA256SUMS` manifest:

$$\text{Root Checksum} = \text{SHA256}(\text{canonicalJson}(\text{sha256Sums}))$$

Any modification to any of the 21 sub-artifacts invalidates its individual hash and causes `verifyPackageV4()` to reject package integrity and flag the exact tampered file.
