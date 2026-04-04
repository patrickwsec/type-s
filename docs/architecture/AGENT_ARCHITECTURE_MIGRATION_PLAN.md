# Type-S Agent Architecture Migration Plan

Date: 2026-03-06

## Recommendation

Do not do a full greenfield rewrite of the entire product.

Do not keep the current backend architecture as the long-term foundation either.

Recommended direction:

- keep the current frontend app as the starting UI shell
- keep the core product concepts: projects, assets, findings, screenshots, scan history
- replace the current "web app runs tools directly" backend model with a task- and data-driven architecture
- introduce a separate AI agent service that owns orchestration and scan execution

Short version:

- keep the UI
- rebuild the backend architecture
- move scanning/orchestration into a separate agent service

---

## Why This Direction Makes Sense

The current app already gives you useful product value:

- project and asset views
- vulnerability and screenshot presentation
- basic authentication
- a UI pattern users can already understand

But the current backend shape is wrong for the product you now want:

- the API is tightly coupled to direct tool execution
- long-running scans are started from the web app process
- scan orchestration logic and product API logic are mixed together
- the current backend is hard to evolve into an agent-first system cleanly

If you keep extending the existing backend, the app will keep fighting you.

If you rewrite everything, you will throw away working UI and product knowledge unnecessarily.

So the right move is a staged migration:

- preserve the UI and data concepts
- introduce a new backend architecture beside the old one
- cut over feature by feature

---

## Target Architecture

### 1. UI App

Responsibilities:

- authentication
- project browsing
- asset and finding presentation
- screenshots and artifact viewing
- task creation and approval UX
- task status, history, and audit display

The UI should not know how `subfinder`, `httpx`, `naabu`, or `nuclei` are run.

It should only know:

- what task the user requested
- what status it is in
- what data was produced

### 2. Product API

Responsibilities:

- CRUD for projects, scopes, assets, findings, screenshots, tags, notes
- task creation and task state transitions
- user auth and permissions
- reading and shaping data for the UI
- ingest endpoints for agent-produced results

The API should become the system of record for product data, not the runtime that performs scans.

### 3. Agent Service

Responsibilities:

- interpret user task requests
- decide which scan steps to run
- execute tools or call other worker tools
- normalize outputs
- write results, artifacts, and status updates back to the API/DB
- request approval when a task is sensitive or high-risk

This is where the "AI agent" lives.

### 4. Queue / Job Layer

Responsibilities:

- store pending tasks
- hand work to agents/workers
- support retries and cancellation
- isolate long-running work from the API

Examples:

- Redis + RQ/Celery
- Postgres-backed jobs
- RabbitMQ

You do not need a complicated workflow engine on day one, but you do need to stop running scan jobs directly in the web API process.

### 5. Storage

Split storage by concern:

- relational or document DB for canonical product data
- object/blob storage for screenshots, raw responses, exports, large artifacts
- optional search index later for asset/finding search

---

## Recommended System Boundaries

### UI

Should do:

- create task
- display task
- display results
- collect approval from user

Should not do:

- interpret raw tool output
- manage scan pipelines
- open WebSocket connections to tool processes directly

### API

Should do:

- validate requests
- enforce auth
- persist canonical data
- expose queryable product endpoints

Should not do:

- run tools directly
- own concurrency-heavy scan orchestration
- block on long external processes

### Agent

Should do:

- plan and execute scan workflows
- decide next actions
- emit structured events
- ingest artifacts and findings

Should not do:

- serve the user-facing UI
- become the only place where canonical state exists

---

## Canonical Data Model

The product should pivot around a stable data model.

Suggested core entities:

### `users`

- id
- username / auth identity
- role
- created_at

### `projects`

- id
- owner_id
- name
- description
- created_at
- updated_at

### `scopes`

- id
- project_id
- type: domain, subdomain, CIDR, URL, hostname
- value
- source
- status

### `assets`

- id
- project_id
- hostname
- ip_addresses
- urls
- technologies
- ports
- tags
- source
- first_seen_at
- last_seen_at

### `findings`

- id
- project_id
- asset_id
- type
- title
- severity
- description
- evidence_summary
- normalized_fields
- source_task_id
- first_seen_at
- last_seen_at
- triage_status

### `artifacts`

- id
- project_id
- asset_id
- task_id
- type: screenshot, raw_http, export, log, nuclei_output
- storage_path
- metadata
- created_at

### `tasks`

