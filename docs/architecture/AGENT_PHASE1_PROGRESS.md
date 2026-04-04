# Type-S Agent Phase 1 Progress

Date: 2026-03-08

Note:

- this document includes historical migration steps from when the frontend still carried an explicit legacy fallback mode
- the current app no longer uses `VITE_USE_TASKS_UI` in the frontend source
- references to that flag below are historical checkpoints, not current runtime instructions

## Completed In This Slice

- backed the v2 task API with real MongoDB collections:
  - `v2_tasks`
  - `v2_task_events`
- backed the v2 asset API with a real MongoDB collection:
  - `v2_assets`
- backed the v2 findings API with a real MongoDB collection:
  - `v2_findings`
- backed the v2 artifact API with a real MongoDB collection plus file-backed storage:
  - `v2_artifacts`
  - `/app/data/v2_artifacts`
- replaced the manual-only task startup model with an autonomous worker service:
  - `agent-worker` polls for queued tasks
  - claims the next supported task atomically
  - executes the first workflow without a user-triggered `/run`
- implemented authenticated v2 project reads on top of the current projects collection:
  - `GET /v2/projects`
  - `GET /v2/projects/{project_id}`
  - `GET /v2/projects/{project_id}/overview`
- added project ownership checks for all implemented v2 task routes by reusing the current authenticated project model
- added project ownership checks for the new v2 findings route
- implemented:
  - `POST /v2/projects/{project_id}/tasks`
  - `GET /v2/projects/{project_id}/tasks`
  - `GET /v2/tasks/{task_id}`
  - `GET /v2/tasks/{task_id}/events`
  - `POST /v2/tasks/{task_id}/run`
  - `GET /v2/projects/{project_id}/assets`
  - `GET /v2/projects/{project_id}/findings`
  - `GET /v2/projects/{project_id}/artifacts`
  - `GET /v2/projects/{project_id}/artifacts/by-id/{artifact_id}/content`
- persisted an initial `task.created` event when a task is created
- added a background worker path for `enumerate_scope`
- added a background worker path for `run_findings_scan`
- added normalized asset ingestion from the first workflow into `v2_assets`
- added normalized findings ingestion from nuclei output into `v2_findings`
- normalized default-port target URLs and finding identities so `https://host` and `https://host:443` do not create duplicate findings
- added file-backed artifact ingestion from the first workflow into `v2_artifacts`
- added screenshot artifact ingestion for `enumerate_scope` when `include_screenshots=true`
- added raw target and raw nuclei output artifacts for `run_findings_scan`
- added task result summaries and failure fields so the UI can read workflow outcomes
- added typed task enums for:
  - task type
  - task status
  - approval mode
- exposed the v2 task routes through the current running backend under `/v2` without changing the main legacy scan endpoints
- exposed real v2 project, asset, finding, task, and artifact routes through the current running backend under `/v2`
- added app-lifecycle Mongo wiring for the v2 backend path so the new code does not rely on a module-global Motor client
- added a feature-flagged frontend adapter in `frontend/src/Scans.jsx`:
  - `VITE_USE_TASKS_UI=false` forces the legacy scan history behavior
  - the default frontend path now reads `/v2/projects/:id/tasks`
  - early migration fallback behavior has since been removed from the default path
- added a task-details modal in the tasks UI path:
  - shows result summary
  - shows task events
  - shows task artifacts with links to raw artifact content
- added a feature-flagged frontend adapter in `frontend/src/Vulnerabilities.jsx`:
  - the default frontend path now reads `/v2/projects/:id/findings`
  - `VITE_USE_TASKS_UI=false` retains the legacy vulnerabilities view
- added a minimal findings-task creation action in the vulnerabilities UI:
  - queue `run_findings_scan` directly from the page
  - keep the legacy path untouched when the migration flag is disabled
- added v2 finding triage mutation support:
  - `PATCH /v2/projects/{project_id}/findings/{finding_id}`
  - `triage_status` now supports `new`, `acknowledged`, `in_progress`, `resolved`, and `false_positive`
