"""
ai_router.py — Unified NOC AI endpoint
POST /api/v1/ai/chat  →  questions + MCP execution
GET  /api/v1/ai/context  →  AAP inventory for sidebar
"""
import logging
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

from app.agents.ai_agent import process, get_aap_context
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

    # 1. RAG — search knowledge base
    try:
        kb_docs    = await qdrant_service.search(msg, limit=3)
        kb_context = "\n\n".join([d["content"] for d in kb_docs]) if kb_docs else ""
        sources    = len(kb_docs) if kb_docs else 0
    except Exception:
        kb_context = ""
        sources    = 0

    # 2. Live incidents — last 5 open
    try:
        result    = await mongo_service.db["incidents"].find(
            {"status": {"$in": ["open", "remediating"]}},
            {"device_name":1,"incident_type":1,"network_name":1,"status":1}
        ).sort("created_at", -1).limit(5).to_list(5)
        incidents = result or []
    except Exception:
        incidents = []

    # 3. Process through unified agent
    response = await process(msg, kb_context, incidents)
    response["sources_used"] = sources
    return response


@router.get("/context")
async def context():
    """AAP inventory for the sidebar."""
    return get_aap_context()