- id
- project_id
- created_by
- type: enumerate_scope, enrich_asset, run_templates, analyze_project, screenshot_hosts
- status: queued, planning, awaiting_approval, running, ingesting, completed, failed, cancelled
- requested_input
- execution_plan
- created_at
- updated_at

### `task_events`

- id
- task_id
- type
- message
- payload
- created_at

### `agent_runs`

- id
- task_id
- agent_name
- model
- prompt_version
- status
- started_at
- completed_at

This matters because once the data model is stable, you can swap the orchestration layer without breaking the product.

---

## Migration Strategy

Do this in phases. Do not try to replace everything in one move.

## Phase 0: Freeze The Wrong Direction

Goal:

- stop adding new scan logic to the current backend architecture

Actions:

1. Treat current scan endpoints as legacy.
2. Keep bug-fixing them only when needed to preserve current use.
3. Do not add new tool integrations directly into `backend/main.py`.
4. Start writing all new architecture work into new modules/services.

Exit criteria:

- team agrees that direct tool execution in the API is legacy-only

---

## Phase 1: Define The Canonical Product Backend

Goal:

- create a clean backend surface for product data, independent from scan execution

Actions:

1. Create a new API module structure instead of growing `backend/main.py`.
2. Add service boundaries such as:
   - `api/routes/projects.py`
   - `api/routes/assets.py`
   - `api/routes/findings.py`
   - `api/routes/tasks.py`
   - `api/routes/artifacts.py`
3. Add a canonical schema for projects, assets, findings, tasks, and artifacts.
4. Add migration/seed tooling for current project and result data.
5. Build read endpoints first before changing orchestration.

Recommended outcome:

- the UI can read all important product data from a stable API model

Exit criteria:

- assets/findings/screenshots/project history are readable from the new backend shape

---

## Phase 2: Introduce Tasks As The New Control Plane

Goal:

- replace "run scan now" API calls with "create task" API calls

Actions:

1. Add `POST /tasks`.
2. Add `GET /tasks/:id`.
3. Add `GET /projects/:id/tasks`.
4. Add task event history endpoints.
5. Update the UI scan launcher to create tasks instead of directly calling tool endpoints.
6. Keep old endpoints behind the scenes for a temporary adapter if needed.

Task examples:

- enumerate a domain scope
- enrich current assets with HTTP metadata
- run vulnerability templates against selected assets
- capture screenshots for selected live hosts
- analyze a project and recommend next actions

Exit criteria:

- the UI no longer needs to know which specific tool endpoint to call

---

## Phase 3: Create The Agent Service

Goal:

- move orchestration and tool execution out of the API

Actions:

1. Create a separate `agent` service in this repo or a sibling repo.
2. Give it access to the queue and either:
   - direct DB write access, or
   - authenticated ingest endpoints on the API
3. Implement a simple worker loop:
   - fetch queued task
   - plan task
   - run tools
   - emit task events
   - ingest normalized results
4. Add approval support for tasks that should not auto-run.
5. Store planning output and execution decisions for auditability.

First version should be simple:

- no multi-agent complexity
- one orchestrator agent
- deterministic tool wrappers
- structured result ingest

Exit criteria:

- at least one workflow is fully agent-driven end to end

---

## Phase 4: Build A Structured Ingest Pipeline

Goal:

- make tool output a normalized input to the product, not a special-case code path

Actions:

1. Define normalized result formats for:
   - discovered assets
   - HTTP metadata
   - ports
   - findings
   - screenshots
   - logs/artifacts
2. Add ingest endpoints or internal services:
   - `ingest/assets`
   - `ingest/findings`
   - `ingest/artifacts`
   - `ingest/task-events`
3. Deduplicate by canonical identity:
   - asset: project + hostname or URL
   - finding: project + asset + template/fingerprint
4. Track provenance:
   - which task produced the record
   - when it was first seen
   - when it was last seen

Exit criteria:

- multiple tool outputs can flow through the same ingest path

---

## Phase 5: Migrate UI Features One By One

Goal:

- keep the UI, replace its backend dependencies gradually

Actions:

1. Migrate Projects page to new API contracts.
2. Migrate Assets page to read normalized `assets` data only.
3. Migrate Vulnerabilities page to read normalized `findings`.
4. Migrate Screenshots page to read `artifacts`.
5. Migrate Scan History page into Task History.
6. Replace old "scan config" modals with "task request" modals where appropriate.

Important product shift:

- users request outcomes
- agent decides exact scan pipeline

Example:

Old model:

- run subfinder
- then run httpx
- then run nuclei

New model:

- "enumerate this scope and identify high-risk issues"

