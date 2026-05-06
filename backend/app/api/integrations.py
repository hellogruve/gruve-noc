"""
integrations.py — Gruve NOC Integration Manager
Handles CRUD for all device/system integrations + webhook receiver + health checks.
Add this file to: backend/app/api/integrations.py
Wire into main.py: app.include_router(integrations_router, prefix="/api/v1")
"""

import asyncio
import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.mongo import mongo_service

logger = logging.getLogger("gruve.noc.integrations")

router = APIRouter(prefix="/integrations", tags=["integrations"])

# ─────────────────────────────────────────────
# DEVICE CATALOGUE  (mirrors Supervity + extras)
# ─────────────────────────────────────────────
DEVICE_CATALOGUE = {
    # ── Network ──────────────────────────────────────────────────────
    "meraki": {
        "label": "Cisco Meraki",
        "category": "Network",
        "connection_type": "http",
        "icon": "meraki",
        "description": "Cisco Meraki cloud-managed networking",
        "credential_fields": [
            {"key": "api_key", "label": "API Key", "type": "password", "required": True},
            {"key": "org_id",  "label": "Organization ID", "type": "text", "required": True},
        ],
        "webhook_url_template": "/api/v1/webhooks/{id}",
    },
    "cisco_ios": {
        "label": "Cisco IOS / IOS-XE",
        "category": "Network",
        "connection_type": "ssh",
        "icon": "cisco",
        "description": "Cisco routers and switches (SSH/SNMP)",
        "credential_fields": [
            {"key": "host",     "label": "IP / Hostname",  "type": "text",     "required": True},
            {"key": "username", "label": "Username",        "type": "text",     "required": True},
            {"key": "password", "label": "Password",        "type": "password", "required": True},
            {"key": "enable_secret", "label": "Enable Secret", "type": "password", "required": False},
            {"key": "port",     "label": "SSH Port",        "type": "number",   "required": False, "default": "22"},
            {"key": "snmp_community", "label": "SNMP Community", "type": "text", "required": False},
        ],
    },
    "cisco_fmc": {
        "label": "Cisco FMC (Firepower)",
        "category": "Network",
        "connection_type": "http",
        "icon": "cisco",
        "description": "Cisco Firepower Management Center",
        "credential_fields": [
            {"key": "fmc_host", "label": "FMC Host / IP", "type": "text",     "required": True},
            {"key": "username", "label": "Username",       "type": "text",     "required": True},
            {"key": "password", "label": "Password",       "type": "password", "required": True},
        ],
    },
    "cisco_8kv": {
        "label": "Cisco Catalyst 8000V",
        "category": "Network",
        "connection_type": "ssh",
        "icon": "cisco",
        "description": "Cisco Catalyst 8000V virtual router",
        "credential_fields": [
            {"key": "host",     "label": "IP / Hostname", "type": "text",     "required": True},
            {"key": "username", "label": "Username",       "type": "text",     "required": True},
            {"key": "password", "label": "Password",       "type": "password", "required": True},
            {"key": "snmp_community", "label": "SNMP Community", "type": "text", "required": False},
        ],
        "webhook_url_template": "/api/v1/webhooks/{id}",
    },
    "palo_alto": {
        "label": "Palo Alto Networks (PAN-OS)",
        "category": "Network",
        "connection_type": "http",
        "icon": "paloalto",
        "description": "Palo Alto firewall — REST API / SNMP",
        "credential_fields": [
            {"key": "host",    "label": "Firewall IP / FQDN", "type": "text",     "required": True},
            {"key": "api_key", "label": "API Key",             "type": "password", "required": True},
        ],
    },
    "pan_scm": {
        "label": "Palo Alto Prisma (SCM)",
        "category": "Network",
        "connection_type": "http",
        "icon": "paloalto",
        "description": "Palo Alto Strata Cloud Manager",
        "credential_fields": [
            {"key": "client_id",     "label": "Client ID",     "type": "text",     "required": True},
            {"key": "client_secret", "label": "Client Secret", "type": "password", "required": True},
            {"key": "tsg_id",        "label": "TSG ID",        "type": "text",     "required": True},
        ],
    },
    "arista": {
        "label": "Arista EOS",
        "category": "Network",
        "connection_type": "http",
        "icon": "arista",
        "description": "Arista switches — eAPI / SNMP",
        "credential_fields": [
            {"key": "host",     "label": "Switch IP / FQDN", "type": "text",     "required": True},
            {"key": "username", "label": "Username",          "type": "text",     "required": True},
            {"key": "password", "label": "Password",          "type": "password", "required": True},
            {"key": "port",     "label": "eAPI Port",         "type": "number",   "required": False, "default": "443"},
        ],
    },
    # ── Virtual Machines / Servers ────────────────────────────────────
    "linux_vm": {
        "label": "Linux VM / Server",
        "category": "VM",
        "connection_type": "ssh",
        "icon": "linux",
        "description": "Any Linux server monitored via SSH + SNMP",
        "credential_fields": [
            {"key": "host",           "label": "IP / Hostname",   "type": "text",     "required": True},
            {"key": "username",       "label": "SSH Username",     "type": "text",     "required": True},
            {"key": "password",       "label": "SSH Password",     "type": "password", "required": False},
            {"key": "ssh_key",        "label": "SSH Private Key",  "type": "textarea", "required": False},
            {"key": "port",           "label": "SSH Port",         "type": "number",   "required": False, "default": "22"},
            {"key": "snmp_community", "label": "SNMP Community",   "type": "text",     "required": False, "default": "public"},
            {"key": "snmp_port",      "label": "SNMP Port",        "type": "number",   "required": False, "default": "161"},
            {"key": "services",       "label": "Services to Monitor (comma-separated)", "type": "text", "required": False},
        ],
    },
    "windows_vm": {
        "label": "Windows VM / Server",
        "category": "VM",
        "connection_type": "winrm",
        "icon": "windows",
        "description": "Windows server monitored via WinRM + SNMP",
        "credential_fields": [
            {"key": "host",           "label": "IP / Hostname",     "type": "text",     "required": True},
            {"key": "username",       "label": "Username (domain\\user)", "type": "text", "required": True},
            {"key": "password",       "label": "Password",           "type": "password", "required": True},
            {"key": "winrm_port",     "label": "WinRM Port",         "type": "number",   "required": False, "default": "5985"},
            {"key": "snmp_community", "label": "SNMP Community",     "type": "text",     "required": False, "default": "public"},
            {"key": "snmp_port",      "label": "SNMP Port",          "type": "number",   "required": False, "default": "161"},
            {"key": "services",       "label": "Windows Services to Monitor", "type": "text", "required": False},
        ],
    },
    # ── Monitoring ────────────────────────────────────────────────────
    "solarwinds": {
        "label": "SolarWinds NPM / SAM",
        "category": "Monitoring",
        "connection_type": "http",
        "icon": "solarwinds",
        "description": "SolarWinds Network & Systems Management",
        "credential_fields": [
            {"key": "url",      "label": "SolarWinds URL (https://...)", "type": "text",     "required": True},
            {"key": "username", "label": "Username",                     "type": "text",     "required": True},
            {"key": "password", "label": "Password",                     "type": "password", "required": True},
        ],
        "webhook_url_template": "/api/v1/webhooks/{id}",
    },
    "prometheus": {
        "label": "Prometheus / Alertmanager",
        "category": "Monitoring",
        "connection_type": "http",
        "icon": "prometheus",
        "description": "Prometheus metrics and Alertmanager webhooks",
        "credential_fields": [
            {"key": "url",      "label": "Prometheus URL",  "type": "text",     "required": True},
            {"key": "username", "label": "Username (if auth enabled)", "type": "text", "required": False},
            {"key": "password", "label": "Password",        "type": "password", "required": False},
        ],
        "webhook_url_template": "/api/v1/webhooks/{id}",
    },
    "splunk": {
        "label": "Splunk",
        "category": "Monitoring",
        "connection_type": "http",
        "icon": "splunk",
        "description": "Splunk SIEM — alerts and search",
        "credential_fields": [
            {"key": "url",      "label": "Splunk URL (https://...)", "type": "text",     "required": True},
            {"key": "username", "label": "Username",                 "type": "text",     "required": True},
            {"key": "password", "label": "Password",                 "type": "password", "required": True},
            {"key": "token",    "label": "Auth Token (alternative)", "type": "password", "required": False},
        ],
        "webhook_url_template": "/api/v1/webhooks/{id}",
    },
    "datadog": {
        "label": "Datadog",
        "category": "Monitoring",
        "connection_type": "http",
        "icon": "datadog",
        "description": "Datadog infrastructure monitoring and APM",
        "credential_fields": [
            {"key": "api_key", "label": "API Key",         "type": "password", "required": True},
            {"key": "app_key", "label": "Application Key", "type": "password", "required": True},
            {"key": "site",    "label": "Datadog Site (e.g. datadoghq.com)", "type": "text", "required": False, "default": "datadoghq.com"},
        ],
        "webhook_url_template": "/api/v1/webhooks/{id}",
    },
    # ── CMDB ──────────────────────────────────────────────────────────
    "netbox": {
        "label": "NetBox (CMDB)",
        "category": "CMDB",
        "connection_type": "http",
        "icon": "netbox",
        "description": "NetBox DCIM/IPAM — device inventory and changes",
        "credential_fields": [
            {"key": "url",            "label": "NetBox URL (https://...)", "type": "text",     "required": True},
            {"key": "token",          "label": "API Token",               "type": "password", "required": False},
            {"key": "username",       "label": "Username (if no token)",   "type": "text",     "required": False},
            {"key": "password",       "label": "Password",                 "type": "password", "required": False},
            {"key": "webhook_secret", "label": "Webhook Secret (HMAC-SHA512)", "type": "password", "required": False},
        ],
        "webhook_url_template": "/api/v1/webhooks/{id}",
    },
    # ── ITSM ─────────────────────────────────────────────────────────
    "jira": {
        "label": "Jira",
        "category": "ITSM",
        "connection_type": "http",
        "icon": "jira",
        "description": "Jira Cloud / Server — issue tracking",
        "credential_fields": [
            {"key": "url",       "label": "Jira URL (https://...)",  "type": "text",     "required": True},
            {"key": "email",     "label": "Email / Username",         "type": "text",     "required": True},
            {"key": "api_token", "label": "API Token",                "type": "password", "required": True},
        ],
        "webhook_url_template": "/api/v1/webhooks/{id}",
    },
    "servicenow": {
        "label": "ServiceNow",
        "category": "ITSM",
        "connection_type": "http",
        "icon": "snow",
        "description": "ServiceNow ITSM — incident and change management",
        "credential_fields": [
            {"key": "instance", "label": "Instance URL (https://...service-now.com)", "type": "text", "required": True},
            {"key": "username", "label": "Username",  "type": "text",     "required": True},
            {"key": "password", "label": "Password",  "type": "password", "required": True},
        ],
    },
    # ── Security ─────────────────────────────────────────────────────
    "sentinel": {
        "label": "Microsoft Sentinel",
        "category": "Security",
        "connection_type": "http",
        "icon": "azure",
        "description": "Microsoft Sentinel SIEM — security alerts",
        "credential_fields": [
            {"key": "workspace_id",   "label": "Workspace ID",     "type": "text",     "required": True},
            {"key": "tenant_id",      "label": "Tenant ID",        "type": "text",     "required": True},
            {"key": "client_id",      "label": "Client ID",        "type": "text",     "required": True},
            {"key": "client_secret",  "label": "Client Secret",    "type": "password", "required": True},
        ],
        "webhook_url_template": "/api/v1/webhooks/{id}",
    },
}

