#!/usr/bin/env bash
# Verifies that the perky1: pairing-code transfer round-trips tasks too.
# Compiles the real src/main/db.ts + share.ts to CJS, symlinks the project's
# Electron-ABI node_modules, and drives them inside an Electron process.
cd /Users/lyam999gh/Desktop/Calender

rm -rf /tmp/perky-xfer-test /tmp/perky-xfer-ud
mkdir -p /tmp/perky-xfer-test

# Compile the persistence + codec to CommonJS (no emit declaration, skip types).
# outDir is the temp root so files land at /tmp/perky-xfer-test/main/db.js etc.
npx tsc src/main/db.ts src/main/share.ts \
  --outDir /tmp/perky-xfer-test \
  --module commonjs --target es2022 --moduleResolution node \
  --esModuleInterop --skipLibCheck --resolveJsonModule 2>/dev/null || npx tsc src/main/db.ts src/main/share.ts \
  --outDir /tmp/perky-xfer-test \
  --module commonjs --target es2022 --moduleResolution node16 \
  --esModuleInterop --skipLibCheck --resolveJsonModule 2>/dev/null

# Use this project's node_modules (better-sqlite3 already rebuilt for Electron).
ln -sfn /Users/lyam999gh/Desktop/Calender/node_modules /tmp/perky-xfer-test/node_modules

echo "=== compiled main dir ==="
ls /tmp/perky-xfer-test/main/

rm -rf /tmp/perky-xfer-ud
nohup npx electron /Users/lyam999gh/Desktop/Calender/scripts/verify-task-transfer.cjs >/tmp/xfer.log 2>&1 &
PID=$!
echo "PID=$PID"
sleep 10
echo "=== LOG ==="
grep -vE 'Electron Security Warning|was loaded over|DevTools|^\s*$' /tmp/xfer.log || true
echo "=== END ==="
kill $PID 2>/dev/null || true

