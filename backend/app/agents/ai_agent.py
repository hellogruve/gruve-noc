"""
ai_agent.py — Unified NOC AI: RAG questions + MCP execution
Replaces both llm/chat logic and ops_agent in one place.
"""
import httpx
import json
import re
import logging
import asyncio
import time

logger = logging.getLogger(__name__)
from app.services.llm import llm_service

QWEN_URL  = "https://qwen25-7b-instruct-noc-agent.apps.ocp-mig2.gruveai.com/v1"
MCP_URL   = "https://ansible-mcp-aap.apps.ocp-mig2.gruveai.com/mcp"
AAP_TOKEN = "pkgJGDaQj9Ry7E13Kpw4rxt1RQlbNI"
MODEL     = "qwen25-7b-instruct"

MCP_HEADERS = {
    "Authorization": f"Bearer {AAP_TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}

_lock        = asyncio.Lock()
_session_id: str   = ""
_tools:      list  = []
_aap_ctx:    dict  = {}
_session_ts: float = 0.0       # epoch time of last init
SESSION_TTL  = 1800            # reinit after 30 minutes


# ── MCP low-level ─────────────────────────────────────────────────────────────

async def _mcp_post(method: str, params: dict = None, session_id: str = "") -> dict:
    headers = MCP_HEADERS.copy()
    if session_id:
        headers["Mcp-Session-Id"] = session_id
    body = {"jsonrpc": "2.0", "method": method, "id": 1}
    if params:
        body["params"] = params
    async with httpx.AsyncClient(verify=False, timeout=30) as c:
        resp = await c.post(MCP_URL, headers=headers, json=body)
    for line in resp.text.splitlines():
        if line.startswith("data:"):
            result = json.loads(line[5:].strip())
            # Detect stale session — MCP returns error -32001 or empty result
            if isinstance(result, dict):
                err = result.get("error", {})
                if isinstance(err, dict) and err.get("code") in (-32001, -32600, -32603):
                    logger.warning(f"MCP session error {err.get('code')} — will reset")
                    await reset_session()
                    raise RuntimeError(f"MCP session stale: {err.get('message','')}")
            return result
    # Empty response = stale session
    logger.warning("MCP returned empty response — resetting session")
    await reset_session()
    raise RuntimeError("MCP empty response — session was stale, retry your request")


async def _init_session() -> str:
    async with httpx.AsyncClient(verify=False, timeout=15) as c:
        resp = await c.post(
            MCP_URL, headers=MCP_HEADERS,
            json={"jsonrpc":"2.0","method":"initialize",
                  "params":{"protocolVersion":"2024-11-05","capabilities":{},
                            "clientInfo":{"name":"noc-ai","version":"1.0"}},"id":1})
    sid = resp.headers.get("Mcp-Session-Id","")
    logger.info(f"MCP session: {sid[:12]}...")
    return sid


async def _load_aap_context(sid: str) -> dict:
    ctx = {}
    for tool, key in [("job_templates_list","job_templates"),
                      ("inventories_list","inventories"),
                      ("hosts_list","hosts")]:
        try:
            r = await _mcp_post("tools/call", {"name":tool,"arguments":{}}, sid)
            data = _parse_content(r.get("result", r))
            if isinstance(data, dict) and "results" in data:
                ctx[key] = [{"id":i["id"],"name":i["name"]} for i in data["results"]]
            else:
                ctx[key] = []
        except Exception as e:
            logger.warning(f"Could not load {key}: {e}")
            ctx[key] = []
    return ctx


async def ensure_session():
    global _session_id, _tools, _aap_ctx, _session_ts
    async with _lock:
        # Reinit if: never initialized, OR session is older than TTL
        age = time.time() - _session_ts
        if _session_id and age < SESSION_TTL:
            return
        if _session_id:
            logger.info(f"MCP session TTL expired ({int(age)}s) — reinitializing...")
        else:
            logger.info("Initializing MCP session...")
        _session_id = await _init_session()
        r = await _mcp_post("tools/list", session_id=_session_id)
        _tools   = r.get("result",{}).get("tools",[])
        _aap_ctx = await _load_aap_context(_session_id)
        _session_ts = time.time()
        logger.info(f"MCP ready — {len(_tools)} tools, "
                    f"{len(_aap_ctx.get('job_templates',[]))} templates, "
                    f"{len(_aap_ctx.get('hosts',[]))} hosts")


async def reset_session():
    global _session_id, _tools, _aap_ctx, _session_ts
    async with _lock:
        _session_id = ""
        _tools      = []
        _aap_ctx    = {}
        _session_ts = 0.0


def get_aap_context() -> dict:
    return _aap_ctx


def _parse_content(result):
    content = result.get("content", result)
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict) and "text" in item:
                try:    return json.loads(item["text"])
                except: return item["text"]
    return content


