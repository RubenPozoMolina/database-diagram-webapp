# Database Diagram Web Application

A web application for creating, editing, and exchanging database diagrams. Supports visual diagramming, JSON import/export, and direct PostgreSQL schema introspection and DDL application.

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + TypeScript + Vite | Graphic design interface for database diagramming |
| Backend | Node.js + Express + TypeScript | Lightweight local service for PostgreSQL communication |
| Database | PostgreSQL 14+ | Schema introspection and DDL application |

## Tech Stack

- **Frontend:** Vite, TypeScript (strict), Vitest + jsdom, HTML5 Canvas 2D API
- **Backend:** Express.js, TypeScript (strict), Vitest, node-postgres (`pg`)

## Directory Structure

```
frontend/   # React + TypeScript + Vite application
backend/    # Express + TypeScript backend (PostgreSQL only)
src/
  main.ts                 # Application entry point
  styles.css              # Base styles for the canvas
  types.ts                # Domain types (TableNode, RelationshipNode, etc.)
  canvas/
    DiagramCanvas.ts      # Main canvas component (empty workspace, tables, lines)
    TableNode.ts          # Table node rendering
    RelationshipLine.ts   # Relationship line rendering
  __tests__/
    DiagramCanvas.test.ts # Component unit tests
    TableNode.test.ts     # Table node tests
    RelationshipLine.test.ts # Relationship line tests
backend/
  package.json            # Backend dependencies
  tsconfig.json           # TypeScript configuration
  vitest.config.ts        # Vitest configuration
  src/
    index.ts              # Application entry point
    app.ts                # Express app factory
    types.ts              # Domain types
    middleware/
      validate.ts         # Request validation
    routes/
      test-connection.ts  # POST /api/v1/connections/test
    services/
      postgres-connection.service.ts  # PostgreSQL connection test service
    __tests__/
      test-connection.unit.test.ts   # Unit tests (mocked pg.Client)
      integration.test.ts            # Integration tests (real PostgreSQL)
vitest.setup.ts           # jsdom canvas context mock
Dockerfile                # Containerized test environment
Dockerfile.test           # Containerized test environment (workspaces)
docker-compose.test.yml   # Compose-based test runner
```

## Acceptance Criteria (TASK-001)

1. **Empty canvas is displayed when application loads** — `DiagramCanvas` renders a blank workspace with no tables or relationships.
2. **Canvas supports rendering table nodes** — `addTable()` adds table nodes with headers and column lists; `render()` draws them.
3. **Canvas supports rendering relationship lines between tables** — `addRelationship()` adds connector lines with arrowheads between tables.

## Running the Tests

All tests run inside Docker containers (never on the host), per the
[docker-test-runner](.opencode/skills/docker-test-runner) skill.

### Using `docker run` (recommended)

#### Frontend tests

```bash
docker run --rm \
  --init \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --pids-limit 512 \
  --memory 2g \
  --shm-size 1g \
  --user "$(id -u):$(id -g)" \
  --tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -v "$(pwd)":/work:rw \
  -v "$(pwd)/qa-artifacts":/artifacts \
  -w /work/frontend \
  node:20-alpine \
  sh -c "npm ci --ignore-scripts && npm test"
```

#### Backend tests

```bash
docker run --rm \
  --init \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --pids-limit 512 \
  --memory 2g \
  --shm-size 1g \
  --user "$(id -u):$(id -g)" \
  --tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -v "$(pwd)":/work:rw \
  -v "$(pwd)/qa-artifacts":/artifacts \
  -w /work/backend \
  node:20-alpine \
  sh -c "npm ci --ignore-scripts && npm test"
```

#### Root tests

```bash
docker run --rm \
  --init \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --pids-limit 512 \
  --memory 2g \
  --shm-size 1g \
  --user "$(id -u):$(id -g)" \
  --tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -v "$(pwd)":/work:rw \
  -w /work \
  node:20-alpine \
  sh -c "./node_modules/.bin/vitest run"
```

### Using Docker Compose

```bash
docker compose -f docker-compose.test.yml run --rm tests
```

### Type check

```bash
docker run --rm \
  --init \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --pids-limit 512 \
  --memory 2g \
  --shm-size 1g \
  --user "$(id -u):$(id -g)" \
  --tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -v "$(pwd)":/work:rw \
  -w /work \
  node:20-alpine \
  sh -c "./node_modules/.bin/tsc --noEmit"
```

### Backend tests

The backend lives in `backend/` and has its own `package.json` and `vitest.config.ts`.
Run its unit tests inside Docker:

```bash
docker run --rm \
  --init \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --pids-limit 512 \
  --memory 2g \
  --shm-size 1g \
  --user "$(id -u):$(id -g)" \
  --tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -v "$(pwd)":/work:rw \
  -w /work/backend \
  node:20-alpine \
  sh -c "npx vitest run"
```

Integration tests require a throwaway PostgreSQL container on a private Docker network
(see `database/run-verification.sh` for the pattern). Run them with:

```bash
docker run --rm --init --cap-drop ALL --security-opt no-new-privileges \
  --network <pg-network> --user "$(id -u):$(id -g)" --memory 1g \
  --tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -v "$(pwd)":/work:rw -w /work/backend \
  -e PG_HOST=<pg-container> \
  -e PG_PORT=5432 \
  -e PG_DATABASE=<db> \
  -e PG_USER=<user> \
  -e PG_PASSWORD=<password> \
  -e PG_BAD_PASSWORD=<bad-password> \
  -e PG_BAD_HOST=<unreachable-host> \
  node:20-alpine \
  sh -c "npx vitest run src/__tests__/integration.test.ts"
```

### Backend type check

```bash
docker run --rm \
  --init \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --pids-limit 512 \
  --memory 2g \
  --shm-size 1g \
  --user "$(id -u):$(id -g)" \
  --tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -v "$(pwd)":/work:rw \
  -w /work/backend \
  node:20-alpine \
  sh -c "./node_modules/.bin/tsc --noEmit"
```

## Development

### Prerequisites

- Node.js >= 20
- Docker (for containerized testing)

### Install dependencies

```bash
npm install
```

### Run in development

Frontend (dev server on port 5173):

```bash
npm run dev:frontend
```

Backend (dev server on port 3001):

```bash
npm run dev:backend
```

Root Vite dev server:

```bash
npm run dev
```

### Linting and formatting

```bash
# Lint all workspaces
npm run lint

# Check formatting
npm run format:check

# Apply formatting
npm run format
```

### Build

```bash
npm run build:frontend
npm run build:backend
```

### Backend development

```bash
cd backend
npm install       # Install backend dependencies
npm run dev       # Start Express dev server with tsx watch
npm run start     # Start Express server
npm test          # Run backend unit tests (Vitest)
npm run typecheck # Run TypeScript type check
```

## License

MIT
