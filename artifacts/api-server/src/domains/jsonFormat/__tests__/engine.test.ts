import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  assertSafeJson,
  evaluate,
  inferMapping,
  inferSchema,
  stableHash,
  validateMapping,
  validateOutput,
  type Mapping,
} from "../engine";

describe("json format safety and inference", () => {
  it("rejects dangerous keys, excessive depth, and excessive serialized input", () => {
    expect(() => assertSafeJson(JSON.parse('{"__proto__":1}'))).toThrow(
      "Unsafe",
    );
    let nested: unknown = "leaf";
    for (let i = 0; i < 25; i++) nested = { child: nested };
    expect(() => assertSafeJson(nested)).toThrow("depth");
    expect(() => assertSafeJson("x".repeat(512 * 1024 + 1))).toThrow("512KiB");
  });

  it("infers strict nested object and conservative array schemas", () => {
    const schema = inferSchema({
      config: { enabled: true },
      rows: [
        { id: "a", n: 1 },
        { id: "b", n: 2 },
      ],
    });
    expect(schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["config", "rows"],
    });
    expect(schema.properties?.config).toMatchObject({
      type: "object",
      additionalProperties: false,
      required: ["enabled"],
    });
    expect(schema.properties?.rows?.items).toMatchObject({
      type: "object",
      required: ["id", "n"],
    });
  });

  it("creates usable starter mappings for both supplied attachment shapes", () => {
    for (const name of [
      "export-roleplay-content_70756481341460c4_1787568077314.json",
      "긴급_문제_선_조치_후_보고-미래전자-new-product-launch-2026-02-10T02-11-07_1787639639059.json",
    ]) {
      const value = JSON.parse(
        readFileSync(
          join(process.cwd(), "../../attached_assets", name),
          "utf8",
        ),
      );
      const mapping = inferMapping(inferSchema(value));
      expect(mapping.type).toBe("object");
      expect(
        validateMapping(mapping).some(
          (issue) => issue.message === "Unsafe source path",
        ),
      ).toBe(false);
    }
  });
});

describe("json format mapping evaluator", () => {
  const root = {
    content: { title: "Launch", id: "c1" },
    characters: [{ name: "Ada", role: "lead" }],
    tags: ["a", "b"],
    fallback: undefined,
  };
  const mapping: Mapping = {
    type: "object",
    fields: {
      title: { type: "source", path: "content.title" },
      fallback: { type: "source", path: "fallback", default: "defaulted" },
      fixed: { type: "constant", value: 7 },
      people: {
        type: "array",
        sourcePath: "characters",
        item: {
          type: "object",
          fields: {
            name: { type: "source", path: "item.name" },
            label: {
              type: "format",
              template: "{name} ({role})",
              values: { name: "item.name", role: "item.role" },
            },
          },
        },
      },
      tags: { type: "join", sourcePath: "tags", separator: "|" },
    },
  };
  it("evaluates source, default, constant, objects, arrays, format, and join", () => {
    expect(evaluate(mapping, root)).toEqual({
      title: "Launch",
      fallback: "defaulted",
      fixed: 7,
      people: [{ name: "Ada", label: "Ada (lead)" }],
      tags: "a|b",
    });
  });
  it("reports unresolved mappings and output schema mismatches", () => {
    expect(validateMapping({ type: "unresolved" })).toEqual([
      { path: "$", message: "Unresolved mapping" },
    ]);
    expect(
      validateOutput(
        { title: 4 },
        {
          type: "object",
          properties: { title: { type: "string" } },
          required: ["title"],
          additionalProperties: false,
        },
      ),
    ).toHaveLength(1);
  });
  it("rejects additional properties for strict object schemas", () => {
    expect(
      validateOutput(
        { title: "ok", extra: true },
        {
          type: "object",
          properties: { title: { type: "string" } },
          required: ["title"],
          additionalProperties: false,
        },
      ),
    ).toEqual([
      { path: "$.extra", message: "Additional property is not allowed" },
    ]);
  });
  it("uses stable key ordering in mapping hashes", () => {
    expect(stableHash({ b: 2, a: { y: 1, x: 2 } })).toBe(
      stableHash({ a: { x: 2, y: 1 }, b: 2 }),
    );
  });
});
