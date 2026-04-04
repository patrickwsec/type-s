const DEFAULT_STATUS_CODE = 200;

export function adaptFindingToVulnerability(finding) {
  return {
    id: finding.id,
    host: finding.asset_hostname || finding.metadata?.host || finding.matched_at || "Unknown Host",
    url: finding.matched_at || finding.metadata?.host || "",
    template_id: finding.template_id || "",
    name: finding.title || "Unknown Vulnerability",
    description: finding.description || "",
    severity: finding.severity || "info",
    tags: finding.tags || [],
    reference: finding.references || [],
    references: finding.references || [],
    matcher_name: finding.matcher_name || "",
    matched_at: finding.matched_at || "",
    extracted_results: finding.extracted_results || [],
    request: finding.request || "",
    response: finding.response || "",
    curl_command: finding.curl_command || "",
    timestamp: finding.last_seen_at || finding.first_seen_at,
    triage_status: finding.triage_status,
    source_task_id: finding.source_task_id,
  };
}

export function buildV2ResultsModel({ projectId, apiBase, assets, findings, screenshotArtifacts }) {
  const vulnerabilities = findings.map(adaptFindingToVulnerability);

  const findingsByAssetId = new Map();
  const findingsByHostname = new Map();
  for (const finding of findings) {
    const adapted = adaptFindingToVulnerability(finding);
    if (finding.asset_id) {
      const current = findingsByAssetId.get(finding.asset_id) || [];
      current.push(adapted);
      findingsByAssetId.set(finding.asset_id, current);
    }
    if (finding.asset_hostname) {
      const hostname = finding.asset_hostname.toLowerCase();
      const current = findingsByHostname.get(hostname) || [];
      current.push(adapted);
      findingsByHostname.set(hostname, current);
    }
  }

  const screenshotsByAssetId = new Map();
  const screenshotsByHostname = new Map();
  for (const artifact of screenshotArtifacts) {
    const screenshotUrl = `${apiBase}/v2/projects/${projectId}/artifacts/by-id/${artifact.id}/content`;
    const screenshotEntry = {
      screenshot_url: screenshotUrl,
      screenshot_artifact_id: artifact.id,
    };
    if (artifact.asset_id && !screenshotsByAssetId.has(artifact.asset_id)) {
      screenshotsByAssetId.set(artifact.asset_id, screenshotEntry);
    }
    const hostname = artifact.metadata?.hostname?.toLowerCase();
    if (hostname && !screenshotsByHostname.has(hostname)) {
      screenshotsByHostname.set(hostname, screenshotEntry);
    }
  }

  const results = assets.map((asset) => {
    const assetFindings =
      findingsByAssetId.get(asset.id) ||
      findingsByHostname.get((asset.hostname || "").toLowerCase()) ||
      [];
    const screenshot =
      screenshotsByAssetId.get(asset.id) ||
      screenshotsByHostname.get((asset.hostname || "").toLowerCase()) ||
      null;
    const statusCode =
      asset.status_code ??
      (asset.primary_url ? DEFAULT_STATUS_CODE : 0);

    return {
      id: asset.id,
      source_kind: "v2_asset",
      domain: asset.hostname,
      url: asset.primary_url || "",
      ip_address: asset.ip_addresses?.[0] || "",
      ip_addresses: asset.ip_addresses || [],
      status_code: statusCode,
      title: asset.title || "",
      tech: asset.technologies || [],
      webserver: asset.webserver || "",
      ports: asset.ports || [],
      port_details: asset.port_details || [],
      vulnerabilities: assetFindings,
      tags: asset.tags || [],
      screenshot_url: screenshot?.screenshot_url || null,
      screenshot_artifact_id: screenshot?.screenshot_artifact_id || null,
      cdn_name: "",
      cdn_type: "",
      updated_at: asset.last_seen_at || asset.first_seen_at,
    };
  });

  const severityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const vulnerability of vulnerabilities) {
    const severity = (vulnerability.severity || "info").toLowerCase();
    if (severity in severityCounts) {
      severityCounts[severity] += 1;
    }
  }

  const allPorts = new Set();
  results.forEach((result) => {
    (result.ports || []).forEach((port) => allPorts.add(port));
  });

  return {
    results,
    vulnerabilities,
    stats: {
      assetLabel: "Assets",
      totalSubdomains: results.length,
      totalVulnerabilities:
        severityCounts.critical +
        severityCounts.high +
        severityCounts.medium +
        severityCounts.low,
      criticalVulns: severityCounts.critical,
      highVulns: severityCounts.high,
      mediumVulns: severityCounts.medium,
      lowVulns: severityCounts.low,
      infoVulns: severityCounts.info,
      totalPorts: allPorts.size,
      liveHosts: results.filter((result) => (result.status_code || 0) > 0).length,
    },
  };
}
