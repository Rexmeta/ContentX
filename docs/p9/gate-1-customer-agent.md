# P9 Gate #1: External Agent Connect & Validation

## 1. Objective
Establish an independent, verifiable onboarding, contract verification, and attestation pipeline for external AI agents.

## 2. Agent Ownership Classification
We strictly enforce three non-conflated ownership types:
1. `internal`: System-managed test and reference agents.
2. `validation_fixture`: Deterministic standalone fixtures (e.g. ApexPay) used for infrastructure validation and sales engineering demos (`non_production`, `independenceStatus: "unverified"`).
3. `third_party_customer`: Independently deployed customer AI agents backed by verified operator attestations and contractual evidence (`independenceStatus: "verified"`, `productionStatus: "staging" | "production"`).

## 3. Customer Readiness Status
- **Current Status**: `READY_FOR_CUSTOMER`
- **Promotion Rule**: When an actual third-party customer agent connects with contract verification in P9.1, status elevates to `CUSTOMER_VALIDATED`.

## 4. 8-Step Preflight Check
- Step 1: Health Handshake (`/health` ping and network availability)
- Step 2: Response Schema Conformance (standard `AgentResponse` format)
- Step 3: Turn Continuity & Context Persistence
- Step 4: Latency SLA Check ($< 3000\text{ms}$)
- Step 5: Dynamic Tool Calling Verification (if declared)
- Step 6: Malformed Input Graceful Handling
- Step 7: Automated PII Redaction Audit
- Step 8: Network Error Recovery & Fallback
