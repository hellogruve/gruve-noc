"""
api/ops_router.py — FastAPI router: POST /ops/chat, GET /ops/context
Mounted under /api/v1 in main.py → full paths:
  POST /api/v1/ops/chat
  GET  /api/v1/ops/context
"""
import logging
from fastapi import APIRouter
from pydantic import BaseModel
from app.agents.ops_agent import process_message, get_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ops", tags=["ops"])


class ChatRequest(BaseModel):
    message: str


@router.post("/chat")
async def chat(body: ChatRequest):
    msg = body.message.strip()
    if not msg:
        return {"error": "message is required"}
    logger.info(f"Ops Console: {msg[:80]}")
    return await process_message(msg)


@router.get("/context")
async def context():
    return await get_context()
