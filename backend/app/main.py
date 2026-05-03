"""
main.py — Gruve NOC Agent Backend
"""

import asyncio
import logging
import os
import json
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.api.health import router as health_router
from app.api.routes import router as api_router
from app.api.ops_router import router as ops_router
from app.services.mongo import mongo_service
from app.agents.incident import incident_agent
from app.agents.snmp_agent import snmp_agent
from app.services.snmp_receiver import start_snmp_receiver

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s"
)
logger = logging.getLogger("gruve.noc")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Gruve NOC Agent starting up...")

    await mongo_service.connect()
    logger.info("✅ MongoDB connected")

    # Start Meraki polling
    meraki_task = asyncio.create_task(incident_agent.polling_loop())
    logger.info(f"✅ Meraki polling started (interval: {settings.poll_interval_seconds}s)")

    # Start SNMP trap receiver
    snmp_task = asyncio.create_task(
        start_snmp_receiver(snmp_agent.process_trap)
    )
    logger.info("✅ SNMP trap receiver started on UDP 162")

    logger.info("✅ Gruve NOC Agent ready")

    yield

    logger.info("Gruve NOC Agent shutting down...")
    meraki_task.cancel()
    snmp_task.cancel()
    try:
        await asyncio.gather(meraki_task, snmp_task, return_exceptions=True)
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

# CORS
_cors_raw = os.environ.get("CORS_ALLOWED_ORIGINS", "*")
if _cors_raw.strip() == "*":
    _cors_origins = ["*"]
elif _cors_raw.strip().startswith("["):
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
app.include_router(ops_router, prefix="/api/v1")
