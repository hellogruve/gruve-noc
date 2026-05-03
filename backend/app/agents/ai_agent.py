"""
ai_agent.py — Unified NOC AI: RAG questions + MCP execution
Replaces both llm/chat logic and ops_agent in one place.
"""
import httpx
import json
import re
import logging
import asyncio

logger = logging.getLogger(__name__)

QWEN_URL  = "https://qwen25-7b-instruct-noc-agent.apps.ocp-mig2.gruveai.com/v1"
MCP_URL   = "https://ansible-mcp-aap.apps.ocp-mig2.gruveai.com/mcp"
AAP_TOKEN = "pkgJGDaQj9Ry7E13Kpw4rxt1RQlbNI"
MODEL     = "qwen25-7b-instruct"

MCP_HEADERS = {
    "Authorization": f"Bearer {AAP_TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
}

_lock       = asyncio.Lock()
_session_id: str  = ""
_tools:      list = []
_aap_ctx:    dict = {}


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
            return json.loads(line[5:].strip())
    return {}


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
    global _session_id, _tools, _aap_ctx
    async with _lock:
        if _session_id:
            return
        logger.info("Initializing MCP session...")
        _session_id = await _init_session()
        r = await _mcp_post("tools/list", session_id=_session_id)
        _tools   = r.get("result",{}).get("tools",[])
        _aap_ctx = await _load_aap_context(_session_id)
        logger.info(f"MCP ready — {len(_tools)} tools, "
                    f"{len(_aap_ctx.get('job_templates',[]))} templates, "
                    f"{len(_aap_ctx.get('hosts',[]))} hosts")


async def reset_session():
    global _session_id, _tools, _aap_ctx
    async with _lock:
        _session_id = ""
        _tools      = []
        _aap_ctx    = {}


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
    r = await _mcp_post("tools/call", {"name":name,"arguments":args}, _session_id)
    return r.get("result", r)


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
    # Job management
    "job_templates_list",
    "job_templates_launch_create",
    "jobs_list",
    "jobs_retrieve",
    # Inventory
    "hosts_list",
    "inventories_list",
    # Ad-hoc
    "ad_hoc_commands_create",
    # Workflow
    "workflow_job_templates_list",
    "workflow_job_templates_launch_create",
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
You handle TWO types of requests:

1. QUESTIONS (about network, incidents, devices, how-to):
   → Respond in clear, helpful plain text.
   → Use the knowledge base and live incident state above.
   → Number steps if giving instructions.

2. ACTIONS (patch, restart, launch, list, ping, check):
   → Respond ONLY with valid JSON: {{"tool": "name", "args": {{...}}}}
   → Use REAL IDs from AAP data above — never placeholders.
   → job_templates_launch_create only needs: {{"id": <number>}}

EXAMPLES:
User: why is haproxy down?          → plain text explanation using incidents
User: how do I check SNMP traps?    → plain text steps from knowledge base
User: list all hosts                → {{"tool": "hosts_list", "args": {{}}}}
User: patch haproxy server          → {{"tool": "job_templates_launch_create", "args": {{"id": 9}}}}
User: show recent jobs              → {{"tool": "jobs_list", "args": {{}}}}
User: ping all servers              → {{"tool": "ad_hoc_commands_create", "args": {{"module_name": "ping"}}}}"""

    async with httpx.AsyncClient(verify=False, timeout=60) as c:
        resp = await c.post(
            f"{QWEN_URL}/chat/completions",
            json={"model": MODEL,
                  "messages": [{"role":"system","content":system_prompt},
                               {"role":"user","content":message}],
                  "temperature": 0.1, "max_tokens": 512})
    return resp.json()["choices"][0]["message"]["content"]


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
