# Agent Phase 2 Progress

## Status

Phase 2 is in progress.

The main runtime cutover is now real:

- the live backend runs from `backend/app/main.py`
- auth/session routes and security helpers needed by the frontend now live under `backend/app`
- the default frontend no longer depends on the retired `VITE_USE_TASKS_UI` flag
- the default project UX is now task-first without a legacy mode switch in the active app path

## Completed Work

### 1. Backend runtime cutover

Added a real application entrypoint in `backend/app/main.py` and switched the live backend runtime from `main:app` to `app.main:app`.

This app now mounts:

- root routes and health
- protected docs/openapi routes
- auth/session routes used by the frontend
- nuclei template metadata route
- the existing `/v2` router tree

The old top-level backend entrypoints have now been retired from the repo. The runtime and tests both point directly at `backend/app/main.py`.

Related files:

- `backend/app/main.py`
- `backend/app/core/security.py`
- `backend/app/api/routes/auth.py`
- `backend/app/api/routes/nuclei.py`
- `backend/app/services/auth.py`
- `backend/app/schemas/auth.py`
- `backend/app/api/dependencies.py`
- `backend/tests/test_auth_api_routes.py`
- `backend/Dockerfile`
- `docker-compose.yml`

### 1a. Backend compatibility pruning

Removed the extra `backend/app/main_v2.py` entrypoint and then retired the old top-level `backend/main.py` and `backend/auth.py` shims once the repo no longer imported them.

Also moved JWT/password helpers and `get_current_user` into `backend/app/core/security.py`, so the v2 runtime no longer depends on a separate standalone auth module.

Concrete effect:

- the application runtime owns its security layer inside `backend/app`
- tests now execute against the same primary app entrypoint the live container uses
- the old top-level entrypoints are no longer a second source of truth

### 1b. Compatibility cleanup isolation

The remaining legacy-data cleanup path is now isolated in `backend/app/services/compatibility.py`.

`ProjectService` no longer reaches into legacy collections directly. It delegates the old `subdomains` and `scans` deletion behavior to an explicit compatibility helper that exists only to clean up imported legacy data during project deletion.

Concrete effect:

- the core project service stays focused on canonical v2 collections
- compatibility behavior is easy to audit and remove later
- the remaining legacy backend seam is now narrow and explicit

### 2. Frontend default-path cutover

Removed the `VITE_USE_TASKS_UI` branch from the active frontend surface.

The following files are now v2-only in normal behavior:

- `frontend/src/Downloads.jsx`
- `frontend/src/components/Breadcrumbs.jsx`
- `frontend/src/contexts/ProjectContext.jsx`
- `frontend/src/ModernProjects.jsx`
- `frontend/src/ProjectOverview.jsx`
- `frontend/src/hooks/useQueryHooks.js`
- `frontend/src/hooks/useProjectData.js`
- `frontend/src/hooks/useBulkOperations.js`
- `frontend/src/Vulnerabilities.jsx`
- `frontend/src/Screenshots.jsx`
- `frontend/src/components/Sidebar.jsx`
- `frontend/src/ModernDashboard.jsx`
- `frontend/src/Scans.jsx`

Concrete effect:

- project list and project reads are `/v2`
- overview/stats are `/v2`
- assets/findings/screenshots/exports are `/v2`
- dashboard asset mutations are `/v2`
- tasks page is permanently task-first in the shipped UI
- the dashboard no longer exposes the old scan-engine branch in the default path

### 2a. Dead legacy code pruning

Removed frontend files that no longer have any runtime references after the Phase 2 cutover:

- `frontend/src/hooks/useScanEngine.js`
- `frontend/src/hooks/useNaabuConfig.js`
- `frontend/src/hooks/useScheduler.js`
- `frontend/src/hooks/useNotifications.js`
- `frontend/src/hooks/useFindings.js`
- `frontend/src/hooks/useVulnFilters.js`
- `frontend/src/components/Dashboard/SchedulerModal.jsx`
- `frontend/src/components/Dashboard/NaabuConfigModal.jsx`

These files were either scan-era compatibility code or unused migration leftovers. They are no longer part of the shipped app path.

### 3. Frontend runtime serving

The frontend is being served as a production build instead of through the Vite dev server. This avoids stale HMR/react chunk mismatch problems and matches the Phase 2 cutover goal of a stable runtime path.

Follow-up runtime hardening:

- nginx now resolves Docker service names dynamically instead of pinning a stale frontend/backend container IP
- the frontend service now installs dependencies before its startup build so runtime restarts do not fail on a stale `node_modules` volume

## Verification

Completed successfully:

- `npm run build`
- `python3 -m py_compile $(find backend/app -name '*.py' | sort) $(find backend/tests -name '*.py' | sort)`
- `docker compose exec -T backend python -m unittest discover -s tests -v`
- `curl http://127.0.0.1/` -> `200`
- `curl http://127.0.0.1/health` -> `200`
- `curl http://127.0.0.1/api/check-account` -> `200`

Backend suite result:

- `34` tests passed

Frontend build result:

- production build passed
- bundle size warning still exists and remains a follow-up item

## Remaining Phase 2 Work

The cutover is materially further along, but Phase 2 is not finished.

Remaining high-value items:

- retire or isolate the remaining legacy code that is still present but no longer on the default path
- continue rewriting historical docs so they do not read like the retired feature flag is still an active runtime control
- decide when to remove the remaining compatibility-only legacy cleanup/import behavior entirely
- address frontend bundle size with chunking/code-splitting

## Notes

Historical docs from Phase 1 may still mention `VITE_USE_TASKS_UI` because they describe the migration period. The live app no longer depends on that flag in the frontend source, and the env example no longer exposes it.