async def _call_tool(name: str, args: dict) -> dict:
    try:
        r = await _mcp_post("tools/call", {"name":name,"arguments":args}, _session_id)
        return r.get("result", r)
    except RuntimeError as e:
        if "stale" in str(e) or "empty response" in str(e):
            # Session was reset — reinitialize and retry once
            logger.info("Retrying tool call after session reset...")
            await ensure_session()
            r = await _mcp_post("tools/call", {"name":name,"arguments":args}, _session_id)
            return r.get("result", r)
        raise


def _format(data) -> str:
    if not isinstance(data, dict):
        return str(data)[:2000]
    if "results" in data:
        count = data.get("count", len(data["results"]))
        lines = [f"Found {count} item(s):\n"]
        for item in data["results"]:
            line = f"  [{item.get('id','')}] {item.get('name','—')}"
            if item.get("status"):
                line += f" — {item['status']}"
            lines.append(line)
        return "\n".join(lines)
    if "id" in data and "status" in data:
        return (f"✅ Job launched!\n\n"
                f"  Job ID:   {data['id']}\n"
                f"  Status:   {data['status']}\n"
                f"  Template: {data.get('name','')}\n\n"
                f"Job is running in AAP. Check back with: show job {data['id']}")
    return json.dumps(data, indent=2)[:2000]


# ── Key tools exposed to Qwen ─────────────────────────────────────────────────
# Step-by-step expansion: start with core ops, add more each sprint
KEY_TOOLS = [
    # ── Job templates ──────────────────────────────────────
    "job_templates_list",             # list all job templates
    "job_templates_retrieve",         # get details of a specific template
    "job_templates_launch_create",    # launch a job template
    # ── Jobs (running/history) ─────────────────────────────
    "jobs_list",                      # list recent jobs
    "jobs_retrieve",                  # get job details + status
    "jobs_stdout_retrieve",           # get job console output
    "jobs_relaunch_create",           # relaunch a failed job
    "jobs_cancel_create",             # cancel a running job
    # ── Workflow templates ─────────────────────────────────
    "workflow_job_templates_list",
    "workflow_job_templates_launch_create",
    "workflow_jobs_list",
    "workflow_jobs_retrieve",
    # ── Inventory / hosts ──────────────────────────────────
    "inventories_list",
    "hosts_list",
    "hosts_retrieve",
    "groups_list",
    # ── Projects & credentials ─────────────────────────────
    "projects_list",
    "credentials_list",
    "execution_environments_list",
]


def _build_tools_desc(tools: list) -> str:
    return "\n".join([
        f"- {t['name']}: {t.get('description','')}"
        for t in tools if t["name"] in KEY_TOOLS
    ])


# ── Unified Qwen call ─────────────────────────────────────────────────────────

