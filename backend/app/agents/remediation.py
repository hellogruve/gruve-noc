"""
remediation.py — Remediation agent.
When the NOC engineer clicks "Run Remediation" in the UI,
this agent determines the right AAP job template and launches it.
"""

import logging
from typing import Optional

from app.services.aap import aap_service, INCIDENT_JOB_TEMPLATE_MAP

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

        template_id = job_template_id or INCIDENT_JOB_TEMPLATE_MAP.get(incident_type)

        if not template_id:
            logger.warning(
                f"No AAP job template mapped for {incident_type}. "
                f"Create a job template in AAP and update INCIDENT_JOB_TEMPLATE_MAP."
            )
            return {
                "status":  "not_configured",
                "message": (
                    f"No job template configured for {incident_type}. "
                    f"Please create an AAP job template and map it in "
                    f"services/aap.py under INCIDENT_JOB_TEMPLATE_MAP."
                )
            }

        extra_vars = {
            "incident_type": incident_type,
            "device_serial": device_serial,
            "device_name":   device_name,
            "network_id":    network_id,
            "network_name":  network_name,
            "incident_id":   str(incident.get("_id", "")),
            "snow_ticket":   incident.get("snow_ticket", {}).get("ticket_number", "")
        }

        logger.info(
            f"Launching AAP job template {template_id} "
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
