"""
aap.py — Ansible Automation Platform Controller API integration.
Triggers job templates on aap-controller-aap.apps.ocp-mig2.gruveai.com
"""

import logging
import httpx
from app.config import settings

logger = logging.getLogger("gruve.noc.aap")

# Map incident types to AAP job template IDs.
# Update these IDs after creating job templates in AAP.
INCIDENT_JOB_TEMPLATE_MAP = {
    "DEVICE_DOWN":   19,
    "INTERNET_DOWN": 20,
    "DEVICE_STALE":  None,
}


class AAPService:

    def __init__(self):
        self.base_url = settings.aap_controller_url.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {settings.aap_token}",
            "Content-Type":  "application/json",
            "Accept":        "application/json"
        }
        self.verify_ssl = settings.aap_verify_ssl

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            headers=self.headers,
            timeout=30.0,
            verify=self.verify_ssl
        )

    async def launch_job(
        self,
        job_template_id: int,
        extra_vars: dict = None
    ) -> dict:
        url = f"{self.base_url}/api/v2/job_templates/{job_template_id}/launch/"
        payload = {}
        if extra_vars:
            payload["extra_vars"] = extra_vars

        async with self._client() as client:
            try:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                job = resp.json()
                job_id  = job.get("id")
                job_url = f"{self.base_url}/#/jobs/playbook/{job_id}/details"
                logger.info(f"AAP job launched: id={job_id} template={job_template_id}")
                return {
                    "job_id":  job_id,
                    "job_url": job_url,
                    "status":  job.get("status", "pending")
                }
            except httpx.HTTPStatusError as e:
                logger.error(f"AAP launch failed: {e.response.status_code} | {e.response.text}")
                return {"error": str(e)}
            except Exception as e:
                logger.error(f"AAP launch error: {e}")
                return {"error": str(e)}

    async def get_job_status(self, job_id: int) -> dict:
        url = f"{self.base_url}/api/v2/jobs/{job_id}/"
        async with self._client() as client:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                job = resp.json()
                return {
                    "job_id":   job_id,
                    "status":   job.get("status"),
                    "started":  job.get("started"),
                    "finished": job.get("finished"),
                    "failed":   job.get("failed"),
                    "result_url": job.get("related", {}).get("stdout", "")
                }
            except Exception as e:
                logger.error(f"AAP status check failed for job {job_id}: {e}")
                return {"job_id": job_id, "status": "unknown", "error": str(e)}

    async def get_job_templates(self) -> list[dict]:
        url = f"{self.base_url}/api/v2/job_templates/"
        async with self._client() as client:
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                return [
                    {"id": t["id"], "name": t["name"]}
                    for t in data.get("results", [])
                ]
            except Exception as e:
                logger.error(f"AAP get templates failed: {e}")
                return []


# Singleton
aap_service = AAPService()
