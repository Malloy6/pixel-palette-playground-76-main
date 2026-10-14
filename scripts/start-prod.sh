#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export NODE_ENV=production
export PATH="$ROOT_DIR/node_modules/.bin:$PATH"

# Build during deployment (`npm run build:production`) before restarting the
# service. Only build here when starting from a fresh checkout with no bundle;
# this keeps ordinary systemd restarts from taking the upstream offline while
# Vite rebuilds the application.
if [[ ! -f "$ROOT_DIR/dist/server/server.js" || ! -d "$ROOT_DIR/dist/client/assets" ]] || \
  ! ./scripts/use-project-node.sh node scripts/verify-production-build.mjs; then
  ./scripts/use-project-node.sh npm run build:production
fi

exec ./scripts/use-project-node.sh node ./server.mjs