- added inline triage controls in the v2 vulnerabilities UI path
- added a v2 project overview endpoint backed by `v2_assets`, `v2_findings`, and `v2_tasks`
- moved `frontend/src/ProjectOverview.jsx` onto the v2 overview route behind the migration flag:
  - shows asset, vulnerability, and task counts from v2
  - shows recent v2 task activity
  - falls back to legacy stats and scan history when no v2 overview data exists
- extended the v2 asset model and API with richer dashboard-facing fields:
  - `status_code`
  - `title`
  - `webserver`
  - `screenshot_storage_key`
- added v2 asset mutation routes:
  - `POST /v2/projects/{project_id}/assets/tags`
  - `DELETE /v2/projects/{project_id}/assets/tags`
  - `POST /v2/projects/{project_id}/assets/delete`
- moved the dashboard asset data seam onto v2 under the migration flag:
  - `frontend/src/hooks/useProjectData.js` now adapts `v2_assets`, `v2_findings`, and screenshot artifacts into the current table model
  - bulk tag and delete actions now use v2 asset routes when the dashboard is in v2 mode
  - screenshot previews can load directly from v2 artifact content URLs
- moved `frontend/src/Screenshots.jsx` onto v2 screenshot artifacts behind the migration flag with a legacy fallback
- added a shared frontend adapter utility in `frontend/src/utils/v2Data.js` for normalized v2-to-UI mapping
- added a v2 analytics route backed by `v2_assets` and `v2_findings`:
  - `GET /v2/projects/{project_id}/graph-data`
  - supports `severity_summary`, `vulnerability_distribution`, `ports_summary`, `anomalies`, `waf_detection`, and `technology_summary`
- moved the shared query/graph hooks onto the v2 analytics path behind the migration flag:
  - `frontend/src/hooks/useQueryHooks.js` now uses `/v2/projects/:id/overview`, `/v2/projects/:id/graph-data`, and v2 asset/finding/artifact pagination in the default UI
- added a task capability catalog endpoint:
  - `GET /v2/task-capabilities`
- made the backend authoritative for Phase 1 task creation:
  - unsupported task types now return `400` instead of silently queueing work the worker cannot execute
  - task inputs are normalized before persistence
  - labels can now be auto-generated when the client omits them
- moved `frontend/src/Scans.jsx` from a passive task-history adapter to an actual v2 task workspace:
  - task-first default behavior, with legacy scan history retained only as an explicit fallback mode
  - built-in task composer for `enumerate_scope`
  - built-in task composer for `run_findings_scan`
  - richer findings-scan inputs for hostnames, asset IDs, template/tag filters, severities, ports, and runtime knobs
- added a first backend smoke test module using `unittest`:
  - `backend/tests/test_task_catalog.py`
  - covers supported-task discovery and request normalization/validation for Phase 1 task creation
- added broader containerized backend integration coverage:
  - `backend/tests/test_analytics_service.py`
  - `backend/tests/test_task_service.py`
  - `backend/tests/test_export_service.py`
- added a v2 export/report path backed by `v2_assets` and `v2_findings`:
  - `GET /v2/projects/{project_id}/exports/results.csv`
  - `GET /v2/projects/{project_id}/exports/results.md`
- updated `frontend/src/Downloads.jsx` so export requests switch to the new `/v2` export routes in the default UI
- added pragmatic Phase 1 task-control actions:
  - `POST /v2/tasks/{task_id}/cancel`
  - `POST /v2/tasks/{task_id}/retry`
- extended task cancellation semantics for work already picked up by the worker:
  - added `cancelling` as an intermediate task status
  - added `task.cancellation_requested` as a first-class task event
  - running tasks now stop cooperatively at safe checkpoints instead of only before pickup
  - long-running external commands are polled for cancellation and killed when a cancellation request is observed
- wired the scans task workspace to the new task-control actions:
  - queued tasks can be cancelled from the table
  - completed, failed, and cancelled tasks can be re-queued from the table
