"""
snmp_receiver.py — SNMP Trap Receiver for Gruve NOC Agent.
Listens on UDP 1162 for traps from monitored VMs.
Onboarding a new VM = just point its SNMP traps here.
No code changes needed.
"""

import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger("gruve.noc.snmp")

# OID mappings for Gruve NOC custom traps
OID_MAP = {
    "1.3.6.1.4.1.99999.1.1.1": "hostname",
    "1.3.6.1.4.1.99999.1.1.2": "service_name",
    "1.3.6.1.4.1.99999.1.1.3": "event_type",
    "1.3.6.1.4.1.99999.1.1.4": "host_ip",
    "1.3.6.1.4.1.99999.1.1.5": "severity",
    "1.3.6.1.4.1.99999.1.1.6": "incident_type",
}


async def start_snmp_receiver(incident_callback):
    """
    Start SNMP trap receiver on UDP port 1162.
    incident_callback(event) is called for each trap received.
    Onboard new VM: install net-snmp, point traps to this IP:1162.
    """
    try:
        from pysnmp.hlapi.asyncio import SnmpEngine
        from pysnmp.carrier.asyncio.dgram import udp
        from pysnmp.entity import config
        from pysnmp.entity.rfc3413 import ntfrcv

        snmp_engine = SnmpEngine()

        config.addTransport(
            snmp_engine,
            udp.UdpTransport.DOMAIN_NAME,
            udp.UdpTransport().openServerMode(("0.0.0.0", 1162))
        )

        config.addV1System(snmp_engine, "gruve-noc", "gruve2026")

        def trap_callback(snmp_engine, state_reference,
                          context_engine_id, context_name,
                          var_binds, cb_ctx):
            try:
                transport_domain, transport_address = \
                    snmp_engine.observer.getCloneInfo(
                        snmp_engine, state_reference, "rfc3412.receiveMessage:request"
                    )
            except Exception:
                transport_address = ("unknown", 0)

            event = {
                "source_ip":   str(transport_address[0]),
                "received_at": datetime.now(timezone.utc).isoformat()
            }

            for oid, value in var_binds:
                oid_str = str(oid).lstrip(".")
                key = OID_MAP.get(oid_str)
                if key:
                    event[key] = str(value)

            if not event.get("incident_type"):
                logger.debug(f"SNMP trap from {event['source_ip']} — no incident type, skipping")
                return

            logger.info(
                f"SNMP trap: {event.get('incident_type')} "
                f"from {event.get('hostname', event['source_ip'])} "
                f"service={event.get('service_name', '?')}"
            )

            asyncio.create_task(incident_callback(event))

        ntfrcv.NotificationReceiver(snmp_engine, trap_callback)
        snmp_engine.transportDispatcher.jobStarted(1)
        logger.info("✅ SNMP trap receiver listening on UDP 1162")

        while True:
            snmp_engine.transportDispatcher.runDispatcher(1)
            await asyncio.sleep(0)

    except ImportError as e:
        logger.error(f"pysnmp import failed — SNMP receiver disabled: {e}")
    except PermissionError:
        logger.error("Permission denied on UDP 1162 — SNMP receiver disabled")
    except Exception as e:
        logger.error(f"SNMP receiver error: {e}", exc_info=True)
