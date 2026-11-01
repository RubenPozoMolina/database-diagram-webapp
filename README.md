# Database Diagram Web Application

A web application for creating, editing, and exchanging database diagrams. Supports visual diagramming, JSON import/export, and direct PostgreSQL schema introspection and DDL application.

Web-based database diagram designer with JSON import/export and PostgreSQL integration.

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + TypeScript + Vite | Graphic design interface for database diagramming |
| Backend | Node.js + Express + TypeScript | Lightweight local service for PostgreSQL communication |
| Database | PostgreSQL 14+ | Schema introspection and DDL application |

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** CSS (custom properties)
- **Unit tests:** Vitest + React Testing Library + jsdom
- **E2E tests:** Playwright (Chromium)
- **Lint:** ESLint + Prettier
- **Container:** Docker (node:20-alpine, playwright:v1.49.1, nginx-unprivileged:1.27-alpine)

## Directory Structure

```
frontend/   # React + TypeScript + Vite application
backend/    # Express + TypeScript backend (PostgreSQL only)
src/
  main.tsx          # React entry point (STORY-001)
  App.tsx           # Root component: header + canvas (STORY-001)
  index.css         # Global styles (STORY-001)
  main.ts           # Application entry point (trunk canvas app)
  styles.css        # Base styles for the canvas (trunk)
  types/diagram.ts  # Diagram data model (STORY-001)
  types.ts          # Domain types (trunk)
  hooks/useDiagram.ts  # Diagram state (STORY-001)
  canvas/
    DiagramCanvas.ts      # Main canvas component (trunk)
    TableNode.ts          # Table node rendering (trunk)
    RelationshipLine.ts   # Relationship line rendering (trunk)
  components/
    DiagramCanvas.tsx   # Canvas: tables + relationship lines + empty state (STORY-001)
    TableNode.tsx       # A table rendered on the canvas (STORY-001)
    RelationshipLine.tsx # SVG curve connecting two tables (STORY-001)
  __tests__/
    DiagramCanvas.test.ts # Component unit tests (trunk)
    TableNode.test.ts     # Table node tests (trunk)
    RelationshipLine.test.ts # Relationship line tests (trunk)
    ConnectionForm.test.ts
    connectionApi.test.ts
  test/setup.ts     # Vitest setup (jest-dom matchers) (STORY-001)
e2e/
  empty-canvas.spec.ts  # Playwright browser tests (STORY-001)
Dockerfile          # Multi-stage build + nginx serve (STORY-001)
docker-compose.test.yml  # Compose reference for app + tests (STORY-001)
playwright.config.ts    # Playwright configuration (STORY-001)
vitest.config.ts        # Root vitest configuration (trunk)
vitest.setup.ts         # jsdom canvas context mock (trunk)
```

## Acceptance Criteria (TASK-001)

1. **Empty canvas is displayed when application loads** — `DiagramCanvas` renders a blank workspace with no tables or relationships.
2. **Canvas supports rendering table nodes** — `addTable()` adds table nodes with headers and column lists; `render()` draws them.
3. **Canvas supports rendering relationship lines between tables** — `addRelationship()` adds connector lines with arrowheads between tables.

## Acceptance criteria (STORY-001)

Given the user opens the application, when they choose to create a new diagram,
then an empty canvas is displayed where tables and relationships can be added.

- Empty canvas is displayed when the application loads.
- New Diagram button/action is available in the UI.
- Clicking New Diagram displays an empty canvas.
- Canvas supports rendering table nodes.
- Canvas supports rendering relationship lines between tables.

## Running the Tests

All tests run inside Docker containers (never on the host), per the
[docker-test-runner](.opencode/skills/docker-test-runner) skill.

### Using `docker run` (recommended)

#### Unit tests (Vitest)

```bash
docker run --rm --init --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 512 --memory 2g --shm-size 1g \
  --user "$(id -u):$(id -g)" --tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -v "$(pwd)":/work:ro -v "$(pwd)/qa-artifacts":/artifacts -w /work \
  node:20-alpine \
  sh -c "npm ci --ignore-scripts && npm test"
```

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
  -v "$(pwd)/qa-artifacts":/artifacts \
  -w /work \
  node:20-alpine \
  sh -c "./node_modules/.bin/vitest run"
```

### E2E / browser tests (Playwright)

The app is served by an unprivileged nginx container on a private Docker network;
the Playwright container reaches it by container name (nothing is published on the host).

```bash
NETWORK="qa-STORY-001"
docker network create "$NETWORK"

# Build and serve the app
docker build -t database-diagram-webapp:st001 -f Dockerfile .
docker run -d --rm --name "app-STORY-001" --network "$NETWORK" \
  --cap-drop ALL --security-opt no-new-privileges --read-only --tmpfs /tmp \
  database-diagram-webapp:st001

# Wait until the app answers
docker run --rm --network "$NETWORK" curlimages/curl:8.10.1 \
  --retry 15 --retry-connrefused --retry-delay 1 -sf "http://app-STORY-001:8080/"

# Run Playwright tests
docker run --rm --init --cap-drop ALL --security-opt no-new-privileges \
  --shm-size 1g --user "$(id -u):$(id -g)" --tmpfs /tmp -e HOME=/tmp \
  -e BASE_URL="http://app-STORY-001:8080/" \
  -v "$(pwd)":/work:ro -v "$(pwd)/qa-artifacts":/artifacts -w /work \
  mcr.microsoft.com/playwright:v1.49.1-noble \
  sh -c "npx playwright@1.49.1 test"

# Cleanup
docker rm -f "app-STORY-001"
docker network rm "$NETWORK"
```

### Using Docker Compose

```bash
docker compose -f docker-compose.test.yml run --rm tests
```

### Lint

```bash
docker run --rm --init --cap-drop ALL --security-opt no-new-privileges \
  --user "$(id -u):$(id -g)" --tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -v "$(pwd)":/work:ro -w /work \
  node:20-alpine \
  sh -c "npm ci --ignore-scripts && npm run lint"
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
