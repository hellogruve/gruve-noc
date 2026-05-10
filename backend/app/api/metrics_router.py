"""
metrics_router.py — Infrastructure Metrics API
Queries OCP Prometheus for node, pod, and VM metrics.

Routes:
  GET /api/v1/metrics/config                    — get watched namespaces + VM config
  POST /api/v1/metrics/config/namespace         — add namespace to watch
  DELETE /api/v1/metrics/config/namespace/{ns}  — remove namespace
  GET /api/v1/metrics/nodes                     — all OCP nodes CPU/Memory/Disk
  GET /api/v1/metrics/pods/{namespace}          — pods in namespace
  GET /api/v1/metrics/vms                       — VMs from AAP inventory via node_exporter
  GET /api/v1/metrics/fleet                     — summary of everything
"""
import logging
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.config import settings
from app.services.mongo import mongo_service

logger = logging.getLogger("gruve.noc.metrics")
router = APIRouter(prefix="/metrics", tags=["metrics"])

AAP_URL   = "https://aap-controller-aap.apps.ocp-mig2.gruveai.com"
AAP_TOKEN = "esBXwLQlbRM7QgLguqeqWl231utzVX"

# ── Prometheus query helper ────────────────────────────────────────────────────

async def prom_query(query: str) -> list:
    """Query Prometheus instant API. Returns result list."""
    try:
        headers = {"Authorization": f"Bearer {settings.prometheus_token}"}
        async with httpx.AsyncClient(verify=False, timeout=15) as client:
            r = await client.get(
                f"{settings.prometheus_url}/api/v1/query",
                headers=headers,
                params={"query": query}
            )
            r.raise_for_status()
            data = r.json()
            return data.get("data", {}).get("result", [])
    except Exception as e:
        logger.error(f"Prometheus query failed: {query[:60]} — {e}")
        return []

async def prom_query_range(query: str, duration: str = "1h", step: str = "5m") -> list:
    """Query Prometheus range API. Returns result list with values array."""
    try:
        import time
        end   = int(time.time())
        start = end - _duration_to_seconds(duration)
        headers = {"Authorization": f"Bearer {settings.prometheus_token}"}
        async with httpx.AsyncClient(verify=False, timeout=15) as client:
            r = await client.get(
                f"{settings.prometheus_url}/api/v1/query_range",
                headers=headers,
                params={"query": query, "start": start, "end": end, "step": step}
            )
            r.raise_for_status()
            data = r.json()
            return data.get("data", {}).get("result", [])
    except Exception as e:
        logger.error(f"Prometheus range query failed: {e}")
        return []

def _duration_to_seconds(d: str) -> int:
    if d.endswith("h"): return int(d[:-1]) * 3600
    if d.endswith("m"): return int(d[:-1]) * 60
    if d.endswith("d"): return int(d[:-1]) * 86400
    return 3600

def _val(result_list: list, label_key: str = None, label_val: str = None) -> dict:
    """Extract {label: value} dict from Prometheus instant result."""
    out = {}
    for r in result_list:
        metric = r.get("metric", {})
        val    = float(r.get("value", [0, 0])[1])
        key    = metric.get(label_key, "unknown") if label_key else "value"
        if label_val:
            if metric.get(label_key) == label_val:
                return val
        out[key] = val
    return out

# ── AAP inventory helper ────────────────────────────────────────────────────────

async def get_aap_vms(inventory_id: int = 2) -> list:
    """Fetch hosts from AAP inventory. Returns list of {name, ip}."""
    try:
        headers = {
            "Authorization": f"Bearer {AAP_TOKEN}",
            "Content-Type": "application/json"
        }
        async with httpx.AsyncClient(verify=False, timeout=15) as client:
            r = await client.get(
                f"{AAP_URL}/api/v2/inventories/{inventory_id}/hosts/?page_size=100",
                headers=headers
            )
            r.raise_for_status()
            hosts = r.json().get("results", [])
            vms = []
            for h in hosts:
                name = h.get("name", "")
                # Get IP from variables or name
                variables = h.get("variables", "{}")
                ip = ""
                try:
                    import json as _json
                    vars_dict = _json.loads(variables) if isinstance(variables, str) else variables
                    ip = vars_dict.get("ansible_host", "")
                except Exception:
                    pass
                if not ip:
                    ip = name  # fallback — use hostname
                vms.append({"name": name, "ip": ip, "inventory_id": inventory_id})
            return vms
    except Exception as e:
        logger.error(f"AAP inventory fetch failed: {e}")
        return []

