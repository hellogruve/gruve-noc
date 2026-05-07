"""
snmp_agent.py — Processes SNMP traps and creates NOC incidents.
Works for ANY VM that sends SNMP traps — zero code changes to onboard.
"""

import logging
from datetime import datetime, timezone

from app.services.mongo import mongo_service
from app.services.llm import llm_service
from app.services.qdrant_svc import qdrant_service

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

        # If hostname looks like an IP (SNMP parse failed), resolve via integrations collection
        import re
        if re.match(r"^\d+\.\d+\.\d+\.\d+$", hostname) or hostname == "unknown":
            source_ip = event.get("source_ip", "")
            # Try matching source_ip or host_ip against registered integrations
            for ip_to_check in [source_ip, host_ip, hostname]:
                if not ip_to_check:
                    continue
                integ = await mongo_service._db["integrations"].find_one({
                    "credentials.host": ip_to_check,
                    "category": "VM"
                })
                if integ:
                    hostname = integ.get("name", hostname)
                    logger.info(f"Resolved IP {ip_to_check} -> integration name: {hostname}")
                    # Also get services from integration if service_name is empty
                    if not service_name:
                        services = integ.get("credentials", {}).get("services", "")
                        if services:
                            service_name = services.split(",")[0].strip()
                            logger.info(f"Using first configured service: {service_name}")
                    break

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

        logger.info(f"SNMP incident {incident_id} created — ServiceNow ticket will be created by AAP workflow after approval")

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