- updated the scans task workspace so cancel feedback reflects `cancelling` vs `cancelled`, and task-mode status filters now include pending, cancelling, and cancelled states
- expanded backend service coverage again:
  - `backend/tests/test_task_service.py` now covers cancel and retry flows
  - `backend/tests/test_worker_service.py` now covers cooperative cancellation after worker pickup for both `enumerate_scope` and `run_findings_scan`
- added in-process route-level coverage for the mounted v2 HTTP surface:
  - `backend/tests/test_task_api_routes.py`
  - `backend/tests/test_data_api_routes.py`
  - `backend/tests/api_base.py`
- added a real-time task event stream endpoint:
  - `GET /v2/tasks/{task_id}/events/stream`
- wired the scans task-details modal to subscribe to the task event stream while it is open:
  - detail, event, artifact, and task-list state now refresh from live task events instead of relying only on periodic polling
- moved more project metadata reads onto `/v2` behind the migration flag:
  - `frontend/src/ModernProjects.jsx` now uses `/v2/projects` and `/v2/projects/{project_id}/overview` for project cards in the default UI
  - `frontend/src/contexts/ProjectContext.jsx` now resolves project detail from `/v2/projects/{project_id}` when the flag is enabled
  - `frontend/src/hooks/useQueryHooks.js` now normalizes `useProjects()` around `/v2/projects` when the flag is enabled
- removed more silent legacy fallbacks from the v2 migration path:
  - `frontend/src/Vulnerabilities.jsx` now stays on `/v2/projects/{project_id}/findings` when the flag is enabled and shows a findings-first empty state instead of dropping back to legacy results
  - `frontend/src/ProjectOverview.jsx` now stays on `/v2/projects/{project_id}/overview` when the flag is enabled and shows task-oriented empty states instead of falling back to legacy overview endpoints
  - `frontend/src/Screenshots.jsx` now stays on v2 screenshot artifacts when the flag is enabled instead of falling back to legacy screenshot paths
  - `frontend/src/hooks/useProjectData.js` now keeps the main assets/dashboard view on `v2_assets`, `v2_findings`, and v2 screenshot artifacts when the flag is enabled, even when the project is currently empty
- replaced task-mode polling in the scans history table with event-driven refresh for active tasks:
  - `frontend/src/Scans.jsx` now opens task event streams for non-terminal tasks
  - legacy scan history still uses the 5-second poll loop
  - task list refresh is now driven by `task_event` and `task_terminal` frames instead of a task-mode interval
- completed the first frontend cutover from migration flag to default behavior:
  - `VITE_USE_TASKS_UI` now defaults to the v2 task/data experience unless explicitly set to `false`
  - the main `/project/:id/scans` screen is now a task-first screen in the default UI
  - legacy scan history remains available only as an explicit fallback path when the env flag is disabled
  - navigation and user-facing copy now label the default workflow as `Tasks` instead of `Scans`
- added a one-way legacy import utility for seeding v2 with real data:
  - [backend/scripts/migrate_legacy_data_to_v2.py](backend/scripts/migrate_legacy_data_to_v2.py)
  - reuses `projects`, transforms legacy `subdomains` into `v2_assets`, flattens embedded vulnerabilities into `v2_findings`, and can backfill screenshot artifacts
  - creates a synthetic completed `Legacy Data Import` task per migrated project so imported data has task/artifact provenance in the v2 UI
- executed the legacy import across the current database for testing:
  - seeded `v2_assets` with 1006 assets
  - seeded `v2_findings` with 269 findings from 270 legacy vulnerability records, with 1 record deduped by the v2 finding identity rules
  - seeded `v2_artifacts` with 328 screenshot artifacts
  - seeded `v2_tasks` with 10 synthetic `Legacy Data Import` tasks plus matching task events

## What Is Still Placeholder

- task assignment controls
- dedicated v2 task/project screens outside the legacy shells
- broader API-route and worker-path coverage beyond the current service/in-process/live checks
- full retirement of the remaining legacy shells once the explicit fallback mode is no longer needed

