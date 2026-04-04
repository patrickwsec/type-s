# Type-S

Type-S is a task-first attack surface management application built to explore how AI-assisted orchestration can sit on top of a real security product.

The repo combines a React frontend, a FastAPI product API, a Mongo-backed data model, and a worker-based execution path for recon and findings workflows. It also includes architecture and migration work for moving the product toward an agent-driven runtime.

## What This Repo Demonstrates

- Full-stack product engineering across React, FastAPI, MongoDB, Docker, and nginx.
- A v2 backend redesign that separates product APIs from long-running execution work.
- Task-first workflow modeling for async operations, status tracking, retries, and audit history.
- AI-oriented systems design through agent-service planning, tool schemas, and worker orchestration.
- UI/UX work for project views, assets, findings, screenshots, exports, and project-scoped navigation.

## Current Product Surface

- Authenticated multi-project workspace.
- Project overview, asset inventory, findings, screenshots, analytics, and exports.
- Task-first flows for scope enumeration and findings scans.
- Background worker assignment and task event history.
- CSV and Markdown export paths.
- Protected API docs and a v2-first backend runtime under `backend/app`.

## AI And Agent Work In This Repo

The repo is not just a scanner wrapper. A large part of the engineering work is about how to move a security product toward an agent-driven architecture safely.

- `backend/app` contains the v2 task/data runtime used by the app today.
- The task model includes agent-oriented fields such as assigned worker ownership and event history.
- `backend/app/api/routes/tools.py` exposes direct tool endpoints intended for UI or LLM-agent use.
- `backend/app/services/nmap_tool.py` includes an OpenAI-compatible tool schema for function-calling workflows.
- The repo includes detailed migration and cutover docs for the agent architecture work, including `docs/architecture/AGENT_ARCHITECTURE_MIGRATION_PLAN.md`, `docs/architecture/AGENT_PHASE1_PROGRESS.md`, `docs/architecture/AGENT_PHASE2_PLAN.md`, and `docs/architecture/AGENT_PHASE2_PROGRESS.md`.

## Architecture

- Frontend: React, Vite, Tailwind CSS, React Router, TanStack Query.
- Backend: FastAPI, Motor/PyMongo, JWT auth, task/data services under `backend/app`.
- Worker: Separate background process for task pickup and execution.
- Storage: MongoDB for canonical product data, filesystem-backed artifacts for screenshots and exports.
- Runtime: Docker Compose with nginx proxying the frontend and backend behind `http://localhost`.

## Public Demo Notes

- Secrets, cookies, downloaded templates, screenshots, and captured scan artifacts are intentionally kept out of git.
- The repo is being used as a public portfolio/demo project, so committed data should stay synthetic or otherwise safe to publish.
- If you want interview-safe demo content, seed the app with disposable example projects rather than real client targets.

## Local Setup

### Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Python 3.12+

### Start The App

1. Clone the repository.

   ```bash
   git clone https://github.com/patrickwsec/type-s.git
   cd type-s
   ```

2. Create local environment files.

   ```bash
   cp .env.example .env
   cp frontend/.env.example frontend/.env.local
   ```

3. Update `.env` as needed.

   Notes:

   - `OPENAI_API_KEY` is optional unless you are experimenting with agent integrations that require it.
   - `SECRET_KEY` must be set.

4. Start the stack.

   ```bash
   docker compose up --build -d
   ```

5. Open the app.

   - Main app: `http://localhost`
   - Frontend container: `http://localhost:3001`
   - Backend API: `http://localhost:8000`

## Validation

### Frontend Build

```bash
cd frontend
npm ci --legacy-peer-deps
npm run build
```

### Backend Tests

The backend test suite expects MongoDB to be available.

```bash
cd backend
SECRET_KEY=dev-only-secret MONGO_URI=mongodb://127.0.0.1:27017 python -m unittest discover -s tests -v
```

A GitHub Actions workflow is included at `.github/workflows/ci.yml` to run these checks automatically once the repository is public.

## Project Status

This is an actively evolving repo rather than a frozen showcase snapshot.

The important part of the story is the direction of travel:

- the live runtime is already centered on the v2 app structure
- the frontend has been moved to a task-first default path
- the remaining work is mostly around legacy isolation, task-workspace maturity, and agent-service evolution

## Roadmap And Design Docs

- [`AGENT_ARCHITECTURE_MIGRATION_PLAN.md`](docs/architecture/AGENT_ARCHITECTURE_MIGRATION_PLAN.md)
- [`AGENT_PHASE1_PROGRESS.md`](docs/architecture/AGENT_PHASE1_PROGRESS.md)
- [`AGENT_PHASE2_PLAN.md`](docs/architecture/AGENT_PHASE2_PLAN.md)
- [`AGENT_PHASE2_PROGRESS.md`](docs/architecture/AGENT_PHASE2_PROGRESS.md)
- [`LEGACY_TO_V2_IMPORT.md`](docs/architecture/LEGACY_TO_V2_IMPORT.md)

