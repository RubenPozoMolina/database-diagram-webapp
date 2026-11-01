# Database Diagram Web App

A web-based graphic design interface for creating and editing database diagrams.
Supports visual diagramming, JSON import/export, and PostgreSQL integration.

## Tech Stack

- **Build tool:** Vite
- **Language:** TypeScript (strict)
- **Testing:** Vitest + jsdom
- **Rendering:** HTML5 Canvas 2D API

## Project Structure

```
src/
  main.ts                 # Application entry point
  styles.css              # Base styles for the canvas
  types.ts                # Domain types (TableNode, RelationshipLine, etc.)
  canvas/
    DiagramCanvas.ts      # Main canvas component (empty workspace, tables, lines)
    TableNode.ts          # Table node rendering
    RelationshipLine.ts   # Relationship line rendering
  __tests__/
    DiagramCanvas.test.ts # Component unit tests
    TableNode.test.ts     # Table node tests
    RelationshipLine.test.ts # Relationship line tests
vitest.setup.ts           # jsdom canvas context mock
Dockerfile                # Containerized test environment
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

## Development

```bash
npm run dev       # Start Vite dev server
npm run build     # Type-check and build for production
npm run preview   # Preview production build
npm test          # Run unit tests (Vitest)
npm run typecheck # Run TypeScript type check
```

## License

MIT
