import { useState, useEffect, useCallback } from 'react'
import { Plus, X, RefreshCw, Server, Box, Cpu, Activity } from 'lucide-react'
const API = import.meta.env.VITE_API_BASE_URL || ''
function pct(val) { return Math.min(100, Math.max(0, val || 0)) }
function colorFor(val) {
  if (val >= 85) return '#ef4444'
  if (val >= 70) return '#f97316'
  if (val >= 50) return '#eab308'
  return 'var(--gruve-green)'
}
function Bar({ value, color }) {
  const c = color || colorFor(value)
  return (
    <div style={{ background:'var(--bg-border)', borderRadius:4, height:6, width:'100%', overflow:'hidden' }}>
      <div style={{ width:`${pct(value)}%`, height:'100%', background:c, borderRadius:4, transition:'width 0.4s' }} />
    </div>
  )
}
function Badge({ label, color='var(--gruve-green)' }) {
  return <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:20, background:`${color}22`, color, letterSpacing:'0.05em', textTransform:'uppercase' }}>{label}</span>
}
function StatRow({ icon:Icon, label, value, unit='%', color }) {
  const c = color || colorFor(value)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
      <Icon size={13} color={c} />
      <span style={{ fontSize:12, color:'var(--text-secondary)', flex:1 }}>{label}</span>
      <span style={{ fontSize:12, fontWeight:700, color:c }}>{typeof value==='number' ? value.toFixed(1) : value}{unit}</span>
    </div>
  )
}
function NodeCard({ node }) {
  return (
    <div style={{ background:'var(--bg-surface)', borderRadius:10, padding:'14px 16px', border:`1px solid ${node.ready ? 'var(--bg-border)' : '#ef444444'}`, borderLeft:`3px solid ${node.ready ? (node.role==='master' ? '#7c3aed' : 'var(--gruve-green)') : '#ef4444'}` }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700 }}>{node.name.split('.')[0]}</div>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{node.ip}</div>
        </div>
        <div style={{ display:'flex', gap:6 }}>
          <Badge label={node.role} color={node.role==='master' ? '#7c3aed' : 'var(--gruve-green)'} />
          <Badge label={node.ready ? 'Ready' : 'NotReady'} color={node.ready ? 'var(--gruve-green)' : '#ef4444'} />
        </div>
      </div>
      <StatRow icon={Cpu} label="CPU" value={node.cpu_pct} />
      <Bar value={node.cpu_pct} />
      <div style={{ marginTop:8 }} />
      <StatRow icon={Activity} label="Memory" value={node.mem_pct} />
      <Bar value={node.mem_pct} />
      <div style={{ marginTop:8 }} />
      <StatRow icon={Server} label="Disk" value={node.disk_pct} />
      <Bar value={node.disk_pct} />
      {node.mem_total_gb > 0 && <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:8 }}>{node.mem_total_gb} GB RAM total</div>}
    </div>
  )
}
function VMCard({ vm }) {
  const uptimeDays = Math.floor((vm.uptime_hours||0)/24)
  const uptimeHrs  = (vm.uptime_hours||0) % 24
  return (
    <div style={{ background:'var(--bg-surface)', borderRadius:10, padding:'14px 16px', border:`1px solid ${vm.online ? 'var(--bg-border)' : '#ef444444'}`, borderLeft:`3px solid ${vm.online ? '#0891b2' : '#ef4444'}` }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div>
          <div style={{ fontSize:12, fontWeight:700 }}>{vm.name}</div>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>{vm.ip}:{vm.scrape_port}</div>
        </div>
        <Badge label={vm.online ? 'Online' : 'Offline'} color={vm.online ? 'var(--gruve-green)' : '#ef4444'} />
      </div>
      {vm.online ? (
        <>
          <StatRow icon={Cpu} label="CPU" value={vm.cpu_pct} />
          <Bar value={vm.cpu_pct} />
          <div style={{ marginTop:8 }} />
          <StatRow icon={Activity} label="Memory" value={vm.mem_pct} />
          <Bar value={vm.mem_pct} />
          <div style={{ marginTop:8 }} />
          <StatRow icon={Server} label="Disk" value={vm.disk_pct} />
          <Bar value={vm.disk_pct} />
          <div style={{ display:'flex', gap:16, marginTop:10 }}>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>Load: <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>{vm.load_1m}</span></div>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>Uptime: <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>{uptimeDays}d {uptimeHrs}h</span></div>
            {vm.mem_total_gb > 0 && <div style={{ fontSize:10, color:'var(--text-muted)' }}>RAM: <span style={{ fontWeight:600, color:'var(--text-secondary)' }}>{vm.mem_total_gb} GB</span></div>}
          </div>
        </>
      ) : (
        <div style={{ fontSize:12, color:'#ef4444', marginTop:8 }}>No metrics — node_exporter unreachable on port {vm.scrape_port}</div>
      )}
    </div>
  )
}
function NamespacePanel({ namespace, onRemove }) {
  const [pods,         setPods]         = useState([])
  const [loading,      setLoading]      = useState(true)
  const [selectedPods, setSelectedPods] = useState(null)
  const [pickMode,     setPickMode]     = useState(false)

  const loadPods = async () => {
    try {
      setLoading(true)
      const r = await fetch(`${API}/api/v1/metrics/pods/${namespace}`)
      const d = await r.json()
      setPods(d.pods || [])
    } catch(e) { setPods([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadPods(); const t=setInterval(loadPods,30000); return ()=>clearInterval(t) }, [namespace])

  const togglePod = (podName) => {
    setSelectedPods(prev => {
      const s = new Set(prev === null ? pods.map(p => p.name) : prev)
      if (s.has(podName)) s.delete(podName); else s.add(podName)
      return new Set(s)
    })
  }

  const visiblePods = selectedPods === null ? pods : pods.filter(p => selectedPods.has(p.name))

  return (
    <div style={{ background:'var(--bg-surface)', border:'1px solid var(--bg-border)', borderRadius:10, overflow:'hidden', marginBottom:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px',
        borderBottom:'1px solid var(--bg-border)', background:'rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Box size={14} color="var(--gruve-green)" />
          <span style={{ fontSize:13, fontWeight:700 }}>{namespace}</span>
          {!loading && <span style={{ fontSize:11, color:'var(--text-muted)' }}>{visiblePods.length}/{pods.length} pods</span>}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button onClick={() => setPickMode(p => !p)} style={{
            fontSize:11, padding:'3px 10px', borderRadius:6, cursor:'pointer',
            border: pickMode ? '1px solid var(--gruve-green)' : '1px solid var(--bg-border)',
            background: pickMode ? 'rgba(0,166,82,0.12)' : 'transparent',
            color: pickMode ? 'var(--gruve-green)' : 'var(--text-muted)', fontWeight:600 }}>
            {pickMode ? '✓ Done' : 'Select Pods'}
          </button>
          <button onClick={() => onRemove(namespace)}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}>
            <X size={14} />
          </button>
        </div>
      </div>

      {pickMode && !loading && pods.length > 0 && (
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--bg-border)', background:'rgba(0,166,82,0.04)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
            <span style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)' }}>CHOOSE PODS TO MONITOR</span>
            <button onClick={() => setSelectedPods(null)}
              style={{ fontSize:11, padding:'2px 8px', borderRadius:5, cursor:'pointer',
                border:'1px solid var(--bg-border)', background:'transparent', color:'var(--gruve-green)' }}>All</button>
            <button onClick={() => setSelectedPods(new Set())}
              style={{ fontSize:11, padding:'2px 8px', borderRadius:5, cursor:'pointer',
                border:'1px solid var(--bg-border)', background:'transparent', color:'#ef4444' }}>None</button>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {pods.map(pod => {
              const active = selectedPods === null || selectedPods.has(pod.name)
              return (
                <button key={pod.name} onClick={() => togglePod(pod.name)} style={{
                  fontSize:11, padding:'4px 10px', borderRadius:6, cursor:'pointer', fontFamily:'monospace',
                  border: active ? '1px solid var(--gruve-green)' : '1px solid var(--bg-border)',
                  background: active ? 'rgba(0,166,82,0.12)' : 'transparent',
                  color: active ? 'var(--gruve-green)' : 'var(--text-muted)' }}>
                  {active ? '✓ ' : ''}{pod.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding:16, fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>Loading pods...</div>
      ) : pods.length===0 ? (
        <div style={{ padding:16, fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>No pods found in {namespace}</div>
      ) : visiblePods.length===0 ? (
        <div style={{ padding:16, fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>
          No pods selected — click Select Pods to choose
        </div>
      ) : (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ borderBottom:'1px solid var(--bg-border)' }}>
            {['Pod','Status','CPU (m)','Memory (MB)'].map(h => (
              <th key={h} style={{ padding:'7px 16px', textAlign:'left', fontSize:11,
                color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>{visiblePods.map((pod,i) => (
            <tr key={pod.name} style={{ borderBottom: i<visiblePods.length-1 ? '1px solid var(--bg-border)' : 'none',
              background: i%2===0 ? 'transparent' : 'rgba(0,0,0,0.06)' }}>
              <td style={{ padding:'8px 16px', fontFamily:'monospace', fontSize:11 }}>{pod.name}</td>
              <td style={{ padding:'8px 16px' }}>
                <Badge label={pod.ready ? 'Ready' : 'Not Ready'} color={pod.ready ? 'var(--gruve-green)' : '#ef4444'} />
              </td>
              <td style={{ padding:'8px 16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ color:colorFor(pod.cpu_milli/10), fontWeight:600, minWidth:40 }}>{pod.cpu_milli}m</span>
                  <div style={{ flex:1, minWidth:60 }}><Bar value={Math.min(100,pod.cpu_milli/10)} /></div>
                </div>
              </td>
              <td style={{ padding:'8px 16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ color:colorFor(pod.mem_mb/20), fontWeight:600, minWidth:50 }}>{pod.mem_mb}</span>
                  <div style={{ flex:1, minWidth:60 }}><Bar value={Math.min(100,pod.mem_mb/20)} /></div>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}) {
  const [pods,    setPods]    = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const load = async () => {
      try { setLoading(true); const r = await fetch(`${API}/api/v1/metrics/pods/${namespace}`); const d = await r.json(); setPods(d.pods || []) }
      catch(e) { setPods([]) }
      finally { setLoading(false) }
    }
    load(); const t = setInterval(load, 30000); return () => clearInterval(t)
  }, [namespace])
  return (
    <div style={{ background:'var(--bg-surface)', border:'1px solid var(--bg-border)', borderRadius:10, overflow:'hidden', marginBottom:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px', borderBottom:'1px solid var(--bg-border)', background:'rgba(0,0,0,0.15)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Box size={14} color="var(--gruve-green)" />
          <span style={{ fontSize:13, fontWeight:700 }}>{namespace}</span>
          {!loading && <span style={{ fontSize:11, color:'var(--text-muted)' }}>{pods.length} pods</span>}
        </div>
        <button onClick={() => onRemove(namespace)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:4 }}><X size={14} /></button>
      </div>
      {loading ? <div style={{ padding:16, fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>Loading pods...</div>
      : pods.length===0 ? <div style={{ padding:16, fontSize:12, color:'var(--text-muted)', textAlign:'center' }}>No pods found in {namespace}</div>
      : (
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr style={{ borderBottom:'1px solid var(--bg-border)' }}>
            {['Pod','Status','CPU (m)','Memory (MB)'].map(h => <th key={h} style={{ padding:'7px 16px', textAlign:'left', fontSize:11, color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>)}
          </tr></thead>
          <tbody>{pods.map((pod,i) => (
            <tr key={pod.name} style={{ borderBottom: i<pods.length-1 ? '1px solid var(--bg-border)' : 'none', background: i%2===0 ? 'transparent' : 'rgba(0,0,0,0.06)' }}>
              <td style={{ padding:'8px 16px', fontFamily:'monospace', fontSize:11 }}>{pod.name}</td>
              <td style={{ padding:'8px 16px' }}><Badge label={pod.ready ? 'Ready' : 'Not Ready'} color={pod.ready ? 'var(--gruve-green)' : '#ef4444'} /></td>
              <td style={{ padding:'8px 16px' }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ color:colorFor(pod.cpu_milli/10), fontWeight:600, minWidth:40 }}>{pod.cpu_milli}m</span><div style={{ flex:1, minWidth:60 }}><Bar value={Math.min(100,pod.cpu_milli/10)} /></div></div></td>
              <td style={{ padding:'8px 16px' }}><div style={{ display:'flex', alignItems:'center', gap:8 }}><span style={{ color:colorFor(pod.mem_mb/20), fontWeight:600, minWidth:50 }}>{pod.mem_mb}</span><div style={{ flex:1, minWidth:60 }}><Bar value={Math.min(100,pod.mem_mb/20)} /></div></div></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}
export default function Metrics() {
  const [subTab,      setSubTab]      = useState('cluster')
  const [nodes,       setNodes]       = useState([])
  const [vms,         setVMs]         = useState([])
  const [namespaces,  setNamespaces]  = useState([])
  const [fleet,       setFleet]       = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [nsInput,     setNsInput]     = useState('')
  const [adding,      setAdding]      = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshing,  setRefreshing]  = useState(false)
  const fetchConfig = useCallback(async () => {
    try { const r = await fetch(`${API}/api/v1/metrics/config`); const d = await r.json(); setNamespaces(d.namespaces || []) } catch(e) {}
  }, [])
  const fetchAll = useCallback(async (showRefresh=false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const [nodesR,vmsR,fleetR] = await Promise.all([
        fetch(`${API}/api/v1/metrics/nodes`).then(r=>r.json()),
        fetch(`${API}/api/v1/metrics/vms`).then(r=>r.json()),
        fetch(`${API}/api/v1/metrics/fleet`).then(r=>r.json()),
      ])
      setNodes(nodesR.nodes||[]); setVMs(vmsR.vms||[]); setFleet(fleetR); setLastUpdated(new Date())
    } catch(e) {}
    finally { setLoading(false); setRefreshing(false) }
  }, [])
  useEffect(() => { fetchConfig(); fetchAll(); const t=setInterval(()=>fetchAll(),30000); return ()=>clearInterval(t) }, [fetchAll,fetchConfig])
  const addNamespace = async () => {
    const ns=nsInput.trim(); if(!ns) return; setAdding(true)
    try { await fetch(`${API}/api/v1/metrics/config/namespace`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({namespace:ns})}); setNsInput(''); await fetchConfig() } catch(e) {}
    finally { setAdding(false) }
  }
  const removeNamespace = async (ns) => {
    try { await fetch(`${API}/api/v1/metrics/config/namespace/${ns}`,{method:'DELETE'}); await fetchConfig() } catch(e) {}
  }
  const masters=nodes.filter(n=>n.role==='master'), workers=nodes.filter(n=>n.role==='worker')
  const onlineVMs=vms.filter(v=>v.online).length, onlineNodes=nodes.filter(n=>n.ready).length
  const summaryCards=[
    {label:'OCP Nodes', value:`${onlineNodes}/${nodes.length}`, color:'var(--gruve-green)', icon:Server},
    {label:'VMs Online', value:`${onlineVMs}/${vms.length}`, color:'#0891b2', icon:Activity},
    {label:'Namespaces', value:namespaces.length, color:'#7c3aed', icon:Box},
    {label:'Avg CPU', value:`${fleet?.cluster_avg?.cpu_pct||0}%`, color:colorFor(fleet?.cluster_avg?.cpu_pct||0), icon:Cpu},
    {label:'Avg Memory', value:`${fleet?.cluster_avg?.mem_pct||0}%`, color:colorFor(fleet?.cluster_avg?.mem_pct||0), icon:Activity},
  ]
  return (
    <div style={{ padding:24, overflowY:'auto', height:'100%' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:20, fontWeight:700 }}>Infrastructure Metrics</h1>
          <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:3 }}>OCP cluster nodes · VM infrastructure · Dynamic namespace monitoring</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {lastUpdated && <span style={{ fontSize:11, color:'var(--text-muted)' }}>Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button onClick={()=>fetchAll(true)} disabled={refreshing} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', fontSize:12, borderRadius:8, background:'none', border:'1px solid var(--bg-border)', color:'var(--text-secondary)', cursor:'pointer' }}>
            <RefreshCw size={13} style={{ animation:refreshing?'spin 1s linear infinite':'none' }} /> Refresh
          </button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:12, marginBottom:20 }}>
        {summaryCards.map(c=>(
          <div key={c.label} style={{ background:'var(--bg-surface)', border:'1px solid var(--bg-border)', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}><c.icon size={14} color={c.color} /><span style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>{c.label}</span></div>
            <div style={{ fontSize:22, fontWeight:700, color:c.color }}>{c.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:20 }}>
        {[{id:'cluster',label:'🖥  OCP Cluster'},{id:'vms',label:'⚙  VM Infrastructure'},{id:'pods',label:'📦  Namespace Pods'}].map(t=>(
          <button key={t.id} onClick={()=>setSubTab(t.id)} style={{ padding:'7px 18px', fontSize:13, borderRadius:8, cursor:'pointer', border:subTab===t.id?'1px solid var(--gruve-green)':'1px solid var(--bg-border)', background:subTab===t.id?'rgba(0,166,82,0.12)':'var(--bg-surface)', color:subTab===t.id?'var(--gruve-green)':'var(--text-secondary)', fontWeight:subTab===t.id?700:400 }}>{t.label}</button>
        ))}
      </div>
      {loading ? <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)', fontSize:13 }}>Loading metrics from Prometheus...</div> : (
        <>
          {subTab==='cluster' && (
            <div>
              {masters.length>0 && <><div style={{ fontSize:12, fontWeight:700, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Control Plane — {masters.length} Masters</div><div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>{masters.map(n=><NodeCard key={n.name} node={n}/>)}</div></>}
              {workers.length>0 && <><div style={{ fontSize:12, fontWeight:700, color:'var(--gruve-green)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:12 }}>Worker Nodes — {workers.length} Workers</div><div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>{workers.map(n=><NodeCard key={n.name} node={n}/>)}</div></>}
              {nodes.length===0 && <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)', fontSize:13 }}>No node metrics — check Prometheus token</div>}
            </div>
          )}
          {subTab==='vms' && (
            <div>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:16 }}>Auto-discovered from AAP NJ-Infrastructure inventory. Add a VM to AAP and it appears here automatically.</div>
              {vms.length===0 ? <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)', fontSize:13 }}>No VMs found in AAP inventory</div>
              : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>{vms.map(v=><VMCard key={v.name} vm={v}/>)}</div>}
            </div>
          )}
          {subTab==='pods' && (
            <div>
              <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:20, padding:'12px 16px', background:'var(--bg-surface)', border:'1px solid var(--bg-border)', borderRadius:10 }}>
                <Box size={16} color="var(--gruve-green)" />
                <input value={nsInput} onChange={e=>setNsInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addNamespace()} placeholder="Enter namespace (e.g. gruve-noc, aap, openshift-monitoring)" style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:13, color:'var(--text-primary)' }} />
                <button onClick={addNamespace} disabled={adding||!nsInput.trim()} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 14px', fontSize:12, borderRadius:8, border:'none', fontWeight:700, background: nsInput.trim() ? 'var(--gruve-green)' : 'var(--bg-border)', color: nsInput.trim() ? '#000' : 'var(--text-muted)', cursor: nsInput.trim() ? 'pointer' : 'not-allowed', transition:'all 0.15s' }}><Plus size={13}/>{adding?'Adding...':'Add Namespace'}</button>
              </div>
              {namespaces.length===0 ? (
                <div style={{ textAlign:'center', padding:60, color:'var(--text-muted)', fontSize:13, background:'var(--bg-surface)', border:'1px solid var(--bg-border)', borderRadius:10 }}>
                  <Box size={36} style={{ opacity:0.2, marginBottom:12 }} />
                  <div style={{ fontWeight:600, marginBottom:6 }}>No namespaces added yet</div>
                  <div style={{ fontSize:12 }}>Type a namespace above and press Enter</div>
                </div>
              ) : namespaces.filter(n=>n.enabled).map(n=><NamespacePanel key={n.name} namespace={n.name} onRemove={removeNamespace}/>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}
