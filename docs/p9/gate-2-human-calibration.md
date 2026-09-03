# P9 Gate #2: Human Gold Set Calibration

## 1. Objective
Empirically validate whether automated LLM judges and multi-layer evaluators correlate with multi-expert human judgment.

## 2. Multi-Rater Architecture
```text
Gold Trajectory (N >= 20)
       ├── Expert A (Pseudonymized)
       ├── Expert B (Pseudonymized)
       └── Expert C (Pseudonymized)
               │
               ▼
       Human Consensus Score
               │
       ┌───────┴───────┐
       ▼               ▼
Human Gold Score   LLM Judge Score
       │               │
       └───────┬───────┘
               ▼
      Statistical Analysis
 (Pearson r, Cohen's kappa, MAE, Bias)
```

## 3. Statistical Acceptance Criteria for CALIBRATED Status
- **Sample Size ($N$)**: $\ge 20$ fully annotated trajectories across balanced cohorts.
- **Pearson Correlation ($r$)**: $r \ge 0.90$ with human consensus scores.
- **Cohen's $\kappa$**: $\kappa \ge 0.85$ (Inter-rater and Judge-Human decision agreement).
- **Mean Absolute Error ($MAE$)**: $MAE \le 5.0$ points on a 100-point rubric.
- **Status Assignment**:
  - `CALIBRATED`: All acceptance criteria strictly met with empirical human annotations.
  - `PROVISIONAL`: Synthetic reference calibration or sample size $N < 20$.
  - `FAILED`: Correlation $r < 0.70$ or missing annotations.
