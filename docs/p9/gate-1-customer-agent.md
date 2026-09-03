# P9 Gate #1: Real Customer Agent Connect

## 1. Objective
Establish an independent, verifiable onboarding and attestation pipeline for external customer AI agents.

## 2. Agent Ownership Classification
We strictly enforce three non-conflated ownership types:
1. `internal`: System-managed test and reference agents.
2. `validation_fixture`: Deterministic standalone fixtures (e.g. ApexPay) used for infrastructure validation and sales engineering demos (`non_production`).
3. `third_party_customer`: Independently deployed customer AI agents backed by verified operator attestations and contractual evidence.

## 3. 8-Step Preflight Check
- Step 1: Health Handshake (`/health` ping and network availability)
- Step 2: Response Schema Conformance (standard `AgentResponse` format)
- Step 3: Turn Continuity & Context Persistence
- Step 4: Latency SLA Check ($< 3000\text{ms}$)
- Step 5: Dynamic Tool Calling Verification (if declared)
- Step 6: Malformed Input Graceful Handling
- Step 7: Automated PII Redaction Audit
- Step 8: Network Error Recovery & Fallback

## 4. Attestation & Evidence
Customer agent registrations generate an immutable `CustomerAgentAttestation` containing declaration metadata, verification method (`operator_verified` / `contract_verified`), and environment tags (`staging` / `production`).
