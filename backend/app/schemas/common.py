from datetime import datetime
from enum import Enum

from pydantic import BaseModel


class SeverityLevel(str, Enum):
    INFO = "info"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class FindingTriageStatus(str, Enum):
    NEW = "new"
    ACKNOWLEDGED = "acknowledged"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    FALSE_POSITIVE = "false_positive"


class TaskStatus(str, Enum):
    QUEUED = "queued"
    PLANNING = "planning"
    AWAITING_APPROVAL = "awaiting_approval"
    CANCELLING = "cancelling"
    RUNNING = "running"
    INGESTING = "ingesting"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskType(str, Enum):
    ENUMERATE_SCOPE = "enumerate_scope"
    ENRICH_ASSETS = "enrich_assets"
    CAPTURE_SCREENSHOTS = "capture_screenshots"
    ANALYZE_PROJECT = "analyze_project"
    RUN_FINDINGS_SCAN = "run_findings_scan"
    PORT_SCAN = "port_scan"
    SERVICE_DISCOVERY = "service_discovery"


class ApprovalMode(str, Enum):
    AUTO = "auto"
    REQUIRED = "required"


class TaskEventType(str, Enum):
    TASK_CREATED = "task.created"
    TASK_CANCELLATION_REQUESTED = "task.cancellation_requested"
    TASK_CANCELLED = "task.cancelled"
    TASK_PLANNING_STARTED = "task.planning_started"
    TASK_ENUMERATION_STARTED = "task.enumeration_started"
    TASK_ENUMERATION_COMPLETED = "task.enumeration_completed"
    TASK_ENRICHMENT_STARTED = "task.enrichment_started"
    TASK_ENRICHMENT_COMPLETED = "task.enrichment_completed"
    TASK_FINDINGS_SCAN_STARTED = "task.findings_scan_started"
    TASK_FINDINGS_SCAN_COMPLETED = "task.findings_scan_completed"
    TASK_FINDINGS_INGEST_COMPLETED = "task.findings_ingest_completed"
    TASK_PORT_SCAN_STARTED = "task.port_scan_started"
    TASK_PORT_SCAN_COMPLETED = "task.port_scan_completed"
    TASK_SERVICE_DISCOVERY_STARTED = "task.service_discovery_started"
    TASK_SERVICE_DISCOVERY_COMPLETED = "task.service_discovery_completed"
    TASK_INGEST_STARTED = "task.ingest_started"
    TASK_COMPLETED = "task.completed"
    TASK_FAILED = "task.failed"


class ArtifactType(str, Enum):
    SCREENSHOT = "screenshot"
    HTTP_RESPONSE = "http_response"
    RAW_OUTPUT = "raw_output"
    REPORT = "report"
    LOG = "log"


class TimestampedModel(BaseModel):
    created_at: datetime
    updated_at: datetime


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int
