# Type-S Agent Phase 2 Plan

Date: 2026-03-11

## Purpose

Phase 1 established the v2 data model, task API, worker, and default task-first UI.

Phase 2 should finish the architectural cutover.

The goal is not to add another parallel layer.

The goal is to make the app operationally and structurally v2-first, while reducing the amount of legacy code that still has to exist in the normal runtime.

---

## Phase 2 Goal

Ship Type-S as a v2-first product where:

- the live backend runtime is centered on `backend/app`
- the default frontend no longer depends on legacy-vs-v2 branching for normal behavior
- the remaining legacy API surface is compatibility-only, not part of the primary application flow
- agent tasks, assets, findings, artifacts, and overview data are the canonical product model everywhere

Short version:

- move the runtime to v2
- remove default legacy fallbacks
- make the UI explicitly task-native
- leave legacy support only where it still has migration value

---

## Current Baseline

Phase 1 is complete enough to support this cutover:

- `/v2` already has working routes for projects, tasks, assets, findings, artifacts, analytics, and exports
- the worker already executes `enumerate_scope` and `run_findings_scan`
- the default UI already reads mostly from `/v2`
- project and asset mutation paths now also exist on `/v2`
- legacy data import already exists for testing and migration seeding

What still anchors the app to the old shape:

- compatibility cleanup and import tooling still touch legacy collections for migration safety
- several UI screens are still legacy-era shells adapted to v2 data rather than truly v2-native screens

---

## Phase 2 Scope

In scope:

- move the live backend entrypoint toward `backend/app`
- migrate auth/session endpoints into the v2 backend structure
- remove default frontend dependence on legacy API branches
- reduce or isolate legacy scan/subdomain endpoints
- make task workflows the only first-class execution path in the UI
- tighten automated coverage around the v2 runtime and cutover paths
- improve operator safety for deployment and rollback

Out of scope:

- replacing MongoDB
- introducing a full distributed workflow engine
- building a multi-agent planning system
- large new product areas unrelated to cutover
- redesigning the entire UI from scratch

---

## Success Criteria

Phase 2 is done when all of the following are true:

- the main Docker/backend runtime boots from the v2 application structure, not the legacy monolith
- auth, project reads/writes, task operations, assets, findings, artifacts, analytics, and exports all live in the v2 application layer
- the default frontend contains no normal-path dependency on legacy-vs-v2 mode switches
- the default frontend contains no normal-path calls to legacy `/projects/*/run/*`, `/scans/*`, `/subdomains/*`, `/results`, or legacy stats/graph endpoints
- legacy endpoints, if retained, are explicitly compatibility-only and not used by the default UI
- the task workspace is the only execution surface presented to users
- test coverage includes v2 route coverage, worker coverage, and runtime smoke coverage for the deployed stack

---

## Workstreams

### 1. Backend Runtime Cutover

Objective:

- keep all live backend behavior centered on `backend/app`

Deliverables:

- create a single primary FastAPI app under `backend/app`
- move shared middleware, CORS, OpenAPI config, health routes, and dependency wiring into the v2 app layer
- migrate auth/session routes into `backend/app/api/routes`
- move login/logout/check-auth/check-account/register/change-password into the new app structure
- update Docker to run the v2 app entrypoint directly

Recommended approach:

1. build `backend/app/api/routes/auth.py`
2. centralize app construction in `backend/app/main.py`
3. verify nginx/frontend behavior against the new runtime
4. remove redundant top-level backend entrypoints once the repo no longer imports them

Definition of done:

- the live container command no longer depends on the legacy monolith as the primary app

### 2. Frontend Legacy Branch Retirement

Objective:

- remove the feature-flag and fallback shape from the normal UI path

Primary seams still visible now:

- route naming and copy still carry some scan-era language
- `frontend/src/Scans.jsx`
- `frontend/src/ModernDashboard.jsx`
- `frontend/src/Vulnerabilities.jsx`
- `frontend/src/Screenshots.jsx`
- `frontend/src/ProjectOverview.jsx`
- `frontend/src/ModernProjects.jsx`
- `frontend/src/hooks/useProjectData.js`
- `frontend/src/hooks/useQueryHooks.js`
- `frontend/src/hooks/useBulkOperations.js`

Deliverables:

- remove the last scan-era shell assumptions from the default build
- keep current v2 behavior as the only supported app behavior
- move any remaining legacy-only compatibility actions behind explicit maintenance tooling or remove them
- delete dead legacy hook code once no longer referenced

Definition of done:

- the shipped frontend bundle is task-native and no longer organized around scan-era fallback behavior

### 3. Legacy API Isolation

Objective:

- prevent the remaining compatibility-only legacy behaviors from continuing to shape the product architecture

Remaining compatibility seams:

- legacy-to-v2 import tooling
- project-deletion cleanup of imported legacy `subdomains` and `scans`
- historical docs that still reference the old route families as if they were live runtime behavior

Deliverables:

- keep compatibility-only behaviors isolated in explicit helper/modules
- avoid reintroducing any legacy execution route families into the live runtime
- define the retirement path for importer/cleanup behavior once migration value is low enough

