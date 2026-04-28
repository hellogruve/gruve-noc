"""
llm.py — LLM service.
Calls Qwen 2.5 7B running on KServe via OpenAI-compatible API.
Endpoint: qwen25-7b-instruct-predictor.noc-agent.svc.cluster.local
"""

import logging
from openai import AsyncOpenAI
from app.config import settings

logger = logging.getLogger("gruve.noc.llm")


class LLMService:

    def __init__(self):
        self.client = AsyncOpenAI(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            timeout=settings.llm_timeout
        )
        self.model = settings.llm_model

    async def complete(self, system_prompt: str, user_prompt: str) -> str:
        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": user_prompt}
                ],
                max_tokens=settings.llm_max_tokens,
                temperature=settings.llm_temperature
            )
            result = response.choices[0].message.content.strip()
            logger.debug(f"LLM response: {len(result)} chars")
            return result
        except Exception as e:
            logger.error(f"LLM call failed: {e}")
            return f"AI plan generation failed: {str(e)}"

    async def generate_remediation_plan(
        self,
        incident_type: str,
        device_name: str,
        network_name: str,
        kb_context: str,
        recent_events: str
    ) -> str:
        system_prompt = """You are an expert NOC engineer specialising in Cisco Meraki networks.
Generate a clear, numbered remediation plan.
Be specific, actionable and concise.
Format: numbered steps, each step on its own line.
End with a validation step to confirm resolution."""

        user_prompt = f"""Incident detected on Meraki network.

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


# Singleton
llm_service = LLMService()
