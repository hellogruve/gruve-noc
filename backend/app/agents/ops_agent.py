"""
ops_agent.py — Ansible MCP + Qwen agent (async, FastAPI-safe)
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
_session_id: str        = ""
_tools:      list       = []
_context:    dict       = {}


# ── MCP low-level ────────────────────────────────────────────

async def _mcp_request(method: str, params: dict = None, session_id: str = "") -> dict:
    headers = MCP_HEADERS.copy()
    if session_id:
        headers["Mcp-Session-Id"] = session_id
    body = {"jsonrpc": "2.0", "method": method, "id": 1}
    if params:
        body["params"] = params
    async with httpx.AsyncClient(verify=False, timeout=30) as client:
        resp = await client.post(MCP_URL, headers=headers, json=body)
    for line in resp.text.splitlines():
        if line.startswith("data:"):
            return json.loads(line[5:].strip())
    return {}


async def _get_session() -> str:
    async with httpx.AsyncClient(verify=False, timeout=15) as client:
        resp = await client.post(
            MCP_URL,
            headers=MCP_HEADERS,
            json={
                "jsonrpc": "2.0", "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "noc-ops-console", "version": "1.0"},
                },
                "id": 1,
            },
        )
    sid = resp.headers.get("Mcp-Session-Id", "")
    logger.info(f"MCP session: {sid[:12]}...")
    return sid


async def _get_tools(session_id: str) -> list:
    result = await _mcp_request("tools/list", session_id=session_id)
    return result.get("result", {}).get("tools", [])


async def _call_tool(tool_name: str, tool_args: dict, session_id: str) -> dict:
    result = await _mcp_request(
        "tools/call",
        params={"name": tool_name, "arguments": tool_args},
        session_id=session_id,
    )
    return result.get("result", result)


def _parse_tool_result(result: dict):
    content = result.get("content", result)
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict) and "text" in item:
                try:
                    return json.loads(item["text"])
                except Exception:
                    return item["text"]
    return content


async def _load_context(session_id: str) -> dict:
    context = {}
    for tool_name, key in [
        ("job_templates_list", "job_templates"),
        ("inventories_list",   "inventories"),
        ("hosts_list",         "hosts"),
    ]:
        try:
            raw  = await _call_tool(tool_name, {}, session_id)
            data = _parse_tool_result(raw)
            if isinstance(data, dict) and "results" in data:
                context[key] = [{"id": i["id"], "name": i["name"]} for i in data["results"]]
            else:
                context[key] = []
        except Exception as e:
            logger.warning(f"Could not load {key}: {e}")
            context[key] = []
    return context


# ── Session management ───────────────────────────────────────

async def _ensure_session():
    global _session_id, _tools, _context
    async with _lock:
        if _session_id:
            return
        logger.info("Initializing MCP session (lazy)...")
        _session_id = await _get_session()
        _tools      = await _get_tools(_session_id)
        _context    = await _load_context(_session_id)
        logger.info(
            f"MCP ready — {len(_tools)} tools, "
            f"{len(_context.get('job_templates', []))} templates, "
            f"{len(_context.get('hosts', []))} hosts"
        )


async def _reset_session():
    global _session_id, _tools, _context
    async with _lock:
        _session_id = ""
        _tools      = []
        _context    = {}


async def get_context() -> dict:
    await _ensure_session()
    return _context


# ── Qwen LLM ────────────────────────────────────────────────

KEY_TOOLS = [
    "job_templates_list", "job_templates_launch_create",
    "hosts_list", "inventories_list",
    "jobs_list", "jobs_retrieve", "ad_hoc_commands_create",
]


async def _ask_qwen(user_message: str, tools: list, context: dict) -> str:
    tools_desc = "\n".join([
        f"- {t['name']}: {t.get('description', '')}"
        for t in tools if t["name"] in KEY_TOOLS
    ])
    context_str = (
        f"REAL AAP DATA (use these exact IDs):\n"
        f"Job Templates: {json.dumps(context.get('job_templates', []))}\n"
        f"Inventories:   {json.dumps(context.get('inventories', []))}\n"
        f"Hosts:         {json.dumps(context.get('hosts', []))}\n"
    )
    system_prompt = f"""You are an Ansible Automation Platform agent embedded in a Network Operations Center.

{context_str}
Available tools:
{tools_desc}

RULES:
1. Use REAL IDs from data above — never placeholder text.
2. patch/update/upgrade/install → job_templates_launch_create with correct id
3. job_templates_launch_create only needs: {{"id": <number>}}
4. ping/connectivity check → ad_hoc_commands_create with module_name=ping
5. restart service → job_templates_launch_create with extra_vars
6. show recent jobs → jobs_list
7. Respond ONLY with valid JSON: {{"tool": "name", "args": {{...}}}}

Examples:
User: patch haproxy    → {{"tool":"job_templates_launch_create","args":{{"id":9}}}}
User: list hosts       → {{"tool":"hosts_list","args":{{}}}}
User: show recent jobs → {{"tool":"jobs_list","args":{{}}}}"""

    async with httpx.AsyncClient(verify=False, timeout=60) as client:
        resp = await client.post(
            f"{QWEN_URL}/chat/completions",
            json={
                "model":    MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_message},
                ],
                "temperature": 0.1,
                "max_tokens":  256,
            },
        )
    return resp.json()["choices"][0]["message"]["content"]


def _extract_json(text: str) -> dict | None:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group())
        except Exception:
            return None
    return None


def _format_result(data) -> str:
    if isinstance(data, dict):
        if "results" in data:
            count = data.get("count", len(data["results"]))
            lines = [f"Found {count} item(s):\n"]
            for item in data["results"]:
                line = f"[{item.get('id','')}] {item.get('name','—')}"
                if item.get("status"):
                    line += f" — {item['status']}"
                lines.append(line)
            return "\n".join(lines)
        elif "id" in data and "status" in data:
            return (
                f"Job Launched!\n\n"
                f"Job ID:   {data['id']}\n"
                f"Status:   {data['status']}\n"
                f"Template: {data.get('name', '')}\n\n"
                f"Track progress in AAP UI → Jobs"
            )
        else:
            return json.dumps(data, indent=2)[:2000]
    return str(data)[:2000]


# ── Public API ───────────────────────────────────────────────

async def process_message(user_message: str) -> dict:
    await _ensure_session()
    try:
        qwen_resp = await _ask_qwen(user_message, _tools, _context)
        action    = _extract_json(qwen_resp)

        if not action:
            return {"type": "text", "tool": None, "args": {}, "content": qwen_resp, "raw": {}}

        tool_name = action.get("tool", "")
        tool_args = action.get("args", {})

        if not tool_name or tool_name == "none":
            return {
                "type": "text", "tool": None, "args": {},
                "content": action.get("message", "No matching action found."), "raw": {},
            }

        raw    = await _call_tool(tool_name, tool_args, _session_id)
        data   = _parse_tool_result(raw)
        result = _format_result(data)

        return {
            "type":    "tool_result",
            "tool":    tool_name,
            "args":    tool_args,
            "content": result,
            "raw":     data if isinstance(data, dict) else {},
        }

    except Exception as e:
        logger.error(f"ops_agent error: {e}", exc_info=True)
        await _reset_session()
        return {
            "type": "error", "tool": None, "args": {},
            "content": f"Agent error: {str(e)}", "raw": {},
        }
