"""
metrics_router.py — Infrastructure Metrics API
OCP nodes queried via Prometheus (instance=hostname label).
VMs queried directly via node_exporter HTTP (bypasses Prometheus).

Routes:
  GET /api/v1/metrics/config
  POST /api/v1/metrics/config/namespace
  DELETE /api/v1/metrics/config/namespace/{ns}
  GET /api/v1/metrics/nodes
  GET /api/v1/metrics/pods/{namespace}
  GET /api/v1/metrics/vms
  GET /api/v1/metrics/fleet
"""
import logging
import httpx
import time
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
    try:
        headers = {"Authorization": f"Bearer {settings.prometheus_token}"}
        async with httpx.AsyncClient(verify=False, timeout=15) as client:
            r = await client.get(
                f"{settings.prometheus_url}/api/v1/query",
                headers=headers,
                params={"query": query}
            )
            r.raise_for_status()
            return r.json().get("data", {}).get("result", [])
    except Exception as e:
        logger.error(f"Prometheus query failed [{query[:50]}]: {e}")
        return []

# ── AAP inventory helper ───────────────────────────────────────────────────────

async def get_aap_vms(inventory_id: int = 2) -> list:
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
                variables = h.get("variables", "{}")
                ip = ""
                try:
                    import json as _json, re as _re
                    # Try JSON first
                    if variables.strip().startswith("{"):
                        vars_dict = _json.loads(variables)
                        ip = vars_dict.get("ansible_host", "")
                    else:
                        # YAML format — extract ansible_host with regex
                        match = _re.search(r'ansible_host:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)', variables)
                        ip = match.group(1) if match else ""
                except Exception:
                    pass
                if not ip:
                    import re as _re
                    ip_match = _re.search(r'(\d+\.\d+\.\d+\.\d+)', name)
                    ip = ip_match.group(1) if ip_match else name
                vms.append({"name": name, "ip": ip, "inventory_id": inventory_id})
            return vms
    except Exception as e:
        logger.error(f"AAP inventory fetch failed: {e}")
        return []

# ── Direct node_exporter query for VMs ────────────────────────────────────────

def parse_metric_line(lines: str, metric_name: str, labels: dict = None) -> float:
    """Parse a specific metric value from node_exporter text output."""
    for line in lines.splitlines():
        if line.startswith('#') or not line.strip():
            continue
        if not line.startswith(metric_name):
            continue
        # Check label filters
        if labels:
            match = True
            for k, v in labels.items():
                if f'{k}="{v}"' not in line:
                    match = False
                    break
            if not match:
                continue
        # Extract value
        parts = line.rsplit(' ', 1)
        if len(parts) == 2:
            try:
                return float(parts[1].strip())
            except ValueError:
                continue
    return 0.0

async def query_node_exporter(ip: str, port: int = 9100) -> dict:
    """Query a single VM's node_exporter directly. Returns metrics dict."""
    try:
        async with httpx.AsyncClient(verify=False, timeout=5) as client:
            r = await client.get(f"http://{ip}:{port}/metrics")
            r.raise_for_status()
            text = r.text

        # CPU — sum idle across all CPUs, calculate usage
        cpu_idle_total = 0.0
        cpu_total_total = 0.0
        cpu_counts = {}
        for line in text.splitlines():
            if line.startswith('#') or not line.strip():
                continue
            if line.startswith('node_cpu_seconds_total{'):
                parts = line.rsplit(' ', 1)
                if len(parts) == 2:
                    val = float(parts[1].strip())
                    cpu = 'unknown'
                    if 'cpu="' in line:
                        cpu = line.split('cpu="')[1].split('"')[0]
                    mode = ''
                    if 'mode="' in line:
                        mode = line.split('mode="')[1].split('"')[0]
                    if cpu not in cpu_counts:
                        cpu_counts[cpu] = {'idle': 0, 'total': 0}
                    cpu_counts[cpu]['total'] += val
                    if mode == 'idle':
                        cpu_counts[cpu]['idle'] += val

        # Calculate CPU usage % — note: these are cumulative counters
        # We can approximate from the ratio of idle to total
        total_idle = sum(c['idle'] for c in cpu_counts.values())
        total_all  = sum(c['total'] for c in cpu_counts.values())
        cpu_pct = round((1 - total_idle / total_all) * 100, 1) if total_all > 0 else 0.0

        # Memory
        mem_total = parse_metric_line(text, 'node_memory_MemTotal_bytes ')
        mem_avail = parse_metric_line(text, 'node_memory_MemAvailable_bytes ')
        mem_pct   = round((1 - mem_avail / mem_total) * 100, 1) if mem_total > 0 else 0.0

        # Disk (root filesystem)
        disk_size  = parse_metric_line(text, 'node_filesystem_size_bytes{', {'mountpoint': '/'})
        disk_avail = parse_metric_line(text, 'node_filesystem_avail_bytes{', {'mountpoint': '/'})
        disk_pct   = round((1 - disk_avail / disk_size) * 100, 1) if disk_size > 0 else 0.0

        # Load average
        load_1m = parse_metric_line(text, 'node_load1 ')

        # Uptime
        boot_time = parse_metric_line(text, 'node_boot_time_seconds ')
        uptime_hours = round((time.time() - boot_time) / 3600, 1) if boot_time > 0 else 0

        # Memory total GB
        mem_total_gb = round(mem_total / 1073741824, 1) if mem_total > 0 else 0

        return {
            "online":       True,
            "cpu_pct":      cpu_pct,
            "mem_pct":      mem_pct,
            "mem_total_gb": mem_total_gb,
            "disk_pct":     disk_pct,
            "load_1m":      round(load_1m, 2),
            "uptime_hours": int(uptime_hours),
        }
    except Exception as e:
        logger.warning(f"node_exporter unreachable at {ip}:{port} — {e}")
        return {"online": False, "cpu_pct": 0, "mem_pct": 0, "mem_total_gb": 0,
                "disk_pct": 0, "load_1m": 0, "uptime_hours": 0}