## Current Behavior

- the live app still runs on the legacy FastAPI entrypoint, but the default frontend project experience now reads the v2 task/data model
- task history, assets, findings, artifacts, overview, analytics, project metadata, and exports now default to `/v2`
- `/project/:id/scans` is now the default task workspace and history screen
- the vulnerabilities, overview, dashboard/assets, screenshots, analytics, projects list, and project context now default to the v2 read path
- legacy scan history and legacy read paths remain available only when `VITE_USE_TASKS_UI=false` is set explicitly
- queued v2 tasks can now be started through `/v2/tasks/{task_id}/run`
- queued v2 tasks are also picked up automatically by the `agent-worker` service
- queued `run_findings_scan` tasks scan existing `v2_assets` and write normalized findings plus raw artifacts
- v2 findings can now be triaged directly from the default vulnerabilities screen
- supported Phase 1 task types are now discoverable through `/v2/task-capabilities`
- queued tasks can now be cancelled before worker pickup
- running and ingesting tasks can now enter `cancelling` and stop at the next worker checkpoint
- completed, failed, and cancelled tasks can now be re-queued as a fresh task
- the task-details modal can now subscribe to a server-sent event stream for task progress while it is open
- the projects list and project context now read v2 project metadata by default
- the vulnerabilities, overview, screenshots, and dashboard data paths now stay on v2 data by default instead of silently falling back to legacy result models
- the task history table now uses task event streams for active task refresh; the 5-second interval is only retained for legacy scan history
- the first workflow currently uses a pragmatic fallback:
  - if `subfinder` times out, the task continues with the root domain as an asset candidate
  - if `httpx` fails, the task still completes with enumeration-only assets
- the first workflow now leaves behind:
  - normalized assets
  - raw JSON artifacts
  - a task summary artifact
  - screenshot artifacts when enabled
- the findings workflow now leaves behind:
  - normalized findings
  - raw nuclei target lists
  - raw nuclei JSON output
  - a task summary artifact

## Verification

- `python3 -m py_compile backend/main.py backend/auth.py $(find backend/app -name '*.py' | sort)` passed
- `docker compose exec -T backend python -m unittest discover -s tests -v` passed
- `npm run build` passed in `frontend/`
- live HTTP verification against the running backend succeeded for:
  - create task
  - automatic worker pickup without manual `/run`
  - poll task detail to completion
  - get task events
  - list ingested assets
  - list artifacts
  - fetch artifact content
  - create screenshot artifacts when requested
- live HTTP verification against the running backend also succeeded for:
  - create `run_findings_scan` task
  - automatic worker pickup for findings scans
  - poll task detail to completion with findings counts
  - list normalized findings from `/v2/projects/{project_id}/findings`
  - list findings-task artifacts
  - inspect findings-task events
  - patch a finding from `new` to `resolved`
  - filter resolved findings via `triage_status=resolved`
  - fetch `/v2/projects/{project_id}/overview` with expected asset, finding, and task counts
  - fetch all six `/v2/projects/{project_id}/graph-data` graph types with seeded v2 assets and findings
  - fetch `/v2/projects/{project_id}/assets` with enriched dashboard fields
  - fetch screenshot artifact content with `200 OK`
  - add and remove v2 asset tags through the new mutation routes
  - delete a v2 asset and confirm its related findings, artifacts, and screenshot file are removed
  - fetch `/v2/task-capabilities` and confirm the worker-supported task catalog
  - reject an unsupported task type with `400`
  - create `enumerate_scope` without a label and verify auto-generated label plus normalized requested input
  - create `run_findings_scan` without a label and verify auto-generated label plus normalized requested input
  - fetch `/v2/projects/{project_id}/exports/results.csv` with seeded v2 assets and findings
  - fetch `/v2/projects/{project_id}/exports/results.md` with seeded v2 assets and findings
  - create a queued task, cancel it through `/v2/tasks/{task_id}/cancel`, and verify a `task.cancelled` event
  - retry the cancelled task through `/v2/tasks/{task_id}/retry` and verify the new task is picked up and completed by the worker