async def _ask(message: str, kb_context: str, incidents: list) -> str:
    tools_desc = _build_tools_desc(_tools)

    incident_summary = "None currently" if not incidents else "\n".join([
        f"  [{i.get('status','?').upper()}] {i.get('device_name','?')} — "
        f"{i.get('incident_type','?')} ({i.get('network_name','')})"
        for i in incidents[:5]
    ])

    aap_summary = (
        f"Job Templates: {json.dumps(_aap_ctx.get('job_templates',[]))}\n"
        f"Inventories:   {json.dumps(_aap_ctx.get('inventories',[]))}\n"
        f"Hosts:         {json.dumps(_aap_ctx.get('hosts',[]))}"
    )

    system_prompt = f"""You are Gruve NOC AI — an intelligent network operations assistant.

━━ LIVE NETWORK STATE ━━
Active Incidents:
{incident_summary}

━━ AAP AUTOMATION (use exact IDs) ━━
{aap_summary}

━━ AVAILABLE TOOLS ━━
{tools_desc}

━━ KNOWLEDGE BASE ━━
{kb_context if kb_context else "No relevant docs found."}

━━ RULES ━━
You handle TWO types of requests. Choose based on INTENT, not keywords.

1. QUESTIONS — answer in plain text when the user is:
   → Asking "how many", "what is", "why", "which", "when", "explain", "tell me"
   → Asking about status, counts, health, or information
   → Using question marks or words like "how", "what", "why", "is", "are", "does"
   → Asking about Meraki devices, incidents, networks from the live state above
   → Asking for help, guidance, steps, or explanations
   NEVER run a tool for these — just answer using the context provided above.

2. ACTIONS — respond ONLY with JSON when the user explicitly wants to DO something:
   → "run", "launch", "execute", "patch", "restart", "reboot", "deploy"
   → "list" or "show" ONLY when they want live AAP data (jobs, templates, hosts)
   → "cancel", "relaunch", "ping" a specific target
   → Direct imperative commands with no question mark
   → Respond ONLY with valid JSON: {{"tool": "name", "args": {{...}}}}
   → Use REAL IDs from AAP data above — never placeholders.
   → job_templates_launch_create only needs: {{"id": <number>}}

DECISION GUIDE — when in doubt, answer as text:
User: how many meraki devices?      → plain text using device/incident context above
User: how many devices are online?  → plain text answer from live incident state
User: what templates are available? → plain text listing from AAP data above
User: is haproxy running?           → plain text answer based on incidents
User: why is haproxy down?          → plain text explanation
User: what happened last night?     → plain text from incidents timeline
User: run the patch template        → {{"tool": "job_templates_launch_create", "args": {{"id": 9}}}}
User: launch check-disk-usage       → {{"tool": "job_templates_launch_create", "args": {{"id": 18}}}}
User: show recent jobs              → {{"tool": "jobs_list", "args": {{}}}}
User: list hosts in AAP             → {{"tool": "hosts_list", "args": {{}}}}
User: restart haproxy service       → {{"tool": "job_templates_launch_create", "args": {{"id": 12}}}}
User: relaunch job 452              → {{"tool": "jobs_relaunch_create", "args": {{"id": 452}}}}
User: show output of job 452        → {{"tool": "jobs_stdout_retrieve", "args": {{"id": 452}}}}"""

    # Use llm_service — respects LLM_PROVIDER env var (gemini/qwen/openai/claude)
    return await llm_service.complete(system_prompt, message)


def _extract_json(text: str):
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:    return json.loads(match.group())
        except: return None
    return None


# ── Public API ────────────────────────────────────────────────────────────────

async def process(message: str, kb_context: str = "", incidents: list = None) -> dict:
    """
    Main entry point called by ai_router.
    Returns: { type, tool, args, content, sources_used }
    Auto-retries once if MCP session was stale.
    """
    await ensure_session()

    try:
        raw_resp = await _ask(message, kb_context, incidents or [])
        action   = _extract_json(raw_resp)

        # ── Action path: Qwen returned a tool call ──
        if action and "tool" in action and action["tool"] != "none":
            tool_name = action.get("tool","")
            tool_args = action.get("args",{})

            if not tool_name:
                return {"type":"answer","tool":None,"args":{},
                        "content":raw_resp,"sources_used":0}

            raw    = await _call_tool(tool_name, tool_args)
            data   = _parse_content(raw)
            result = _format(data)

            return {"type":"tool_result","tool":tool_name,
                    "args":tool_args,"content":result,"sources_used":0}

        # ── Answer path: Qwen returned plain text ──
        return {"type":"answer","tool":None,"args":{},
                "content":raw_resp,"sources_used":0}

    except Exception as e:
        logger.error(f"ai_agent error: {e}", exc_info=True)
        await reset_session()
        return {"type":"error","tool":None,"args":{},
                "content":f"Agent error: {str(e)}","sources_used":0}
