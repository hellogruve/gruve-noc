"""
routes.py — Main REST API routes.
The frontend calls these endpoints for incidents, chat, and remediation.
"""

import logging
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional

from app.services.mongo import mongo_service
from app.services.llm import llm_service
from app.services.qdrant_svc import qdrant_service
from app.services.aap import aap_service
from app.services.meraki import meraki_service
from app.agents.remediation import remediation_agent

logger = logging.getLogger("gruve.noc.routes")
router = APIRouter(tags=["noc"])


# ── Request / Response models ─────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    network_id: Optional[str] = None

class RemediationRequest(BaseModel):
    incident_id: str
    job_template_id: Optional[int] = None


# ── Incidents ─────────────────────────────────────────────────────────────────

@router.get("/incidents")
async def get_incidents(
    limit: int = Query(default=20, le=100),
    status: Optional[str] = Query(default=None)
):
    incidents = await mongo_service.get_incidents(limit=limit, status=status)
    return {"incidents": incidents, "count": len(incidents)}


@router.get("/incidents/stats/summary")
async def get_stats():
    stats = await mongo_service.get_incident_stats()
    return stats


@router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str):
    incident = await mongo_service.get_incident_by_id(incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


# ── Chatbot ───────────────────────────────────────────────────────────────────

@router.post("/chat")
async def chat(request: ChatRequest):
    logger.info(f"Chat request: {request.message[:80]}")

    kb_context = await qdrant_service.search(request.message, limit=5)
    context_text = "\n\n".join([doc["content"] for doc in kb_context]) if kb_context else ""

    system_prompt = """You are an expert NOC engineer for a Cisco Meraki network.
Answer questions clearly and concisely. If you reference specific steps,
number them. If you don't know something, say so."""

    user_prompt = request.message
    if context_text:
        user_prompt = f"""Context from knowledge base:
{context_text}

Question: {request.message}"""

    answer = await llm_service.complete(
        system_prompt=system_prompt,
        user_prompt=user_prompt
    )

    return {
        "answer": answer,
        "sources_used": len(kb_context),
        "model": "qwen25-7b-instruct"
    }


# ── Remediation ───────────────────────────────────────────────────────────────

@router.post("/remediate")
async def trigger_remediation(request: RemediationRequest):
    logger.info(f"Remediation triggered for incident: {request.incident_id}")

    incident = await mongo_service.get_incident_by_id(request.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    result = await remediation_agent.run(
        incident=incident,
        job_template_id=request.job_template_id
    )

    await mongo_service.update_incident_status(
        request.incident_id,
        status="remediating",
        aap_job_id=result.get("job_id")
    )

    return {
        "message": "Remediation job launched",
        "incident_id": request.incident_id,
        "aap_job_id": result.get("job_id"),
        "aap_job_url": result.get("job_url")
    }


@router.get("/remediate/{job_id}/status")
async def get_job_status(job_id: int):
    status = await aap_service.get_job_status(job_id)
    return status


# ── Networks ──────────────────────────────────────────────────────────────────

@router.get("/networks")
async def get_networks():
    networks = await mongo_service.get_networks()
    return {"networks": networks}


# ── Devices ───────────────────────────────────────────────────────────────────

@router.get("/devices")
async def get_devices():
    """
    Returns all 16 devices from Meraki with live status.
    Grouped by network for the map view.
    """
    # Fetch devices and availability in parallel
    devices, availability = await asyncio.gather(
        meraki_service.get_all_devices(),
        meraki_service.get_device_availabilities()
    )

    # Build availability lookup by serial
    avail_map = {d.get("serial"): d for d in availability}

    # Merge availability status into device data
    enriched = []
    for device in devices:
        serial = device.get("serial", "")
        avail  = avail_map.get(serial, {})
        enriched.append({
            "serial":      serial,
            "name":        device.get("name", serial),
            "model":       device.get("model", ""),
            "networkId":   device.get("networkId", ""),
            "productType": avail.get("productType", device.get("productType", "")),
            "status":      avail.get("status", "unknown"),
            "lastSeen":    avail.get("lastReportedAt", ""),
            "mac":         device.get("mac", ""),
            "lanIp":       device.get("lanIp", ""),
        })

    # Get network names from MongoDB cache
    networks_raw = await mongo_service.get_networks()
    network_map  = {n.get("id"): n.get("name", n.get("id")) for n in networks_raw}

    # Group devices by network
    grouped = {}
    for device in enriched:
        nid   = device["networkId"]
        nname = network_map.get(nid, nid)
        device["networkName"] = nname
        if nid not in grouped:
            grouped[nid] = {
                "networkId":   nid,
                "networkName": nname,
                "devices":     [],
                "online":      0,
                "offline":     0,
                "total":       0
            }
        grouped[nid]["devices"].append(device)
        grouped[nid]["total"] += 1
        if device["status"] == "online":
            grouped[nid]["online"] += 1
        else:
            grouped[nid]["offline"] += 1

    return {
        "groups":        list(grouped.values()),
        "total_devices": len(enriched),
        "last_updated":  datetime.now(timezone.utc).isoformat()
    }


# ── Event Logs ────────────────────────────────────────────────────────────────

@router.get("/logs")
async def get_logs(
    network_id: Optional[str] = Query(default=None),
    device_serial: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=500)
):
    """
    Returns device event logs from MongoDB (last 30 mins).
    Optionally filtered by network_id or device_serial.
    """
    logs  = await mongo_service.get_event_logs(
        network_id=network_id,
        device_serial=device_serial,
        limit=limit
    )
    stats = await mongo_service.get_event_log_stats()
    return {
        "logs":  logs,
        "count": len(logs),
        "stats": stats
    }
