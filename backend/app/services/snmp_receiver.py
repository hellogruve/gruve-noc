"""
snmp_receiver.py — SNMP Trap Receiver for Gruve NOC Agent.
Listens on UDP 162 for traps from monitored VMs.
Onboarding a new VM = just point its SNMP traps here.
No code changes needed.
"""

import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger("gruve.noc.snmp")

# Custom OID prefix for Gruve NOC traps
GRUVE_OID_PREFIX = ".1.3.6.1.4.1.99999.1.1"

# OID mappings
OID_MAP = {
    ".1.3.6.1.4.1.99999.1.1.1": "hostname",
    ".1.3.6.1.4.1.99999.1.1.2": "service_name",
    ".1.3.6.1.4.1.99999.1.1.3": "event_type",
    ".1.3.6.1.4.1.99999.1.1.4": "host_ip",
    ".1.3.6.1.4.1.99999.1.1.5": "severity",
    ".1.3.6.1.4.1.99999.1.1.6": "incident_type",
}


def parse_trap(transport_address, var_binds) -> dict:
    """Parse SNMP trap var_binds into a structured event."""
    event = {
        "source_ip":   str(transport_address[0]),
        "received_at": datetime.now(timezone.utc).isoformat()
    }
    for oid, value in var_binds:
        oid_str = str(oid)
        key = OID_MAP.get(oid_str)
        if key:
            event[key] = str(value)

    return event


async def start_snmp_receiver(incident_callback):
    """
    Start SNMP trap receiver on UDP port 162.
    incident_callback(event) is called for each trap received.

    To onboard a new VM:
    1. Install net-snmp on the VM
    2. Configure snmptrap to send to this NOC agent IP
    3. Done — no code changes needed
    """
    try:
        from pysnmp.carrier.asyncio.dgram import udp
        from pysnmp.entity import engine, config
        from pysnmp.entity.rfc3413 import ntfrcv
        from pysnmp.proto.api import v2c

        snmp_engine = engine.SnmpEngine()

        # Listen on UDP 162
        config.addTransport(
            snmp_engine,
            udp.domainName,
            udp.UdpTransport().openServerMode(("0.0.0.0", 1162))
        )

        # Accept community string gruve2026
        config.addV1System(snmp_engine, "gruve-noc", "gruve2026")

        def trap_callback(snmp_engine, state_reference,
                         context_engine_id, context_name,
                         var_binds, cb_ctx):
            transport_domain, transport_address = \
                snmp_engine.msgAndPduDsp.getTransportInfo(state_reference)

            event = parse_trap(transport_address, var_binds)

            if not event.get("incident_type"):
                logger.debug(f"SNMP trap from {event['source_ip']} — no incident type, ignoring")
                return

            logger.info(
                f"SNMP trap received: {event.get('incident_type')} "
                f"from {event.get('hostname', event['source_ip'])} "
                f"service={event.get('service_name', '?')}"
            )

            # Fire callback to create incident
            asyncio.create_task(incident_callback(event))

        ntfrcv.NotificationReceiver(snmp_engine, trap_callback)
        snmp_engine.transportDispatcher.jobStarted(1)

        logger.info("SNMP trap receiver started on UDP 162")

        # Run forever
        try:
            snmp_engine.transportDispatcher.runDispatcher()
        except Exception:
            snmp_engine.transportDispatcher.closeDispatcher()

    except ImportError:
        logger.error("pysnmp not installed — SNMP receiver disabled")
    except PermissionError:
        logger.error("Port 162 requires root — SNMP receiver disabled. Run as root or use port 1162")
    except Exception as e:
        logger.error(f"SNMP receiver failed: {e}")
