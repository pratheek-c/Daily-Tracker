#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# One-shot deployment check for Anusree's Daily Tracker
#
#   ./scripts/deploy-check.sh https://your-app.vercel.app
#
# Runs the local quality gates, then verifies the deployed build over HTTP and
# confirms no secret key was shipped to the browser. Safe to run repeatedly.
# -----------------------------------------------------------------------------
set -euo pipefail

TARGET="${1:-https://anusree-daily-tracker.vercel.app}"

echo "==> Typechecking"
npx tsc -b --pretty false

echo "==> Linting"
npx eslint .

echo "==> Unit tests"
npx vitest run

echo "==> Production build"
npm run build

echo "==> Verifying ${TARGET}"
node scripts/verify-deployment.mjs "$TARGET"

echo "==> Verifying the shipped bundle"
node scripts/verify-bundle.mjs "$TARGET"

echo
echo "All gates passed."
