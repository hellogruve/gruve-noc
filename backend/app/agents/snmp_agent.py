"""
snmp_agent.py — Processes SNMP traps and creates NOC incidents.
Works for ANY VM that sends SNMP traps — zero code changes to onboard.
"""

import logging
from datetime import datetime, timezone

from app.services.mongo import mongo_service
from app.services.llm import llm_service
from app.services.qdrant_svc import qdrant_service
from app.services.servicenow import snow_service

logger = logging.getLogger("gruve.noc.snmp_agent")


class SNMPAgent:

    async def process_trap(self, event: dict):
        """
        Process incoming SNMP trap and create incident if needed.
        Called by snmp_receiver for every trap received.
        """
        incident_type = event.get("incident_type", "VM_SERVICE_DOWN")
        hostname      = event.get("hostname", event.get("source_ip", "unknown"))
        service_name  = event.get("service_name", "")
        host_ip       = event.get("host_ip", event.get("source_ip", ""))
        severity      = event.get("severity", "critical")

        logger.info(f"Processing SNMP trap: {incident_type} | {hostname} | {service_name}")

        # Handle service recovery
        if incident_type == "VM_SERVICE_RECOVERED":
            await self._handle_recovery(hostname, service_name)
            return

        # Deduplicate — don't create duplicate incidents
        exists = await mongo_service.incident_exists(
            incident_type=incident_type,
            network_id="nj-infrastructure",
            device_serial=f"{hostname}-vm",
            window_minutes=5
        )
        if exists:
            logger.info(f"Duplicate SNMP incident suppressed for {hostname}/{service_name}")
            return

        # Generate AI plan
        kb_query   = f"{incident_type} {service_name} linux service down remediation"
        kb_docs    = await qdrant_service.search(kb_query, limit=3)
        kb_context = "\n\n".join([d["content"] for d in kb_docs]) if kb_docs else ""

        ai_plan = await llm_service.generate_remediation_plan(
            incident_type=incident_type,
            device_name=hostname,
            network_name="NJ Infrastructure",
            kb_context=kb_context,
            recent_events=f"Service {service_name} is down on {hostname} ({host_ip})"
        )

        # Save incident to MongoDB
        incident = {
            "incident_type":  incident_type,
            "device_serial":  f"{hostname}-vm",
            "device_name":    hostname,
            "network_id":     "nj-infrastructure",
            "network_name":   "NJ Infrastructure",
            "service_name":   service_name,
            "host_ip":        host_ip,
            "severity":       severity,
            "status":         "open",
            "ai_plan":        ai_plan,
            "snow_ticket_id": None,
            "source":         "snmp"
        }

        incident_id = await mongo_service.save_incident(incident)
        logger.info(f"SNMP incident created: {incident_id}")

        # Create ServiceNow ticket
        snow_result = await snow_service.create_incident(
            incident_type=incident_type,
            short_description=f"[Gruve NOC] {incident_type}: {service_name} on {hostname}",
            description=(
                f"SNMP trap received — service down detected.\n"
                f"Host: {hostname} ({host_ip})\n"
                f"Service: {service_name}\n"
                f"Severity: {severity}\n"
                f"Detected at: {datetime.now(timezone.utc).isoformat()}"
            ),
            device_name=hostname,
            network_name="NJ Infrastructure"
        )

        if snow_result:
            await mongo_service.update_incident_status(
                incident_id=incident_id,
                status="open",
                snow_ticket_id=snow_result.get("ticket_number")
            )
            logger.info(f"SNMP incident {incident_id} → ServiceNow {snow_result.get('ticket_number')}")

    async def _handle_recovery(self, hostname: str, service_name: str):
        """Mark open incidents as resolved when service comes back up."""
        logger.info(f"Service recovery: {service_name} on {hostname}")
        # Find open incidents for this host/service and mark resolved
        incidents = await mongo_service.get_incidents(
            limit=10,
            status="open"
        )
        for incident in incidents:
            if (incident.get("device_name") == hostname and
                    incident.get("service_name") == service_name):
                await mongo_service.update_incident_status(
                    incident["_id"],
                    status="resolved"
                )
                logger.info(f"Auto-resolved incident {incident['_id']} — service recovered")


# Singleton
snmp_agent = SNMPAgent()
