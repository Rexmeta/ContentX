/**
 * Workflow graph validation — guards every write path (create / PATCH) so an
 * edited workflow can never be persisted with a broken step graph: dangling
 * dependency ids, duplicate ids, cycles, or bindings the executor cannot run.
 */
import {
  InvalidWorkflowError,
  STEP_ACTIONS,
  type WorkflowStep,
} from "./model";

export function validateWorkflowSteps(steps: WorkflowStep[]): void {
  const ids = new Set<string>();
  for (const step of steps) {
    if (!step.id || !step.id.trim()) {
      throw new InvalidWorkflowError("모든 단계에는 id가 필요합니다.");
    }
    if (ids.has(step.id)) {
      throw new InvalidWorkflowError(`단계 id가 중복되었습니다: ${step.id}`);
    }
    ids.add(step.id);
  }

  for (const step of steps) {
    for (const dep of step.dependencies) {
      if (dep === step.id) {
        throw new InvalidWorkflowError(
          `단계 "${step.title}"가 자기 자신에 의존하고 있습니다.`,
        );
      }
      if (!ids.has(dep)) {
        throw new InvalidWorkflowError(
          `단계 "${step.title}"가 존재하지 않는 단계(${dep})에 의존하고 있습니다.`,
        );
      }
    }
    if (
      step.binding &&
      !(STEP_ACTIONS as readonly string[]).includes(step.binding.action)
    ) {
      throw new InvalidWorkflowError(
        `단계 "${step.title}"의 실행 동작(${step.binding.action})을 알 수 없습니다.`,
      );
    }
  }

  // Cycle detection (iterative DFS with colors).
  const byId = new Map(steps.map((s) => [s.id, s]));
  const state = new Map<string, "visiting" | "done">();
  for (const start of steps) {
    if (state.get(start.id)) continue;
    const stack: { id: string; depIndex: number }[] = [
      { id: start.id, depIndex: 0 },
    ];
    state.set(start.id, "visiting");
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const step = byId.get(frame.id)!;
      if (frame.depIndex >= step.dependencies.length) {
        state.set(frame.id, "done");
        stack.pop();
        continue;
      }
      const dep = step.dependencies[frame.depIndex++]!;
      const depState = state.get(dep);
      if (depState === "visiting") {
        throw new InvalidWorkflowError(
          "단계 간 의존 관계가 순환하고 있습니다. 의존성을 확인해주세요.",
        );
      }
      if (!depState) {
        state.set(dep, "visiting");
        stack.push({ id: dep, depIndex: 0 });
      }
    }
  }
}
