"""Standalone nmap runner usable both by the task worker and AI agents as a tool."""

import asyncio
import ipaddress
import logging
import re
import tempfile
import xml.etree.ElementTree as ET
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Input validation helpers
# ---------------------------------------------------------------------------

_PORT_RANGE_RE = re.compile(r"^\d+(-\d+)?$")


def _validate_targets(targets: list[str]) -> list[str]:
    """Validate each target is a plausible IP, CIDR, or hostname.

    Raises ValueError on the first invalid entry to prevent command injection.
    Hostnames are validated to only contain safe characters; IPs and CIDRs are
    parsed by the standard library so their format is strictly checked.
    """
    safe_hostname_re = re.compile(r"^[a-zA-Z0-9._\-]+$")
    validated: list[str] = []
    for t in targets:
        t = t.strip()
        if not t:
            continue
        # Try CIDR or plain IP first
        try:
            ipaddress.ip_network(t, strict=False)
            validated.append(t)
            continue
        except ValueError:
            pass
        # Plain hostname / domain
        if safe_hostname_re.fullmatch(t):
            validated.append(t)
            continue
        raise ValueError(
            f"Invalid target {t!r}: must be an IP, CIDR, or hostname containing "
            "only alphanumerics, dots, hyphens, and underscores."
        )
    return validated


def _validate_ports(ports: list[int | str]) -> list[str]:
    """Validate port entries are integers or port ranges like '80-90'.

    Returns a list of string port specs safe to join for -p.
    """
    validated: list[str] = []
    for p in ports:
        s = str(p).strip()
        if not _PORT_RANGE_RE.fullmatch(s):
            raise ValueError(f"Invalid port specification {s!r}.")
        parts = s.split("-")
        for part in parts:
            n = int(part)
            if not (0 < n <= 65535):
                raise ValueError(f"Port {n} is out of range (1-65535).")
        validated.append(s)
    return validated


def _validate_timing(timing: Any) -> str:
    t = str(timing).strip()
    if t not in {"0", "1", "2", "3", "4", "5"}:
        raise ValueError(f"Timing template must be 0-5, got {t!r}.")
    return t


def _validate_scan_type(scan_type: Any) -> str:
    s = str(scan_type).strip()
    # Accept naabu-style single chars for backwards compat
    mapping = {"s": "sS", "c": "sT"}
    s = mapping.get(s, s)
    if s not in {"sS", "sT"}:
        raise ValueError(
            f"scan_type must be 'sS' (SYN) or 'sT' (TCP connect), got {s!r}."
        )
    return s


# ---------------------------------------------------------------------------
# nmap runner
# ---------------------------------------------------------------------------

async def run_nmap(
    targets: list[str],
    *,
    ports: list[int | str] | None = None,
    top_ports: int = 100,
    scan_type: str = "sT",
    timing: int | str = 4,
    max_rate: int | None = None,
    version_scan: bool = False,
    default_scripts: bool = False,
    command_timeout: int = 300,
) -> list[dict]:
    """Run nmap and return a list of open port records.

    Each record is a dict with keys:
        ip, host, port, protocol, service, product, version, extrainfo,
        scripts (list of {id, output})

    Parameters
    ----------
    targets:
        IPs, CIDRs, or hostnames to scan.
    ports:
        Explicit port list/ranges. When provided, top_ports is ignored.
    top_ports:
        Scan the N most common ports (nmap --top-ports).  Default 100.
    scan_type:
        'sT' (TCP connect, no root required) or 'sS' (SYN, needs root).
        Legacy naabu values 's' and 'c' are accepted and mapped automatically.
    timing:
        nmap timing template 0-5.  Default 4 (Aggressive).
    max_rate:
        Optional maximum packet send rate (--max-rate).
    version_scan:
        Enable service/version detection (-sV).
    default_scripts:
        Run default NSE scripts (--script=default / -sC).
    command_timeout:
        Wall-clock seconds before the nmap process is killed.  Default 300.
    """
    validated_targets = _validate_targets(targets)
    if not validated_targets:
        raise ValueError("At least one target is required.")

    validated_scan_type = _validate_scan_type(scan_type)
    validated_timing = _validate_timing(timing)

    command = [
        "nmap",
        f"-{validated_scan_type}",
        f"-T{validated_timing}",
        "--open",       # only report open ports
        "-oX", "-",    # XML output to stdout
        "-n",          # no DNS resolution (faster; targets are already resolved or IPs)
    ]

    if version_scan:
        command.append("-sV")
    if default_scripts:
        command.append("--script=default")

    if ports:
        validated_port_specs = _validate_ports(ports)
        command.extend(["-p", ",".join(validated_port_specs)])
    else:
        validated_top = max(1, int(top_ports))
        command.extend(["--top-ports", str(validated_top)])

    if max_rate is not None:
        validated_rate = max(1, int(max_rate))
        command.extend(["--max-rate", str(validated_rate)])

    command.extend(validated_targets)

    logger.info("Running nmap: %s", " ".join(command))

    process = await asyncio.create_subprocess_exec(
        *command,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=command_timeout,
        )
    except asyncio.TimeoutError:
        process.kill()
        await process.communicate()
        raise TimeoutError(f"nmap timed out after {command_timeout}s.")

    if process.returncode != 0:
        error_msg = stderr.decode(errors="replace").strip()
        raise RuntimeError(f"nmap exited with code {process.returncode}: {error_msg}")

    return _parse_nmap_xml(stdout.decode(errors="replace"))


