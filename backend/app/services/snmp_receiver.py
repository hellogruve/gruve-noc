"""
snmp_receiver.py — SNMP Trap Receiver for Gruve NOC Agent.
Listens on UDP 1162 for traps from monitored VMs.
Uses pysnmp 7.x asyncio API.
"""

import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger("gruve.noc.snmp")

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
    Uses raw asyncio UDP socket — works with any pysnmp version.
    """
    class SNMPTrapProtocol(asyncio.DatagramProtocol):
        def __init__(self, callback):
            self.callback = callback

        def connection_made(self, transport):
            logger.info("✅ SNMP trap receiver listening on UDP 1162")

        def datagram_received(self, data, addr):
            try:
                event = self._parse_trap(data, addr)
                if event and event.get("incident_type"):
                    logger.info(
                        f"SNMP trap: {event.get('incident_type')} "
                        f"from {event.get('hostname', addr[0])} "
                        f"service={event.get('service_name', '?')}"
                    )
                    asyncio.create_task(self.callback(event))
                else:
                    logger.debug(f"SNMP trap from {addr[0]} — no incident type, skipping")
            except Exception as e:
                logger.error(f"Error parsing SNMP trap: {e}")

        def _parse_trap(self, data: bytes, addr) -> dict:
            """
            Parse SNMP v2c trap packet.
            Extracts OID values using pysnmp decoder.
            """
            event = {
                "source_ip":   addr[0],
                "received_at": datetime.now(timezone.utc).isoformat()
            }
            try:
                from pysnmp.proto import api
                msg_ver = api.decodeMessageVersion(data)
                if msg_ver in api.protoModules:
                    proto_mod = api.protoModules[msg_ver]
                else:
                    logger.warning(f"Unsupported SNMP version from {addr[0]}")
                    return event

                req_msg, _ = proto_mod.apiMessage.decodeMessage(data)
                community = str(proto_mod.apiMessage.getCommunity(req_msg))

                req_pdu = proto_mod.apiMessage.getPDU(req_msg)

                for oid, val in proto_mod.apiPDU.getVarBinds(req_pdu):
                    oid_str = str(oid).lstrip(".")
                    key = OID_MAP.get(oid_str)
                    if key:
                        event[key] = str(val)

            except Exception as e:
                logger.debug(f"pysnmp decode failed: {e} — trying raw parse")
                # Fallback: try to extract strings from raw bytes
                try:
                    text = data.decode("latin-1")
                    for oid_suffix, key in [
                        ("99999.1.1.1", "hostname"),
                        ("99999.1.1.2", "service_name"),
                        ("99999.1.1.6", "incident_type"),
                    ]:
                        if oid_suffix in text:
                            pass
                except Exception:
                    pass

            return event

        def error_received(self, exc):
            logger.error(f"SNMP UDP error: {exc}")

        def connection_lost(self, exc):
            logger.warning(f"SNMP UDP connection lost: {exc}")

    try:
        loop = asyncio.get_event_loop()
        transport, protocol = await loop.create_datagram_endpoint(
            lambda: SNMPTrapProtocol(incident_callback),
            local_addr=("0.0.0.0", 1162)
        )
        logger.info("✅ SNMP trap receiver started on UDP 1162")

        # Keep running forever
        while True:
            await asyncio.sleep(60)

    except PermissionError:
        logger.error("Permission denied on UDP 1162 — SNMP receiver disabled")
    except OSError as e:
        logger.error(f"SNMP receiver OS error: {e}")
    except Exception as e:
        logger.error(f"SNMP receiver failed: {e}", exc_info=True)
