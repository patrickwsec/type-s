# Legacy To V2 Import

Date: 2026-03-08

## Purpose

This importer is meant to seed the v2 UI with real data from the legacy Mongo model without modifying the legacy collections.

It transforms:

- `projects` reuse only
- `subdomains` -> `v2_assets`
- embedded `subdomains.vulnerabilities[]` -> `v2_findings`
- legacy screenshot files -> `v2_artifacts` when requested

It also creates one synthetic completed task per migrated project so imported data has v2 provenance:

- task label: `Legacy Data Import`
- task type: `analyze_project`
- created by: `system.migration`

## What It Does Not Migrate

- legacy `scans` as real agent tasks
- legacy scan event timelines
- raw historical scan artifacts beyond screenshot backfill

## Script

- [migrate_legacy_data_to_v2.py](backend/scripts/migrate_legacy_data_to_v2.py)

## Usage

Run from the backend container so the Python dependencies and Mongo env are already present.

Dry run for all projects:

```bash
docker compose exec -T backend python scripts/migrate_legacy_data_to_v2.py --all-projects --include-screenshots
```

Execute for one project:

```bash
docker compose exec -T backend python scripts/migrate_legacy_data_to_v2.py --project-id <project_id> --include-screenshots --execute
```

Execute for all projects:

```bash
docker compose exec -T backend python scripts/migrate_legacy_data_to_v2.py --all-projects --include-screenshots --execute
```

## Notes

- The script is dry-run by default.
- The import is idempotent at the asset and finding layer.
- Screenshot backfill only occurs when the referenced legacy file still exists under `backend/screenshots` or `/app/screenshots`.
- Imported findings start with triage status `new`.
- Existing legacy collections are not edited or deleted.
