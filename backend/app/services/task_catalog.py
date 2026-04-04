from typing import Any

from fastapi import HTTPException

from app.schemas.common import SeverityLevel, TaskType
from app.schemas.tasks import TaskCapability, TaskCapabilityField


SUPPORTED_TASK_TYPES = [
    TaskType.ENUMERATE_SCOPE.value,
    TaskType.RUN_FINDINGS_SCAN.value,
    TaskType.PORT_SCAN.value,
    TaskType.SERVICE_DISCOVERY.value,
]

_SEVERITY_VALUES = {severity.value for severity in SeverityLevel}


def list_task_capabilities() -> list[TaskCapability]:
    return [
        TaskCapability(
            task_type=TaskType.ENUMERATE_SCOPE,
            display_name="Enumerate Scope",
            description="Discover hosts for a root domain and optionally enrich them with HTTP metadata and screenshots.",
            auto_pickup=True,
            fields=[
                TaskCapabilityField(
                    key="scope_value",
                    label="Root Domain",
                    input_type="text",
                    required=True,
                    placeholder="example.com",
                ),
                TaskCapabilityField(
                    key="include_http_enrichment",
                    label="HTTP Enrichment",
                    input_type="boolean",
                    default=True,
                ),
                TaskCapabilityField(
                    key="include_screenshots",
                    label="Capture Screenshots",
                    input_type="boolean",
                    default=False,
                ),
            ],
        ),
        TaskCapability(
            task_type=TaskType.PORT_SCAN,
            display_name="Port Scan",
            description="Scan IP addresses or CIDR ranges with nmap to discover open ports and active hosts.",
            auto_pickup=True,
            fields=[
                TaskCapabilityField(
                    key="targets",
                    label="Targets",
                    input_type="textarea",
                    required=True,
                    placeholder="192.168.1.0/24 or 10.0.0.1,10.0.0.2",
                ),
                TaskCapabilityField(
                    key="ports",
                    label="Ports",
                    input_type="text",
                    placeholder="Top 100 ports by default, or e.g. 80,443,8080-8090,22",
                ),
                TaskCapabilityField(
                    key="top_ports",
                    label="Top Ports",
                    input_type="number",
                    default=100,
                ),
                TaskCapabilityField(
                    key="scan_type",
                    label="Scan Type",
                    input_type="text",
                    default="sT",
                    placeholder="sT (TCP connect), sS (SYN — requires root)",
                ),
                TaskCapabilityField(
                    key="timing",
                    label="Timing Template (0-5)",
                    input_type="number",
                    default=4,
                ),
                TaskCapabilityField(
                    key="max_rate",
                    label="Max Rate (packets/sec)",
                    input_type="number",
                    default=None,
                ),
                TaskCapabilityField(
                    key="command_timeout",
                    label="Command Timeout (s)",
                    input_type="number",
                    default=300,
                ),
                TaskCapabilityField(
                    key="create_assets",
                    label="Create Assets",
                    input_type="boolean",
                    default=True,
                ),
            ],
        ),
        TaskCapability(
            task_type=TaskType.SERVICE_DISCOVERY,
            display_name="Service Discovery",
            description="Run httpx against selected assets to identify web services, technologies, and capture metadata.",
            auto_pickup=True,
            fields=[
                TaskCapabilityField(
                    key="hostnames",
                    label="Target Hostnames",
                    input_type="textarea",
                    placeholder="192.168.1.1, 192.168.1.2",
                ),
                TaskCapabilityField(
                    key="asset_ids",
                    label="Target Asset IDs",
                    input_type="textarea",
                    placeholder="asset_123, asset_456",
                ),
                TaskCapabilityField(
                    key="ports",
                    label="Target Ports",
                    input_type="text",
                    placeholder="80,443,8080,8443",
                ),
                TaskCapabilityField(
                    key="include_screenshots",
                    label="Capture Screenshots",
                    input_type="boolean",
                    default=False,
                ),
                TaskCapabilityField(
                    key="max_assets",
                    label="Max Assets",
                    input_type="number",
                    default=100,
                ),
                TaskCapabilityField(
                    key="command_timeout",
                    label="Command Timeout (s)",
                    input_type="number",
                    default=120,
                ),
            ],
        ),
        TaskCapability(
            task_type=TaskType.RUN_FINDINGS_SCAN,
            display_name="Run Findings Scan",
            description="Run nuclei against existing v2 assets with optional targeting, template filters, and runtime limits.",
            auto_pickup=True,
            fields=[
                TaskCapabilityField(
                    key="hostnames",
                    label="Target Hostnames",
                    input_type="textarea",
                    placeholder="app.example.com, api.example.com",
                ),
                TaskCapabilityField(
                    key="asset_ids",
                    label="Target Asset IDs",
                    input_type="textarea",
                    placeholder="asset_123, asset_456",
                ),
                TaskCapabilityField(
                    key="max_assets",
                    label="Max Assets",
                    input_type="number",
                    default=25,
                ),
                TaskCapabilityField(
                    key="ports",
                    label="Ports",
                    input_type="text",
                    placeholder="443, 8443",
                ),
                TaskCapabilityField(
                    key="templates",
                    label="Templates",
                    input_type="text",
                    placeholder="/app/nuclei-templates/http/exposures/apis/swagger-api.yaml",
                ),
                TaskCapabilityField(
                    key="tags",
                    label="Tags",
                    input_type="text",
                    placeholder="cve, exposure, default-login",
                ),
                TaskCapabilityField(
                    key="severity",
                    label="Severity Filter",
                    input_type="text",
                    default="medium,high,critical",
                ),
                TaskCapabilityField(
                    key="exclude_tags",
                    label="Exclude Tags",
                    input_type="text",
                ),
                TaskCapabilityField(
                    key="exclude_severity",
                    label="Exclude Severity",
                    input_type="text",
                ),
                TaskCapabilityField(
                    key="use_primary_url",
                    label="Use Primary URL",
                    input_type="boolean",
                    default=True,
                ),
                TaskCapabilityField(
                    key="run_all_templates",
                    label="Run All Templates",
                    input_type="boolean",
                    default=False,
                ),
                TaskCapabilityField(
                    key="rate_limit",
                    label="Rate Limit",
                    input_type="number",
                    default=150,
                ),
                TaskCapabilityField(
                    key="timeout",
                    label="Timeout",
                    input_type="number",
                    default=10,
                ),
                TaskCapabilityField(
                    key="retries",
                    label="Retries",
                    input_type="number",
                    default=2,
                ),
                TaskCapabilityField(
                    key="command_timeout",
                    label="Command Timeout",
                    input_type="number",
                    default=300,
                ),
            ],
        ),
    ]


