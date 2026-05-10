"""
config.py — All application settings loaded from environment variables.
In OCP, these come from ConfigMap (non-sensitive) and Secret (sensitive).
"""

import json
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):

    # ── Meraki ────────────────────────────────────────────────────────────────
    meraki_api_key: str           = Field(..., env="MERAKI_API_KEY")
    meraki_org_id: str            = Field(..., env="MERAKI_ORG_ID")
    meraki_base_url: str          = Field("https://api.meraki.com/api/v1", env="MERAKI_BASE_URL")
    meraki_request_timeout: float = Field(30.0, env="MERAKI_REQUEST_TIMEOUT")
    meraki_network_id: str        = Field("", env="MERAKI_NETWORK_ID")

    # ── LLM ───────────────────────────────────────────────────────────────────
    llm_base_url: str      = Field(..., env="LLM_BASE_URL")
    llm_model: str         = Field("qwen25-7b-instruct", env="LLM_MODEL")
    llm_api_key: str       = Field("unused", env="LLM_API_KEY")
    llm_max_tokens: int    = Field(2048, env="LLM_MAX_TOKENS")
    llm_temperature: float = Field(0.3, env="LLM_TEMPERATURE")
    llm_timeout: float     = Field(180.0, env="LLM_TIMEOUT")

    # ── MongoDB ───────────────────────────────────────────────────────────────
    mongo_uri: str                  = Field(..., env="MONGO_URI")
    mongo_db_name: str              = Field("gruve_noc", env="MONGO_DB_NAME")
    mongo_collection_incidents: str = Field("incidents", env="MONGO_COLLECTION_INCIDENTS")

    # ── Qdrant ────────────────────────────────────────────────────────────────
    qdrant_url: str             = Field(..., env="QDRANT_URL")
    qdrant_api_key: str         = Field("", env="QDRANT_API_KEY")
    qdrant_collection: str      = Field("meraki_noc_knowledge", env="QDRANT_COLLECTION_NAME")
    qdrant_retrieval_limit: int = Field(5, env="RAG_RETRIEVAL_LIMIT")
    qdrant_timeout: float       = Field(30.0, env="QDRANT_TIMEOUT")
    # ── Prometheus ────────────────────────────────────────────────────────
    prometheus_url: str   = Field("", env="PROMETHEUS_URL")
    prometheus_token: str = Field("", env="PROMETHEUS_TOKEN")

    # ── ServiceNow ────────────────────────────────────────────────────────────
    snow_instance_url: str   = Field(..., env="SNOW_INSTANCE_URL")
    snow_username: str       = Field(..., env="SNOW_USERNAME")
    snow_password: str       = Field(..., env="SNOW_PASSWORD")
    snow_incident_table: str = Field("incident", env="SNOW_INCIDENT_TABLE")

    # ── AAP ───────────────────────────────────────────────────────────────────
    aap_controller_url: str = Field(..., env="AAP_CONTROLLER_URL")
    aap_token: str          = Field(..., env="AAP_TOKEN")
    aap_verify_ssl: bool    = Field(False, env="AAP_VERIFY_SSL")

    # ── AAP Template Map — JSON string, no rebuild needed to add templates ────
    # Example: '{"DEVICE_DOWN": 19, "INTERNET_DOWN": 20}'
    aap_template_map_raw: str = Field(
        default='{}',
        env="AAP_TEMPLATE_MAP"
    )

    @property
    def aap_template_map(self) -> dict:
        """
        Returns incident_type -> template_id mapping.
        Loaded from ConfigMap at runtime.
        Add new templates by updating ConfigMap only — no rebuild needed.
        """
        try:
            return json.loads(self.aap_template_map_raw)
        except Exception:
            return {}

    # ── Pipeline ──────────────────────────────────────────────────────────────
    poll_interval_seconds: int = Field(120, env="PIPELINE_POLL_INTERVAL_SECONDS")
    dedup_window_minutes: int  = Field(5, env="PIPELINE_DEFAULT_WINDOW_MINUTES")

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins_raw: str = Field(
        default="*",
        env="CORS_ALLOWED_ORIGINS"
    )

    @property
    def cors_origins(self) -> list[str]:
        raw = self.cors_origins_raw.strip()
        if raw == "*":
            return ["*"]
        if raw.startswith("["):
            try:
                return json.loads(raw)
            except Exception:
                pass
        return [r.strip().strip('"') for r in raw.split(",") if r.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = False


# Singleton
settings = Settings()