def _parse_nmap_xml(xml_text: str) -> list[dict]:
    """Parse nmap XML output into a flat list of open-port records."""
    results: list[dict] = []
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        logger.warning("Failed to parse nmap XML output: %s", exc)
        return results

    for host_el in root.findall("host"):
        status_el = host_el.find("status")
        if status_el is None or status_el.get("state") != "up":
            continue

        ip: str | None = None
        for addr_el in host_el.findall("address"):
            if addr_el.get("addrtype") in ("ipv4", "ipv6"):
                ip = addr_el.get("addr")
                break
        if not ip:
            continue

        hostname: str | None = None
        hostnames_el = host_el.find("hostnames")
        if hostnames_el is not None:
            hn_el = hostnames_el.find("hostname")
            if hn_el is not None:
                hostname = hn_el.get("name")

        ports_el = host_el.find("ports")
        if ports_el is None:
            continue

        for port_el in ports_el.findall("port"):
            state_el = port_el.find("state")
            if state_el is None or state_el.get("state") != "open":
                continue

            port_num = int(port_el.get("portid", 0))
            protocol = port_el.get("protocol", "tcp")
            service_el = port_el.find("service")
            service_name: str | None = None
            product: str | None = None
            version: str | None = None
            extrainfo: str | None = None
            if service_el is not None:
                service_name = service_el.get("name")
                product = service_el.get("product") or None
                version = service_el.get("version") or None
                extrainfo = service_el.get("extrainfo") or None

            # Collect NSE script results for this port
            scripts: list[dict] = []
            for script_el in port_el.findall("script"):
                script_id = script_el.get("id", "")
                script_output = script_el.get("output", "").strip()
                if script_id:
                    scripts.append({"id": script_id, "output": script_output})

            results.append(
                {
                    "ip": ip,
                    "host": hostname or ip,
                    "port": port_num,
                    "protocol": protocol,
                    "service": service_name,
                    "product": product,
                    "version": version,
                    "extrainfo": extrainfo,
                    "scripts": scripts,
                }
            )

    return results


# ---------------------------------------------------------------------------
# OpenAI tool schema (for LLM agent function-calling)
# ---------------------------------------------------------------------------

NMAP_TOOL_SCHEMA: dict = {
    "type": "function",
    "function": {
        "name": "run_nmap",
        "description": (
            "Scan one or more IP addresses, CIDR ranges, or hostnames with nmap "
            "to discover open TCP ports and running services. "
            "Returns a list of open port records for each live host. "
            "Use scan_type 'sT' when not running as root; use 'sS' (SYN scan) "
            "for faster results when running as root."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "targets": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "IPs, CIDR ranges, or hostnames to scan. "
                        "Examples: ['10.0.0.1', '192.168.1.0/24', 'example.com']"
                    ),
                },
                "ports": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": (
                        "Explicit port list or ranges to scan. "
                        "Examples: ['80', '443', '8080-8090']. "
                        "When omitted, top_ports is used instead."
                    ),
                },
                "top_ports": {
                    "type": "integer",
                    "description": "Scan the N most common ports (default 100). Ignored when ports is provided.",
                    "default": 100,
                },
                "scan_type": {
                    "type": "string",
                    "enum": ["sT", "sS"],
                    "description": (
                        "'sT' = TCP connect scan (no root required, default). "
                        "'sS' = SYN scan (faster, requires root/CAP_NET_RAW)."
                    ),
                    "default": "sT",
                },
                "timing": {
                    "type": "integer",
                    "enum": [0, 1, 2, 3, 4, 5],
                    "description": (
                        "nmap timing template controlling scan speed and aggressiveness "
                        "(0=Paranoid … 5=Insane). Default 4 (Aggressive)."
                    ),
                    "default": 4,
                },
                "max_rate": {
                    "type": "integer",
                    "description": "Optional maximum packet send rate (packets/sec). Omit to let timing template decide.",
                },
                "command_timeout": {
                    "type": "integer",
                    "description": "Maximum seconds to wait for nmap to finish. Default 300.",
                    "default": 300,
                },
            },
            "required": ["targets"],
        },
    },
}
