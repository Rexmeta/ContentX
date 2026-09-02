import type {
  SimulationSpec,
  TrajectoryEvent,
  TrajectoryTrace,
  SimulationOutcome,
  EvaluationResult,
  Actor,
  ActorAction,
  ReplayMode,
  ReproducibilityMetadata,
} from "@workspace/simulation-contract";
import { isDecisionActor } from "@workspace/simulation-contract";
import { PersonaActorImpl, AIAgentTargetImpl, ToolActorImpl } from "./actor";
import { CustomerServiceEnvironment } from "./environments/customerService";
import { MultiLayerEvaluationEngine } from "../../evaluation/multiLayerEngine";

export interface SimulationRunResult {
  simulationId: string;
  runId: string;
  specId: string;
  trace: TrajectoryTrace;
  evaluation: EvaluationResult;
  outcome: SimulationOutcome;
  reproducibility: ReproducibilityMetadata;
}

export class SimulationRuntimeEngine {
  private spec: SimulationSpec;
  private actors: Map<string, Actor> = new Map();
  private environment: CustomerServiceEnvironment;
  private recordedEvents: TrajectoryEvent[] = [];
  private evaluationEngine = new MultiLayerEvaluationEngine();

  constructor(spec: SimulationSpec) {
    this.spec = spec;
    this.environment = new CustomerServiceEnvironment(spec);
    this.initActors();
  }

  private initActors(): void {
    this.actors.clear();
    for (const actorSpec of this.spec.actors) {
      if (actorSpec.actorType === "persona_actor") {
        this.actors.set(
          actorSpec.id,
          new PersonaActorImpl({
            spec: actorSpec,
            behaviorPolicies: this.spec.behaviorPolicies,
          })
        );
      } else if (actorSpec.actorType === "ai_agent_target") {
        this.actors.set(
          actorSpec.id,
          new AIAgentTargetImpl({
            spec: actorSpec,
          })
        );
      } else if (actorSpec.actorType === "tool_actor") {
        this.actors.set(actorSpec.id, new ToolActorImpl(actorSpec.id));
      }
    }
  }

  async reset(): Promise<void> {
    await this.environment.reset();
    this.initActors();
    this.recordedEvents = [];
  }

  async run(options: { runId?: string; simulationId?: string } = {}): Promise<SimulationRunResult> {
    const simulationId = options.simulationId ?? `sim_${Date.now()}`;
    const runId = options.runId ?? `run_${Date.now()}`;
    await this.reset();

    const events: TrajectoryEvent[] = [];
    const recentEventsPayloads: Array<Record<string, unknown>> = [];
    const maxTurns = this.spec.environment.termination.maxTurns ?? 8;
    let eventSeq = 0;

    const orderedActors = this.spec.actors
      .map((a) => this.actors.get(a.id))
      .filter((a): a is Actor => Boolean(a));

    for (let turn = 1; turn <= maxTurns && !this.environment.isDone(); turn++) {
      const turnCorrelationId = `corr_turn_${turn}_${runId}`;
      let lastEventId: string | undefined = undefined;

      for (const actor of orderedActors) {
        if (this.environment.isDone()) break;

        const obs = await actor.observe(
          await this.environment.observe(actor.id, recentEventsPayloads, turn)
        );

        let action: ActorAction;
        let sourceType: "rule" | "llm" | "tool" | "environment" = "rule";
        let provider: string | undefined = undefined;
        let model: string | undefined = undefined;

        if (isDecisionActor(actor)) {
          action = await actor.decide(obs);
          if (actor.type === "ai_agent_target") {
            sourceType = "llm";
            const actorSpec = this.spec.actors.find((a) => a.id === actor.id);
            provider = actorSpec?.agentConfig?.provider ?? "openai";
            model = (actorSpec?.agentConfig?.config?.model as string) ?? "gpt-4o";
          } else {
            sourceType = "rule";
          }
        } else {
          action = {
            action: "system_step",
            intent: "execute_system_turn",
            reasonCodes: ["system_routine"],
          };
          sourceType = "tool";
        }

        const stateBefore = {
          affective: (obs.actorState as { affective?: Record<string, number> })?.affective ?? {},
          relational: (obs.actorState as { relational?: Record<string, number> })?.relational ?? {},
          cognitive: {},
        };

        const execResult = await actor.execute(action);
        await this.environment.step(actor.id, action);

        const stateAfter = {
          affective: (execResult.nextState as { affective?: Record<string, number> })?.affective ?? stateBefore.affective,
          relational: (execResult.nextState as { relational?: Record<string, number> })?.relational ?? stateBefore.relational,
          cognitive: {},
        };

        eventSeq++;
        const eventId = `event_${String(eventSeq).padStart(3, "0")}_${runId}`;
        const trajectoryEvent: TrajectoryEvent = {
          id: eventId,
          simulationId,
          runId,
          turn,
          actorId: actor.id,
          actorType: actor.type,
          correlationId: turnCorrelationId,
          parentEventId: lastEventId,
          source: {
            type: sourceType,
            provider,
            model,
            version: "1.0.0",
          },
          stateBefore,
          action,
          stateAfter,
          timestamp: new Date().toISOString(),
        };

        events.push(trajectoryEvent);
        recentEventsPayloads.push({
          eventId,
          turn,
          actorId: actor.id,
          action,
          effect: execResult.effect,
        });
        lastEventId = eventId;
      }
    }

    const outcome = this.environment.getOutcome();
    this.recordedEvents = events;

    const trace: TrajectoryTrace = {
      simulationId,
      runId,
      specId: this.spec.id,
      events,
      outcome,
      createdAt: events[0]?.timestamp ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    const evaluation = this.evaluationEngine.evaluate(this.spec, trace);

    const reproducibility: ReproducibilityMetadata = {
      mode: "parameterized",
      guarantee: "best_effort",
      reproducibilityKey: `key_${this.spec.id}_${runId}`,
      varianceNote: "Model-parameterized re-execution: Identical initial conditions with best-effort probabilistic convergence.",
    };

    return {
      simulationId,
      runId,
      specId: this.spec.id,
      trace,
      evaluation,
      outcome,
      reproducibility,
    };
  }

  async replay(options: {
    runId: string;
    mode: ReplayMode;
    simulationId?: string;
  }): Promise<SimulationRunResult> {
    if (options.mode === "recorded") {
      if (this.recordedEvents.length === 0) {
        throw new Error("No recorded events available to replay in recorded mode");
      }
      const outcome = this.environment.getOutcome();
      const trace: TrajectoryTrace = {
        simulationId: options.simulationId ?? this.recordedEvents[0].simulationId,
        runId: options.runId,
        specId: this.spec.id,
        events: structuredClone(this.recordedEvents),
        outcome,
        createdAt: this.recordedEvents[0].timestamp,
        completedAt: new Date().toISOString(),
      };
      const evaluation = this.evaluationEngine.evaluate(this.spec, trace);
      const reproducibility: ReproducibilityMetadata = {
        mode: "exact",
        guarantee: "exact",
        reproducibilityKey: `exact_trace_${options.runId}`,
        varianceNote: "100% exact state transition and trajectory replay from recorded trace.",
      };
      return {
        simulationId: trace.simulationId,
        runId: options.runId,
        specId: this.spec.id,
        trace,
        evaluation,
        outcome,
        reproducibility,
      };
    }

    // Mode "reexecute"
    return this.run({ runId: options.runId, simulationId: options.simulationId });
  }
}
