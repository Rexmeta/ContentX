import { createHash } from "node:crypto";

export type Json =
  null | boolean | number | string | Json[] | { [key: string]: Json };
export type Mapping =
  | { type: "unresolved" }
  | { type: "source"; path: string; default?: Json }
  | { type: "constant"; value: Json }
  | { type: "object"; fields: Record<string, Mapping> }
  | { type: "array"; sourcePath: string; item: Mapping }
  | { type: "format"; template: string; values: Record<string, string> }
  | { type: "join"; sourcePath: string; separator: string };
export type JsonSchema = {
  type: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
};
export type Issue = { path: string; message: string };

const forbidden = new Set(["__proto__", "prototype", "constructor"]);
const limits = {
  bytes: 512 * 1024,
  depth: 24,
  nodes: 10000,
  array: 1000,
  key: 128,
};
export function assertSafeJson(value: unknown): asserts value is Json {
  let bytes: number;
  try {
    bytes = Buffer.byteLength(JSON.stringify(value));
  } catch {
    throw new Error("Input must be JSON serializable");
  }
  if (bytes > limits.bytes) throw new Error("Input exceeds 512KiB");
  let nodes = 0;
  const visit = (v: unknown, depth: number): void => {
    if (++nodes > limits.nodes) throw new Error("Input exceeds 10000 nodes");
    if (depth > limits.depth) throw new Error("Input exceeds maximum depth 24");
    if (Array.isArray(v)) {
      if (v.length > limits.array)
        throw new Error("Input array exceeds length 1000");
      v.forEach((x) => visit(x, depth + 1));
      return;
    }
    if (v && typeof v === "object")
      for (const [k, x] of Object.entries(v)) {
        if (k.length > limits.key || forbidden.has(k))
          throw new Error(`Unsafe JSON key "${k}"`);
        visit(x, depth + 1);
      }
  };
  visit(value, 0);
}
export function inferSchema(value: Json): JsonSchema {
  if (value === null) return { type: "null" };
  if (Array.isArray(value))
    return {
      type: "array",
      items: value.length
        ? mergeSchemas(value.map(inferSchema))
        : { type: "string" },
    };
  if (typeof value === "object") {
    const properties = Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, inferSchema(v)]),
    );
    return {
      type: "object",
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    };
  }
  return { type: typeof value === "number" ? "number" : typeof value };
}
function mergeSchemas(schemas: JsonSchema[]): JsonSchema {
  const first = schemas[0]!;
  if (!schemas.every((s) => s.type === first.type)) return { type: "string" };
  if (first.type !== "object" || !first.properties) return first;
  const keys = Object.keys(first.properties).filter((k) =>
    schemas.every((s) => s.properties?.[k]),
  );
  return {
    type: "object",
    properties: Object.fromEntries(
      keys.map((k) => [k, mergeSchemas(schemas.map((s) => s.properties![k]!))]),
    ),
    required: keys,
    additionalProperties: false,
  };
}
export function validateSupportedSchema(
  schema: unknown,
): asserts schema is JsonSchema {
  assertSafeJson(schema);
  const check = (s: any): void => {
    if (
      !s ||
      typeof s !== "object" ||
      ![
        "object",
        "array",
        "string",
        "number",
        "boolean",
        "null",
        "integer",
      ].includes(s.type)
    )
      throw new Error("Unsupported JSON Schema");
    if (s.type === "object") {
      if (
        s.additionalProperties !== false ||
        !s.properties ||
        !Array.isArray(s.required)
      )
        throw new Error(
          "Object schemas must be strict with properties and required",
        );
      const propertyNames = new Set(Object.keys(s.properties));
      if (!s.required.every((key: unknown) => typeof key === "string" && propertyNames.has(key)))
        throw new Error("Every required key must exist in properties");
      Object.values(s.properties).forEach(check);
    }
    if (s.type === "array") check(s.items);
  };
  check(schema);
}
export function stableHash(value: unknown): string {
  const stable = (x: any): any =>
    Array.isArray(x)
      ? x.map(stable)
      : x && typeof x === "object"
        ? Object.fromEntries(
            Object.keys(x)
              .sort()
              .map((k) => [k, stable(x[k])]),
          )
        : x;
  return createHash("sha256")
    .update(JSON.stringify(stable(value)))
    .digest("hex");
}
export function validateMapping(mapping: unknown): Issue[] {
  const issues: Issue[] = [];
  const pathOk = (p: unknown) =>
    typeof p === "string" &&
    p
      .split(".")
      .every(
        (s) =>
          s &&
          !forbidden.has(s) &&
          (/^\d+$/.test(s) || /^[A-Za-z_$][\w$-]*$/.test(s)),
      );
  const walk = (m: any, at = "$"): void => {
    if (
      !m ||
      typeof m !== "object" ||
      ![
        "unresolved",
        "source",
        "constant",
        "object",
        "array",
        "format",
        "join",
      ].includes(m.type)
    ) {
      issues.push({ path: at, message: "Invalid mapping node" });
      return;
    }
    if (m.type === "unresolved")
      issues.push({ path: at, message: "Unresolved mapping" });
    if (
      (m.type === "source" || m.type === "array" || m.type === "join") &&
      !pathOk(m.path ?? m.sourcePath)
    )
      issues.push({ path: at, message: "Unsafe source path" });
    if (m.type === "object")
      Object.entries(m.fields ?? {}).forEach(([k, v]) => walk(v, `${at}.${k}`));
    if (m.type === "array") walk(m.item, `${at}[]`);
    if (m.type === "format") {
      if (
        typeof m.template !== "string" ||
        m.template.length > 4096 ||
        !Object.values(m.values ?? {}).every(pathOk)
      )
        issues.push({ path: at, message: "Invalid format" });
    }
  };
  walk(mapping);
  return issues;
}
function read(root: any, path: string): unknown {
  const base = path.startsWith("root.") ? root.root : root;
  const bits = (path.startsWith("root.") ? path.slice(5) : path).split(".");
  if (
    !bits.every(
      (s) =>
        s &&
        !forbidden.has(s) &&
        (/^\d+$/.test(s) || /^[A-Za-z_$][\w$-]*$/.test(s)),
    )
  )
    throw new Error("Unsafe source path");
  return bits.reduce((v, p) => (v == null ? undefined : v[p]), base);
}
export function evaluate(
  mapping: Mapping,
  root: Record<string, unknown>,
  local: unknown = root,
): unknown {
  switch (mapping.type) {
    case "unresolved":
      throw new Error("Unresolved mapping");
    case "constant":
      return mapping.value;
    case "source": {
      const value = read({ ...root, root, item: local }, mapping.path);
      return value === undefined ? mapping.default : value;
    }
    case "object":
      return Object.fromEntries(
        Object.entries(mapping.fields).map(([k, v]) => [
          k,
          evaluate(v, root, local),
        ]),
      );
    case "array": {
      const v = read({ ...root, root, item: local }, mapping.sourcePath);
      if (!Array.isArray(v))
        throw new Error(`Expected array at ${mapping.sourcePath}`);
      return v.map((item) => evaluate(mapping.item, root, item));
    }
    case "join": {
      const v = read({ ...root, root, item: local }, mapping.sourcePath);
      if (!Array.isArray(v))
        throw new Error(`Expected array at ${mapping.sourcePath}`);
      return v.join(mapping.separator);
    }
    case "format":
      return mapping.template.replace(/\{([A-Za-z_$][\w$-]*)\}/g, (_, name) =>
        String(
          read({ ...root, root, item: local }, mapping.values[name] ?? "") ??
            "",
        ),
      );
  }
}
export function validateOutput(
  value: any,
  schema: JsonSchema,
  path = "$",
): Issue[] {
  const issues: Issue[] = [];
  const type =
    value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (
    !(schema.type === "integer"
      ? Number.isInteger(value)
      : schema.type === type)
  )
    return [{ path, message: `Expected ${schema.type}` }];
  if (schema.type === "object") {
    for (const k of schema.required ?? [])
      if (!(k in value))
        issues.push({ path: `${path}.${k}`, message: "Required" });
    for (const [k, s] of Object.entries(schema.properties ?? {}))
      if (k in value)
        issues.push(...validateOutput(value[k], s, `${path}.${k}`));
    if (schema.additionalProperties === false) {
      const declared = new Set(Object.keys(schema.properties ?? {}));
      for (const key of Object.keys(value))
        if (!declared.has(key))
          issues.push({
            path: `${path}.${key}`,
            message: "Additional property is not allowed",
          });
    }
  }
  if (schema.type === "array" && schema.items)
    value.forEach((x: any, i: number) =>
      issues.push(...validateOutput(x, schema.items!, `${path}.${i}`)),
    );
  return issues;
}
export function inferMapping(schema: JsonSchema, path = ""): Mapping {
  if (schema.type === "object")
    return {
      type: "object",
      fields: Object.fromEntries(
        Object.entries(schema.properties ?? {}).map(([k, s]) => [
          k,
          inferMapping(s, path ? `${path}.${k}` : k),
        ]),
      ),
    };
  if (schema.type === "array") {
    const aliases: Record<string, string> = {
      objectives: "goals",
      goals: "goals",
      personas: "characters",
      characters: "characters",
      recommendedFlow: "events",
      events: "events",
    };
    const sourcePath = aliases[path.split(".").at(-1) ?? ""];
    if (sourcePath) {
      const item =
        schema.items?.type === "object"
          ? {
              type: "object" as const,
              fields: Object.fromEntries(
                Object.keys(schema.items.properties ?? {}).map((k) => [
                  k,
                  { type: "source" as const, path: `item.${k}` },
                ]),
              ),
            }
          : { type: "source" as const, path: "item" };
      return { type: "array", sourcePath, item };
    }
  }
  const aliases: Record<string, string> = {
    title: "content.title",
    id: "content.id",
    name: "name",
    role: "role",
    background: "background",
    description: "description",
    objectives: "goals",
    goals: "goals",
    personas: "characters",
    characters: "characters",
    recommendedFlow: "events",
    events: "events",
  };
  const p = aliases[path.split(".").at(-1) ?? ""];
  return p ? { type: "source", path: p } : { type: "unresolved" };
}
