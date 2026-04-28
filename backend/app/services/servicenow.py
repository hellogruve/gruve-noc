"""
servicenow.py — ServiceNow REST API integration.
Creates and updates incidents in dev385032.service-now.com.
"""

import logging
import httpx
from app.config import settings

logger = logging.getLogger("gruve.noc.servicenow")

INCIDENT_PRIORITY_MAP = {
    "DEVICE_DOWN":     {"urgency": "1", "impact": "1"},
    "INTERNET_DOWN":   {"urgency": "1", "impact": "1"},
    "DEVICE_RECOVERED":{"urgency": "3", "impact": "3"},
    "DEVICE_STALE":    {"urgency": "2", "impact": "2"},
    "DEFAULT":         {"urgency": "2", "impact": "2"},
}


class ServiceNowService:

    def __init__(self):
        self.base_url = settings.snow_instance_url.rstrip("/")
        self.auth = (settings.snow_username, settings.snow_password)
        self.headers = {
            "Accept": "application/json",
            "Content-Type": "application/json"
        }

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            auth=self.auth,
            headers=self.headers,
            timeout=30.0
        )

    async def create_incident(
        self,
        incident_type: str,
        short_description: str,
        description: str,
        device_name: str = "",
        network_name: str = ""
    ) -> dict:
        priority = INCIDENT_PRIORITY_MAP.get(
            incident_type,
            INCIDENT_PRIORITY_MAP["DEFAULT"]
        )

        payload = {
            "short_description": short_description[:160],
            "description":       description,
            "urgency":           priority["urgency"],
            "impact":            priority["impact"],
            "category":          "Network",
            "subcategory":       "Network Infrastructure",
            "caller_id":         settings.snow_username,
            "work_notes":        f"Auto-detected by Gruve NOC Agent\nDevice: {device_name}\nNetwork: {network_name}"
        }

        url = f"{self.base_url}/api/now/table/{settings.snow_incident_table}"

        async with self._client() as client:
            try:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                result = resp.json().get("result", {})
                ticket_number = result.get("number", "unknown")
                sys_id = result.get("sys_id", "")
                logger.info(f"ServiceNow ticket created: {ticket_number} for {incident_type}")
                return {
                    "ticket_number": ticket_number,
                    "sys_id":        sys_id,
                    "url":           f"{self.base_url}/incident.do?sys_id={sys_id}"
                }
            except httpx.HTTPStatusError as e:
                logger.error(f"ServiceNow create failed: {e.response.status_code} | {e.response.text}")
                return {}
            except Exception as e:
                logger.error(f"ServiceNow create error: {e}")
                return {}

    async def update_incident(
        self,
        sys_id: str,
        work_notes: str = "",
        state: str = None
    ):
        payload = {}
        if work_notes:
            payload["work_notes"] = work_notes
        if state:
            payload["state"] = state

        url = f"{self.base_url}/api/now/table/{settings.snow_incident_table}/{sys_id}"

        async with self._client() as client:
            try:
                resp = await client.patch(url, json=payload)
                resp.raise_for_status()
                logger.info(f"ServiceNow incident {sys_id} updated")
            except Exception as e:
                logger.error(f"ServiceNow update failed: {e}")

    async def close_incident(self, sys_id: str, resolution_notes: str):
        await self.update_incident(
            sys_id=sys_id,
            work_notes=resolution_notes,
            state="6"
        )


# Singleton
snow_service = ServiceNowService()
