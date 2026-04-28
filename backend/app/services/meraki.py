"""
meraki.py — Cisco Meraki API client.
Polls Meraki cloud for device status, uplink health, and network events.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger("gruve.noc.meraki")


class MerakiService:

    def __init__(self):
        self.base_url = settings.meraki_base_url.rstrip("/")
        self.headers = {
            "X-Cisco-Meraki-API-Key": settings.meraki_api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        self.timeout = settings.meraki_request_timeout

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            headers=self.headers,
            timeout=self.timeout,
            follow_redirects=True
        )

    async def get_device_availabilities(self) -> list[dict]:
        url = f"{self.base_url}/organizations/{settings.meraki_org_id}/devices/availabilities"
        async with self._client() as client:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                devices = resp.json()
                logger.debug(f"Fetched {len(devices)} device availabilities")
                return devices
            except httpx.HTTPStatusError as e:
                logger.error(f"Meraki device availabilities error: {e.response.status_code}")
                return []
            except Exception as e:
                logger.error(f"Meraki device availabilities failed: {e}")
                return []

    async def get_uplink_statuses(self) -> list[dict]:
        url = f"{self.base_url}/organizations/{settings.meraki_org_id}/appliance/uplink/statuses"
        async with self._client() as client:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                uplinks = resp.json()
                logger.debug(f"Fetched {len(uplinks)} uplink statuses")
                return uplinks
            except httpx.HTTPStatusError as e:
                logger.error(f"Meraki uplink status error: {e.response.status_code}")
                return []
            except Exception as e:
                logger.error(f"Meraki uplink status failed: {e}")
                return []

    async def get_network_events(
        self,
        network_id: str,
        window_minutes: int = 5
    ) -> list[dict]:
        # Meraki requires productType — fetch for all types in parallel
        product_types = ["appliance", "switch", "wireless"]
        all_events = []
        url = f"{self.base_url}/networks/{network_id}/events"
        async with self._client() as client:
            for ptype in product_types:
                try:
                    params = {"perPage": 30, "productType": ptype}
                    resp = await client.get(url, params=params)
                    if resp.status_code == 200:
                        data = resp.json()
                        all_events.extend(data.get("events", []))
                except Exception:
                    pass
        logger.debug(f"Fetched {len(all_events)} events for network {network_id}")
        return all_events

    async def get_networks(self) -> list[dict]:
        url = f"{self.base_url}/organizations/{settings.meraki_org_id}/networks"
        async with self._client() as client:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                networks = resp.json()
                logger.info(f"Fetched {len(networks)} networks")
                return networks
            except Exception as e:
                logger.error(f"Meraki networks failed: {e}")
                return []

    async def get_device_details(self, serial: str) -> Optional[dict]:
        url = f"{self.base_url}/devices/{serial}"
        async with self._client() as client:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                return resp.json()
            except Exception as e:
                logger.error(f"Device details failed for {serial}: {e}")
                return None

    async def get_all_devices(self) -> list[dict]:
        """Returns all devices in the org with full details."""
        url = f"{self.base_url}/organizations/{settings.meraki_org_id}/devices"
        async with self._client() as client:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                devices = resp.json()
                logger.info(f"Fetched {len(devices)} devices")
                return devices
            except Exception as e:
                logger.error(f"Meraki all devices failed: {e}")
                return []


# Singleton
meraki_service = MerakiService()