# ── Config endpoints ────────────────────────────────────────────────────────────

class NamespaceRequest(BaseModel):
    namespace: str

@router.get("/config")
async def get_config():
    try:
        docs = await mongo_service._db.metrics_config.find({}).to_list(100)
        namespaces = [d for d in docs if d.get("type") == "namespace"]
        vm_config  = next((d for d in docs if d.get("type") == "vm_inventory"), None)
        for d in namespaces:
            d["_id"] = str(d["_id"])
        if vm_config:
            vm_config["_id"] = str(vm_config["_id"])
        return {
            "namespaces": [{"name": d["name"], "enabled": d.get("enabled", True)} for d in namespaces],
            "vm_inventory": vm_config or {"aap_inventory_id": 2, "scrape_port": 9100}
        }
    except Exception as e:
        return {"namespaces": [], "vm_inventory": {"aap_inventory_id": 2, "scrape_port": 9100}}

@router.post("/config/namespace")
async def add_namespace(req: NamespaceRequest):
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
        return {"status": "ok", "namespace": ns}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/config/namespace/{namespace}")
async def remove_namespace(namespace: str):
    try:
        await mongo_service._db.metrics_config.delete_one({"type": "namespace", "name": namespace})
        return {"status": "ok", "namespace": namespace, "removed": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── Node metrics — Prometheus with instance=hostname label ─────────────────────

@router.get("/nodes")
async def get_nodes():
    try:
        # ── instance label = hostname (e.g. ocp-mig2-ctrl1.gruveai.com) ──
        cpu_results  = await prom_query(
            '100 - (avg by (instance) (rate(node_cpu_seconds_total{job="node-exporter",mode="idle"}[5m])) * 100)'
        )
        mem_results  = await prom_query(
            '100 * (1 - (node_memory_MemAvailable_bytes{job="node-exporter"} / node_memory_MemTotal_bytes{job="node-exporter"}))'
        )
        mem_tot_results = await prom_query('node_memory_MemTotal_bytes{job="node-exporter"}')
        disk_results = await prom_query(
            '100 - (node_filesystem_avail_bytes{job="node-exporter",mountpoint="/"} / node_filesystem_size_bytes{job="node-exporter",mountpoint="/"} * 100)'
        )
        ready_results = await prom_query('kube_node_status_condition{condition="Ready",status="true"}')
        node_info_results = await prom_query('kube_node_info')
        node_role_results = await prom_query('kube_node_role')

        # All use instance=hostname
        cpu_map     = {r["metric"].get("instance",""): round(float(r["value"][1]),1) for r in cpu_results}
        mem_map     = {r["metric"].get("instance",""): round(float(r["value"][1]),1) for r in mem_results}
        mem_tot_map = {r["metric"].get("instance",""): round(float(r["value"][1])/1073741824,1) for r in mem_tot_results}
        disk_map    = {r["metric"].get("instance",""): round(float(r["value"][1]),1) for r in disk_results}
        ready_map   = {r["metric"].get("node",""):     float(r["value"][1])==1 for r in ready_results}
        role_map    = {r["metric"].get("node",""):     r["metric"].get("role","worker") for r in node_role_results}
        ip_map      = {r["metric"].get("node",""):     r["metric"].get("internal_ip","") for r in node_info_results}

        nodes = []
        for node_name in ready_map:
            nodes.append({
                "name":         node_name,
                "ip":           ip_map.get(node_name, ""),
                "role":         role_map.get(node_name, "worker"),
                "ready":        ready_map.get(node_name, True),
                "cpu_pct":      cpu_map.get(node_name, 0),
                "mem_pct":      mem_map.get(node_name, 0),
                "mem_total_gb": mem_tot_map.get(node_name, 0),
                "disk_pct":     disk_map.get(node_name, 0),
            })

        return {"nodes": nodes, "total": len(nodes)}
    except Exception as e:
        logger.error(f"Node metrics failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Pod metrics ────────────────────────────────────────────────────────────────

@router.get("/pods/{namespace}")
async def get_pods(namespace: str):
    try:
        cpu_results = await prom_query(
            f'sum by (pod) (rate(container_cpu_usage_seconds_total{{namespace="{namespace}",container!=""}}[5m]))'
        )
        mem_results = await prom_query(
            f'sum by (pod) (container_memory_working_set_bytes{{namespace="{namespace}",container!=""}})'
        )
        ready_results = await prom_query(
            f'kube_pod_status_ready{{namespace="{namespace}",condition="true"}}'
        )

        cpu_map   = {r["metric"].get("pod",""): round(float(r["value"][1])*1000,1) for r in cpu_results}
        mem_map   = {r["metric"].get("pod",""): round(float(r["value"][1])/1048576,1) for r in mem_results}
        ready_map = {r["metric"].get("pod",""): float(r["value"][1])==1 for r in ready_results}

        all_pods = set(list(cpu_map)+list(mem_map)+list(ready_map))
        pods = [{"name":p,"namespace":namespace,"ready":ready_map.get(p,False),
                 "cpu_milli":cpu_map.get(p,0),"mem_mb":mem_map.get(p,0)}
                for p in sorted(all_pods)]

        return {"namespace": namespace, "pods": pods, "total": len(pods)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ── VM metrics — direct node_exporter queries ──────────────────────────────────

@router.get("/vms")
async def get_vms():
    try:
        vm_config    = await mongo_service._db.metrics_config.find_one({"type": "vm_inventory"})
        inventory_id = vm_config.get("aap_inventory_id", 2) if vm_config else 2
        scrape_port  = vm_config.get("scrape_port", 9100) if vm_config else 9100

        vms = await get_aap_vms(inventory_id)
        if not vms:
            return {"vms": [], "total": 0}

        # Query all VMs concurrently
        import asyncio
        tasks   = [query_node_exporter(vm["ip"], scrape_port) for vm in vms]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        output = []
        for vm, result in zip(vms, results):
            if isinstance(result, Exception):
                result = {"online": False, "cpu_pct":0,"mem_pct":0,"mem_total_gb":0,
                          "disk_pct":0,"load_1m":0,"uptime_hours":0}
            output.append({
                "name":        vm["name"],
                "ip":          vm["ip"],
                "scrape_port": scrape_port,
                **result
            })

        return {"vms": output, "total": len(output), "inventory_id": inventory_id}
    except Exception as e:
        logger.error(f"VM metrics failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Fleet summary ──────────────────────────────────────────────────────────────

@router.get("/fleet")
async def get_fleet():
    try:
        node_data  = await get_nodes()
        nodes      = node_data.get("nodes", [])
        config     = await get_config()
        ns_list    = [n["name"] for n in config.get("namespaces",[]) if n.get("enabled")]
        total_pods = 0
        for ns in ns_list:
            pod_data    = await get_pods(ns)
            total_pods += pod_data.get("total", 0)
        vm_data    = await get_vms()
        vms        = vm_data.get("vms", [])
        online_nodes = sum(1 for n in nodes if n.get("ready"))
        online_vms   = sum(1 for v in vms if v.get("online"))
        avg_cpu      = round(sum(n.get("cpu_pct",0) for n in nodes)/max(len(nodes),1),1)
        avg_mem      = round(sum(n.get("mem_pct",0) for n in nodes)/max(len(nodes),1),1)
        return {
            "nodes":       {"total":len(nodes),"online":online_nodes},
            "pods":        {"total":total_pods,"namespaces":len(ns_list)},
            "vms":         {"total":len(vms),"online":online_vms},
            "cluster_avg": {"cpu_pct":avg_cpu,"mem_pct":avg_mem},
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
