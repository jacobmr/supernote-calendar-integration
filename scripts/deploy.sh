#!/usr/bin/env bash
set -euo pipefail

SERVER="root@37.27.198.218"
REMOTE_DIR="/opt/supernote"
COMPOSE_FILE="docker-compose.prod.yml"

echo "=== Supernote Production Deploy ==="

# Step 1: Decrypt secrets and deploy .env to server

echo "Deploying secrets..."
sops decrypt --input-type dotenv --output-type dotenv secrets.production.env.enc | \
  ssh "$SERVER" "cat > ${REMOTE_DIR}/.env"

# Step 2: Sync project files (excluding secrets, data, git)

echo "Syncing project files..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='.env' \
  --exclude='.env.production' \
  --exclude='data/' \
  --exclude='.planning/' \
  --exclude='secrets.*.enc' \
  --exclude='tokens.json' \
  . "$SERVER:${REMOTE_DIR}/"

# Step 3: Build and restart on server

echo "Building and restarting..."
ssh "$SERVER" "cd ${REMOTE_DIR} && docker compose -f ${COMPOSE_FILE} up -d --build"

# Step 4: Wait for health check

echo "Waiting for health check..."
sleep 10
if curl -sf https://supernote.salundo.com/health > /dev/null; then
  echo "Deploy successful! Health check passed."
else
  echo "WARNING: Health check failed. Check logs:"
  echo "  ssh $SERVER 'cd $REMOTE_DIR && docker compose -f $COMPOSE_FILE logs --tail=50'"
  exit 1
fi

echo "=== Deploy Complete ==="
