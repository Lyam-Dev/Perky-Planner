#!/usr/bin/env bash
# Verifies the multi-day deadline feature end to end.
#
# Compiles the real persistence layer (src/main/db.ts, share.ts) plus the pure
# renderer layout helpers to CommonJS in /tmp, symlinks this project's
# node_modules (better-sqlite3 is built for Electron's ABI), then runs
# scripts/verify-deadlines.cjs inside an Electron process.
cd /Users/lyam999gh/Desktop/Calender

rm -rf /tmp/perky-deadline-test /tmp/perky-deadline-ud
mkdir -p /tmp/perky-deadline-test

# scripts/tsconfig.verify.json pins outDir + the @shared/* path alias; stderr is
# discarded because unresolved React/electron types are irrelevant here.
npx tsc -p scripts/tsconfig.verify.json 2>/dev/null

# Use this project's node_modules so the Electron-ABI better-sqlite3 resolves.
ln -sfn /Users/lyam999gh/Desktop/Calender/node_modules /tmp/perky-deadline-test/node_modules

echo "=== compiled modules ==="
ls /tmp/perky-deadline-test/main/ /tmp/perky-deadline-test/renderer/lib/ 2>/dev/null

rm -rf /tmp/perky-deadline-ud
nohup npx electron scripts/verify-deadlines.cjs >/tmp/deadline-test.log 2>&1 &
PID=$!

# Give the run time to finish; the harness exits on its own.
for _ in $(seq 1 30); do
  if grep -qE 'ALL_PASS|SOME_FAILED|HARNESS_ERROR' /tmp/deadline-test.log 2>/dev/null; then
    break
  fi
  sleep 1
done

echo "=== LOG ==="
grep -vE 'Electron Security Warning|was loaded over|DevTools|^\s*$' /tmp/deadline-test.log || true
echo "=== END ==="

kill $PID 2>/dev/null || true
