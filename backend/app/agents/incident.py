"""
incident.py — Incident detection agent.
Runs every N seconds, polls Meraki, detects incidents,
saves device event logs, triggers full pipeline.
"""

import asyncio
import logging
from datetime import datetime, timezone

from app.config import settings
from app.services.meraki import meraki_service
from app.services.mongo import mongo_service
from app.services.llm import llm_service
from app.services.qdrant_svc import qdrant_service
from app.services.servicenow import snow_service

logger = logging.getLogger("gruve.noc.incident_agent")


class IncidentAgent:

    async def polling_loop(self):
        logger.info(f"Polling loop started - interval: {settings.poll_interval_seconds}s")
        await self._refresh_networks()
        while True:
            try:
                await self._run_poll_cycle()
            except Exception as e:
                logger.error(f"Poll cycle error: {e}", exc_info=True)
            await asyncio.sleep(settings.poll_interval_seconds)

    async def _run_poll_cycle(self):
        logger.info("--- Poll cycle starting ---")

        # Fetch device status + uplinks in parallel
        devices, uplinks = await asyncio.gather(
            meraki_service.get_device_availabilities(),
            meraki_service.get_uplink_statuses()
        )

        # Fetch events for each network in parallel
        networks = await mongo_service.get_networks()
        network_ids = [n.get("id") for n in networks if n.get("id")]

        if network_ids:
            event_results = await asyncio.gather(*[
                meraki_service.get_network_events(nid, window_minutes=3)
                for nid in network_ids
            ])
            # Flatten and save all events to MongoDB
            all_events = []
            for nid, events in zip(network_ids, event_results):
                for event in events:
                    all_events.append({
                        "network_id":    nid,
                        "device_serial": event.get("deviceSerial", ""),
                        "device_name":   event.get("deviceName", ""),
                        "event_type":    event.get("type", ""),
                        "description":   event.get("description", ""),
                        "category":      event.get("category", ""),
                        "occurred_at":   event.get("occurredAt", ""),
                        "client_mac":    event.get("clientMac", ""),
                        "ssid":          event.get("ssidName", ""),
                        "raw":           event
                    })
            if all_events:
                await mongo_service.save_event_logs(all_events)
                logger.info(f"Saved {len(all_events)} device events to logs")

        # Cache device list for dashboard
        await mongo_service.save_devices_cache(devices)

        # Detect incidents
        detected = []
        for device in devices:
            if device.get("status") == "offline":
                incident = await self._build_device_incident(device, "DEVICE_DOWN")
                if incident:
                    detected.append(incident)

        for appliance in uplinks:
            for uplink in appliance.get("uplinks", []):
                if uplink.get("status") == "failed":
                    incident = await self._build_uplink_incident(appliance, uplink)
                    if incident:
                        detected.append(incident)

        if detected:
            logger.info(f"Detected {len(detected)} new incident(s) this cycle")
        else:
            logger.info("No new incidents detected")

        for incident in detected:
            await self._process_incident(incident)

    async def _build_device_incident(self, device: dict, incident_type: str):
        serial     = device.get("serial", "unknown")
        name       = device.get("name", serial)
        network_id = device.get("networkId", "")
        exists = await mongo_service.incident_exists(
            incident_type=incident_type,
            network_id=network_id,
            device_serial=serial,
            window_minutes=settings.dedup_window_minutes
        )
        if exists:
            logger.debug(f"Dedup: skipping existing {incident_type} for {serial}")
            return None
        return {
            "incident_type": incident_type,
            "device_serial": serial,
            "device_name":   name,
            "network_id":    network_id,
            "network_name":  device.get("networkName", network_id),
            "status":        "open",
            "last_seen":     device.get("lastReportedAt", ""),
            "model":         device.get("productType", ""),
            "ai_plan":       None,
            "snow_ticket":   None
        }

    async def _build_uplink_incident(self, appliance: dict, uplink: dict):
        network_id = appliance.get("networkId", "")
        serial     = appliance.get("serial", "unknown")
        exists = await mongo_service.incident_exists(
            incident_type="INTERNET_DOWN",
            network_id=network_id,
            device_serial=serial,
            window_minutes=settings.dedup_window_minutes
        )
        if exists:
            return None
        return {
            "incident_type": "INTERNET_DOWN",
            "device_serial": serial,
            "device_name":   serial,
            "network_id":    network_id,
            "network_name":  network_id,
            "uplink_name":   uplink.get("interface", "WAN1"),
            "status":        "open",
            "ai_plan":       None,
            "snow_ticket":   None
        }

    async def _process_incident(self, incident: dict):
        incident_type = incident["incident_type"]
        device_name   = incident.get("device_name", "unknown")
        network_name  = incident.get("network_name", "unknown")
        logger.info(f"Processing: {incident_type} | {device_name} | {network_name}")

        kb_query   = f"{incident_type} {device_name} Meraki remediation"
        kb_docs    = await qdrant_service.search(kb_query, limit=5)
        kb_context = "\n\n".join([d["content"] for d in kb_docs]) if kb_docs else "No KB context found."

        ai_plan = await llm_service.generate_remediation_plan(
            incident_type=incident_type,
            device_name=device_name,
            network_name=network_name,
            kb_context=kb_context,
            recent_events=f"Device {device_name} is {incident_type.replace('_', ' ').lower()}"
        )
        incident["ai_plan"] = ai_plan
        incident_id = await mongo_service.save_incident(incident)
        incident["_id"] = incident_id

        ticket_text = await llm_service.generate_ticket_summary(
            incident_type=incident_type,
            device_name=device_name,
            network_name=network_name,
            events_summary=f"{incident_type} detected by Gruve NOC Agent"
        )
        short_desc  = f"[Gruve NOC] {incident_type}: {device_name}"
        description = ticket_text
        if "SHORT:" in ticket_text and "DETAIL:" in ticket_text:
            try:
                short_desc  = ticket_text.split("SHORT:")[1].split("DETAIL:")[0].strip()
                description = ticket_text.split("DETAIL:")[1].strip()
            except Exception:
                pass

        snow_result = await snow_service.create_incident(
            incident_type=incident_type,
            short_description=short_desc,
            description=description,
            device_name=device_name,
            network_name=network_name
        )
        if snow_result:
            await mongo_service.update_incident_status(
                incident_id=incident_id,
                status="open",
                snow_ticket_id=snow_result.get("ticket_number")
            )
            logger.info(f"Incident {incident_id} -> ServiceNow {snow_result.get('ticket_number')}")

    async def _refresh_networks(self):
        try:
            networks = await meraki_service.get_networks()
            await mongo_service.save_networks(networks)
            logger.info(f"Networks cache refreshed: {len(networks)} networks")
        except Exception as e:
            logger.error(f"Network cache refresh failed: {e}")


# Singleton
incident_agent = IncidentAgent()

