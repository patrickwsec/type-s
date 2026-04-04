from fastapi import APIRouter, HTTPException


router = APIRouter()


@router.get("/nuclei/templates")
async def get_nuclei_templates():
    try:
        template_categories = {
            "quick_scan": {
                "name": "Quick Security Scan",
                "description": "Fast scan for common vulnerabilities and exposures",
                "tags": ["cve", "default-login", "exposure"],
                "estimated_time": "5-15 minutes",
                "severity": ["high", "critical"],
                "template_count": "~500",
            },
            "comprehensive": {
                "name": "Comprehensive Scan",
                "description": "Full security assessment using ALL available Nuclei templates",
                "tags": [],
                "estimated_time": "1-3 hours",
                "severity": ["info", "low", "medium", "high", "critical"],
                "template_count": "~6000+",
            },
            "cve_only": {
                "name": "CVE Vulnerabilities",
                "description": "Scan for known CVE vulnerabilities only",
                "tags": ["cve", "cve2024", "cve2023", "cve2022"],
                "estimated_time": "15-30 minutes",
                "severity": ["medium", "high", "critical"],
                "template_count": "~3200",
            },
            "web_app": {
                "name": "Web Application Security",
                "description": "Focus on web application vulnerabilities",
                "tags": ["xss", "sqli", "lfi", "rce", "ssrf", "csrf"],
                "estimated_time": "20-40 minutes",
                "severity": ["low", "medium", "high", "critical"],
                "template_count": "~2000",
            },
            "cms_specific": {
                "name": "CMS Security (WordPress, Joomla, etc.)",
                "description": "Vulnerabilities specific to content management systems",
                "tags": ["wordpress", "joomla", "drupal", "cms"],
                "estimated_time": "10-25 minutes",
                "severity": ["medium", "high", "critical"],
                "template_count": "~1300",
            },
            "network_services": {
                "name": "Network Services",
                "description": "Common network service vulnerabilities",
                "tags": ["apache", "nginx", "ftp", "ssh", "telnet", "smtp"],
                "estimated_time": "15-30 minutes",
                "severity": ["medium", "high", "critical"],
                "template_count": "~800",
            },
            "disclosure": {
                "name": "Information Disclosure",
                "description": "Scan for information leaks and sensitive data exposure",
                "tags": ["exposure", "disclosure", "config", "debug"],
                "estimated_time": "10-20 minutes",
                "severity": ["info", "low", "medium"],
                "template_count": "~1100",
            },
            "takeover": {
                "name": "Subdomain Takeover",
                "description": "Check for subdomain takeover vulnerabilities",
                "tags": ["takeover", "subdomain", "dns"],
                "estimated_time": "5-10 minutes",
                "severity": ["high", "critical"],
                "template_count": "~150",
            },
            "waf_detection": {
                "name": "WAF Detection",
                "description": "Detect Web Application Firewalls (Cloudflare, AWS WAF, Akamai, etc.)",
                "tags": ["waf", "tech"],
                "estimated_time": "5-10 minutes",
                "severity": ["info"],
                "template_count": "~50",
            },
            "critical_only": {
                "name": "Critical Vulnerabilities Only",
                "description": "Scan only for critical severity vulnerabilities",
                "tags": ["cve", "rce", "sqli"],
                "estimated_time": "15-25 minutes",
                "severity": ["critical"],
                "template_count": "~800",
            },
            "custom": {
                "name": "Custom Selection",
                "description": "Choose your own tags and severity levels",
                "tags": [],
                "estimated_time": "Varies",
                "severity": [],
                "template_count": "User defined",
            },
        }

        severity_levels = [
            {"value": "info", "label": "Info", "color": "blue", "description": "Informational findings"},
            {"value": "low", "label": "Low", "color": "green", "description": "Low risk vulnerabilities"},
            {"value": "medium", "label": "Medium", "color": "yellow", "description": "Medium risk vulnerabilities"},
            {"value": "high", "label": "High", "color": "orange", "description": "High risk vulnerabilities"},
            {"value": "critical", "label": "Critical", "color": "red", "description": "Critical vulnerabilities requiring immediate attention"},
        ]

        popular_tags = [
            {"tag": "cve", "count": 3235, "description": "Common Vulnerabilities and Exposures"},
            {"tag": "wordpress", "count": 1174, "description": "WordPress specific vulnerabilities"},
            {"tag": "exposure", "count": 1101, "description": "Information exposure and leaks"},
            {"tag": "xss", "count": 1038, "description": "Cross-Site Scripting vulnerabilities"},
            {"tag": "lfi", "count": 773, "description": "Local File Inclusion vulnerabilities"},
            {"tag": "rce", "count": 770, "description": "Remote Code Execution vulnerabilities"},
            {"tag": "sqli", "count": 482, "description": "SQL Injection vulnerabilities"},
            {"tag": "login", "count": 453, "description": "Login related vulnerabilities"},
            {"tag": "default-login", "count": 275, "description": "Default login credentials"},
            {"tag": "apache", "count": 238, "description": "Apache web server vulnerabilities"},
            {"tag": "joomla", "count": 151, "description": "Joomla CMS vulnerabilities"},
            {"tag": "ssrf", "count": 146, "description": "Server-Side Request Forgery"},
            {"tag": "takeover", "count": 89, "description": "Subdomain takeover vulnerabilities"},
            {"tag": "waf", "count": 52, "description": "Web Application Firewall detection"},
            {"tag": "disclosure", "count": 67, "description": "Information disclosure vulnerabilities"},
            {"tag": "csrf", "count": 43, "description": "Cross-Site Request Forgery"},
        ]

        return {
            "template_categories": template_categories,
            "severity_levels": severity_levels,
            "popular_tags": popular_tags,
            "recommendations": {
                "small_scope": "For scans with 1-10 hosts, use 'Quick Scan' or 'Comprehensive'",
                "medium_scope": "For scans with 10-50 hosts, use 'Quick Scan' or 'CVE Only'",
                "large_scope": "For scans with 50+ hosts, use 'Critical Only' or 'Quick Scan'",
                "time_sensitive": "For time-sensitive scans, use 'Critical Only' or 'Takeover'",
            },
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to get template information") from exc