The agent can still use those tools internally, but the UI stops exposing raw tool orchestration as the main product abstraction.

Exit criteria:

- primary user flows operate through tasks and normalized data, not legacy scan endpoints

---

## Phase 6: Retire Legacy Scan Execution

Goal:

- remove the old architecture safely

Actions:

1. Mark legacy endpoints deprecated.
2. Remove direct scan execution from the API service.
3. Move any remaining helper logic into the agent or ingestion services.
4. Remove temporary compatibility adapters.
5. Archive or delete legacy code paths once the cutover is complete.

Exit criteria:

- the web API no longer starts scan tools directly

---

## Suggested Repo Shape

You can do this in the current repo.

Suggested high-level layout:

```text
frontend/
backend/
  app/
    routes/
    services/
    models/
    repositories/
    auth/
    ingest/
    tasks/
  main.py
agent/
  workers/
  tools/
  planners/
  ingest_client/
shared/
  schemas/
  contracts/
docs/
```

If you prefer to keep the agent isolated, split it into another repo later. For now, one repo is fine if boundaries are clear.

---

## What To Reuse From This App

Keep:

- the frontend app and current route structure
- the product concepts: projects, assets, findings, screenshots
- the newer UI pages and contexts
- the authentication idea, with cleanup

Refactor heavily:

- backend API layout
- scan history into task history
- screenshot and artifact handling
- data access patterns

Replace:

- direct tool execution in the API
- monolithic backend route file design
- the assumption that scan orchestration belongs in the web server

---

## First 10 Concrete Steps

These are the next practical steps I would take in this repo.

1. Create a new backend package structure beside the current legacy routes.
2. Define canonical schemas for `projects`, `assets`, `findings`, `artifacts`, `tasks`, and `task_events`.
3. Add a new `/tasks` API with create/list/detail endpoints.
4. Add a new task history page or adapt the current scans page to read `tasks`.
5. Build one ingestion path for findings and screenshots.
6. Implement an `agent` service with one worker that can process a queued task.
7. Convert one workflow end to end, ideally: "enumerate scope and enrich assets".
8. Update the UI to submit that workflow as a task rather than calling `run/subfinder` and `run/httpx` directly.
9. Add task event streaming or polling for status updates.
10. Mark legacy scan endpoints as deprecated and stop adding features to them.

---

## Recommended First Agent Workflow

Start with one narrow workflow:

- input: domain or scope
- agent actions:
  - enumerate candidates
  - probe HTTP
  - store live assets
  - capture screenshots for live web assets
- output:
  - normalized assets
  - screenshots
  - task history

Why this first:

- it creates visible UI value quickly
- it exercises tasking, execution, artifact storage, and ingest
- it avoids starting with the most complex finding normalization path

Then add:

- vulnerability scan workflow
- project analysis workflow
- recommended next-action workflow

---

## Approval Model

If you want the product to feel agent-driven without becoming dangerous, add an approval model early.

Task types:

- auto-approved:
  - read-only enrichment
  - screenshot capture
  - finding summarization
- approval-required:
  - broad or expensive scans
  - actions against sensitive/internal targets
  - actions that exceed cost/time thresholds

This gives you:

- a safer UX
- better auditability
- a clean place for human-in-the-loop interaction

---

## Risks To Avoid

### 1. Rebuilding The Old System Under A New Name

If the API still owns tool execution, you have not actually migrated architecture.

### 2. Letting The Agent Become The Only Source Of Truth

Agent output should be persisted as structured product data.

The DB/API should remain the canonical source of truth for the UI.

### 3. Starting With Too Much AI Complexity

Do not start with:

- multiple agents
- autonomous branching workflows
- a heavy planner framework

Start with:

- one worker
- explicit task types
- deterministic tool wrappers
- structured ingest

### 4. Keeping Tool-Centric UX Forever

Your desired product is outcome-centric, not tool-centric.

That means the UI should gradually shift from:

- "run nuclei"

to:

- "analyze this project for high-risk findings"

---

## Decision Summary

Best path:

- keep the frontend and product model
- create a new backend architecture in stages
- move scan execution and orchestration into a separate agent service
- migrate the UI to task-based workflows
- retire direct scan execution after the new path is proven

If you want to build the product you described, this is the right compromise between speed and correctness.

---

## Suggested Next Implementation Doc

After this plan, the next document should be a more tactical build sheet:

- exact backend module layout
- exact DB schema
- exact first task API contract
- exact first agent workflow
- exact cutover plan for the current `Scans` page

That should be the implementation blueprint for Phase 1 and Phase 2.