# ── Config endpoints ────────────────────────────────────────────────────────────

class NamespaceRequest(BaseModel):
    namespace: str

@router.get("/config")
async def get_config():
    """Get watched namespaces and VM inventory config from MongoDB."""
    try:
        docs = await mongo_service._db.metrics_config.find({}).to_list(100)
        namespaces = [d for d in docs if d.get("type") == "namespace"]
        vm_config  = next((d for d in docs if d.get("type") == "vm_inventory"), None)

        # Convert ObjectId to string
        for d in namespaces:
            d["_id"] = str(d["_id"])
        if vm_config:
            vm_config["_id"] = str(vm_config["_id"])

        return {
            "namespaces": [{"name": d["name"], "enabled": d.get("enabled", True)} for d in namespaces],
            "vm_inventory": vm_config or {"aap_inventory_id": 2, "scrape_port": 9100}
        }
    except Exception as e:
        logger.error(f"Config fetch failed: {e}")
        return {"namespaces": [], "vm_inventory": {"aap_inventory_id": 2, "scrape_port": 9100}}

@router.post("/config/namespace")
async def add_namespace(req: NamespaceRequest):
    """Add a namespace to watch. Idempotent."""
    ns = req.namespace.strip()
    if not ns:
        raise HTTPException(status_code=400, detail="namespace required")
    try:
        await mongo_service._db.metrics_config.update_one(
            {"type": "namespace", "name": ns},
            {"$set": {"type": "namespace", "name": ns, "enabled": True,
                      "added_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True
        )
        logger.info(f"Namespace added to metrics config: {ns}")
        return {"status": "ok", "namespace": ns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/config/namespace/{namespace}")
async def remove_namespace(namespace: str):
    """Remove a namespace from watch list."""
    try:
        await mongo_service._db.metrics_config.delete_one(
            {"type": "namespace", "name": namespace}
        )
        return {"status": "ok", "namespace": namespace, "removed": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Node metrics ────────────────────────────────────────────────────────────────

@router.get("/nodes")
async def get_nodes():
    """All OCP nodes — CPU, Memory, Disk per node."""
    try:
        # CPU usage % per node (1 - idle)
        cpu_results = await prom_query(
            '100 - (avg by (node) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'
        )
        # Memory usage % per node
        mem_results = await prom_query(
            '100 * (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes))'
        )
        # Memory total GB per node
        mem_total_results = await prom_query(
            'node_memory_MemTotal_bytes'
        )
        # Disk usage % per node (root fs)
        disk_results = await prom_query(
            '100 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"} * 100)'
        )
        # Node ready status
        node_ready_results = await prom_query(
            'kube_node_status_condition{condition="Ready",status="true"}'
        )

        # Build lookup maps
        cpu_map      = {r["metric"].get("node",""):     round(float(r["value"][1]),1) for r in cpu_results}
        mem_map      = {r["metric"].get("instance",""): round(float(r["value"][1]),1) for r in mem_results}
        mem_tot_map  = {r["metric"].get("instance",""): round(float(r["value"][1])/1073741824,1) for r in mem_total_results}
        disk_map     = {r["metric"].get("instance",""): round(float(r["value"][1]),1) for r in disk_results}
        ready_map    = {r["metric"].get("node",""):     float(r["value"][1]) == 1 for r in node_ready_results}

        # ── Dynamic node discovery from Prometheus ──────────────────────────
        # Discovers ALL nodes automatically — no hardcoding
        # Adding a new node to OCP = appears here automatically
        node_info_results = await prom_query(
            'kube_node_info'
        )
        node_role_results = await prom_query(
            'kube_node_role'
        )

        # Build role map: node_name → role
        role_map = {}
        for r in node_role_results:
            node = r["metric"].get("node", "")
            role = r["metric"].get("role", "worker")
            role_map[node] = role

        # Build node → internal_ip map from kube_node_info
        node_ip_map = {}
        for r in node_info_results:
            node       = r["metric"].get("node", "")
            internal_ip = r["metric"].get("internal_ip", "")
            node_ip_map[node] = internal_ip

        # If kube_node_info does not have internal_ip, fall back to
        # node_ipaddress or derive from ready_map keys
        if not node_ip_map:
            # Fallback: discover from node_memory metric which has instance label
            node_mem_results = await prom_query('node_memory_MemTotal_bytes')
            for r in node_mem_results:
                instance = r["metric"].get("instance", "")
                ip = instance.split(":")[0]
                # Try to match to a node name via ready_map
                for node_name in ready_map:
                    if ip and ip not in [v for v in node_ip_map.values()]:
                        node_ip_map[node_name] = ip
                        break

        nodes = []
        for node_name in ready_map.keys():
            ip           = node_ip_map.get(node_name, "")
            instance_key = f"{ip}:9100" if ip else ""
            role         = role_map.get(node_name, "worker")
            nodes.append({
                "name":         node_name,
                "ip":           ip,
                "role":         role,
                "ready":        ready_map.get(node_name, True),
                "cpu_pct":      cpu_map.get(node_name, 0),
                "mem_pct":      mem_map.get(instance_key, 0),
                "mem_total_gb": mem_tot_map.get(instance_key, 0),
                "disk_pct":     disk_map.get(instance_key, 0),
            })

        return {"nodes": nodes, "total": len(nodes)}
    except Exception as e:
        logger.error(f"Node metrics failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Pod metrics ─────────────────────────────────────────────────────────────────

@router.get("/pods/{namespace}")
async def get_pods(namespace: str):
    """Pods in a namespace — CPU and Memory usage."""
    try:
        # CPU cores per pod
        cpu_results = await prom_query(
            f'sum by (pod) (rate(container_cpu_usage_seconds_total{{namespace="{namespace}",container!=""}}[5m]))'
        )
        # Memory MB per pod
        mem_results = await prom_query(
            f'sum by (pod) (container_memory_working_set_bytes{{namespace="{namespace}",container!=""}})'
        )
        # Pod ready status
        ready_results = await prom_query(
            f'kube_pod_status_ready{{namespace="{namespace}",condition="true"}}'
        )

        cpu_map   = {r["metric"].get("pod",""): round(float(r["value"][1])*1000, 1) for r in cpu_results}  # millicores
        mem_map   = {r["metric"].get("pod",""): round(float(r["value"][1])/1048576, 1) for r in mem_results}  # MB
        ready_map = {r["metric"].get("pod",""): float(r["value"][1]) == 1 for r in ready_results}

        all_pods = set(list(cpu_map.keys()) + list(mem_map.keys()) + list(ready_map.keys()))
        pods = []
        for pod in sorted(all_pods):
            pods.append({
                "name":       pod,
                "namespace":  namespace,
                "ready":      ready_map.get(pod, False),
                "cpu_milli":  cpu_map.get(pod, 0),
                "mem_mb":     mem_map.get(pod, 0),
            })

        return {"namespace": namespace, "pods": pods, "total": len(pods)}
    except Exception as e:
        logger.error(f"Pod metrics failed for {namespace}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── VM metrics ─────────────────────────────────────────────────────────────────

@router.get("/vms")
async def get_vms():
    """
    VM metrics — auto-discovered from AAP inventory.
    Queries node_exporter on each VM via Prometheus.
    Adding a new VM to AAP inventory automatically includes it here.
    """
    try:
        # Get VM config from MongoDB
        vm_config = await mongo_service._db.metrics_config.find_one({"type": "vm_inventory"})
        inventory_id = vm_config.get("aap_inventory_id", 2) if vm_config else 2
        scrape_port  = vm_config.get("scrape_port", 9100) if vm_config else 9100

        # Auto-discover VMs from AAP inventory
        vms = await get_aap_vms(inventory_id)
        if not vms:
            return {"vms": [], "total": 0, "message": "No VMs in AAP inventory"}

        # Build instance filter for Prometheus
        instance_filter = "|".join([f"{vm['ip']}:{scrape_port}" for vm in vms if vm.get('ip')])

        # Query all VM metrics in one shot
        cpu_results  = await prom_query(
            f'100 - (avg by (instance) (rate(node_cpu_seconds_total{{mode="idle",instance=~"{instance_filter}"}}[5m])) * 100)'
        )
        mem_results  = await prom_query(
            f'100 * (1 - (node_memory_MemAvailable_bytes{{instance=~"{instance_filter}"}} / node_memory_MemTotal_bytes{{instance=~"{instance_filter}"}}))'
        )
        disk_results = await prom_query(
            f'100 - (node_filesystem_avail_bytes{{mountpoint="/",instance=~"{instance_filter}"}} / node_filesystem_size_bytes{{mountpoint="/",instance=~"{instance_filter}"}} * 100)'
        )
        load_results = await prom_query(
            f'node_load1{{instance=~"{instance_filter}"}}'
        )
        mem_total_results = await prom_query(
            f'node_memory_MemTotal_bytes{{instance=~"{instance_filter}"}}'
        )
        uptime_results = await prom_query(
            f'node_time_seconds{{instance=~"{instance_filter}"}} - node_boot_time_seconds{{instance=~"{instance_filter}"}}'
        )

        cpu_map      = {r["metric"].get("instance","").split(":")[0]: round(float(r["value"][1]),1) for r in cpu_results}
        mem_map      = {r["metric"].get("instance","").split(":")[0]: round(float(r["value"][1]),1) for r in mem_results}
        disk_map     = {r["metric"].get("instance","").split(":")[0]: round(float(r["value"][1]),1) for r in disk_results}
        load_map     = {r["metric"].get("instance","").split(":")[0]: round(float(r["value"][1]),2) for r in load_results}
        mem_tot_map  = {r["metric"].get("instance","").split(":")[0]: round(float(r["value"][1])/1073741824,1) for r in mem_total_results}
        uptime_map   = {r["metric"].get("instance","").split(":")[0]: int(float(r["value"][1])/3600) for r in uptime_results}

        result = []
        for vm in vms:
            ip = vm.get("ip","")
            result.append({
                "name":         vm["name"],
                "ip":           ip,
                "scrape_port":  scrape_port,
                "online":       ip in cpu_map,
                "cpu_pct":      cpu_map.get(ip, 0),
                "mem_pct":      mem_map.get(ip, 0),
                "mem_total_gb": mem_tot_map.get(ip, 0),
                "disk_pct":     disk_map.get(ip, 0),
                "load_1m":      load_map.get(ip, 0),
                "uptime_hours": uptime_map.get(ip, 0),
            })

        return {"vms": result, "total": len(result), "inventory_id": inventory_id}
    except Exception as e:
        logger.error(f"VM metrics failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Fleet summary ───────────────────────────────────────────────────────────────

@router.get("/fleet")
async def get_fleet():
    """High-level summary — node count, pod count, VM health."""
    try:
        node_data = await get_nodes()
        nodes     = node_data.get("nodes", [])

        # Get watched namespaces
        config   = await get_config()
        ns_list  = [n["name"] for n in config.get("namespaces", []) if n.get("enabled")]

        total_pods = 0
        for ns in ns_list:
            pod_data    = await get_pods(ns)
            total_pods += pod_data.get("total", 0)

        vm_data = await get_vms()
        vms     = vm_data.get("vms", [])

        online_nodes = sum(1 for n in nodes if n.get("ready"))
        online_vms   = sum(1 for v in vms if v.get("online"))
        avg_cpu      = round(sum(n.get("cpu_pct",0) for n in nodes) / max(len(nodes),1), 1)
        avg_mem      = round(sum(n.get("mem_pct",0) for n in nodes) / max(len(nodes),1), 1)

        return {
            "nodes":        {"total": len(nodes), "online": online_nodes},
            "pods":         {"total": total_pods, "namespaces": len(ns_list)},
            "vms":          {"total": len(vms), "online": online_vms},
            "cluster_avg":  {"cpu_pct": avg_cpu, "mem_pct": avg_mem},
        }
    except Exception as e:
        logger.error(f"Fleet summary failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
