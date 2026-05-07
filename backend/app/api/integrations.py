"""
integrations.py — Gruve NOC Integration Manager
Location: backend/app/api/integrations.py

Handles:
- Device/system catalogue
- CRUD for all integrations
- VM setup script generation (full step-by-step)
- AAP auto-registration
- Dynamic webhook receiver
- Health checks
"""

import asyncio
import datetime
import hashlib
import hmac
import json
import logging
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.services.mongo import mongo_service

logger = logging.getLogger("gruve.noc.integrations")

router         = APIRouter(prefix="/integrations", tags=["integrations"])
webhook_router = APIRouter(prefix="/webhooks",     tags=["webhooks"])

# ─────────────────────────────────────────────────────────────────────────────
# AAP CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────
AAP_CONTROLLER_URL = "https://aap-controller-aap.apps.ocp-mig2.gruveai.com"
AAP_TOKEN          = "esBXwLQlbRM7QgLguqeqWl231utzVX"
AAP_INVENTORY_ID   = 2       # NJ-Infrastructure
AAP_SSH_CRED_ID    = 3       # HAProxy-SSH (Machine credential)
NOC_AGENT_IP       = "10.7.51.114"
NOC_AGENT_PORT     = "31162"

ANSIBLE_PUB_KEY_PATH = "/home/bhupesh/.ssh/ansible-pem-key.pub"
ANSIBLE_PRI_KEY_PATH = "/home/bhupesh/.ssh/ansible-id-rsa"

