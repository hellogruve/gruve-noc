"""
snmp_receiver.py — SNMP Trap Receiver for Gruve NOC Agent.
Uses a dedicated thread for UDP socket to avoid asyncio event loop conflicts.
"""

import asyncio
import logging
import socket
import threading
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


def parse_snmp_trap(data: bytes, addr) -> dict:
    """Parse SNMP v2c trap using pysnmp."""
    event = {
        "source_ip":   addr[0],
        "received_at": datetime.now(timezone.utc).isoformat()
    }
    try:
        from pysnmp.proto import api
        msg_ver = api.decodeMessageVersion(data)
        if msg_ver in api.protoModules:
            proto_mod = api.protoModules[msg_ver]
            req_msg, _ = proto_mod.apiMessage.decodeMessage(data)
            req_pdu = proto_mod.apiMessage.getPDU(req_msg)
            for oid, val in proto_mod.apiPDU.getVarBinds(req_pdu):
                oid_str = str(oid).lstrip(".")
                key = OID_MAP.get(oid_str)
                if key:
                    event[key] = str(val)
    except Exception as e:
        logger.debug(f"pysnmp decode error: {e}")
    return event


async def start_snmp_receiver(incident_callback):
    """
    Start SNMP trap receiver using a blocking socket in a thread pool.
    This avoids asyncio event loop conflicts with uvicorn.
    """
    loop = asyncio.get_event_loop()

    def udp_listener():
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            sock.bind(("0.0.0.0", 1162))
            logger.info("✅ SNMP trap receiver listening on UDP 1162")
            sock.settimeout(1.0)

            while True:
                try:
                    data, addr = sock.recvfrom(4096)
                    logger.info(f"Raw UDP packet received from {addr[0]} — {len(data)} bytes")

                    event = parse_snmp_trap(data, addr)

                    if event.get("incident_type"):
                        logger.info(
                            f"SNMP trap: {event.get('incident_type')} "
                            f"from {event.get('hostname', addr[0])} "
                            f"service={event.get('service_name', '?')}"
                        )
                        asyncio.run_coroutine_threadsafe(
                            incident_callback(event), loop
                        )
                    else:
                        logger.debug(f"SNMP trap from {addr[0]} — no incident type")

                except socket.timeout:
                    continue
                except Exception as e:
                    logger.error(f"SNMP receive error: {e}")

        except OSError as e:
            logger.error(f"SNMP bind error: {e}")
        finally:
            sock.close()

    # Run UDP listener in thread pool — doesn't block asyncio loop
    await asyncio.get_event_loop().run_in_executor(None, udp_listener)
