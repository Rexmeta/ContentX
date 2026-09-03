# P9.1: Expanded Human Gold Set & Calibration Drift Specification

## 1. Methodology & Sampling Tiers

To ensure statistical rigor in AI agent evaluation, human gold standard datasets are stratified into two clear tiers:

| Tier | Min Distinct Trajectories | Min Experts | Multi-Rater Coverage | Consensus Coverage | Purpose |
|:---|:---:|:---:|:---:|:---:|:---|
| **Smoke / Fixture Tier** | $N \ge 20$ | $\ge 2$ | $\ge 80\%$ | $\ge 80\%$ | CI/CD testing, synthetic validation fixtures |
| **Customer Validation Tier** | $N \ge 50$ | $\ge 3$ | $\ge 90\%$ | $\ge 90\%$ | Enterprise customer pilot certification |

---

## 2. Metric Definitions

- **`multiRaterCoverage`**: Percentage of distinct gold set trajectories evaluated by at least 2 independent experts.
$$\text{multiRaterCoverage} = \frac{\sum \mathbb{I}(\text{experts}(t) \ge 2)}{N_{\text{distinct}}}$$
- **`consensusCoverage`**: Percentage of multi-rated trajectories where expert score variance is $\le 15$ points.
$$\text{consensusCoverage} = \frac{\sum \mathbb{I}(\max(\text{scores}(t)) - \min(\text{scores}(t)) \le 15)}{N_{\text{multi-rated}}}$$

---

## 3. Calibration Metrics & Drift Tolerances

- **Pearson Correlation ($r$)**: $\ge 0.90$ for `CALIBRATED` status.
- **Cohen's Kappa ($\kappa$)**: $\ge 0.85$ (LLM Judge vs Human Consensus binary decision agreement).
- **Mean Absolute Error ($MAE$)**: $\le 5.0$ points.
- **Drift Monitoring**:
  - $|r_{\text{current}} - r_{\text{baseline}}| \le 0.05 \implies \text{STABLE}$
  - $0.05 < |r_{\text{current}} - r_{\text{baseline}}| \le 0.15 \implies \text{DRIFT\_WARNING}$
  - $|r_{\text{current}} - r_{\text{baseline}}| > 0.15 \lor \Delta MAE > 3.0 \implies \text{DRIFT\_CRITICAL}$
