"""
main.py — Gruve NOC Agent Backend
"""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.health import router as health_router
from app.api.routes import router as api_router
from app.services.mongo import mongo_service
from app.agents.incident import incident_agent

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)
logger = logging.getLogger("gruve.noc")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Gruve NOC Agent starting up...")
    await mongo_service.connect()
    logger.info("MongoDB connected")
    poll_task = asyncio.create_task(incident_agent.polling_loop())
    logger.info(f"Meraki polling started (interval: {settings.poll_interval_seconds}s)")
    yield
    logger.info("Gruve NOC Agent shutting down...")
    poll_task.cancel()
    try:
        await poll_task
    except asyncio.CancelledError:
        pass
    await mongo_service.disconnect()
    logger.info("Shutdown complete")


app = FastAPI(
    title="Gruve NOC Agent API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Read CORS origins directly from env — bypass pydantic parsing
_cors_raw = os.environ.get("CORS_ALLOWED_ORIGINS", "*")
if _cors_raw.strip() == "*":
    _cors_origins = ["*"]
elif _cors_raw.strip().startswith("["):
    import json
    try:
        _cors_origins = json.loads(_cors_raw)
    except Exception:
        _cors_origins = ["*"]
else:
    _cors_origins = [o.strip() for o in _cors_raw.split(",") if o.strip()]

logger.info(f"CORS origins: {_cors_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(api_router, prefix="/api/v1")
# updated
# test trigger
# trigger
# retry
# trigger
