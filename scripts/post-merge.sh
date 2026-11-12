#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm run typecheck:libs
# Dependency updates can leave Vite serving prebundled React from the old lockfile.
rm -rf artifacts/contentx/node_modules/.vite
pnpm run validate:merge
pnpm --filter db push
