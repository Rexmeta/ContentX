# Scientific Validity & Non-Claims

## 1. What P9 Proves
- **Technical Interoperability**: Standardized `AgentProtocol` successfully connects, authenticates (HMAC), and orchestrates multi-turn tool calling across arbitrary external AI agent architectures.
- **Evaluation Agreement**: Evaluator outputs correlate strongly ($r \ge 0.90, \kappa \ge 0.85$) with multi-expert human gold consensus.
- **Known-Case Regression Detection**: Detects 100% of tested critical regression cases in the canonical R01~R08 corpus without false positives on clean candidates.
- **Vulnerability Amplification**: Closed-loop adaptive stress testing isolates and amplifies discovered weaknesses by $> 6\times$.
- **Simpson's Paradox Defense**: Automated deployment gating blocks candidates whose overall scores increase while vulnerable cohorts degrade.
- **Cryptographic Traceability**: End-to-end 14-stage lineage chain is cryptographically sealed with SHA-256 integrity checksums.

## 2. What P9 Does NOT Claim
- **Universal Safety**: Does not guarantee safety under zero-day adversarial prompts outside the evaluated benchmark space.
- **Universal Zero False Positives**: Observed FPR = 0% in tested scenarios does not constitute a universal zero-error rate in unmodeled domains.
- **Causal Proof**: Observed behavioral divergence represents factual empirical difference; root cause hypotheses remain provisional.
- **Production Equivalency**: Synthetic simulations provide high-fidelity behavioral testing but are distinct from live human production traffic.
