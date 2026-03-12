#!/bin/sh
# Start both Express server and scheduler in a single container
# Express runs as the foreground process (PID 1 behavior)
# Scheduler runs in background

echo "[Startup] Starting Supernote Calendar Integration..."

# Start scheduler in background
node dist/src/index-scheduler.js &
SCHEDULER_PID=$!
echo "[Startup] Scheduler started (PID: $SCHEDULER_PID)"

# Trap signals to stop both processes gracefully
cleanup() {
  echo "[Startup] Shutting down..."
  kill $SCHEDULER_PID 2>/dev/null
  kill $SERVER_PID 2>/dev/null
  wait
  echo "[Startup] All processes stopped"
  exit 0
}

trap cleanup SIGTERM SIGINT

# Start Express server in foreground
node dist/src/index-server.js &
SERVER_PID=$!
echo "[Startup] Express server started (PID: $SERVER_PID)"

# Wait for either process to exit
wait -n
EXIT_CODE=$?

echo "[Startup] A process exited with code $EXIT_CODE, shutting down..."
cleanup
