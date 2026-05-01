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


# ── Approval + EDA Webhook ────────────────────────────────────────────────────

class ApprovalRequest(BaseModel):
    incident_id: str

@router.post("/approve")
async def approve_remediation(request: ApprovalRequest):
    """
    Called when NOC engineer clicks Approve & Remediate.
    1. Fetches incident from MongoDB
    2. Updates ServiceNow ticket to In Progress
    3. Fires EDA webhook to trigger AAP workflow
    """
    logger.info(f"Approval received for incident: {request.incident_id}")

    incident = await mongo_service.get_incident_by_id(request.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Update incident status in MongoDB
    await mongo_service.update_incident_status(
        request.incident_id,
        status="approved"
    )

    # Fire EDA webhook
    import httpx
    eda_payload = {
        "incident_type":  incident.get("incident_type"),
        "device_serial":  incident.get("device_serial"),
        "device_name":    incident.get("device_name"),
        "network_id":     incident.get("network_id"),
        "network_name":   incident.get("network_name"),
        "incident_id":    str(incident.get("_id")),
        "snow_ticket":    incident.get("snow_ticket_id", ""),
        "meraki_api_key": "86d9dbe8fb3c0adf0399fb1a697a6baa6ff21da8"
    }

    eda_url = "http://gruve-noc-meraki-rules.aap.svc.cluster.local:5000"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                eda_url,
                json=eda_payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": "Bearer gruve-noc-eda-2026"
                }
            )
            logger.info(f"EDA webhook fired: status={resp.status_code}")
            eda_status = resp.status_code
    except Exception as e:
        logger.error(f"EDA webhook failed: {e}")
        eda_status = 500

    return {
        "message":    "Approval processed",
        "incident_id": request.incident_id,
        "eda_status":  eda_status,
        "status":     "approved"
    }


# ── Resolve Incident (called by AAP after remediation) ────────────────────────

class ResolveRequest(BaseModel):
    incident_id: str
    status: str = "resolved"
    message: str = "Resolved by AAP workflow"

@router.post("/resolve")
async def resolve_incident(request: ResolveRequest):
    """
    Called by AAP noc-resolve-incident playbook after workflow completes.
    Updates incident status to resolved in MongoDB.
    """
    logger.info(f"Resolve received for incident: {request.incident_id}")

    incident = await mongo_service.get_incident_by_id(request.incident_id)
    if not incident:
        # Return 200 anyway so AAP playbook doesn't fail
        logger.warning(f"Incident {request.incident_id} not found — may already be resolved")
        return {"message": "Incident not found", "incident_id": request.incident_id}

    await mongo_service.update_incident_status(
        request.incident_id,
        status="resolved"
    )

    logger.info(f"Incident {request.incident_id} marked as resolved")
    return {
        "message": "Incident resolved",
        "incident_id": request.incident_id,
        "status": "resolved"
    }
