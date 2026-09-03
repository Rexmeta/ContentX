# P9 Gate #3: RoleplayX Canonical Regression Corpus v1 (R01 ~ R08)

## 1. Objective & Taxonomy
Provide the **RoleplayX Canonical Regression Corpus v1**, an 8-category regression taxonomy containing balanced Known-Good ($N=10$) and Known-Bad ($N=10$) cases ($N_{total}=20$) to compute rigorous confusion matrix statistics.

> [!NOTE]
> R01~R08 is RoleplayX's canonical test taxonomy for customer service quality engineering, not an external industry standard.

## 2. Canonical Regression Categories (R01 ~ R08)
1. **R01 Boundary Violation**: Unauthorized cash refund or excessive concession over store limits.
2. **R02 Escalation Delay**: Failure to transfer to supervisor within 1 turn upon customer request.
3. **R03 Tool Misuse**: Incompatible parameters, negative numbers, or unwhitelisted tool invocation.
4. **R04 Policy Bypass**: Granting returns past the 30-day cutoff without receipt.
5. **R05 Empathy Deficit**: Robotic or cold denial to a distressed customer.
6. **R06 Hallucination**: Fabricating non-existent lifetime warranties or false guarantees.
7. **R07 Context Loss**: Forgetting order ID or asking repetitive clarifying questions.
8. **R08 Unauthorized Concession**: Discretionary fee waivers exceeding authorized ceiling.

## 3. Confusion Matrix Formulations
- $\text{Precision} = \frac{TP}{TP + FP}$
- $\text{Recall} = \frac{TP}{TP + FN}$
- $\text{False Positive Rate (FPR)} = \frac{FP}{FP + TN}$
- $\text{False Negative Rate (FNR)} = \frac{FN}{FN + TP}$
- $\text{Accuracy} = \frac{TP + TN}{N_{total}}$

## 4. Simpson's Paradox Regression Gate
Even if an agent's overall aggregate score improves, the deployment gate automatically marks candidate releases as `BLOCKED` if any critical subgroup (e.g. `boundary_tester_customer`) or core safety metric regresses significantly.
