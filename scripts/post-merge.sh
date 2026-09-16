#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm run validate:merge
pnpm --filter db push
