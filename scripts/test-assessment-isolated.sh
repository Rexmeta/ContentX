#!/usr/bin/env bash
# This suite never connects to DATABASE_URL from the workspace.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
temp="$(mktemp -d /tmp/contentx-assessment-pg.XXXXXX)"
cleanup() {
  pg_ctl -D "$temp/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$temp"
}
trap cleanup EXIT
initdb -D "$temp/data" --auth=trust --username=assessment_test >/dev/null
# Unix socket only, private directory; no shared dev/production port or database.
pg_ctl -D "$temp/data" -l "$temp/postgres.log" -o "-k $temp -h '' -p 55437" -w start >/dev/null
export DATABASE_URL="postgresql://assessment_test@localhost:55437/postgres?host=$temp"
export ASSESSMENT_DB_ISOLATED=true
export ASSESSMENT_DB_TEST_REQUIRED=true
cd "$root"
pnpm --filter @workspace/db run push-force
pnpm --filter @workspace/api-server exec vitest run src/domains/assessment/__tests__/repository.db.test.ts src/domains/assessment/__tests__/diagnostic.db.test.ts --reporter=verbose