# ─────────────────────────────────────────────
# PYDANTIC SCHEMAS
# ─────────────────────────────────────────────

class IntegrationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tool_id: str
    credentials: dict
    tags: Optional[list] = []


class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    credentials: Optional[dict] = None
    tags: Optional[list] = None


# ─────────────────────────────────────────────
# CATALOGUE ENDPOINT
# ─────────────────────────────────────────────

@router.get("/catalogue")
async def get_catalogue():
    """Return the full device/system catalogue grouped by category."""
    grouped = {}
    for tool_id, info in DEVICE_CATALOGUE.items():
        cat = info["category"]
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append({
            "tool_id": tool_id,
            **{k: v for k, v in info.items() if k != "credential_fields"},
            "credential_fields": info["credential_fields"],
        })
    return {"catalogue": grouped}


# ─────────────────────────────────────────────
# CRUD
# ─────────────────────────────────────────────

@router.get("/")
async def list_integrations(category: Optional[str] = None, active_only: bool = False):
    """List all integrations, optionally filtered by category."""
    query = {}
    if category:
        query["category"] = category
    if active_only:
        query["is_active"] = True

    integrations = await mongo_service._db["integrations"].find(query).to_list(length=500)

    # Sanitize — never return raw credentials
    for i in integrations:
        i["_id"] = str(i["_id"])
        i.pop("credentials", None)

    return {"integrations": integrations, "total": len(integrations)}