# ─────────────────────────────────────────────────────────────────────────────
# DEVICE CATALOGUE
# ─────────────────────────────────────────────────────────────────────────────
DEVICE_CATALOGUE = {
    "meraki": {
        "label": "Cisco Meraki", "category": "Network",
        "connection_type": "http", "icon": "meraki",
        "description": "Cisco Meraki cloud-managed networking",
        "webhook_url_template": "/api/v1/webhooks/{id}",
        "credential_fields": [
            {"key": "api_key", "label": "API Key",         "type": "password", "required": True},
            {"key": "org_id",  "label": "Organization ID", "type": "text",     "required": True},
        ],
    },
    "cisco_ios": {
        "label": "Cisco IOS / IOS-XE", "category": "Network",
        "connection_type": "ssh", "icon": "cisco",
        "description": "Cisco routers and switches (SSH/SNMP)",
        "credential_fields": [
            {"key": "host",           "label": "IP / Hostname",    "type": "text",     "required": True},
            {"key": "username",       "label": "Username",         "type": "text",     "required": True},
            {"key": "password",       "label": "Password",         "type": "password", "required": True},
            {"key": "enable_secret",  "label": "Enable Secret",    "type": "password", "required": False},
            {"key": "port",           "label": "SSH Port",         "type": "number",   "required": False, "default": "22"},
            {"key": "snmp_community", "label": "SNMP Community",   "type": "text",     "required": False},
        ],
    },
    "cisco_fmc": {
        "label": "Cisco FMC (Firepower)", "category": "Network",
        "connection_type": "http", "icon": "cisco",
        "description": "Cisco Firepower Management Center",
        "credential_fields": [
            {"key": "fmc_host", "label": "FMC Host / IP", "type": "text",     "required": True},
            {"key": "username", "label": "Username",       "type": "text",     "required": True},
            {"key": "password", "label": "Password",       "type": "password", "required": True},
        ],
    },
    "cisco_8kv": {
        "label": "Cisco Catalyst 8000V", "category": "Network",
        "connection_type": "ssh", "icon": "cisco",
        "description": "Cisco Catalyst 8000V virtual router",
        "webhook_url_template": "/api/v1/webhooks/{id}",
        "credential_fields": [
            {"key": "host",           "label": "IP / Hostname",  "type": "text",     "required": True},
            {"key": "username",       "label": "Username",       "type": "text",     "required": True},
            {"key": "password",       "label": "Password",       "type": "password", "required": True},
            {"key": "snmp_community", "label": "SNMP Community", "type": "text",     "required": False},
        ],
    },
    "palo_alto": {
        "label": "Palo Alto Networks (PAN-OS)", "category": "Network",
        "connection_type": "http", "icon": "paloalto",
        "description": "Palo Alto firewall — REST API / SNMP",
        "credential_fields": [
            {"key": "host",    "label": "Firewall IP / FQDN", "type": "text",     "required": True},
            {"key": "api_key", "label": "API Key",             "type": "password", "required": True},
        ],
    },
    "pan_scm": {
        "label": "Palo Alto Prisma (SCM)", "category": "Network",
        "connection_type": "http", "icon": "paloalto",
        "description": "Palo Alto Strata Cloud Manager",
        "credential_fields": [
            {"key": "client_id",     "label": "Client ID",     "type": "text",     "required": True},
            {"key": "client_secret", "label": "Client Secret", "type": "password", "required": True},
            {"key": "tsg_id",        "label": "TSG ID",        "type": "text",     "required": True},
        ],
    },
    "arista": {
        "label": "Arista EOS", "category": "Network",
        "connection_type": "http", "icon": "arista",
        "description": "Arista switches — eAPI / SNMP",
        "credential_fields": [
            {"key": "host",     "label": "Switch IP / FQDN", "type": "text",     "required": True},
            {"key": "username", "label": "Username",          "type": "text",     "required": True},
            {"key": "password", "label": "Password",          "type": "password", "required": True},
            {"key": "port",     "label": "eAPI Port",         "type": "number",   "required": False, "default": "443"},
        ],
    },
    "linux_vm": {
        "label": "Linux VM / Server", "category": "VM",
        "connection_type": "ssh", "icon": "linux",
        "description": "Any Linux server monitored via SSH + SNMP",
        "credential_fields": [
            {"key": "host",           "label": "IP Address (e.g. 10.7.51.136)",    "type": "text",     "required": True, "hint": "Enter IP address only — must match what hostname command returns on the VM"},
            {"key": "username",       "label": "Root / Admin Username",             "type": "text",     "required": True},
            {"key": "password",       "label": "Root / Admin Password",             "type": "password", "required": False},
            {"key": "port",           "label": "SSH Port",                          "type": "number",   "required": False, "default": "22"},
            {"key": "snmp_community", "label": "SNMP Community",                    "type": "text",     "required": False, "default": "public"},
            {"key": "snmp_port",      "label": "SNMP Port",                         "type": "number",   "required": False, "default": "161"},
            {"key": "services",       "label": "Services to Monitor (comma-separated)", "type": "text", "required": False},
        ],
    },
    "windows_vm": {
        "label": "Windows VM / Server", "category": "VM",
        "connection_type": "winrm", "icon": "windows",
        "description": "Windows server monitored via WinRM + SNMP",
        "credential_fields": [
            {"key": "host",           "label": "IP Address (e.g. 10.7.51.x)","type": "text",     "required": True, "hint": "Enter IP address only"},
            {"key": "username",       "label": "Username (domain\\\\user)",  "type": "text",     "required": True},
            {"key": "password",       "label": "Password",                   "type": "password", "required": True},
            {"key": "winrm_port",     "label": "WinRM Port",                 "type": "number",   "required": False, "default": "5985"},
            {"key": "snmp_community", "label": "SNMP Community",             "type": "text",     "required": False, "default": "public"},
            {"key": "snmp_port",      "label": "SNMP Port",                  "type": "number",   "required": False, "default": "161"},
            {"key": "services",       "label": "Windows Services to Monitor","type": "text",     "required": False},
        ],
    },
    "solarwinds": {
        "label": "SolarWinds NPM / SAM", "category": "Monitoring",
        "connection_type": "http", "icon": "solarwinds",
        "description": "SolarWinds Network & Systems Management",
        "webhook_url_template": "/api/v1/webhooks/{id}",
        "credential_fields": [
            {"key": "url",      "label": "SolarWinds URL (https://...)", "type": "text",     "required": True},
            {"key": "username", "label": "Username",                     "type": "text",     "required": True},
            {"key": "password", "label": "Password",                     "type": "password", "required": True},
        ],
    },
    "prometheus": {
        "label": "Prometheus / Alertmanager", "category": "Monitoring",
        "connection_type": "http", "icon": "prometheus",
        "description": "Prometheus metrics and Alertmanager webhooks",
        "webhook_url_template": "/api/v1/webhooks/{id}",
        "credential_fields": [
            {"key": "url",      "label": "Prometheus URL",             "type": "text",     "required": True},
            {"key": "username", "label": "Username (if auth enabled)", "type": "text",     "required": False},
            {"key": "password", "label": "Password",                   "type": "password", "required": False},
        ],
    },
    "splunk": {
        "label": "Splunk", "category": "Monitoring",
        "connection_type": "http", "icon": "splunk",
        "description": "Splunk SIEM — alerts and search",
        "webhook_url_template": "/api/v1/webhooks/{id}",
        "credential_fields": [
            {"key": "url",      "label": "Splunk URL (https://...)", "type": "text",     "required": True},
            {"key": "username", "label": "Username",                 "type": "text",     "required": True},
            {"key": "password", "label": "Password",                 "type": "password", "required": True},
            {"key": "token",    "label": "Auth Token (alternative)", "type": "password", "required": False},
        ],
    },
    "datadog": {
        "label": "Datadog", "category": "Monitoring",
        "connection_type": "http", "icon": "datadog",
        "description": "Datadog infrastructure monitoring and APM",
        "webhook_url_template": "/api/v1/webhooks/{id}",
        "credential_fields": [
            {"key": "api_key", "label": "API Key",         "type": "password", "required": True},
            {"key": "app_key", "label": "Application Key", "type": "password", "required": True},
            {"key": "site",    "label": "Datadog Site",    "type": "text",     "required": False, "default": "datadoghq.com"},
        ],
    },
    "netbox": {
        "label": "NetBox (CMDB)", "category": "CMDB",
        "connection_type": "http", "icon": "netbox",
        "description": "NetBox DCIM/IPAM — device inventory and changes",
        "webhook_url_template": "/api/v1/webhooks/{id}",
        "credential_fields": [
            {"key": "url",            "label": "NetBox URL (https://...)",      "type": "text",     "required": True},
            {"key": "token",          "label": "API Token",                     "type": "password", "required": False},
            {"key": "username",       "label": "Username (if no token)",        "type": "text",     "required": False},
            {"key": "password",       "label": "Password",                      "type": "password", "required": False},
            {"key": "webhook_secret", "label": "Webhook Secret (HMAC-SHA512)", "type": "password", "required": False},
        ],
    },
    "jira": {
        "label": "Jira", "category": "ITSM",
        "connection_type": "http", "icon": "jira",
        "description": "Jira Cloud / Server — issue tracking",
        "webhook_url_template": "/api/v1/webhooks/{id}",
        "credential_fields": [
            {"key": "url",       "label": "Jira URL (https://...)", "type": "text",     "required": True},
            {"key": "email",     "label": "Email / Username",        "type": "text",     "required": True},
            {"key": "api_token", "label": "API Token",               "type": "password", "required": True},
        ],
    },
    "servicenow": {
        "label": "ServiceNow", "category": "ITSM",
        "connection_type": "http", "icon": "snow",
        "description": "ServiceNow ITSM — incident and change management",
        "credential_fields": [
            {"key": "instance", "label": "Instance URL (https://...service-now.com)", "type": "text",     "required": True},
            {"key": "username", "label": "Username",                                   "type": "text",     "required": True},
            {"key": "password", "label": "Password",                                   "type": "password", "required": True},
        ],
    },
    "sentinel": {
        "label": "Microsoft Sentinel", "category": "Security",
        "connection_type": "http", "icon": "azure",
        "description": "Microsoft Sentinel SIEM — security alerts",
        "webhook_url_template": "/api/v1/webhooks/{id}",
        "credential_fields": [
            {"key": "workspace_id",  "label": "Workspace ID",   "type": "text",     "required": True},
            {"key": "tenant_id",     "label": "Tenant ID",      "type": "text",     "required": True},
            {"key": "client_id",     "label": "Client ID",      "type": "text",     "required": True},
            {"key": "client_secret", "label": "Client Secret",  "type": "password", "required": True},
        ],
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# SCHEMAS
# ─────────────────────────────────────────────────────────────────────────────

class IntegrationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    tool_id: str
    credentials: dict
    tags: Optional[list] = []

class IntegrationUpdate(BaseModel):
    name: Optional[str]        = None
    description: Optional[str] = None
    is_active: Optional[bool]  = None
    credentials: Optional[dict]= None
    tags: Optional[list]       = None

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()

def _extract_base_url(tool_id: str, creds: dict) -> Optional[str]:
    if tool_id == "meraki":   return "https://api.meraki.com/api/v1"
    if tool_id == "pan_scm":  return "https://api.sase.paloaltonetworks.com"
    if tool_id in ("netbox", "jira", "splunk", "solarwinds", "servicenow"):
        return (creds.get("url") or creds.get("instance") or "").rstrip("/")
    if tool_id in ("linux_vm", "windows_vm", "cisco_ios", "cisco_8kv", "arista"):
        return creds.get("host", "")
    if tool_id == "cisco_fmc":
        h = creds.get("fmc_host", "").strip().replace("https://","").replace("http://","")
        return f"https://{h}" if h else ""
    if tool_id == "palo_alto":
        h = creds.get("host", "").strip().replace("https://","").replace("http://","")
        return f"https://{h}" if h else ""
    if tool_id == "datadog":
        return f"https://api.{creds.get('site','datadoghq.com')}"
    return None

async def _get_doc(integration_id: str):
    from bson import ObjectId
    doc = await mongo_service._db["integrations"].find_one({"id": integration_id})
    if not doc:
        try:
            doc = await mongo_service._db["integrations"].find_one({"_id": ObjectId(integration_id)})
        except Exception:
            pass
    return doc

async def _query(integration_id: str):
    from bson import ObjectId
    try:
        return {"_id": ObjectId(integration_id)}
    except Exception:
        return {"id": integration_id}

# ─────────────────────────────────────────────────────────────────────────────
# CATALOGUE
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/catalogue")
async def get_catalogue():
    grouped = {}
    for tool_id, info in DEVICE_CATALOGUE.items():
        cat = info["category"]
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append({"tool_id": tool_id, **info})
    return {"catalogue": grouped}

# ─────────────────────────────────────────────────────────────────────────────
# CRUD
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/")
async def list_integrations(category: Optional[str] = None, active_only: bool = False):
    query = {}
    if category:    query["category"]  = category
    if active_only: query["is_active"] = True
    docs = await mongo_service._db["integrations"].find(query).to_list(length=500)
    for d in docs:
        d["_id"] = str(d["_id"])
        d.pop("credentials", None)
    return {"integrations": docs, "total": len(docs)}


@router.get("/{integration_id}")
async def get_integration(integration_id: str):
    doc = await _get_doc(integration_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Integration not found")
    doc["_id"] = str(doc["_id"])
    doc.pop("credentials", None)
    return doc


@router.post("/")
async def create_integration(data: IntegrationCreate):
    if data.tool_id not in DEVICE_CATALOGUE:
        raise HTTPException(status_code=400, detail=f"Unknown tool_id: {data.tool_id}")
    spec = DEVICE_CATALOGUE[data.tool_id]
    missing = [f["key"] for f in spec["credential_fields"]
               if f.get("required") and not data.credentials.get(f["key"])]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required fields: {missing}")

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
        "credentials":     data.credentials,
        "is_active":       True,
        "health_status":   "unknown",
        "last_health_check": None,
        "webhook_url":     f"/api/v1/webhooks/{integration_id}" if "webhook_url_template" in spec else None,
        "tags":            data.tags or [],
        "aap_host_id":     None,
        "aap_inventory":   None,
        "created_at":      _now(),
        "updated_at":      _now(),
    }
    await mongo_service._db["integrations"].insert_one(doc)
    logger.info(f"Created integration: {integration_id} ({data.tool_id}) — {data.name}")
    doc.pop("credentials", None)
    doc["_id"] = str(doc.get("_id", ""))
    return {"status": "created", "integration": doc}


@router.patch("/{integration_id}")
async def update_integration(integration_id: str, data: IntegrationUpdate):
    updates = {"updated_at": _now()}
    if data.name        is not None: updates["name"]        = data.name
    if data.description is not None: updates["description"] = data.description
    if data.is_active   is not None: updates["is_active"]   = data.is_active
    if data.credentials is not None: updates["credentials"] = data.credentials
    if data.tags        is not None: updates["tags"]        = data.tags
    result = await mongo_service._db["integrations"].update_one(
        await _query(integration_id), {"$set": updates}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Integration not found")
    return {"status": "updated", "integration_id": integration_id}


@router.delete("/{integration_id}")
async def delete_integration(integration_id: str):
    result = await mongo_service._db["integrations"].delete_one(await _query(integration_id))
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Integration not found")
    logger.info(f"Deleted integration: {integration_id}")
    return {"status": "deleted"}

# ─────────────────────────────────────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{integration_id}/health-check")
async def health_check(integration_id: str):
    doc = await _get_doc(integration_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Integration not found")
    creds   = doc.get("credentials", {})
    tool_id = doc.get("tool_id", "")
    now_iso = _now()
    status, message = await _run_health_check(tool_id, doc, creds)
    await mongo_service._db["integrations"].update_one(
        await _query(integration_id),
        {"$set": {"health_status": status, "last_health_check": now_iso, "updated_at": now_iso}}
    )
    return {"status": status, "message": message, "checked_at": now_iso}


async def _run_health_check(tool_id, doc, creds):
    try:
        if tool_id == "meraki":
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get("https://api.meraki.com/api/v1/organizations",
                                headers={"X-Cisco-Meraki-API-Key": creds.get("api_key","")})
            return ("healthy", f"Meraki API reachable — {len(r.json())} orgs") if r.status_code==200 else ("down", f"HTTP {r.status_code}")

        elif tool_id == "netbox":
            url = (creds.get("url") or doc.get("base_url","")).rstrip("/")
            async with httpx.AsyncClient(verify=False, timeout=10) as c:
                r = await c.get(f"{url}/api/", headers={"Authorization": f"Token {creds.get('token','')}", "Accept":"application/json"})
            return ("healthy", f"NetBox reachable") if r.status_code==200 else ("down", f"HTTP {r.status_code}")

        elif tool_id == "jira":
            import base64
            url  = (creds.get("url") or doc.get("base_url","")).rstrip("/")
            auth = base64.b64encode(f"{creds.get('email','')}:{creds.get('api_token','')}".encode()).decode()
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get(f"{url}/rest/api/3/myself", headers={"Authorization": f"Basic {auth}", "Accept":"application/json"})
            return ("healthy", f"Jira authenticated as {r.json().get('displayName','?')}") if r.status_code==200 else ("down", f"HTTP {r.status_code}")

        elif tool_id == "splunk":
            url = (creds.get("url") or doc.get("base_url","")).rstrip("/")
            headers = {"Authorization": f"Splunk {creds.get('token','')}"}
            async with httpx.AsyncClient(verify=False, timeout=10) as c:
                r = await c.get(f"{url}/services/server/info?output_mode=json", headers=headers)
            return ("healthy", "Splunk reachable") if r.status_code==200 else ("down", f"HTTP {r.status_code}")

        elif tool_id == "solarwinds":
            url = (creds.get("url") or doc.get("base_url","")).rstrip("/")
            async with httpx.AsyncClient(verify=False, timeout=10) as c:
                r = await c.get(f"{url}/SolarWinds/InformationService/v3/Json/Query?query=SELECT+Top+1+NodeID+FROM+Orion.Nodes",
                                auth=(creds.get("username",""), creds.get("password","")))
            return ("healthy", "SolarWinds reachable") if r.status_code==200 else ("down", f"HTTP {r.status_code}")

        elif tool_id == "datadog":
            async with httpx.AsyncClient(timeout=10) as c:
                r = await c.get(f"https://api.{creds.get('site','datadoghq.com')}/api/v1/validate",
                                headers={"DD-API-KEY": creds.get("api_key",""), "DD-APPLICATION-KEY": creds.get("app_key","")})
            return ("healthy", "Datadog API key valid") if r.status_code==200 else ("down", f"HTTP {r.status_code}")

        elif tool_id in ("linux_vm", "windows_vm"):
            host = creds.get("host", doc.get("base_url",""))
            port = int(creds.get("port", 22) if tool_id=="linux_vm" else creds.get("winrm_port", 5985))
            try:
                reader, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=5)
                writer.close(); await writer.wait_closed()
                return ("healthy", f"Port {port} reachable on {host}")
            except asyncio.TimeoutError:
                return ("down", f"Timeout connecting to {host}:{port}")
            except Exception as e:
                return ("down", f"Cannot reach {host}:{port} — {str(e)[:60]}")

        else:
            return ("unknown", f"No health check implemented for {tool_id}")

    except httpx.ConnectError as e:
        return ("down", f"Connection refused: {str(e)[:80]}")
    except httpx.TimeoutException:
        return ("down", "Connection timeout")
    except Exception as e:
        return ("down", f"Error: {str(e)[:100]}")

# ─────────────────────────────────────────────────────────────────────────────
# SETUP SCRIPT GENERATOR  (full step-by-step for new VMs)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{integration_id}/setup-script")
async def get_setup_script(integration_id: str):
    doc = await _get_doc(integration_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Integration not found")

    tool_id  = doc.get("tool_id")
    creds    = doc.get("credentials", {})
    name     = doc.get("name", "vm")
    host     = creds.get("host", "YOUR_VM_IP")
    username = creds.get("username", "root")
    services = creds.get("services", "sshd")
    snmp_com = creds.get("snmp_community", "public")
    port     = creds.get("port", "22")

    svc_list = [s.strip() for s in services.split(",") if s.strip()] if services else ["sshd"]
    svc_bash = " ".join(f'"{s}"' for s in svc_list)

    if tool_id == "linux_vm":
        step0 = f"""# ═══════════════════════════════════════════════════════════
# STEP 0 — Prerequisites check
# Run on: {host} as root
# ═══════════════════════════════════════════════════════════

# Check if ansible user already exists
id ansible 2>/dev/null && echo "✓ ansible user exists" || echo "✗ ansible user missing — run Step 1"

# Check if snmptrap is installed
which snmptrap && echo "✓ snmptrap installed" || echo "✗ snmptrap missing — will install in Step 2"

# Check if net-snmp-utils is installed
rpm -q net-snmp-utils 2>/dev/null || apt list --installed 2>/dev/null | grep snmp
"""

        step1 = f"""# ═══════════════════════════════════════════════════════════
# STEP 1 — Create ansible user + sudoers
# Run on: {host} as root
# ═══════════════════════════════════════════════════════════

# Create ansible user (skip if already exists)
id ansible 2>/dev/null || useradd -m -s /bin/bash ansible

# Create .ssh directory
mkdir -p /home/ansible/.ssh
chmod 700 /home/ansible/.ssh
chown ansible:ansible /home/ansible/.ssh

# Add ansible to sudoers (passwordless)
echo "ansible ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/ansible
chmod 440 /etc/sudoers.d/ansible

# Verify
id ansible && echo "✓ ansible user created"
sudo -l -U ansible | grep NOPASSWD && echo "✓ sudoers configured"
"""

        step2 = f"""# ═══════════════════════════════════════════════════════════
# STEP 2 — Install SNMP monitor script
# Run on: {host} as root
# ═══════════════════════════════════════════════════════════

# Install net-snmp-utils (provides snmptrap command)
dnf install -y net-snmp-utils 2>/dev/null || \\
  yum install -y net-snmp-utils 2>/dev/null || \\
  apt-get install -y snmp 2>/dev/null

# Verify snmptrap is available
which snmptrap && echo "✓ snmptrap ready"

# Create the monitor script
cat > /usr/local/bin/snmp-service-monitor.sh << 'SCRIPT'
#!/bin/bash
# Gruve NOC — SNMP Service Monitor
# Auto-generated for: {name} ({host})
# Sends traps to NOC Agent at {NOC_AGENT_IP}:{NOC_AGENT_PORT}

NOC_AGENT_IP="{NOC_AGENT_IP}"
NOC_AGENT_PORT="{NOC_AGENT_PORT}"
COMMUNITY="{snmp_com}"
HOSTNAME=$(hostname)
HOST_IP=$(ip addr show | grep "inet " | grep -v "127.0.0.1" | head -1 | awk '{{print $2}}' | cut -d/ -f1)
SERVICES=({svc_bash})
STATE_DIR="/var/run/snmp-monitor"
mkdir -p $STATE_DIR

for SVC in "${{SERVICES[@]}}"; do
    STATE_FILE="$STATE_DIR/$SVC.state"
    CURRENT_STATE=$(systemctl is-active $SVC 2>/dev/null)
    PREVIOUS_STATE=$(cat $STATE_FILE 2>/dev/null)

    # First run — initialise state file only
    if [ ! -f "$STATE_FILE" ]; then
        echo "$CURRENT_STATE" > "$STATE_FILE"
        continue
    fi

    # Service went DOWN
    if [ "$CURRENT_STATE" != "active" ] && [ "$PREVIOUS_STATE" = "active" ]; then
        echo "inactive" > "$STATE_FILE"
        logger -t snmp-monitor "Service $SVC went DOWN on $HOSTNAME"
        snmptrap -v 2c -c $COMMUNITY $NOC_AGENT_IP:$NOC_AGENT_PORT "" \\
            .1.3.6.1.4.1.99999.1.1 \\
            .1.3.6.1.4.1.99999.1.1.1 s "$HOSTNAME" \\
            .1.3.6.1.4.1.99999.1.1.2 s "$SVC" \\
            .1.3.6.1.4.1.99999.1.1.3 s "service_down" \\
            .1.3.6.1.4.1.99999.1.1.4 s "$HOST_IP" \\
            .1.3.6.1.4.1.99999.1.1.5 s "critical" \\
            .1.3.6.1.4.1.99999.1.1.6 s "VM_SERVICE_DOWN"
    fi

    # Service came back UP
    if [ "$CURRENT_STATE" = "active" ] && [ "$PREVIOUS_STATE" != "active" ]; then
        echo "active" > "$STATE_FILE"
        logger -t snmp-monitor "Service $SVC came UP on $HOSTNAME"
        snmptrap -v 2c -c $COMMUNITY $NOC_AGENT_IP:$NOC_AGENT_PORT "" \\
            .1.3.6.1.4.1.99999.1.1 \\
            .1.3.6.1.4.1.99999.1.1.1 s "$HOSTNAME" \\
            .1.3.6.1.4.1.99999.1.1.2 s "$SVC" \\
            .1.3.6.1.4.1.99999.1.1.3 s "service_up" \\
            .1.3.6.1.4.1.99999.1.1.4 s "$HOST_IP" \\
            .1.3.6.1.4.1.99999.1.1.5 s "ok" \\
            .1.3.6.1.4.1.99999.1.1.6 s "VM_SERVICE_RECOVERED"
    fi
done
SCRIPT

chmod +x /usr/local/bin/snmp-service-monitor.sh

# Install cron job (runs every minute)
echo "* * * * * root /usr/local/bin/snmp-service-monitor.sh" > /etc/cron.d/snmp-monitor
chmod 644 /etc/cron.d/snmp-monitor

# Verify
cat /etc/cron.d/snmp-monitor && echo "✓ Cron job installed"
ls -la /usr/local/bin/snmp-service-monitor.sh && echo "✓ Monitor script ready"
"""

        step3 = f"""# ═══════════════════════════════════════════════════════════
# STEP 3 — Copy Ansible SSH key to this VM
# Run on: BASTION (mig-jump) as bhupesh
# ═══════════════════════════════════════════════════════════

# Copy the Gruve NOC ansible public key to the new VM
ssh-copy-id -f -i /home/bhupesh/.ssh/ansible-pem-key.pub -p {port} ansible@{host}

# If ssh-copy-id fails (password auth disabled), do it manually:
# cat /home/bhupesh/.ssh/ansible-pem-key.pub | ssh {username}@{host} \\
#   "sudo mkdir -p /home/ansible/.ssh && \\
#    sudo tee -a /home/ansible/.ssh/authorized_keys && \\
#    sudo chmod 600 /home/ansible/.ssh/authorized_keys && \\
#    sudo chown -R ansible:ansible /home/ansible/.ssh"
"""

        step4 = f"""# ═══════════════════════════════════════════════════════════
# STEP 4 — Test Ansible SSH connection
# Run on: BASTION (mig-jump) as bhupesh
# ═══════════════════════════════════════════════════════════

# Test ping (should return SUCCESS)
ansible -i '{host},' all \\
  --private-key /home/bhupesh/.ssh/ansible-id-rsa \\
  -u ansible -m ping

# Test sudo works
ansible -i '{host},' all \\
  --private-key /home/bhupesh/.ssh/ansible-id-rsa \\
  -u ansible --become -m command -a "whoami"
# Expected output: root

# If both return SUCCESS — Ansible can remediate this VM ✓
"""

        # Pick a safe test service — never use sshd
        test_svc = next((s for s in svc_list if s not in ("sshd", "ssh")), svc_list[0] if svc_list else "firewalld")

        step5 = f"""# ═══════════════════════════════════════════════════════════
# STEP 5 — End-to-end verification
# Run on: BASTION (mig-jump) as bhupesh
# ═══════════════════════════════════════════════════════════

# 1. Confirm SNMP monitor cron is running on VM
ssh ansible@{host} "cat /etc/cron.d/snmp-monitor"

# 2. Check state files initialised
ssh ansible@{host} "ls -la /var/run/snmp-monitor/"

# 3. Trigger a test incident — stop a service
ssh ansible@{host} "sudo systemctl stop {test_svc}"

# Wait ~65 seconds for cron to fire, then check:
# → Gruve NOC dashboard: Incidents tab should show VM_SERVICE_DOWN
# → ServiceNow: new INC ticket should be created

# 4. Restore the service
ssh ansible@{host} "sudo systemctl start {test_svc}"

# 5. Confirm recovery — incident should auto-resolve in ~65s
"""

        return {
            "integration_id": integration_id,
            "name": name,
            "host": host,
            "tool_id": tool_id,
            "steps": [
                {"step": 0, "title": "Prerequisites Check",          "run_as": "root on VM",    "command": step0},
                {"step": 1, "title": "Create ansible User",          "run_as": "root on VM",    "command": step1},
                {"step": 2, "title": "Install SNMP Monitor Script",  "run_as": "root on VM",    "command": step2},
                {"step": 3, "title": "Copy Ansible SSH Key",         "run_as": "bastion",       "command": step3},
                {"step": 4, "title": "Test Ansible Connection",      "run_as": "bastion",       "command": step4},
                {"step": 5, "title": "End-to-End Verification",      "run_as": "bastion",       "command": step5},
            ],
            "aap_note": f"AAP registration is automatic — '{name}' will be added to NJ-Infrastructure inventory."
        }

    elif tool_id == "windows_vm":
        step1 = f"""# ═══════════════════════════════════════════════════════════
# STEP 1 — Enable WinRM + create ansible user
# Run in: PowerShell as Administrator on {host}
# ═══════════════════════════════════════════════════════════

# Enable WinRM
winrm quickconfig -q
winrm set winrm/config/service/auth '@{{Basic="true"}}'
winrm set winrm/config/service '@{{AllowUnencrypted="true"}}'

# Open firewall for WinRM
netsh advfirewall firewall add rule name="WinRM-HTTP" dir=in action=allow protocol=TCP localport=5985

# Create ansible local user
net user ansible Gruve@2026! /add
net localgroup Administrators ansible /add

# Verify WinRM is running
winrm enumerate winrm/config/listener
"""

        step2 = f"""# ═══════════════════════════════════════════════════════════
# STEP 2 — Install SNMP service
# Run in: PowerShell as Administrator on {host}
# ═══════════════════════════════════════════════════════════

# Install SNMP
Install-WindowsFeature -Name SNMP-Service -IncludeManagementTools

# Configure SNMP community
Set-ItemProperty `
  -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\SNMP\\Parameters\\ValidCommunities" `
  -Name "{snmp_com}" -Value 4

# Allow NOC agent IP
Set-ItemProperty `
  -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\SNMP\\Parameters\\PermittedManagers" `
  -Name "1" -Value "{NOC_AGENT_IP}"

Restart-Service SNMP
"""

        step3 = f"""# ═══════════════════════════════════════════════════════════
# STEP 3 — Test Ansible WinRM connection
# Run on: BASTION (mig-jump) as bhupesh
# ═══════════════════════════════════════════════════════════

ansible -i '{host},' all \\
  -m win_ping \\
  -e "ansible_user=ansible ansible_password=Gruve@2026! \\
      ansible_connection=winrm ansible_winrm_transport=basic \\
      ansible_winrm_server_cert_validation=ignore \\
      ansible_port=5985"
"""

        return {
            "integration_id": integration_id,
            "name": name,
            "host": host,
            "tool_id": tool_id,
            "steps": [
                {"step": 1, "title": "Enable WinRM + Create ansible User", "run_as": "Administrator on VM",  "command": step1},
                {"step": 2, "title": "Install & Configure SNMP",            "run_as": "Administrator on VM",  "command": step2},
                {"step": 3, "title": "Test Ansible WinRM Connection",       "run_as": "bastion",              "command": step3},
            ],
            "aap_note": f"AAP registration is automatic — '{name}' will be added to NJ-Infrastructure inventory with WinRM vars."
        }

    else:
        return {
            "integration_id": integration_id,
            "name": name,
            "tool_id": tool_id,
            "steps": [],
            "aap_note": "No VM setup required for this integration type."
        }

# ─────────────────────────────────────────────────────────────────────────────
# AAP AUTO-REGISTRATION
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{integration_id}/register-aap")
async def register_in_aap(integration_id: str):
    doc = await _get_doc(integration_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Integration not found")

    tool_id  = doc.get("tool_id")
    creds    = doc.get("credentials", {})
    name     = doc.get("name", "unknown-host")
    host     = creds.get("host", "")
    port     = creds.get("port", "22")
    services = creds.get("services", "")

    if tool_id not in ("linux_vm", "windows_vm"):
        return {"status": "skipped", "message": f"AAP registration not needed for {tool_id}"}

    if not host:
        raise HTTPException(status_code=400, detail="No host IP configured")

    headers = {"Authorization": f"Bearer {AAP_TOKEN}", "Content-Type": "application/json"}

    if tool_id == "linux_vm":
        host_vars = {
            "ansible_host":         host,
            "ansible_port":         int(port),
            "ansible_user":         "ansible",
            "ansible_connection":   "ssh",
            "ansible_private_key_file": ANSIBLE_PRI_KEY_PATH,
            "gruve_services":       services,
            "gruve_integration_id": integration_id,
        }
    else:
        winrm_port = creds.get("winrm_port", "5985")
        host_vars = {
            "ansible_host":                         host,
            "ansible_port":                         int(winrm_port),
            "ansible_user":                         "ansible",
            "ansible_password":                     "Gruve@2026!",
            "ansible_connection":                   "winrm",
            "ansible_winrm_transport":              "basic",
            "ansible_winrm_server_cert_validation": "ignore",
            "gruve_services":                       services,
            "gruve_integration_id":                 integration_id,
        }

    try:
        async with httpx.AsyncClient(verify=False, timeout=30) as client:
            # Check if host already exists
            check = await client.get(
                f"{AAP_CONTROLLER_URL}/api/v2/hosts/?name={name}&inventory={AAP_INVENTORY_ID}",
                headers=headers
            )
            existing = check.json().get("results", [])

            if existing:
                aap_host_id = existing[0]["id"]
                await client.patch(
                    f"{AAP_CONTROLLER_URL}/api/v2/hosts/{aap_host_id}/",
                    headers=headers,
                    json={"name": name, "variables": json.dumps(host_vars), "enabled": True}
                )
                action = "updated"
            else:
                resp = await client.post(
                    f"{AAP_CONTROLLER_URL}/api/v2/hosts/",
                    headers=headers,
                    json={"name": name, "inventory": AAP_INVENTORY_ID,
                          "variables": json.dumps(host_vars), "enabled": True}
                )
                if resp.status_code not in (200, 201):
                    raise HTTPException(status_code=500, detail=f"AAP error: {resp.text[:200]}")
                aap_host_id = resp.json().get("id")
                action = "created"

            # Save AAP host ID back to MongoDB
            await mongo_service._db["integrations"].update_one(
                await _query(integration_id),
                {"$set": {"aap_host_id": aap_host_id, "aap_inventory": AAP_INVENTORY_ID, "updated_at": _now()}}
            )
            logger.info(f"AAP {action}: {name} host_id={aap_host_id}")

            return {
                "status":        "success",
                "action":        action,
                "aap_host_id":   aap_host_id,
                "aap_inventory": "NJ-Infrastructure",
                "host":          host,
                "name":          name,
                "message":       f"Host '{name}' {action} in AAP NJ-Infrastructure (ID: {aap_host_id})"
            }

    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Cannot reach AAP controller")
    except Exception as e:
        logger.error(f"AAP registration failed for {name}: {e}")
        raise HTTPException(status_code=500, detail=f"AAP registration failed: {str(e)}")

# ─────────────────────────────────────────────────────────────────────────────
# DYNAMIC WEBHOOK RECEIVER
# ─────────────────────────────────────────────────────────────────────────────

@webhook_router.post("/{integration_id}")
async def receive_webhook(integration_id: str, request: Request):
    doc = await _get_doc(integration_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Integration not found")

    body    = await request.body()
    payload = {}
    try:
        payload = await request.json()
    except Exception:
        pass

    # HMAC verification if webhook_secret configured
    webhook_secret = doc.get("credentials", {}).get("webhook_secret", "")
    if webhook_secret:
        sig_header = (
            request.headers.get("x-hub-signature-256","") or
            request.headers.get("x-hook-signature","") or
            request.headers.get("x-signature","")
        )
        if sig_header:
            algo     = "sha512" if "sha512" in sig_header.lower() else "sha256"
            expected = hmac.new(webhook_secret.encode(), body, getattr(hashlib, algo)).hexdigest()
            if not hmac.compare_digest(sig_header.split("=")[-1], expected):
                raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event_doc = {
        "integration_id":   integration_id,
        "tool_id":          doc.get("tool_id"),
        "category":         doc.get("category"),
        "integration_name": doc.get("name"),
        "raw_payload":      payload,
        "headers":          dict(request.headers),
        "received_at":      _now(),
        "processed":        False,
    }
    await mongo_service._db["webhook_events"].insert_one(event_doc)
    logger.info(f"Webhook received from {doc.get('tool_id')} / {integration_id}")
    return {"status": "received", "integration": doc.get("name")}


@webhook_router.get("/health")
async def webhook_health():
    return {"status": "healthy", "supported_sources": list(DEVICE_CATALOGUE.keys())}