def normalize_task_request(
    *,
    task_type: TaskType,
    label: str | None,
    requested_input: dict[str, Any] | None,
) -> tuple[str, dict[str, Any]]:
    requested_input = requested_input or {}

    if task_type == TaskType.ENUMERATE_SCOPE:
        return _normalize_enumerate_scope_request(label, requested_input)
    if task_type == TaskType.RUN_FINDINGS_SCAN:
        return _normalize_findings_scan_request(label, requested_input)
    if task_type == TaskType.PORT_SCAN:
        return _normalize_port_scan_request(label, requested_input)
    if task_type == TaskType.SERVICE_DISCOVERY:
        return _normalize_service_discovery_request(label, requested_input)

    raise HTTPException(
        status_code=400,
        detail=f"Task type '{task_type.value}' is not supported by the worker.",
    )


def _normalize_enumerate_scope_request(
    label: str | None,
    requested_input: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    scope_value = str(requested_input.get("scope_value") or "").strip().lower()
    if not scope_value:
        raise HTTPException(
            status_code=400,
            detail="requested_input.scope_value is required for enumerate_scope tasks.",
        )

    normalized_input = {
        "scope_type": "domain",
        "scope_value": scope_value,
        "include_http_enrichment": _normalize_bool(
            requested_input.get("include_http_enrichment"),
            default=True,
        ),
        "include_screenshots": _normalize_bool(
            requested_input.get("include_screenshots"),
            default=False,
        ),
    }
    normalized_label = (label or "").strip() or f"Enumerate {scope_value}"
    return normalized_label, normalized_input


def _normalize_port_scan_request(
    label: str | None,
    requested_input: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    targets = _normalize_string_list(requested_input.get("targets"))
    if not targets:
        raise HTTPException(
            status_code=400,
            detail="requested_input.targets is required for port_scan tasks.",
        )

    ports = _normalize_port_specs(requested_input.get("ports"))

    # scan_type: accept naabu-style 's'/'c' for backwards compat
    raw_scan_type = str(requested_input.get("scan_type") or "sT").strip()
    _scan_type_map = {"s": "sS", "c": "sT"}
    scan_type = _scan_type_map.get(raw_scan_type, raw_scan_type)
    if scan_type not in {"sS", "sT"}:
        scan_type = "sT"

    raw_timing = requested_input.get("timing", 4)
    try:
        timing = max(0, min(5, int(raw_timing)))
    except (TypeError, ValueError):
        timing = 4

    normalized_input = {
        "targets": targets,
        "ports": ports,
        "top_ports": _normalize_int(
            requested_input.get("top_ports"), default=100, minimum=1
        ),
        "scan_type": scan_type,
        "timing": timing,
        "max_rate": _normalize_optional_int(
            requested_input.get("max_rate"), minimum=1
        ),
        "command_timeout": _normalize_int(
            requested_input.get("command_timeout"), default=300, minimum=1
        ),
        "create_assets": _normalize_bool(
            requested_input.get("create_assets"), default=True
        ),
        "version_scan": _normalize_bool(
            requested_input.get("version_scan"), default=False
        ),
        "default_scripts": _normalize_bool(
            requested_input.get("default_scripts"), default=False
        ),
    }

    target_summary = targets[0] if len(targets) == 1 else f"{len(targets)} targets"
    normalized_label = (label or "").strip() or f"Port scan {target_summary}"
    return normalized_label, normalized_input


def _normalize_service_discovery_request(
    label: str | None,
    requested_input: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    hostnames = [
        v.lower()
        for v in _normalize_string_list(requested_input.get("hostnames"))
    ]
    asset_ids = _normalize_string_list(requested_input.get("asset_ids"))

    if not hostnames and not asset_ids:
        raise HTTPException(
            status_code=400,
            detail="At least one of hostnames or asset_ids is required for service_discovery tasks.",
        )

    normalized_input = {
        "hostnames": hostnames,
        "asset_ids": asset_ids,
        "ports": _normalize_ports(requested_input.get("ports")),
        "include_screenshots": _normalize_bool(
            requested_input.get("include_screenshots"), default=False
        ),
        "max_assets": _normalize_optional_int(
            requested_input.get("max_assets"), minimum=1
        ),
        "command_timeout": _normalize_int(
            requested_input.get("command_timeout"), default=120, minimum=1
        ),
    }

    count = len(asset_ids) or len(hostnames)
    normalized_label = (
        (label or "").strip()
        or f"Service discovery for {count} target(s)"
    )
    return normalized_label, normalized_input


def _normalize_findings_scan_request(
    label: str | None,
    requested_input: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    templates = _normalize_string_list(requested_input.get("templates"))
    tags = _normalize_string_list(requested_input.get("tags"))
    run_all_templates = _normalize_bool(
        requested_input.get("run_all_templates"),
        default=False,
    )

    if templates and tags:
        raise HTTPException(
            status_code=400,
            detail="Use either requested_input.templates or requested_input.tags, not both.",
        )
    if run_all_templates and (templates or tags):
        raise HTTPException(
            status_code=400,
            detail="run_all_templates cannot be combined with templates or tags.",
        )

    normalized_input = {
        "asset_ids": _normalize_string_list(requested_input.get("asset_ids")),
        "hostnames": [value.lower() for value in _normalize_string_list(requested_input.get("hostnames"))],
        "max_assets": _normalize_optional_int(
            requested_input.get("max_assets"),
            minimum=1,
        ),
        "ports": _normalize_ports(requested_input.get("ports")),
        "templates": templates,
        "tags": tags,
        "severity": _normalize_severity_list(requested_input.get("severity")),
        "exclude_tags": _normalize_string_list(requested_input.get("exclude_tags")),
        "exclude_severity": _normalize_severity_list(requested_input.get("exclude_severity")),
        "use_primary_url": _normalize_bool(
            requested_input.get("use_primary_url"),
            default=True,
        ),
        "run_all_templates": run_all_templates,
        "rate_limit": _normalize_int(requested_input.get("rate_limit"), default=150, minimum=1),
        "timeout": _normalize_int(requested_input.get("timeout"), default=10, minimum=1),
        "retries": _normalize_int(requested_input.get("retries"), default=2, minimum=0),
        "command_timeout": _normalize_int(
            requested_input.get("command_timeout"),
            default=1800,
            minimum=1,
        ),
    }

    normalized_label = (label or "").strip() or _build_findings_scan_label(normalized_input)
    return normalized_label, normalized_input


def _build_findings_scan_label(requested_input: dict[str, Any]) -> str:
    hostnames = requested_input.get("hostnames") or []
    asset_ids = requested_input.get("asset_ids") or []
    if hostnames:
        if len(hostnames) == 1:
            return f"Findings scan for {hostnames[0]}"
        return f"Findings scan for {len(hostnames)} hosts"
    if asset_ids:
        return f"Findings scan for {len(asset_ids)} assets"

    max_assets = requested_input.get("max_assets")
    if max_assets:
        return f"Findings scan for up to {max_assets} assets"

    return "Findings scan across project assets"


def _normalize_bool(value: Any, *, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value

    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def _normalize_string_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        values = value
    else:
        values = str(value).replace("\n", ",").split(",")

    normalized: list[str] = []
    for item in values:
        item_value = str(item).strip()
        if item_value and item_value not in normalized:
            normalized.append(item_value)
    return normalized


def _normalize_ports(value: Any) -> list[int]:
    """Normalize individual port numbers (no ranges). Used for nuclei URL building."""
    if value is None:
        return []
    if isinstance(value, list):
        values = value
    else:
        values = str(value).replace("\n", ",").split(",")

    normalized: list[int] = []
    for item in values:
        try:
            port = int(str(item).strip())
        except (TypeError, ValueError):
            continue
        if port > 0 and port not in normalized:
            normalized.append(port)
    return normalized


def _normalize_port_specs(value: Any) -> list[str]:
    """Normalize port specs for nmap, preserving range notation like '80-100' or '1-65535'."""
    if value is None:
        return []
    if isinstance(value, list):
        values = value
    else:
        values = str(value).replace("\n", ",").split(",")

    normalized: list[str] = []
    for item in values:
        s = str(item).strip()
        if not s:
            continue
        # Range like "80-100" or "1-65535"
        if "-" in s:
            parts = s.split("-", 1)
            try:
                lo, hi = int(parts[0]), int(parts[1])
            except (ValueError, IndexError):
                continue
            if 0 < lo <= 65535 and 0 < hi <= 65535 and lo <= hi:
                normalized.append(f"{lo}-{hi}")
        else:
            try:
                port = int(s)
            except ValueError:
                continue
            if 0 < port <= 65535:
                normalized.append(str(port))
    return normalized


def _normalize_int(value: Any, *, default: int, minimum: int = 0) -> int:
    try:
        normalized = int(value)
    except (TypeError, ValueError):
        return default
    return normalized if normalized >= minimum else default


def _normalize_optional_int(value: Any, *, minimum: int = 0) -> int | None:
    if value in (None, ""):
        return None
    try:
        normalized = int(value)
    except (TypeError, ValueError):
        return None
    if normalized < minimum:
        return None
    return normalized


def _normalize_severity_list(value: Any) -> list[str]:
    normalized = _normalize_string_list(value)
    return [item.lower() for item in normalized if item.lower() in _SEVERITY_VALUES]
