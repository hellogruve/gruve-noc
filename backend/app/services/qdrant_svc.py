"""
qdrant_svc.py — Qdrant vector database client for RAG knowledge base search.
Collection 'meraki_noc_knowledge' lives in the reddit namespace.
Endpoint: http://qdrant.reddit.svc.cluster.local:6333
"""

import logging
from qdrant_client import AsyncQdrantClient

from app.config import settings

logger = logging.getLogger("gruve.noc.qdrant")


class QdrantService:

    def __init__(self):
        self._client = None

    def _get_client(self) -> AsyncQdrantClient:
        if self._client is None:
            self._client = AsyncQdrantClient(
                url=settings.qdrant_url,
                api_key=settings.qdrant_api_key if settings.qdrant_api_key else None,
                timeout=settings.qdrant_timeout
            )
        return self._client

    async def search(self, query: str, limit: int = None) -> list[dict]:
        limit = limit or settings.qdrant_retrieval_limit
        client = self._get_client()

        try:
            results, _ = await client.scroll(
                collection_name=settings.qdrant_collection,
                scroll_filter=None,
                limit=limit,
                with_payload=True,
                with_vectors=False
            )

            docs = []
            for point in results:
                payload = point.payload or {}
                content = payload.get("content", payload.get("text", ""))
                if query.lower() in content.lower():
                    docs.append({
                        "content": content,
                        "source":  payload.get("source", "knowledge base"),
                        "score":   1.0
                    })

            if not docs:
                for point in results[:3]:
                    payload = point.payload or {}
                    content = payload.get("content", payload.get("text", ""))
                    if content:
                        docs.append({
                            "content": content,
                            "source":  payload.get("source", "knowledge base"),
                            "score":   0.5
                        })

            logger.debug(f"Qdrant search '{query[:40]}' returned {len(docs)} results")
            return docs

        except Exception as e:
            logger.error(f"Qdrant search failed: {e}")
            return []

    async def health_check(self) -> bool:
        try:
            client = self._get_client()
            await client.get_collections()
            return True
        except Exception:
            return False


# Singleton
qdrant_service = QdrantService()