- cooperative cancellation verification was added to automated coverage:
  - start a claimed task in the worker test harness
  - request cancellation after pickup
  - verify `task.cancellation_requested`
  - verify final `task.cancelled`
  - verify no assets are ingested after the cancellation path
- live HTTP verification against the running backend also succeeded for cooperative cancellation after worker pickup:
  - queue `enumerate_scope`
  - wait for the worker to move it to `running`
  - cancel it through `/v2/tasks/{task_id}/cancel`
  - verify the immediate API response is `cancelling`
  - verify the final terminal state is `cancelled`
  - verify the event stream includes `task.cancellation_requested` followed by `task.cancelled`
- live HTTP verification against the running backend also succeeded for the SSE route:
  - queue a task
  - cancel it into a terminal state
  - fetch `/v2/tasks/{task_id}/events/stream`
  - verify the stream emits `task_event` frames for historical events
  - verify the stream emits a final `task_terminal` frame with the terminal task snapshot
- route-level verification now covers:
  - task create, list, detail, cancel, retry, run, and event stream routes
  - project list/detail/overview and graph-data routes
  - asset list, tag mutation, and delete routes
  - findings list/filter and triage patch routes
  - v2 CSV and Markdown export routes
  - owner-scope rejection on task and data routes
- deterministic findings verification used:
  - asset: `petstore.swagger.io`
  - template: `/root/nuclei-templates/http/exposures/apis/swagger-api.yaml`
  - result: 1 normalized finding inserted from 1 normalized target URL
- the temporary verification project and artifacts were removed after the check

## Next Recommended Slice

1. replace the remaining migration-flag structure with dedicated v2-first navigation and screens once we are ready to make v2 the default experience
2. add broader live-agent semantics such as task assignment controls, richer agent provenance, and clearer task intent/approval UX
3. move any remaining legacy mutation paths that still target subdomains/scans onto explicit v2 task or asset APIs
4. decide whether the legacy scan history surface should be retired entirely once the v2 task workspace is complete
5. decide whether Phase 2 needs true mid-step interruption beyond the current safe-checkpoint model for ingestion-heavy tasks

## Runtime Stabilization

- fixed a frontend runtime regression on `/project/:projectId/assets` where `ModernDashboard` could trip an `Invalid hook call` / `Cannot read properties of null (reading 'useState')` failure after dev-server HMR churn
- removed the direct `useNotifications()` dependency from `ModernDashboard` and kept notification state local to the route component
- split context hooks into dedicated modules:
  - [frontend/src/contexts/useProject.js](frontend/src/contexts/useProject.js)
  - [frontend/src/contexts/useSidebar.js](frontend/src/contexts/useSidebar.js)
  - [frontend/src/contexts/useTheme.js](frontend/src/contexts/useTheme.js)
- left provider components in:
  - [frontend/src/contexts/ProjectContext.jsx](frontend/src/contexts/ProjectContext.jsx)
  - [frontend/src/contexts/SidebarContext.jsx](frontend/src/contexts/SidebarContext.jsx)
  - [frontend/src/contexts/ThemeContext.jsx](frontend/src/contexts/ThemeContext.jsx)
- updated project/dashboard/layout imports to use the dedicated hook modules so Vite Fast Refresh has stable module boundaries during ongoing development
- verification:
  - `npm run build` passed after the refactor
  - `docker compose restart frontend nginx` completed cleanly
  - nginx is serving the updated `ModernDashboard.jsx` source that imports the split hook modules

## Frontend Serving Stabilization

