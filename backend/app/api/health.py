"""
health.py — Health check endpoints.
OCP liveness and readiness probes hit these.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.services.mongo import mongo_service

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok", "service": "gruve-noc-agent"}


@router.get("/livez")
async def liveness():
    return {"status": "alive"}


@router.get("/readyz")
async def readiness():
    try:
        await mongo_service.ping()
        return {"status": "ready", "mongo": "connected"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "not ready", "mongo": str(e)}
        )
