import app from "./app";
import { logger } from "./lib/logger";
import { ensureSeedDimensions } from "./domains/population/dimensionService";

const rawPort = process.env["PORT"] || "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Idempotent registration of the seed dimension set (unique on name).
await ensureSeedDimensions().catch((err) => {
  logger.warn({ err: err?.message || err }, "Database not reachable or dimension seeding skipped; starting server in standalone/in-memory mode");
});

app.listen(port, () => {
  logger.info({ port }, `RoleplayX & ContentX API Server listening on port ${port}`);
});
