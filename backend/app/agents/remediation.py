"""
remediation.py — Remediation agent.
Template IDs loaded dynamically from ConfigMap via aap_service.
No rebuild needed to add new templates — just update ConfigMap.
"""

import logging
from typing import Optional

from app.services.aap import aap_service

logger = logging.getLogger("gruve.noc.remediation_agent")


class RemediationAgent:

    async def run(
        self,
        incident: dict,
        job_template_id: Optional[int] = None
    ) -> dict:
        incident_type = incident.get("incident_type", "UNKNOWN")
        device_serial = incident.get("device_serial", "")
        device_name   = incident.get("device_name", "")
        network_id    = incident.get("network_id", "")
        network_name  = incident.get("network_name", "")

        # Use explicitly passed ID or look up from ConfigMap dynamically
        template_id = job_template_id or aap_service.get_template_id(incident_type)

        if not template_id:
            logger.warning(f"No AAP template configured for {incident_type}")
            return {
                "status":  "not_configured",
                "message": (
                    f"No job template configured for {incident_type}. "
                    f"Add it to AAP_TEMPLATE_MAP in the ConfigMap: "
                    f'e.g. AAP_TEMPLATE_MAP: \'{{"DEVICE_DOWN": 19, "{incident_type}": <id>}}\''
                )
            }

        extra_vars = {
            "incident_type": incident_type,
            "device_serial": device_serial,
            "device_name":   device_name,
            "network_id":    network_id,
            "network_name":  network_name,
            "incident_id":   str(incident.get("_id", "")),
            "snow_ticket":   incident.get("snow_ticket_id", ""),
            "meraki_api_key": "86d9dbe8fb3c0adf0399fb1a697a6baa6ff21da8"
        }

        logger.info(
            f"Launching AAP template {template_id} "
            f"for {incident_type} on {device_name}"
        )

        result = await aap_service.launch_job(
            job_template_id=template_id,
            extra_vars=extra_vars
        )

        if "error" in result:
            logger.error(f"AAP job launch failed: {result['error']}")
        else:
            logger.info(
                f"AAP job {result.get('job_id')} launched "
                f"for incident {incident.get('_id')}"
            )

        return result


# Singleton
remediation_agent = RemediationAgent()
