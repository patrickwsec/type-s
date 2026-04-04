"""Direct tool endpoints for AI agent use.

These endpoints run tools immediately (not via the task queue) and return
structured results synchronously.  They are intended to be called either from
the UI or by an LLM agent that needs real-time output.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.core.security import get_current_user
from app.services.nmap_tool import NMAP_TOOL_SCHEMA, run_nmap


router = APIRouter(prefix="/tools")


# ---------------------------------------------------------------------------
# Input / output schemas
# ---------------------------------------------------------------------------


class NmapRunRequest(BaseModel):
    targets: list[str] = Field(
        ...,
        min_length=1,
        description="IPs, CIDR ranges, or hostnames to scan.",
        examples=[["192.168.1.0/24", "10.0.0.1"]],
    )
    ports: list[str] | None = Field(
        default=None,
        description="Explicit ports/ranges (e.g. ['80', '443', '8080-8090']). "
        "Takes precedence over top_ports when provided.",
    )
    top_ports: int = Field(
        default=100,
        ge=1,
        le=65535,
        description="Number of most-common ports to scan when ports is not set.",
    )
    scan_type: str = Field(
        default="sT",
        description="'sT' (TCP connect – no root needed) or 'sS' (SYN – requires root).",
    )
    timing: int = Field(
        default=4,
        ge=0,
        le=5,
        description="nmap timing template 0-5. Higher = faster but noisier.",
    )
    max_rate: int | None = Field(
        default=None,
        ge=1,
        description="Optional maximum packet send rate (packets/sec).",
    )
    command_timeout: int = Field(
        default=300,
        ge=5,
        description="Maximum seconds to wait for nmap before killing the process.",
    )


class NmapPortRecord(BaseModel):
    ip: str
    host: str
    port: int
    protocol: str
    service: str | None


class NmapRunResponse(BaseModel):
    active_hosts: int
    total_open_ports: int
    results: list[NmapPortRecord]
    tool_schema: dict[str, Any] | None = Field(
        default=None,
        description="OpenAI function-calling schema for this tool (included when ?include_schema=true).",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/nmap/schema")
async def get_nmap_tool_schema(
    user_id: str = Depends(get_current_user),
) -> dict:
    """Return the OpenAI function-calling schema for the nmap tool.

    Agents can fetch this schema so they know how to call the tool correctly.
    """
    return NMAP_TOOL_SCHEMA


@router.post("/nmap", response_model=NmapRunResponse)
async def run_nmap_tool(
    request: NmapRunRequest,
    user_id: str = Depends(get_current_user),
) -> NmapRunResponse:
    """Run nmap against the requested targets and return open port records.

    This endpoint runs nmap synchronously and streams back the results once the
    scan is complete.  For long-running scans against large networks, prefer the
    task-queue-based port_scan task instead.
    """
    try:
        records = await run_nmap(
            request.targets,
            ports=request.ports,
            top_ports=request.top_ports,
            scan_type=request.scan_type,
            timing=request.timing,
            max_rate=request.max_rate,
            command_timeout=request.command_timeout,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # Aggregate by host for the summary counts
    seen_hosts: set[str] = set()
    for r in records:
        seen_hosts.add(r["ip"])

    return NmapRunResponse(
        active_hosts=len(seen_hosts),
        total_open_ports=len(records),
        results=[NmapPortRecord(**r) for r in records],
    )
