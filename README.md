# Database Diagram Web Application

A web application for creating, editing, and exchanging database diagrams. Supports visual diagramming, JSON import/export, and direct PostgreSQL schema introspection and DDL application.

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + TypeScript + Vite | Graphic design interface for database diagramming |
| Backend | Node.js + Express + TypeScript | Lightweight local service for PostgreSQL communication |
| Database | PostgreSQL 14+ | Schema introspection and DDL application |

## Directory Structure

```
frontend/   # React + TypeScript + Vite application
backend/    # Express + TypeScript backend (PostgreSQL only)
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

## Running Tests (Containerized)

All tests run inside Docker containers. Never run tests directly on the host.

### Frontend tests

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
  -v "$(pwd)":/work:ro \
  -v "$(pwd)/qa-artifacts":/artifacts \
  -w /work/frontend \
  node:20-alpine \
  sh -c "npm ci --ignore-scripts && npm test"
```

### Backend tests

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
  -v "$(pwd)":/work:ro \
  -v "$(pwd)/qa-artifacts":/artifacts \
  -w /work/backend \
  node:20-alpine \
  sh -c "npm ci --ignore-scripts && npm test"
```

### Using docker-compose

A `docker-compose.test.yml` can be added to orchestrate the app and test containers together on a private network.

## License

MIT
