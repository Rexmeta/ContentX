import { Router, type IRouter } from "express";
import { and, desc, eq, max, sql } from "drizzle-orm";
import { db, jsonFormatsTable } from "@workspace/db";
import * as z from "@workspace/api-zod";
import * as projection from "../domains/projection/service";
import {
  assertSafeJson,
  evaluate,
  inferMapping,
  inferSchema,
  stableHash,
  validateMapping,
  validateOutput,
  validateSupportedSchema,
  type JsonSchema,
  type Mapping,
} from "../domains/jsonFormat/engine";

const router: IRouter = Router();
const id = () => `jsonfmt_${crypto.randomUUID().replaceAll("-", "")}`;
const params = (req: any) => ({
  formatId: Array.isArray(req.params.formatId)
    ? req.params.formatId[0]
    : req.params.formatId,
  version: Number(
    Array.isArray(req.params.version)
      ? req.params.version[0]
      : req.params.version,
  ),
});
const publicRow = (r: any) => ({
  ...r,
  jsonSchema: r.jsonSchema,
  mapping: r.mapping,
});
async function row(formatId: string, version: number) {
  const [r] = await db
    .select()
    .from(jsonFormatsTable)
    .where(
      and(
        eq(jsonFormatsTable.formatId, formatId),
        eq(jsonFormatsTable.version, version),
      ),
    );
  return r;
}
function inference(input: any) {
  if ((input.example === undefined) === (input.jsonSchema === undefined)) {
    throw new Error("Exactly one of example or jsonSchema is required");
  }
  const schema = input.jsonSchema
    ? (validateSupportedSchema(input.jsonSchema),
      input.jsonSchema as JsonSchema)
    : (assertSafeJson(input.example), inferSchema(input.example));
  const mapping = inferMapping(schema);
  const unresolvedPaths = validateMapping(mapping)
    .filter((x) => x.message === "Unresolved mapping")
    .map((x) => x.path);
  return {
    jsonSchema: schema,
    mapping,
    unresolvedPaths,
    sourceCatalog: [
      "content",
      "simulation",
      "characters",
      "goals",
      "outcomes",
      "conflicts",
      "events",
      "worlds",
      "relationships",
      "participants",
      "trace",
      "evaluations",
    ],
  };
}
router.post("/v1/json-formats/infer", (req, res): void => {
  const p = z.InferJsonFormatBody.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  try {
    res.json(z.InferJsonFormatResponse.parse(inference(p.data)));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
router.post("/v1/json-formats", async (req, res): Promise<void> => {
  const p = z.CreateJsonFormatBody.safeParse(req.body);
  if (!p.success) {
    res.status(400).json({ error: p.error.message });
    return;
  }
  try {
    const i = inference(p.data);
    const [created] = await db
      .insert(jsonFormatsTable)
      .values({
        formatId: id(),
        version: 1,
        name: p.data.name,
        description: p.data.description ?? null,
        status: "draft",
        example: p.data.example ?? null,
        jsonSchema: i.jsonSchema,
        mapping: i.mapping,
        mappingHash: stableHash(i.mapping),
      })
      .returning();
    res.status(201).json(z.CreateJsonFormatResponse.parse(publicRow(created)));
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
router.get("/v1/json-formats", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(jsonFormatsTable)
    .orderBy(desc(jsonFormatsTable.updatedAt));
  res.json(z.ListJsonFormatsResponse.parse(rows.map(publicRow)));
});
router.get(
  "/v1/json-formats/:formatId/versions/:version",
  async (req, res): Promise<void> => {
    const p = z.GetJsonFormatVersionParams.safeParse(params(req));
    if (!p.success) {
      res.status(400).json({ error: p.error.message });
      return;
    }
    const r = await row(p.data.formatId, p.data.version);
    if (!r) {
      res.status(404).json({ error: "Format version not found" });
      return;
    }
    res.json(z.GetJsonFormatVersionResponse.parse(publicRow(r)));
  },
);
router.patch(
  "/v1/json-formats/:formatId/versions/:version",
  async (req, res): Promise<void> => {
    const pa = z.UpdateJsonFormatVersionParams.safeParse(params(req)),
      body = z.UpdateJsonFormatVersionBody.safeParse(req.body);
    if (!pa.success) {
      res.status(400).json({ error: pa.error.message });
      return;
    }
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }
    const old = await row(pa.data.formatId, pa.data.version);
    if (!old) {
      res.status(404).json({ error: "Format version not found" });
      return;
    }
    if (old.status !== "draft") {
      res.status(409).json({ error: "Only draft versions can be edited" });
      return;
    }
    const mapping = (body.data.mapping ?? old.mapping) as Mapping;
    try {
      assertSafeJson(mapping);
    } catch (error) {
      res.status(400).json({ error: (error as Error).message });
      return;
    }
    const issues = validateMapping(mapping);
    if (issues.some((x) => x.message !== "Unresolved mapping")) {
      res.status(400).json({ error: issues[0]!.message });
      return;
    }
    const [r] = await db
      .update(jsonFormatsTable)
      .set({ ...body.data, mapping, mappingHash: stableHash(mapping) })
      .where(
        and(
          eq(jsonFormatsTable.formatId, old.formatId),
          eq(jsonFormatsTable.version, old.version),
          eq(jsonFormatsTable.status, "draft"),
        ),
      )
      .returning();
    if (!r) {
      res.status(409).json({ error: "Draft was activated before the update completed" });
      return;
    }
    res.json(z.UpdateJsonFormatVersionResponse.parse(publicRow(r)));
  },
);
router.post(
  "/v1/json-formats/:formatId/versions",
  async (req, res): Promise<void> => {
    const pa = z.CreateJsonFormatVersionParams.safeParse({
        formatId: Array.isArray(req.params.formatId)
          ? req.params.formatId[0]
          : req.params.formatId,
      }),
      body = z.CreateJsonFormatVersionBody.safeParse(req.body);
    if (!pa.success || !body.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }
    const source = await row(pa.data.formatId, body.data.sourceVersion);
    if (!source) {
      res.status(404).json({ error: "Source version not found" });
      return;
    }
    const r = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`json-format-version:${source.formatId}`}))`,
      );
      const [latest] = await tx
        .select({ value: max(jsonFormatsTable.version) })
        .from(jsonFormatsTable)
        .where(eq(jsonFormatsTable.formatId, source.formatId));
      const [created] = await tx
        .insert(jsonFormatsTable)
        .values({
          ...source,
          version: (latest?.value ?? 0) + 1,
          status: "draft",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      return created!;
    });
    res.status(201).json(z.CreateJsonFormatVersionResponse.parse(publicRow(r)));
  },
);
router.post(
  "/v1/json-formats/:formatId/versions/:version/activate",
  async (req, res): Promise<void> => {
    const pa = z.ActivateJsonFormatVersionParams.safeParse(params(req));
    if (!pa.success) {
      res.status(400).json({ error: pa.error.message });
      return;
    }
    const activated = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${`json-format-activation:${pa.data.formatId}`}))`,
      );
      const [target] = await tx
        .select()
        .from(jsonFormatsTable)
        .where(
          and(
            eq(jsonFormatsTable.formatId, pa.data.formatId),
            eq(jsonFormatsTable.version, pa.data.version),
          ),
        )
        .for("update");
      if (!target) return { error: "not-found" as const };
      if (target.status !== "draft") return { error: "not-draft" as const };
      const issues = validateMapping(target.mapping);
      if (issues.length) return { error: issues[0]!.message };
      await tx
        .update(jsonFormatsTable)
        .set({ status: "superseded" })
        .where(
          and(
            eq(jsonFormatsTable.formatId, target.formatId),
            eq(jsonFormatsTable.status, "active"),
          ),
        );
      await tx
        .update(jsonFormatsTable)
        .set({ status: "active" })
        .where(
          and(
            eq(jsonFormatsTable.formatId, target.formatId),
            eq(jsonFormatsTable.version, target.version),
          ),
        );
      return { target };
    });
    if ("error" in activated) {
      if (activated.error === "not-found") {
        res.status(404).json({ error: "Format version not found" });
      } else if (activated.error === "not-draft") {
        res.status(409).json({ error: "Only draft versions can be activated" });
      } else {
        res.status(400).json({ error: activated.error });
      }
      return;
    }
    res.json(
      z.ActivateJsonFormatVersionResponse.parse(
        publicRow({ ...activated.target, status: "active" }),
      ),
    );
  },
);
async function output(
  data: z.JsonExportInput,
  options: { allowDraft: boolean },
) {
  const source = await projection.resolveSource(data);
  const version =
    data.formatVersion ??
    (
      await db
        .select()
        .from(jsonFormatsTable)
        .where(
          and(
            eq(jsonFormatsTable.formatId, data.formatId),
            eq(jsonFormatsTable.status, "active"),
          ),
        )
        .orderBy(desc(jsonFormatsTable.version))
        .limit(1)
    )[0]?.version;
  if (!version) throw new Error("No active format version");
  const format = await row(data.formatId, version);
  if (!format) throw new Error("Format version not found");
  if (format.status === "draft" && !options.allowDraft)
    throw new Error(
      "Exports require an active or immutable superseded format version",
    );
  const entities = source.graph?.entities ?? [];
  const root: any = {
    content: source.graph,
    simulation: source.simulation?.simulation,
    entities,
    metadata: source.graph?.provenance ?? {},
    characters: entities.filter(
      (e: any) => e.kind === "character" || e.kind === "person",
    ),
    goals: entities.filter((e: any) => e.kind === "goal"),
    outcomes: entities.filter((e: any) => e.kind === "outcome"),
    conflicts: entities.filter((e: any) => e.kind === "conflict"),
    events:
      source.simulation?.trace ??
      entities.filter((e: any) => e.kind === "event"),
    worlds: entities.filter((e: any) => e.kind === "world"),
    relationships: source.graph?.relationships ?? [],
    participants: source.simulation?.simulation.participants ?? [],
    trace: source.simulation?.trace ?? [],
    evaluations: source.simulation?.evaluations ?? [],
  };
  let payload: any = null;
  let issues = validateMapping(format.mapping);
  if (!issues.length)
    try {
      payload = evaluate(format.mapping as Mapping, root);
      issues = validateOutput(payload, format.jsonSchema as JsonSchema);
    } catch (e) {
      issues = [{ path: "$", message: (e as Error).message }];
    }
  return {
    payload,
    validation: { valid: !issues.length, issues },
    provenance: {
      formatId: format.formatId,
      formatVersion: format.version,
      mappingHash: format.mappingHash,
      ...(source.graph
        ? { contentId: source.graph.id, contentVersion: source.graph.version }
        : {}),
      ...(source.simulation
        ? { simulationId: source.simulation.simulation.id }
        : {}),
      sourceHash: stableHash(root),
    },
  };
}
router.post("/v1/json-exports/preview", async (req, res): Promise<void> => {
  const parsed = z.PreviewJsonExportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const result = await output(parsed.data, { allowDraft: true });
    res.json(z.PreviewJsonExportResponse.parse(result));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});

router.post("/v1/json-exports", async (req, res): Promise<void> => {
  const parsed = z.CreateJsonExportBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const result = await output(parsed.data, { allowDraft: false });
    if (!result.validation.valid) {
      res.status(422).json({
        error: `Export validation failed: ${result.validation.issues
          .map((issue) => `${issue.path} ${issue.message}`)
          .join("; ")}`,
      });
      return;
    }
    res.json(z.CreateJsonExportResponse.parse(result));
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
});
export default router;
