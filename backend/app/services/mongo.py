"""
mongo.py — MongoDB service using Motor (async driver).
Stores incidents, networks cache, and device event logs (30min TTL).
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from bson import ObjectId

import motor.motor_asyncio

from app.config import settings

logger = logging.getLogger("gruve.noc.mongo")


def _serialize(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


class MongoService:

    def __init__(self):
        self._client = None
        self._db = None

    async def connect(self):
        self._client = motor.motor_asyncio.AsyncIOMotorClient(settings.mongo_uri)
        self._db = self._client[settings.mongo_db_name]

        # Incidents indexes
        await self._db[settings.mongo_collection_incidents].create_index(
            [("incident_type", 1), ("network_id", 1), ("created_at", -1)]
        )
        await self._db[settings.mongo_collection_incidents].create_index(
            [("status", 1), ("created_at", -1)]
        )

        # Device logs — TTL index: auto-delete after 1800 seconds (30 mins)
        await self._db["device_logs"].create_index(
            [("occurred_at", 1)],
            expireAfterSeconds=1800,
            name="ttl_30min"
        )
        await self._db["device_logs"].create_index(
            [("network_id", 1), ("device_serial", 1), ("occurred_at", -1)]
        )

        logger.info(f"MongoDB connected — database: {settings.mongo_db_name}")

    async def disconnect(self):
        if self._client:
            self._client.close()
            logger.info("MongoDB disconnected")

    async def ping(self):
        await self._client.admin.command("ping")

    # ── Incidents ─────────────────────────────────────────────────────────────

    async def save_incident(self, incident: dict) -> str:
        incident["created_at"] = datetime.now(timezone.utc)
        incident["updated_at"] = datetime.now(timezone.utc)
        result = await self._db[settings.mongo_collection_incidents].insert_one(incident)
        incident_id = str(result.inserted_id)
        logger.info(f"Incident saved: {incident_id} | type={incident.get('incident_type')}")
        return incident_id

    async def get_incidents(
        self,
        limit: int = 20,
        status: Optional[str] = None
    ) -> list[dict]:
        query = {}
        if status:
            query["status"] = status
        cursor = self._db[settings.mongo_collection_incidents]\
            .find(query)\
            .sort("created_at", -1)\
            .limit(limit)
        docs = await cursor.to_list(length=limit)
        return [_serialize(d) for d in docs]

    async def get_incident_by_id(self, incident_id: str) -> Optional[dict]:
        try:
            doc = await self._db[settings.mongo_collection_incidents].find_one(
                {"_id": ObjectId(incident_id)}
            )
            return _serialize(doc) if doc else None
        except Exception:
            return None

    async def incident_exists(
        self,
        incident_type: str,
        network_id: str,
        device_serial: str,
        window_minutes: int = 5
    ) -> bool:
        since = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
        count = await self._db[settings.mongo_collection_incidents].count_documents({
            "incident_type": incident_type,
            "network_id":    network_id,
            "device_serial": device_serial,
            "status":        {"$in": ["open", "remediating"]},
            "created_at":    {"$gte": since}
        })
        return count > 0

    async def update_incident_status(
        self,
        incident_id: str,
        status: str,
        aap_job_id: Optional[int] = None,
        snow_ticket_id: Optional[str] = None
    ):
        update = {
            "$set": {
                "status":     status,
                "updated_at": datetime.now(timezone.utc)
            }
        }
        if aap_job_id:
            update["$set"]["aap_job_id"] = aap_job_id
        if snow_ticket_id:
            update["$set"]["snow_ticket_id"] = snow_ticket_id
        await self._db[settings.mongo_collection_incidents].update_one(
            {"_id": ObjectId(incident_id)},
            update
        )

    async def get_incident_stats(self) -> dict:
        pipeline = [
            {"$group": {
                "_id":   {"status": "$status", "type": "$incident_type"},
                "count": {"$sum": 1}
            }}
        ]
        cursor  = self._db[settings.mongo_collection_incidents].aggregate(pipeline)
        results = await cursor.to_list(length=100)
        stats   = {"total": 0, "open": 0, "remediating": 0, "resolved": 0, "by_type": {}}
        for r in results:
            count  = r["count"]
            status = r["_id"]["status"]
            itype  = r["_id"]["type"]
            stats["total"] += count
            if status in stats:
                stats[status] += count
            stats["by_type"][itype] = stats["by_type"].get(itype, 0) + count
        return stats

    # ── Networks cache ────────────────────────────────────────────────────────

    async def save_networks(self, networks: list[dict]):
        col = self._db["networks_cache"]
        await col.drop()
        if networks:
            await col.insert_many(networks)

    async def get_networks(self) -> list[dict]:
        cursor = self._db["networks_cache"].find({})
        docs   = await cursor.to_list(length=500)
        return [_serialize(d) for d in docs]

    # ── Device event logs (30-min TTL) ────────────────────────────────────────

    async def save_event_logs(self, events: list[dict]):
        """
        Bulk insert device events. Each event auto-deletes after 30 mins
        via the TTL index on occurred_at.
        """
        if not events:
            return
        # Ensure occurred_at is a datetime object for TTL to work
        for e in events:
            if isinstance(e.get("occurred_at"), str):
                try:
                    e["occurred_at"] = datetime.fromisoformat(
                        e["occurred_at"].replace("Z", "+00:00")
                    )
                except Exception:
                    e["occurred_at"] = datetime.now(timezone.utc)
            elif "occurred_at" not in e:
                e["occurred_at"] = datetime.now(timezone.utc)
        await self._db["device_logs"].insert_many(events)
        logger.debug(f"Saved {len(events)} device log events")

    async def get_event_logs(
        self,
        network_id: Optional[str] = None,
        device_serial: Optional[str] = None,
        limit: int = 100
    ) -> list[dict]:
        """
        Returns recent device events, newest first.
        Optionally filtered by network or specific device serial.
        """
        query = {}
        if network_id:
            query["network_id"] = network_id
        if device_serial:
            query["device_serial"] = device_serial

        cursor = self._db["device_logs"]\
            .find(query)\
            .sort("occurred_at", -1)\
            .limit(limit)
        docs = await cursor.to_list(length=limit)
        return [_serialize(d) for d in docs]

    async def get_event_log_stats(self) -> dict:
        """Summary counts for the logs tab header."""
        total  = await self._db["device_logs"].count_documents({})
        since  = datetime.now(timezone.utc) - timedelta(minutes=5)
        recent = await self._db["device_logs"].count_documents(
            {"occurred_at": {"$gte": since}}
        )
        return {"total_last_30min": total, "last_5min": recent}

# Singleton
mongo_service = MongoService()