@router.get("/{integration_id}")
async def get_integration(integration_id: str):
    """Get a single integration by ID (credentials omitted)."""
    from bson import ObjectId
    try:
        doc = await mongo_service._db["integrations"].find_one({"_id": ObjectId(integration_id)})
    except Exception:
        doc = await mongo_service._db["integrations"].find_one({"id": integration_id})

    if not doc:
        raise HTTPException(status_code=404, detail="Integration not found")

    doc["_id"] = str(doc["_id"])
    doc.pop("credentials", None)
    return doc


@router.post("/")
async def create_integration(data: IntegrationCreate):
    """Register a new integration. Credentials are stored as-is (add Vault in production)."""
    if data.tool_id not in DEVICE_CATALOGUE:
        raise HTTPException(status_code=400, detail=f"Unknown tool_id: {data.tool_id}. Check /integrations/catalogue")

    spec = DEVICE_CATALOGUE[data.tool_id]

    # Validate required fields
    missing = [
        f["key"] for f in spec["credential_fields"]
        if f.get("required") and not data.credentials.get(f["key"])
    ]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required credential fields: {missing}")

    integration_id = str(uuid.uuid4())

    doc = {
        "id":              integration_id,
        "name":            data.name,
        "description":     data.description or spec["description"],
        "tool_id":         data.tool_id,
        "category":        spec["category"],
        "connection_type": spec["connection_type"],
        "icon":            spec.get("icon", ""),
        "base_url":        _extract_base_url(data.tool_id, data.credentials),
        "credentials":     data.credentials,   # TODO: encrypt via vault in production
        "is_active":       True,
        "health_status":   "unknown",
        "last_health_check": None,
        "webhook_url":     f"/api/v1/webhooks/{integration_id}" if "webhook_url_template" in spec else None,
        "tags":            data.tags or [],
        "created_at":      datetime.now(timezone.utc).isoformat(),
        "updated_at":      datetime.now(timezone.utc).isoformat(),
    }

    await mongo_service._db["integrations"].insert_one(doc)
    logger.info(f"Created integration: {integration_id} ({data.tool_id}) — {data.name}")

    doc.pop("credentials", None)
    doc["_id"] = str(doc.get("_id", ""))
    return {"status": "created", "integration": doc}


