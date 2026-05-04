"""
ai_router.py — Unified NOC AI + live job status polling
POST /api/v1/ai/chat      → questions + MCP execution
GET  /api/v1/ai/context   → AAP inventory for sidebar
GET  /api/v1/ai/job/{id}  → live job status + stdout (frontend polls this)
"""
import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.agents.ai_agent import process, get_aap_context, get_context, _call_tool, _parse_content, ensure_session
from app.services.qdrant_svc import qdrant_service
from app.services.mongo import mongo_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


class ChatRequest(BaseModel):
    message: str
    network_id: Optional[str] = None


@router.post("/chat")
async def chat(body: ChatRequest):
    msg = body.message.strip()
    if not msg:
        return {"error": "message is required"}

    logger.info(f"NOC AI: {msg[:80]}")

    # 1. RAG — knowledge base
    try:
        kb_docs    = await qdrant_service.search(msg, limit=3)
        kb_context = "\n\n".join([d["content"] for d in kb_docs]) if kb_docs else ""
        sources    = len(kb_docs) if kb_docs else 0
    except Exception:
        kb_context = ""
        sources    = 0

    # 2. Live incidents — last 5 open/remediating
    try:
        result    = await mongo_service.db["incidents"].find(
            {"status": {"$in": ["open", "remediating"]}},
            {"device_name":1,"incident_type":1,"network_name":1,"status":1}
        ).sort("created_at", -1).limit(5).to_list(5)
        incidents = result or []
    except Exception:
        incidents = []

    # 3. Unified agent
    response = await process(msg, kb_context, incidents)
    response["sources_used"] = sources
    return response


@router.get("/context")
async def context():
    from app.agents.ai_agent import get_context
    return await get_context()


@router.get("/job/{job_id}")
async def job_status(job_id: int):
    """
    Frontend polls this every 5s after a job launch.
    Returns status + stdout snippet for live display.
    """
    await ensure_session()
    try:
        # Try int id first, then string — MCP tools vary
        raw  = await _call_tool("jobs_retrieve", {"id": job_id})
        data = _parse_content(raw)

        # If no match, try with string id
        if isinstance(data, dict) and "detail" in data and "No Job" in str(data.get("detail","")):
            raw  = await _call_tool("jobs_retrieve", {"id": str(job_id)})
            data = _parse_content(raw)

        if not isinstance(data, dict) or "detail" in data:
            return {"job_id":job_id,"status":"unknown",
                    "output":f"Job #{job_id} not found. It may have completed already.",
                    "finished":True}

        status     = data.get("status", "unknown")
        finished   = status in ("successful", "failed", "error", "canceled")
        elapsed    = data.get("elapsed", 0)
        started    = data.get("started", "")
        finished_at = data.get("finished", "")
        template   = data.get("name", data.get("job_template_name", "—"))

        # Get stdout if job has started running
        stdout_snippet = ""
        if status in ("running", "successful", "failed", "error"):
            try:
                stdout_raw  = await _call_tool("jobs_stdout_retrieve", {"id": job_id})
                stdout_data = _parse_content(stdout_raw)
                if isinstance(stdout_data, str) and stdout_data.strip():
                    # Last 30 lines of output
                    lines = [l for l in stdout_data.splitlines() if l.strip()]
                    stdout_snippet = "\n".join(lines[-30:])
                elif isinstance(stdout_data, dict):
                    stdout_snippet = stdout_data.get("content", "")
                    if stdout_snippet:
                        lines = [l for l in stdout_snippet.splitlines() if l.strip()]
                        stdout_snippet = "\n".join(lines[-30:])
            except Exception as e:
                logger.warning(f"stdout fetch failed: {e}")

        # Build status block
        lines = [
            f"Job ID:    {job_id}",
            f"Status:    {status.upper()}",
            f"Template:  {template}",
        ]
        if elapsed:
            lines.append(f"Elapsed:   {round(float(elapsed), 1)}s")
        if started:
            lines.append(f"Started:   {started[:19].replace('T',' ')}")
        if finished_at:
            lines.append(f"Finished:  {finished_at[:19].replace('T',' ')}")

        if status == "successful":
            lines.append("\n✅ Job completed successfully.")
        elif status == "failed":
            lines.append("\n❌ Job failed.")
        elif status == "error":
            lines.append("\n❌ Job errored.")
        elif status == "canceled":
            lines.append("\n⚠️  Job was canceled.")
        else:
            lines.append(f"\n⏳ Job is {status}...")

        output = "\n".join(lines)
        if stdout_snippet:
            output += f"\n\n── Console Output ──\n{stdout_snippet}"

        return {
            "job_id":   job_id,
            "status":   status,
            "output":   output,
            "finished": finished,
        }

    except Exception as e:
        logger.error(f"job_status error: {e}")
        return {"job_id":job_id,"status":"error","output":str(e),"finished":True}
