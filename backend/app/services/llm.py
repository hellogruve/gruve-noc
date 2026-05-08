"""
llm.py — Multi-provider LLM service for Gruve NOC.

Provider selection via LLM_PROVIDER env var:
  gemini  → Google Gemini 2.5 Flash (default, recommended)
  qwen    → Qwen 2.5 7B on KServe (on-cluster, fallback)
  openai  → OpenAI GPT-4o
  claude  → Anthropic Claude (requires ANTHROPIC_API_KEY)

To switch provider: set LLM_PROVIDER env var and restart pod.
One command switch:
  oc set env deployment/noc-agent-be LLM_PROVIDER=qwen -n gruve-noc
  oc set env deployment/noc-agent-be LLM_PROVIDER=gemini -n gruve-noc
"""
import logging
import os
import httpx
from app.config import settings

logger = logging.getLogger("gruve.noc.llm")

# ── Provider config ───────────────────────────────────────────────────────────
LLM_PROVIDER     = os.getenv("LLM_PROVIDER", "gemini")
GEMINI_API_KEY   = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL     = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL  = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")

logger.info(f"LLM provider: {LLM_PROVIDER}")


class LLMService:

    # ── Gemini ────────────────────────────────────────────────────────────────
    async def _complete_gemini(self, system_prompt: str, user_prompt: str) -> str:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature":    settings.llm_temperature,
                "maxOutputTokens": settings.llm_max_tokens,
            }
        }
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
            return data["candidates"][0]["content"]["parts"][0]["text"].strip()

    # ── Qwen (OpenAI-compatible KServe) ───────────────────────────────────────
    async def _complete_qwen(self, system_prompt: str, user_prompt: str) -> str:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            timeout=settings.llm_timeout
        )
        response = await client.chat.completions.create(
            model=settings.llm_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt}
            ],
            max_tokens=settings.llm_max_tokens,
            temperature=settings.llm_temperature
        )
        return response.choices[0].message.content.strip()

    # ── OpenAI ────────────────────────────────────────────────────────────────
    async def _complete_openai(self, system_prompt: str, user_prompt: str) -> str:
        from openai import AsyncOpenAI
        openai_key = os.getenv("OPENAI_API_KEY", "")
        openai_model = os.getenv("OPENAI_MODEL", "gpt-4o")
        client = AsyncOpenAI(api_key=openai_key, timeout=60)
        response = await client.chat.completions.create(
            model=openai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt}
            ],
            max_tokens=settings.llm_max_tokens,
            temperature=settings.llm_temperature
        )
        return response.choices[0].message.content.strip()

    # ── Claude ────────────────────────────────────────────────────────────────
    async def _complete_claude(self, system_prompt: str, user_prompt: str) -> str:
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": ANTHROPIC_MODEL,
            "max_tokens": settings.llm_max_tokens,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}]
        }
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, json=payload, headers=headers)
            r.raise_for_status()
            return r.json()["content"][0]["text"].strip()

    # ── Router ────────────────────────────────────────────────────────────────
    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        try:
            if LLM_PROVIDER == "gemini":
                result = await self._complete_gemini(system_prompt, user_prompt)
            elif LLM_PROVIDER == "qwen":
                result = await self._complete_qwen(system_prompt, user_prompt)
            elif LLM_PROVIDER == "openai":
                result = await self._complete_openai(system_prompt, user_prompt)
            elif LLM_PROVIDER == "claude":
                result = await self._complete_claude(system_prompt, user_prompt)
            else:
                logger.warning(f"Unknown provider {LLM_PROVIDER}, falling back to qwen")
                result = await self._complete_qwen(system_prompt, user_prompt)
            logger.debug(f"LLM [{LLM_PROVIDER}] response: {len(result)} chars")
            return result
        except Exception as e:
            logger.error(f"LLM [{LLM_PROVIDER}] failed: {e}")
            # Fallback to Qwen if primary fails
            if LLM_PROVIDER != "qwen":
                logger.warning("Falling back to Qwen...")
                try:
                    return await self._complete_qwen(system_prompt, user_prompt)
                except Exception as e2:
                    logger.error(f"Qwen fallback also failed: {e2}")
            return f"AI plan generation failed: {str(e)}"

    # ── Public methods (unchanged interface) ──────────────────────────────────
    async def generate_remediation_plan(
        self,
        incident_type: str,
        device_name: str,
        network_name: str,
        kb_context: str,
        recent_events: str
    ) -> str:
        system_prompt = """You are an expert NOC engineer specialising in infrastructure automation.
Generate a clear, numbered remediation plan.
Be specific, actionable and concise.
Format: numbered steps, each step on its own line.
End with a validation step to confirm resolution."""
        user_prompt = f"""Incident detected on infrastructure.
Incident type: {incident_type}
Device: {device_name}
Network: {network_name}
Recent events: {recent_events}
Relevant knowledge base context:
{kb_context}
Generate a step-by-step remediation plan for this incident."""
        return await self.complete(system_prompt, user_prompt)

    async def generate_ticket_summary(
        self,
        incident_type: str,
        device_name: str,
        network_name: str,
        events_summary: str
    ) -> str:
        system_prompt = """You are a NOC engineer writing a ServiceNow incident ticket.
Write a concise short_description (max 100 chars) and a detailed description.
Format your response as:
SHORT: <short description>
DETAIL: <detailed description>"""
        user_prompt = f"""Write a ServiceNow ticket for:
Incident: {incident_type}
Device: {device_name}
Network: {network_name}
Events: {events_summary}"""
        return await self.complete(system_prompt, user_prompt)

    async def generate_vulnerability_plan(
        self,
        vm_name: str,
        rhel_version: str,
        critical_count: int,
        important_count: int,
        moderate_count: int,
        critical_packages: list,
        important_packages: list,
        patch_option: str = "security"
    ) -> str:
        system_prompt = """You are a senior RHEL security engineer and Linux systems administrator.
Generate a clear, prioritized vulnerability remediation plan.
Include specific dnf commands, estimated downtime, and rollback procedure.
Format: numbered steps with severity indicators."""
        user_prompt = f"""OpenSCAP vulnerability scan results for {vm_name} running {rhel_version}:

Patch option requested: {patch_option}
Critical vulnerabilities: {critical_count}
Important vulnerabilities: {important_count}
Moderate vulnerabilities: {moderate_count}

Critical packages needing update:
{chr(10).join(critical_packages[:10]) if critical_packages else 'None'}

Important packages needing update:
{chr(10).join(important_packages[:10]) if important_packages else 'None'}

Generate a prioritized remediation plan including:
1. Immediate actions for critical vulnerabilities
2. Scheduled actions for important vulnerabilities
3. Exact dnf commands for {patch_option} patching
4. Estimated downtime and maintenance window recommendation
5. Service restart requirements
6. Rollback procedure if patching fails
7. Validation steps post-patching"""
        return await self.complete(system_prompt, user_prompt)


# Singleton
llm_service = LLMService()
