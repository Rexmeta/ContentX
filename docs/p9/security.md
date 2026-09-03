# Security, RBAC & Tenant Isolation

## 1. Multi-Tenant Boundary Enforcement
- All P9 resources (agents, gold sets, calibration runs, regression benchmarks, customer pilots, evidence packages, quality certificates) are strictly bound to `organizationId`.
- Cross-tenant requests return `403 Forbidden` to prevent IDOR vulnerabilities.

## 2. Role-Based Access Control (RBAC)
- `owner` / `admin`: Full management of customer agent registrations, pilots, and certificate issuance/revocation.
- `engineer`: Regression benchmark execution, preflight checks, and candidate comparison.
- `analyst`: Gold set annotations, calibration analysis, and failure explorer review.
- `viewer`: Read-only access to published evidence reports and verified certificates.

## 3. PII Redaction & Secret Safety
- Incoming and persistent customer dialogue streams are filtered through `PIIRedactor` for automatic masking of emails, credit card numbers, and phone numbers.
- HMAC secret tokens and API keys are NEVER logged or exported in public evidence manifests.