@router.patch("/{integration_id}")
async def update_integration(integration_id: str, data: IntegrationUpdate):
    """Update an existing integration."""
    from bson import ObjectId
    try:
        query = {"_id": ObjectId(integration_id)}
    except Exception:
        query = {"id": integration_id}

    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.name is not None:
        updates["name"] = data.name
    if data.description is not None:
        updates["description"] = data.description
    if data.is_active is not None:
        updates["is_active"] = data.is_active
    if data.credentials is not None:
        updates["credentials"] = data.credentials
    if data.tags is not None:
        updates["tags"] = data.tags

    result = await mongo_service._db["integrations"].update_one(query, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Integration not found")

    return {"status": "updated", "integration_id": integration_id}


@router.delete("/{integration_id}")
async def delete_integration(integration_id: str):
    """Delete an integration."""
    from bson import ObjectId
    try:
        result = await mongo_service._db["integrations"].delete_one({"_id": ObjectId(integration_id)})
    except Exception:
        result = await mongo_service._db["integrations"].delete_one({"id": integration_id})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Integration not found")

    logger.info(f"Deleted integration: {integration_id}")
    return {"status": "deleted"}


# ─────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────

@router.post("/{integration_id}/health-check")
async def health_check(integration_id: str):
    """Test connectivity to an integration and update its health_status."""
    from bson import ObjectId
    try:
        doc = await mongo_service._db["integrations"].find_one({"_id": ObjectId(integration_id)})
    except Exception:
        doc = await mongo_service._db["integrations"].find_one({"id": integration_id})

    if not doc:
        raise HTTPException(status_code=404, detail="Integration not found")

    creds   = doc.get("credentials", {})
    tool_id = doc.get("tool_id", "")
    now_iso = datetime.now(timezone.utc).isoformat()

    status, message = await _run_health_check(tool_id, doc, creds)

    from bson import ObjectId as OID
    try:
        q = {"_id": OID(integration_id)}
    except Exception:
        q = {"id": integration_id}

    await mongo_service._db["integrations"].update_one(q, {"$set": {
        "health_status":     status,
        "last_health_check": now_iso,
        "updated_at":        now_iso,
    }})

    return {"status": status, "message": message, "checked_at": now_iso}


async def _run_health_check(tool_id: str, doc: dict, creds: dict):
    """Dispatch health check by tool type. Returns (status, message)."""
    try:
        if tool_id in ("meraki",):
            url = "https://api.meraki.com/api/v1/organizations"
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get(url, headers={"X-Cisco-Meraki-API-Key": creds.get("api_key","")})
            if r.status_code == 200:
                return "healthy", f"Meraki API reachable — {len(r.json())} orgs"
            return "down", f"HTTP {r.status_code}"

        elif tool_id in ("netbox",):
            url = (creds.get("url") or doc.get("base_url","")).rstrip("/")
            token = creds.get("token","")
            async with httpx.AsyncClient(verify=False, timeout=10) as c:
                r = await c.get(f"{url}/api/", headers={"Authorization": f"Token {token}", "Accept":"application/json"})
            if r.status_code == 200:
                return "healthy", f"NetBox v{r.json().get('netbox-version','?')} reachable"
            return "down", f"HTTP {r.status_code}"

        elif tool_id in ("jira",):
            url = (creds.get("url") or doc.get("base_url","")).rstrip("/")
            import base64
            auth = base64.b64encode(f"{creds.get('email','')}:{creds.get('api_token','')}".encode()).decode()
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get(f"{url}/rest/api/3/myself", headers={"Authorization": f"Basic {auth}", "Accept":"application/json"})
            if r.status_code == 200:
                return "healthy", f"Jira authenticated as {r.json().get('displayName','?')}"
            return "down", f"HTTP {r.status_code}"

        elif tool_id in ("splunk",):
            url = (creds.get("url") or doc.get("base_url","")).rstrip("/")
            token = creds.get("token","")
            if token:
                headers = {"Authorization": f"Splunk {token}"}
            else:
                headers = {}
            async with httpx.AsyncClient(verify=False, timeout=10) as c:
                r = await c.get(f"{url}/services/server/info?output_mode=json", headers=headers)
            if r.status_code == 200:
                return "healthy", "Splunk reachable"
            return "down", f"HTTP {r.status_code}"

        elif tool_id in ("solarwinds",):
            url = (creds.get("url") or doc.get("base_url","")).rstrip("/")
            async with httpx.AsyncClient(verify=False, timeout=10) as c:
                r = await c.get(
                    f"{url}/SolarWinds/InformationService/v3/Json/Query?query=SELECT+Top+1+NodeID+FROM+Orion.Nodes",
                    auth=(creds.get("username",""), creds.get("password",""))
                )
            if r.status_code == 200:
                return "healthy", "SolarWinds API reachable"
            return "down", f"HTTP {r.status_code}"

        elif tool_id in ("datadog",):
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get(
                    f"https://api.{creds.get('site','datadoghq.com')}/api/v1/validate",
                    headers={"DD-API-KEY": creds.get("api_key",""), "DD-APPLICATION-KEY": creds.get("app_key","")}
                )
            if r.status_code == 200:
                return "healthy", "Datadog API key valid"
            return "down", f"HTTP {r.status_code}"

        elif tool_id in ("linux_vm", "windows_vm"):
            host = creds.get("host", doc.get("base_url",""))
            if not host:
                return "unknown", "No host configured"
            # Simple ICMP-style check via TCP port probe
            port = int(creds.get("port", 22 if tool_id == "linux_vm" else 5985))
            try:
                reader, writer = await asyncio.wait_for(
                    asyncio.open_connection(host, port), timeout=5
                )
                writer.close()
                await writer.wait_closed()
                return "healthy", f"Port {port} reachable on {host}"
            except (ConnectionRefusedError, OSError):
                return "down", f"Port {port} not reachable on {host}"
            except asyncio.TimeoutError:
                return "down", f"Connection timeout to {host}:{port}"

        else:
            return "unknown", f"No health check implemented for {tool_id}"

    except httpx.ConnectError as e:
        return "down", f"Connection refused: {str(e)[:80]}"
    except httpx.TimeoutException:
        return "down", "Connection timeout"
    except Exception as e:
        logger.error(f"Health check error for {tool_id}: {e}")
        return "down", f"Error: {str(e)[:120]}"


# ─────────────────────────────────────────────
# DYNAMIC WEBHOOK RECEIVER
# ─────────────────────────────────────────────

webhook_router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@webhook_router.post("/{integration_id}")
async def receive_webhook(integration_id: str, request: Request):
    """
    Generic webhook receiver for any registered integration.
    Validates HMAC if a webhook_secret is configured, then
    creates a raw event in MongoDB for the incident agent to pick up.
    """
    from bson import ObjectId
    try:
        doc = await mongo_service._db["integrations"].find_one({"id": integration_id})
        if not doc:
            doc = await mongo_service._db["integrations"].find_one({"_id": ObjectId(integration_id)})
    except Exception:
        doc = None

    if not doc:
        raise HTTPException(status_code=404, detail="Integration not found")

    body    = await request.body()
    payload = {}
    try:
        payload = await request.json()
    except Exception:
        pass

    # HMAC verification if webhook_secret configured in credentials
    webhook_secret = doc.get("credentials", {}).get("webhook_secret", "")
    if webhook_secret:
        sig_header = (
            request.headers.get("x-hub-signature-256","") or
            request.headers.get("x-hook-signature","") or
            request.headers.get("x-signature","")
        )
        if sig_header:
            algo = "sha512" if "sha512" in sig_header.lower() else "sha256"
            expected = hmac.new(webhook_secret.encode(), body, getattr(hashlib, algo)).hexdigest()
            if not hmac.compare_digest(sig_header.split("=")[-1], expected):
                raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Store raw event for incident agent to process
    event_doc = {
        "integration_id":   integration_id,
        "tool_id":          doc.get("tool_id"),
        "category":         doc.get("category"),
        "integration_name": doc.get("name"),
        "raw_payload":      payload,
        "headers":          dict(request.headers),
        "received_at":      datetime.now(timezone.utc).isoformat(),
        "processed":        False,
    }
    await mongo_service._db["webhook_events"].insert_one(event_doc)
    logger.info(f"Webhook received: {doc.get('tool_id')} / {integration_id}")

    return {"status": "received", "integration": doc.get("name")}


@webhook_router.get("/health")
async def webhook_health():
    return {"status": "healthy", "supported_sources": list(DEVICE_CATALOGUE.keys())}


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def _extract_base_url(tool_id: str, creds: dict) -> Optional[str]:
    if tool_id == "meraki":
        return "https://api.meraki.com/api/v1"
    if tool_id == "pan_scm":
        return "https://api.sase.paloaltonetworks.com"
    if tool_id in ("netbox", "jira", "splunk", "solarwinds", "servicenow"):
        return (creds.get("url") or creds.get("instance") or "").rstrip("/")
    if tool_id in ("linux_vm", "windows_vm", "cisco_ios", "cisco_8kv", "arista"):
        return creds.get("host","")
    if tool_id == "cisco_fmc":
        h = creds.get("fmc_host","").strip().replace("https://","").replace("http://","")
        return f"https://{h}" if h else ""
    if tool_id == "palo_alto":
        h = creds.get("host","").strip().replace("https://","").replace("http://","")
        return f"https://{h}" if h else ""
    if tool_id == "datadog":
        return f"https://api.{creds.get('site','datadoghq.com')}"
    return None
