import { Router, type IRouter } from "express";
import {
  ListSnapshotsResponse,
  CreateSnapshotBody,
  CreateSnapshotResponse,
  GetSnapshotResponse,
  ListAgentsResponse,
  CreateAgentBody,
  CreateAgentResponse,
  GetAgentResponse,
  UpdateAgentStateBody,
  UpdateAgentStateResponse,
} from "@workspace/api-zod";
import * as snapshotService from "../domains/character/snapshotService";
import { CharacterNotFoundError } from "../domains/character/snapshotService";
import {
  SnapshotImmutableError,
  SnapshotNotFoundError,
} from "../domains/character/snapshotModel";
import * as agentService from "../domains/agent/service";
import {
  AgentNotFoundError,
  InvalidAgentError,
} from "../domains/agent/model";

const router: IRouter = Router();

function pathParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function handleDomainError(err: unknown, res: {
  status: (code: number) => { json: (body: unknown) => void };
}): boolean {
  if (err instanceof InvalidAgentError) {
    res.status(400).json({ error: err.message });
    return true;
  }
  if (
    err instanceof CharacterNotFoundError ||
    err instanceof SnapshotNotFoundError ||
    err instanceof AgentNotFoundError
  ) {
    res.status(404).json({ error: err.message });
    return true;
  }
  if (err instanceof SnapshotImmutableError) {
    res.status(409).json({ error: err.message });
    return true;
  }
  return false;
}

router.get("/v1/snapshots", async (_req, res): Promise<void> => {
  const snapshots = await snapshotService.listSnapshots();
  res.json(ListSnapshotsResponse.parse(snapshots));
});

router.post("/v1/snapshots", async (req, res): Promise<void> => {
  const parsed = CreateSnapshotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const snapshot = await snapshotService.createSnapshot(parsed.data);
    res.status(201).json(CreateSnapshotResponse.parse(snapshot));
  } catch (err) {
    if (!handleDomainError(err, res)) throw err;
  }
});

router.get("/v1/snapshots/:id", async (req, res): Promise<void> => {
  const snapshot = await snapshotService.getSnapshot(
    pathParam(req.params["id"]),
  );
  if (!snapshot) {
    res.status(404).json({ error: "Character snapshot not found" });
    return;
  }
  res.json(GetSnapshotResponse.parse(snapshot));
});

router.delete("/v1/snapshots/:id", async (req, res): Promise<void> => {
  try {
    await snapshotService.deleteSnapshot(pathParam(req.params["id"]));
    res.sendStatus(204);
  } catch (err) {
    if (!handleDomainError(err, res)) throw err;
  }
});

router.get("/v1/agents", async (_req, res): Promise<void> => {
  const agents = await agentService.listAgents();
  res.json(ListAgentsResponse.parse(agents));
});

router.post("/v1/agents", async (req, res): Promise<void> => {
  const parsed = CreateAgentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    // Orval strips unknown keys (additionalProperties:false is ignored), so
    // forward the RAW initialState — the domain layer must see unknown
    // categories to reject them explicitly instead of silently dropping them.
    const rawInitialState = (req.body as Record<string, unknown>)[
      "initialState"
    ] as Partial<Record<string, Record<string, number>>> | undefined;
    const agent = await agentService.createAgent({
      ...parsed.data,
      initialState: rawInitialState,
    });
    res.status(201).json(CreateAgentResponse.parse(agent));
  } catch (err) {
    if (!handleDomainError(err, res)) throw err;
  }
});

router.get("/v1/agents/:id", async (req, res): Promise<void> => {
  const agent = await agentService.getAgentWithState(
    pathParam(req.params["id"]),
  );
  if (!agent) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.json(GetAgentResponse.parse(agent));
});

router.delete("/v1/agents/:id", async (req, res): Promise<void> => {
  const deleted = await agentService.deleteAgent(pathParam(req.params["id"]));
  if (!deleted) {
    res.status(404).json({ error: "Agent not found" });
    return;
  }
  res.sendStatus(204);
});

router.patch(
  "/v1/agents/:id/state/:category",
  async (req, res): Promise<void> => {
    const parsed = UpdateAgentStateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    try {
      const state = await agentService.updateAgentState({
        agentId: pathParam(req.params["id"]),
        category: pathParam(req.params["category"]),
        values: parsed.data.values,
      });
      res.json(UpdateAgentStateResponse.parse(state));
    } catch (err) {
      if (!handleDomainError(err, res)) throw err;
    }
  },
);

export default router;
