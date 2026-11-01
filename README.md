# Database Diagram Web App

Web-based database diagram designer with JSON import/export and PostgreSQL integration.

## Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** CSS (custom properties)
- **Unit tests:** Vitest + React Testing Library + jsdom
- **E2E tests:** Playwright (Chromium)
- **Lint:** ESLint + Prettier
- **Container:** Docker (node:20-alpine, playwright:v1.49.1, nginx-unprivileged:1.27-alpine)

## Running the tests

All tests run inside Docker containers — never on the host.

### Unit tests (Vitest)

```bash
docker run --rm --init --cap-drop ALL --security-opt no-new-privileges \
  --pids-limit 512 --memory 2g --shm-size 1g \
  --user "$(id -u):$(id -g)" --tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -v "$(pwd)":/work:ro -v "$(pwd)/qa-artifacts":/artifacts -w /work \
  node:20-alpine \
  sh -c "npm ci --ignore-scripts && npm test"
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

### Lint

```bash
docker run --rm --init --cap-drop ALL --security-opt no-new-privileges \
  --user "$(id -u):$(id -g)" --tmpfs /tmp -e HOME=/tmp -e npm_config_cache=/tmp/.npm \
  -v "$(pwd)":/work:ro -w /work \
  node:20-alpine \
  sh -c "npm ci --ignore-scripts && npm run lint"
```

## Project structure

```
src/
  main.tsx          # React entry point
  App.tsx           # Root component: header + canvas
  index.css         # Global styles
  types/diagram.ts  # Diagram data model (Table, Column, Relationship, Diagram)
  hooks/useDiagram.ts  # Diagram state: create, add/remove tables & relationships
  components/
    DiagramCanvas.tsx   # Canvas: tables + relationship lines + empty state
    TableNode.tsx       # A table rendered on the canvas
    RelationshipLine.tsx # SVG curve connecting two tables
  test/setup.ts     # Vitest setup (jest-dom matchers)
e2e/
  empty-canvas.spec.ts  # Playwright browser tests
Dockerfile          # Multi-stage build + nginx serve
docker-compose.test.yml  # Compose reference for app + tests
playwright.config.ts    # Playwright configuration
```

## Acceptance criteria (STORY-001)

Given the user opens the application, when they choose to create a new diagram,
then an empty canvas is displayed where tables and relationships can be added.

- Empty canvas is displayed when the application loads.
- New Diagram button/action is available in the UI.
- Clicking New Diagram displays an empty canvas.
- Canvas supports rendering table nodes.
- Canvas supports rendering relationship lines between tables.
