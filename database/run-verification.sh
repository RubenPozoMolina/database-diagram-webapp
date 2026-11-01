#!/usr/bin/env bash
# =============================================================================
# run-verification.sh — Verify TASK-039 PostgreSQL introspection queries
#
# Starts a throwaway postgres:16-alpine container on a private network, seeds
# database/seed.sql, runs database/verify-introspection.sql and prints each
# result block. Everything runs inside Docker; nothing touches the host.
# =============================================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TICKET_ID="TASK-039"
NET="${TICKET_ID}-net"
CONTAINER="${TICKET_ID}-postgres"
PGPASSWORD="$(head -c 18 /dev/urandom | base64 | tr -dc 'A-Za-z0-9')"
PGDATABASE="app_test"

echo "[verify] Docker network: $NET"
echo "[verify] PostgreSQL container: $CONTAINER"

cleanup() {
    echo "[verify] Cleaning up container and network..."
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

# --- Create private network -------------------------------------------------
docker network create "$NET" >/dev/null

# --- Start throwaway PostgreSQL 16 (tmpfs data dir, no published port) -----
docker run -d --rm --name "$CONTAINER" --network "$NET" \
    --cap-drop ALL --cap-add CHOWN --cap-add SETUID --cap-add SETGID \
    --cap-add DAC_OVERRIDE --cap-add FOWNER \
    --security-opt no-new-privileges --pids-limit 256 --memory 1g \
    --tmpfs /var/lib/postgresql/data \
    -e POSTGRES_PASSWORD="$PGPASSWORD" -e POSTGRES_DB="$PGDATABASE" \
    postgres:16-alpine >/dev/null

# --- Wait until ready -------------------------------------------------------
echo "[verify] Waiting for PostgreSQL to accept connections..."
for i in $(seq 1 30); do
    if docker exec "$CONTAINER" pg_isready -U postgres -d "$PGDATABASE" >/dev/null 2>&1; then
        echo "[verify] PostgreSQL is ready."
        break
    fi
    sleep 1
done

# --- Seed the schema --------------------------------------------------------
echo "[verify] Seeding schema from database/seed.sql"
docker exec -i "$CONTAINER" psql -U postgres -d "$PGDATABASE" -v ON_ERROR_STOP=1 \
    < "$PROJECT_DIR/database/seed.sql" >/dev/null
echo "[verify] Seed complete."

# --- Run the introspection verification -------------------------------------
echo "[verify] Running introspection queries..."
docker run --rm --init --cap-drop ALL --security-opt no-new-privileges \
    --network "$NET" --user "$(id -u):$(id -g)" --memory 1g \
    --tmpfs /tmp -e HOME=/tmp \
    -v "$PROJECT_DIR":/work:ro -w /work \
    postgres:16-alpine \
    psql "postgresql://postgres:${PGPASSWORD}@${CONTAINER}:5432/${PGDATABASE}" \
    -v ON_ERROR_STOP=1 -f /work/database/verify-introspection.sql

echo "[verify] Done."
