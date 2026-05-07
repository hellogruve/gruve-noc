"""
snmp_receiver.py — SNMP Trap Receiver for Gruve NOC Agent.
Uses blocking socket in thread pool. Falls back to raw string extraction.
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

# OID suffix → field name for raw extraction
OID_SUFFIXES = [
    ("99999.1.1.1", "hostname"),
    ("99999.1.1.2", "service_name"),
    ("99999.1.1.3", "event_type"),
    ("99999.1.1.4", "host_ip"),
    ("99999.1.1.5", "severity"),
    ("99999.1.1.6", "incident_type"),
]


def parse_snmp_trap(data: bytes, addr) -> dict:
    """
    Parse SNMP trap — tries pysnmp first, falls back to raw extraction.
    """
    event = {
        "source_ip":   addr[0],
        "received_at": datetime.now(timezone.utc).isoformat()
    }

    # Method 1 — pysnmp proper decode
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
            if event.get("incident_type"):
                logger.debug("Parsed via pysnmp")
                return event
    except Exception as e:
        logger.debug(f"pysnmp decode failed: {e}")

    # Method 2 — OID-positional extraction (dynamic — no hardcoded hostnames/services)
    try:
        import re
        raw = data.decode("latin-1")
        strings = [s.strip() for s in re.findall(r'[ -~]{2,}', raw) if s.strip()]
        logger.debug(f"Raw strings in packet: {strings}")

        EVENT_TYPES    = {"service_down", "service_up", "disk_critical"}
        SEVERITY_VALS  = {"critical", "warning", "ok", "info"}
        INCIDENT_TYPES = {"VM_SERVICE_DOWN", "VM_SERVICE_RECOVERED", "DISK_CRITICAL"}

        # Anchor on event_type (always OID .1.1.3 = 3rd varbind)
        # hostname is 2 before, service_name is 1 before, host_ip is 1 after
        for i, s in enumerate(strings):
            if s in EVENT_TYPES:
                if i >= 2:
                    event["hostname"]     = strings[i - 2]
                    event["service_name"] = strings[i - 1]
                elif i == 1:
                    event["hostname"]     = strings[i - 1]
                event["event_type"] = s
                if i + 1 < len(strings) and re.match(r'^\d+\.\d+\.\d+\.\d+$', strings[i + 1]):
                    event["host_ip"] = strings[i + 1]
                    if i + 2 < len(strings) and strings[i + 2] in SEVERITY_VALS:
                        event["severity"] = strings[i + 2]
                    if i + 3 < len(strings) and strings[i + 3] in INCIDENT_TYPES:
                        event["incident_type"] = strings[i + 3]
                elif i + 1 < len(strings) and strings[i + 1] in SEVERITY_VALS:
                    event["severity"] = strings[i + 1]
                    if i + 2 < len(strings) and strings[i + 2] in INCIDENT_TYPES:
                        event["incident_type"] = strings[i + 2]
                break

        # Fallback scan for incident_type anywhere in packet
        for s in strings:
            if not event.get("incident_type") and s in INCIDENT_TYPES:
                event["incident_type"] = s
            if not event.get("severity") and s in SEVERITY_VALS:
                event["severity"] = s
            if not event.get("host_ip") and re.match(r'^\d+\.\d+\.\d+\.\d+$', s):
                event["host_ip"] = s

        if event.get("incident_type") or event.get("event_type"):
            logger.debug(f"Parsed via OID-positional extraction: {event}")
            return event

    except Exception as e:
        logger.debug(f"Raw extraction failed: {e}")


    logger.warning(f"Could not parse SNMP trap from {addr[0]} — event: {event}")
    return event


async def start_snmp_receiver(incident_callback):
    """Start SNMP trap receiver using blocking socket in thread pool."""
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
                        logger.warning(f"SNMP trap from {addr[0]} — incident_type not found in packet")

                except socket.timeout:
                    continue
                except Exception as e:
                    logger.error(f"SNMP receive error: {e}")

        except OSError as e:
            logger.error(f"SNMP bind error: {e}")
        finally:
            sock.close()

    await asyncio.get_event_loop().run_in_executor(None, udp_listener)
