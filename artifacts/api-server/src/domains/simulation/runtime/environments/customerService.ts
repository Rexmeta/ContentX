import type {
  Observation,
  ActorAction,
  ActionResult,
  SimulationOutcome,
  SimulationSpec,
} from "@workspace/simulation-contract";

export interface CustomerServiceState {
  orderId: string;
  daysElapsed: number;
  policyReturnDays: number;
  denialCount: number;
  voucherOffered: boolean;
  voucherAmount: number;
  escalatedToSupervisor: boolean;
  resolved: boolean;
  currentTurn: number;
  maxTurns: number;
}

export class CustomerServiceEnvironment {
  readonly type = "customer_service";
  private state: CustomerServiceState;
  private initialConfig: Record<string, unknown>;
  private maxTurns: number;

  constructor(spec?: SimulationSpec) {
    const config = spec?.environment.config ?? {};
    this.initialConfig = config;
    this.maxTurns = spec?.environment.termination.maxTurns ?? 8;
    this.state = this.buildInitialState();
  }

  private buildInitialState(): CustomerServiceState {
    return {
      orderId: (this.initialConfig.orderId as string) ?? "ORD-98214",
      daysElapsed: (this.initialConfig.daysElapsed as number) ?? 14,
      policyReturnDays: (this.initialConfig.policyReturnDays as number) ?? 7,
      denialCount: 0,
      voucherOffered: false,
      voucherAmount: 0,
      escalatedToSupervisor: false,
      resolved: false,
      currentTurn: 0,
      maxTurns: this.maxTurns,
    };
  }

  async init(): Promise<void> {
    this.state = this.buildInitialState();
  }

  async reset(): Promise<void> {
    this.state = this.buildInitialState();
  }

  getEnvironmentState(): Record<string, unknown> {
    return { ...this.state };
  }

  async observe(actorId: string, recentEvents: Array<Record<string, unknown>>, turn: number = 1): Promise<Observation> {
    return {
      turn,
      environmentState: this.getEnvironmentState(),
      recentEvents,
      actorState: {},
    };
  }

  async step(actorId: string, action: ActorAction): Promise<ActionResult> {
    this.state.currentTurn++;

    if (action.action === "deny_refund") {
      this.state.denialCount++;
      if (action.reasonCodes.includes("voucher_offered")) {
        this.state.voucherOffered = true;
        this.state.voucherAmount = 15;
      }
    }

    if (action.action === "transfer_to_supervisor") {
      this.state.escalatedToSupervisor = true;
    }

    if (action.action === "accept_resolution") {
      this.state.resolved = true;
    }

    return {
      success: true,
      effect: {
        currentTurn: this.state.currentTurn,
        denialCount: this.state.denialCount,
        escalated: this.state.escalatedToSupervisor,
        resolved: this.state.resolved,
      },
      nextState: this.getEnvironmentState(),
    };
  }

  isDone(): boolean {
    return (
      this.state.resolved ||
      this.state.escalatedToSupervisor ||
      this.state.currentTurn >= this.state.maxTurns * 2
    );
  }

  getOutcome(): SimulationOutcome {
    let status: SimulationOutcome["status"] = "terminated";
    if (this.state.escalatedToSupervisor) {
      status = "escalated";
    } else if (this.state.resolved) {
      status = "completed";
    }

    return {
      status,
      turnsUsed: Math.ceil(this.state.currentTurn / 2),
      goalReached: this.state.escalatedToSupervisor || this.state.resolved,
      summary: this.state.escalatedToSupervisor
        ? `Simulation escalated to supervisor with ${this.state.denialCount} denials.`
        : `Simulation completed with status: ${status}.`,
      finalStates: {},
      metrics: {
        denialCount: this.state.denialCount,
        voucherAmount: this.state.voucherAmount,
        turnsUsed: Math.ceil(this.state.currentTurn / 2),
      },
    };
  }
}