Definition of done:

- compatibility-only legacy behavior is narrow, explicit, and easy to remove later

### 4. Task Workspace Maturity

Objective:

- make the task workspace clearly better than the old scans page, so deleting the old model is safe

Deliverables:

- tighten task terminology and UX across the app
- expose richer task provenance:
  - assigned worker/agent
  - task source
  - retries
  - import provenance
- decide whether `/project/:id/scans` stays as a compatibility URL or becomes `/project/:id/tasks`
- ensure every user-triggered execution path queues a task rather than launching a scan directly

Definition of done:

- users can understand and operate the system entirely in task terms without needing the old scan vocabulary

### 5. Data and Migration Safety

Objective:

- make the cutover safe for real data, not just greenfield or imported test data

Deliverables:

- keep the legacy-to-v2 importer idempotent and documented
- add a small verification utility or checklist for comparing legacy vs v2 counts per project
- define rollback rules for the runtime cutover
- make artifact storage and project deletion behavior explicit in docs and tests

Definition of done:

- there is a documented way to seed, verify, and if necessary revert the runtime cutover without corrupting data

### 6. Test and Release Hardening

Objective:

- make the v2 runtime safe to ship as the main app

Deliverables:

- add route-level coverage for auth/session once migrated
- add end-to-end smoke checks for:
  - login
  - project create/delete
  - task queue -> worker pickup -> completion
  - findings triage
  - export download
- add a deployment verification checklist for Docker/nginx/frontend/backend alignment
- address the oversized frontend bundle enough to remove obvious operational risk

Definition of done:

- the deployable app can be validated with a short repeatable smoke suite

---

## Recommended Execution Order

### Milestone 1: Runtime Preparation

- move auth/session routes into `backend/app`
- centralize app creation and middleware in the v2 app layer
- add tests for the migrated auth/runtime behavior

### Milestone 2: Backend Switch

- point Docker at the new main app
- keep a short compatibility bridge if needed
- verify login, task flow, and project CRUD against the switched runtime

### Milestone 3: Frontend Branch Removal

- remove legacy mode-switch dependence from standard screens
- remove dead legacy hook and modal files that only existed for the scan-era path
- delete dead legacy fallback logic
- keep only explicit compatibility views if still needed

### Milestone 4: Legacy Isolation

- move retained legacy endpoints behind a compatibility namespace or compatibility module
- remove unused legacy route families
- update docs to describe the runtime as v2-first

### Milestone 5: Release Hardening

- extend smoke coverage
- document rollback and data verification
- tune bundle size and deployment checks

---

## Concrete First Tasks

1. Move the remaining security helpers fully under `backend/app`.
2. Remove redundant backend entrypoints so tests and runtime share the same primary app.
3. Continue deleting dead frontend compatibility files once the normal-path references are gone.
4. Isolate compatibility-only backend behaviors that still touch legacy collections.
5. Decide whether to rename the scans route to tasks or keep `/scans` as a stable URL with task-native UI.
6. Add a deploy smoke script/checklist and record the runtime switch procedure.
7. Add route/runtime smoke coverage for the deployed stack entrypoints.
8. Tighten the remaining docs so they describe the app as v2-first instead of feature-flagged.
9. Audit bundle-size hotspots and split the largest frontend chunks.
10. Define the final removal window for the remaining compatibility-only backend behaviors that still touch legacy collections.

---

## Risks

### Auth Regression

Risk:

- the backend runtime switch breaks cookies, session checks, or nginx proxy assumptions

Mitigation:

- move auth first
- keep exact cookie behavior during migration
- verify from both local and remote browser contexts

### Hidden Legacy Dependency

Risk:

- a page still calls a legacy endpoint that is easy to miss until after runtime cutover

Mitigation:

- search for all legacy endpoint patterns before each milestone
- keep route-level request coverage for the main screens

### Data Divergence

Risk:

- legacy data and v2 data drift during a partial cutover period

Mitigation:

- treat v2 as canonical for all default UI behavior
- keep importer one-way
- avoid writing back from v2 into legacy collections except explicit compatibility cleanup behavior

### Operational Ambiguity

Risk:

- it becomes unclear whether a bug lives in legacy runtime, mounted v2 routes, nginx, or the worker

Mitigation:

- reduce mixed-runtime behavior quickly
- document the new primary entrypoint and compatibility boundaries clearly

---

## Definition Of Done For The Repo

When Phase 2 is complete, the repo should look like this conceptually:

- `backend/app/` is the real application
- top-level backend runtime shims are gone
- legacy scan/subdomain/result routes are isolated and clearly temporary
- the frontend is task-native without normal-path v2/legacy branching
- the progress docs describe the system as v2-first, not “v2 mounted inside legacy”

---

## Recommended Outcome After Phase 2

After Phase 2, Type-S should be in a state where:

- a user experiences the app as an agent-backed task platform
- the backend architecture matches that mental model
- legacy compatibility is optional cleanup work, not a core runtime dependency

That is the right point to start a narrower Phase 3 focused on product depth:

- richer agent workflows
- approvals and assignment UX
- better search, triage, and reporting
- more capable task types