- moved the live frontend off the Vite dev server path and onto a built static bundle
- updated [docker-compose.yml](docker-compose.yml) so the `frontend` service now runs `npm run build && serve -s dist -l 3001`
- updated [frontend/Dockerfile](frontend/Dockerfile) so the container defaults to serving `dist` instead of starting `vite --host`
- this removes the live `/src/*`, `/@vite/*`, and `node_modules/.vite/*` module graph from the deployed app and avoids the mixed optimized-dependency state that was causing the React invalid-hook crash in the browser
- verification:
  - `docker compose exec -T frontend ps -ef` shows `node /usr/local/bin/serve -s dist -l 3001`
  - `curl http://127.0.0.1/` now returns HTML that references fingerprinted `/assets/index-*.js`

## Vulnerabilities Pagination Fix

- fixed the v2 vulnerabilities screen so it no longer requests `/v2/projects/{project_id}/findings?page=1&page_size=5000`
- updated [frontend/src/Vulnerabilities.jsx](frontend/src/Vulnerabilities.jsx) to page through findings at the backend-supported limit of `500`
- verification:
  - `npm run build` passed
  - the live HTML now references the rebuilt frontend bundle `/assets/index-C-PD4Lgf.js`
  - the shipped vulnerabilities code now uses `findings?page=${page}&page_size=${V2_PAGE_SIZE}`

## Remote Login API Base Fix

- fixed a frontend deployment regression where the shipped bundle was still using `http://localhost:8000` for auth and logout requests
- root cause: [frontend/.env.local](frontend/.env.local) overrode the intended `/api` base during production bundle builds
- updated [frontend/.env.local](frontend/.env.local) to `VITE_API_BASE_URL=/api`
- verification:
  - `npm run build` passed
  - the live HTML now references `/assets/index-CIKBt5wz.js`
  - the rebuilt bundle contains `/api/login`, `/api/check-auth`, and `/api/logout`
  - the rebuilt bundle contains no `http://localhost:8000`

## Default Cutover Hardening

- closed two more default-path legacy seams so the v2 experience is less dependent on old project and asset mutations
- added a v2 manual asset import route:
  - `POST /v2/projects/{project_id}/assets/import`
  - accepts hostname and/or IP pairs for direct asset seeding from the default assets screen
- made manual asset import non-destructive:
  - repeated imports now merge `ip_addresses`
  - existing enrichment is preserved instead of being wiped
  - preserved fields include `primary_url`, `status_code`, `title`, `webserver`, screenshot linkage, ports, technologies, tags, and `source_task_id`
- extended route coverage for the new asset import behavior:
  - repeated import of the same hostname no longer clears prior IP data
  - import over an already-enriched asset now keeps the enriched fields intact
- pushed the default assets screen further onto v2 behavior:
  - the default empty-state actions now center on queuing discovery work and importing manual assets
  - the custom action modal now queues `enumerate_scope` and `run_findings_scan` tasks in the default UI
  - the selected-assets modal now queues a findings task instead of launching legacy scans in the default UI
  - the manual asset modal now uses v2-oriented copy in the default UI
- added v2 project mutation routes so the default projects screen no longer has to create/delete through the legacy API:
  - `POST /v2/projects`
  - `DELETE /v2/projects/{project_id}`
- v2 project deletion now performs a full project cleanup:
  - removes the canonical `projects` record
  - removes legacy `subdomains` and `scans`
  - removes `v2_assets`, `v2_findings`, `v2_artifacts`, `v2_tasks`, and `v2_task_events`
  - removes the project artifact directory under `/app/data/v2_artifacts/{project_id}`
- updated [frontend/src/ModernProjects.jsx](frontend/src/ModernProjects.jsx) so the default UI now uses the new v2 project create/delete routes
- verification:
  - `python3 -m py_compile backend/main.py backend/auth.py $(find backend/app -name '*.py' | sort) $(find backend/tests -name '*.py' | sort)` passed
  - `docker compose exec -T backend python -m unittest discover -s tests -v` passed with `31` tests
  - `npm run build` passed
  - `docker compose restart backend frontend nginx` completed cleanly
  - `curl http://127.0.0.1/health` returned `200`
  - `curl http://127.0.0.1/` returned `200`
