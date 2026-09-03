# Evidence Package v3 Specification (`contentx.evidence.v3`)

## 1. Overview
The Evidence Package v3 is an immutable, cryptographically verifiable container containing 20 standardized sub-artifacts representing the complete 14-stage evaluation lifecycle.

## 2. 20 Standardized Sub-Artifacts
1. `01_agent-profile.json`: Onboarding registration, protocol capabilities, and HMAC security configs.
2. `02_customer-attestation.json`: Operator attestation, declared independence status, and environment metadata.
3. `03_preflight-report.json`: 8-step preflight contract verification results.
4. `04_benchmark-definition.json`: Canonical SimulationSpec and benchmark world rules.
5. `05_population-snapshot.json`: Demographic and behavioral distribution across cohorts.
6. `06_baseline-results.json`: 1,000 synthetic simulation runs and baseline scores.
7. `07_human-gold-set-summary.json`: Multi-expert human gold trajectory summaries.
8. `08_calibration-report.json`: Pearson $r$, Cohen's $\kappa$, MAE, Bias, and `CALIBRATED` certification.
9. `09_regression-corpus.json`: Canonical R01~R08 regression suite metadata.
10. `10_confusion-matrix.json`: TP, TN, FP, FN, Precision, Recall, FPR, and FNR calculations.
11. `11_failure-discovery.json`: Discovered failure clusters and factual divergence data.
12. `12_adaptive-stress.json`: Targeted adversarial cohort synthesis and failure amplification factor.
13. `13_regression-comparison.json`: Candidate vs baseline statistical effect size ($d$) and cohort deltas.
14. `14_gate-decision.json`: Deployment gate outcome (`APPROVED` / `BLOCKED`) and reason codes.
15. `15_customer-pilot.json`: Customer pilot tracking, environment tags, and execution timestamps.
16. `16_customer-feedback.json`: Customer failure reviews and confirmation decisions.
17. `17_quality-certificate.json`: Formal AI Agent Quality Certificate metadata.
18. `18_lineage-manifest.json`: Full 14-stage lineage chain linking MatrAIx gold datasets to evidence IDs.
19. `19_context-hash.json`: Deterministic `EvaluationContextHash`.
20. `20_SHA256SUMS`: Cryptographic SHA-256 integrity checksums for all individual files and root signature.

## 3. Cryptographic Verification
Integrity is validated via `verifyPackageV3(package)` which recalculates canonical JSON SHA-256 hashes and compares against root package signatures to detect any post-generation tampering.
