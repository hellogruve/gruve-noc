import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, Zap, Activity, X, Wifi, WifiOff, MapPin, RefreshCw } from 'lucide-react'

const API = import.meta.env.VITE_API_BASE_URL || ''

const TYPE_COLOR = {
  DEVICE_DOWN:     '#DC2626',
  INTERNET_DOWN:   '#DC2626',
  DEVICE_STALE:    '#D97706',
  DEVICE_RECOVERED:'#16A34A',
  VM_SERVICE_DOWN: '#7C3AED',
}
const TYPE_LABEL = {
  DEVICE_DOWN:     'Device Down',
  INTERNET_DOWN:   'Internet Down',
  DEVICE_STALE:    'Device Stale',
  DEVICE_RECOVERED:'Recovered',
  VM_SERVICE_DOWN: 'VM Service Down',
}

// ── Mini Network Map ───────────────────────────────────────
const NETWORK_LOCATIONS = {
  'Redwood City': { lat:37.4852, lng:-122.2364, city:'Redwood City, CA' },
  'Korea Office': { lat:37.5665, lng:126.9780,  city:'Seoul, Korea' },
  'IN-PUN-ASTP':  { lat:18.5204, lng:73.8567,   city:'Pune, India' },
}
const TYPE_ICON_MAP = {
  wireless:  { color:'#3B8BDE', label:'Wireless AP' },
  appliance: { color:'#16A34A', label:'Firewall' },
  switch:    { color:'#D97706', label:'Switch' },
  default:   { color:'#6B7280', label:'Device' },
}
function latLngToPercent(lat, lng) {
  return { x:((lng+180)/360)*100, y:((90-lat)/180)*100 }
}

function MiniMap() {
  const [data,     setData]     = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading,  setLoading]  = useState(true)

  const load = async () => {
    try {
      const r = await fetch(`${API}/api/v1/devices`)
      const d = await r.json()
      setData(d)
      if (!selected && d.groups?.length > 0) setSelected(d.groups[0].networkId)
    } catch(e) {}
    finally { setLoading(false) }
  }

  useEffect(() => { load(); const t=setInterval(load,30000); return()=>clearInterval(t) }, [])

  const selGroup = data?.groups?.find(g => g.networkId === selected)

  return (
    <div style={{ display:'flex', height:260, overflow:'hidden' }}>
      {/* Map */}
      <div style={{ flex:1, position:'relative', overflow:'hidden',
        background:'linear-gradient(180deg,#0d1117 0%,#0a1628 100%)' }}>
        {/* Grid */}
        <svg width="100%" height="100%" style={{ position:'absolute',top:0,left:0,opacity:0.12 }}>
          {[-90,-60,-30,0,30,60,90,120,150].map(lng=>(
            <line key={lng} x1={`${((lng+180)/360)*100}%`} y1="0"
              x2={`${((lng+180)/360)*100}%`} y2="100%"
              stroke="#00D46A" strokeWidth="0.5" strokeDasharray="3 6"/>
          ))}
          {[-30,0,30,60].map(lat=>(
            <line key={lat} x1="0" y1={`${((90-lat)/180)*100}%`}
              x2="100%" y2={`${((90-lat)/180)*100}%`}
              stroke="#00D46A" strokeWidth="0.5" strokeDasharray="3 6"/>
          ))}
        </svg>
        {/* Continents */}
        <svg viewBox="0 0 1000 500" width="100%" height="100%"
          style={{ position:'absolute',top:0,left:0 }}>
          <path d="M 150 80 L 280 70 L 310 130 L 290 200 L 240 230 L 180 210 L 140 160 Z" fill="rgba(0,212,106,0.06)" stroke="rgba(0,212,106,0.18)" strokeWidth="1"/>
          <path d="M 220 250 L 290 240 L 300 350 L 250 420 L 200 380 L 190 300 Z"         fill="rgba(0,212,106,0.06)" stroke="rgba(0,212,106,0.18)" strokeWidth="1"/>
          <path d="M 460 60 L 560 55 L 570 120 L 500 140 L 450 120 Z"                     fill="rgba(0,212,106,0.06)" stroke="rgba(0,212,106,0.18)" strokeWidth="1"/>
          <path d="M 470 150 L 560 140 L 580 280 L 520 360 L 460 300 L 450 200 Z"         fill="rgba(0,212,106,0.06)" stroke="rgba(0,212,106,0.18)" strokeWidth="1"/>
          <path d="M 570 50 L 850 40 L 880 180 L 800 220 L 680 200 L 580 160 L 560 100 Z" fill="rgba(0,212,106,0.06)" stroke="rgba(0,212,106,0.18)" strokeWidth="1"/>
          <path d="M 760 280 L 870 270 L 880 360 L 820 390 L 750 350 Z"                   fill="rgba(0,212,106,0.06)" stroke="rgba(0,212,106,0.18)" strokeWidth="1"/>
        </svg>
        {/* Connection lines */}
        {!loading && data?.groups?.length > 1 && (()=>{
          const positions = data.groups
            .filter(g=>NETWORK_LOCATIONS[g.networkName])
            .map(g=>latLngToPercent(NETWORK_LOCATIONS[g.networkName].lat,NETWORK_LOCATIONS[g.networkName].lng))
          return (
            <svg width="100%" height="100%" style={{position:'absolute',top:0,left:0,pointerEvents:'none'}}>
              {positions.map((p1,i)=>positions.slice(i+1).map((p2,j)=>(
                <line key={`${i}-${j}`} x1={`${p1.x}%`} y1={`${p1.y}%`} x2={`${p2.x}%`} y2={`${p2.y}%`}
                  stroke="rgba(0,212,106,0.2)" strokeWidth="1" strokeDasharray="4 4"/>
              )))}
            </svg>
          )
        })()}
        {/* Pins */}
        {!loading && data?.groups?.map(group=>{
          const loc = NETWORK_LOCATIONS[group.networkName]
          if (!loc) return null
          const pos   = latLngToPercent(loc.lat, loc.lng)
          const ok    = group.offline === 0
          const isSel = selected === group.networkId
          return (
            <div key={group.networkId} onClick={()=>setSelected(group.networkId)}
              style={{ position:'absolute', left:`${pos.x}%`, top:`${pos.y}%`,
                transform:'translate(-50%,-50%)', cursor:'pointer', zIndex:isSel?10:5 }}>
              {ok && <div style={{ position:'absolute', width:32, height:32, borderRadius:'50%',
                background:'rgba(0,212,106,0.15)', border:'1px solid rgba(0,212,106,0.4)',
                top:'50%', left:'50%', transform:'translate(-50%,-50%)',
                animation:'mmPulse 2s ease-out infinite' }}/>}
              <div style={{ width:26, height:26, borderRadius:'50%',
                background:isSel?'#16A34A':'#1a2332',
                border:`2px solid ${ok?'#16A34A':'#DC2626'}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                boxShadow:`0 2px 8px ${ok?'rgba(22,163,74,0.5)':'rgba(220,38,38,0.5)'}`,
                transition:'all 0.2s' }}>
                <MapPin size={12} color={isSel?'#fff':ok?'#16A34A':'#DC2626'}/>
              </div>
              <div style={{ position:'absolute', top:28, left:'50%', transform:'translateX(-50%)',
                background:'rgba(10,14,26,0.9)', border:'1px solid rgba(255,255,255,0.1)',
                borderRadius:4, padding:'2px 6px', fontSize:9, fontWeight:600,
                color:'#e2e8f0', whiteSpace:'nowrap', pointerEvents:'none' }}>
                {group.networkName} {group.online}/{group.total}
              </div>
            </div>
          )
        })}
        {loading && <div style={{ position:'absolute',inset:0,display:'flex',
          alignItems:'center',justifyContent:'center',
          color:'rgba(255,255,255,0.3)',fontSize:12 }}>Loading map…</div>}
      </div>
      {/* Side panel */}
      <div style={{ width:160, borderLeft:'1px solid var(--bg-border)',
        display:'flex', flexDirection:'column', overflow:'hidden',
        background:'var(--bg-surface)' }}>
        {selGroup ? (
          <>
            <div style={{ padding:'10px 12px', borderBottom:'1px solid var(--bg-border)' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text-primary)',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {selGroup.networkName}
              </div>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
                {NETWORK_LOCATIONS[selGroup.networkName]?.city}
              </div>
              <div style={{ display:'flex', gap:8, marginTop:4 }}>
                <span style={{ fontSize:10, color:'#16A34A', fontWeight:600 }}>{selGroup.online}↑ online</span>
                {selGroup.offline > 0 && <span style={{ fontSize:10, color:'#DC2626', fontWeight:600 }}>{selGroup.offline}↓ offline</span>}
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:'6px 8px' }}>
              {selGroup.devices.map(dev=>{
                const info = TYPE_ICON_MAP[dev.productType] || TYPE_ICON_MAP.default
                const on   = dev.status === 'online'
                return (
                  <div key={dev.serial} style={{ display:'flex', alignItems:'center', gap:6,
                    padding:'4px 0', borderBottom:'1px solid var(--bg-border)' }}>
                    <div style={{ width:5, height:5, borderRadius:'50%', flexShrink:0,
                      background:on?'#16A34A':'#DC2626',
                      boxShadow:`0 0 4px ${on?'rgba(22,163,74,0.6)':'rgba(220,38,38,0.6)'}` }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:10, fontWeight:500, color:'var(--text-primary)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {dev.name}
                      </div>
                      <div style={{ fontSize:9, color:'var(--text-muted)' }}>{info.label}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center',
            color:'var(--text-muted)', fontSize:11, textAlign:'center', padding:12 }}>
            Click a pin
          </div>
        )}
      </div>
      <style>{`
        @keyframes mmPulse {
          0%   { transform:translate(-50%,-50%) scale(1);   opacity:0.8; }
          100% { transform:translate(-50%,-50%) scale(2.2); opacity:0; }
        }
      `}</style>
    </div>
  )
}

// ── Donut Chart ────────────────────────────────────────────
function DonutChart({ pct, online, offline, total }) {
  const r = 52, cx = 64, cy = 64
  const circ   = 2 * Math.PI * r
  const filled = (pct / 100) * circ
  const color  = pct >= 90 ? '#16A34A' : pct >= 70 ? '#D97706' : '#DC2626'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:24 }}>
      <svg width={128} height={128} viewBox="0 0 128 128">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-border)" strokeWidth={14}/>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={14}
          strokeDasharray={`${filled} ${circ}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition:'stroke-dasharray 0.6s ease' }}/>
        <text x={cx} y={cy-6} textAnchor="middle" fontSize={20} fontWeight={700}
          fill="var(--text-primary)" fontFamily="monospace">{pct}%</text>
        <text x={cx} y={cy+12} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
          devices up</text>
      </svg>
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Wifi size={14} color="#16A34A"/>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)',
              fontFamily:'monospace', lineHeight:1 }}>{online}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>Online</div>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <WifiOff size={14} color="#DC2626"/>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)',
              fontFamily:'monospace', lineHeight:1 }}>{offline}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>Offline</div>
          </div>
        </div>
        <div style={{ fontSize:10, color:'var(--text-muted)',
          paddingTop:4, borderTop:'1px solid var(--bg-border)' }}>
          {total} total devices
        </div>
      </div>
    </div>
  )
}

// ── Type Bars ──────────────────────────────────────────────
function TypeBars({ byType }) {
  const entries = Object.entries(byType).sort((a,b)=>b[1]-a[1])
  const max     = Math.max(...entries.map(e=>e[1]), 1)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {entries.length === 0
        ? <div style={{ fontSize:12, color:'var(--text-muted)', padding:'20px 0', textAlign:'center' }}>No incidents recorded</div>
        : entries.map(([type, count]) => (
          <div key={type}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4, fontSize:12 }}>
              <span style={{ color:'var(--text-secondary)' }}>{TYPE_LABEL[type] || type.replace(/_/g,' ')}</span>
              <span style={{ fontWeight:600, fontFamily:'monospace', color:TYPE_COLOR[type]||'var(--text-primary)' }}>{count}</span>
            </div>
            <div style={{ height:7, background:'var(--bg-border)', borderRadius:4, overflow:'hidden' }}>
              <div style={{ height:'100%', borderRadius:4,
                background:TYPE_COLOR[type]||'var(--gruve-green)',
                width:`${(count/max)*100}%`, transition:'width 0.6s ease' }}/>
            </div>
          </div>
        ))
      }
    </div>
  )
}

// ── Quick Actions ──────────────────────────────────────────
const QUICK_JOBS = [
  { id:12, label:'Restart Service',     icon:'🔧', color:'#2563EB' },
  { id:18, label:'Check Disk Usage',    icon:'💾', color:'#16A34A' },
  { id:11, label:'Check Essential Svcs',icon:'🩺', color:'#7C3AED' },
  { id:9,  label:'Patch RHEL VMs',      icon:'📦', color:'#D97706' },
  { id:13, label:'Remediate Service',   icon:'⚡', color:'#DC2626' },
]
function QuickActions({ onQuickAction }) {
  const launch = (job) => {
    if (onQuickAction) onQuickAction(`launch job template id ${job.id} — ${job.label}`)
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {QUICK_JOBS.map(job => (
        <button key={job.id} onClick={() => launch(job)}
          onMouseEnter={e => { e.currentTarget.style.borderColor=job.color; e.currentTarget.style.background=`${job.color}10` }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='var(--bg-border)'; e.currentTarget.style.background='var(--bg-elevated)' }}
          style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
            borderRadius:8, cursor:'pointer', background:'var(--bg-elevated)',
            border:'1px solid var(--bg-border)', transition:'all 0.15s',
            width:'100%', textAlign:'left' }}>
          <span style={{ fontSize:14, lineHeight:1 }}>{job.icon}</span>
          <span style={{ flex:1, fontSize:12, fontWeight:500, color:'var(--text-secondary)' }}>
            {job.label}
          </span>
          <span style={{ fontSize:10, color:'var(--text-muted)', fontFamily:'monospace' }}>→ AI</span>
        </button>
      ))}
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────
function StatCard({ label, value, color, icon:Icon, sublabel, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div className="card" onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ flex:1, cursor:onClick?'pointer':'default', transition:'all 0.15s',
        transform:hovered&&onClick?'translateY(-2px)':'none',
        boxShadow:hovered&&onClick?'0 4px 12px rgba(0,0,0,0.08)':'none',
        borderColor:hovered&&onClick?(color||'var(--gruve-green)'):'var(--bg-border)' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:8 }}>{label}</div>
          <div style={{ fontSize:32, fontWeight:700, color:color||'var(--text-primary)',
            fontFamily:'monospace' }}>{value ?? '—'}</div>
          {sublabel && <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:4 }}>{sublabel}</div>}
        </div>
        <div style={{ padding:10, borderRadius:10,
          background:color?`${color}15`:'var(--bg-elevated)',
          border:color?`1px solid ${color}30`:'1px solid var(--bg-border)' }}>
          <Icon size={18} color={color||'var(--text-muted)'}/>
        </div>
      </div>
      {onClick && (
        <div style={{ fontSize:10, color:color||'var(--gruve-green)',
          marginTop:10, opacity:hovered?1:0, transition:'opacity 0.15s' }}>
          Click to view all →
        </div>
      )}
    </div>
  )
}

// ── Incident Row ───────────────────────────────────────────
function IncidentRow({ incident, onSelect }) {
  const color = TYPE_COLOR[incident.incident_type] || 'var(--text-muted)'
  const ts    = incident.created_at ? new Date(incident.created_at).toLocaleTimeString() : '—'
  return (
    <div onClick={() => onSelect(incident)}
      style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px',
        borderBottom:'1px solid var(--bg-border)', cursor:'pointer', transition:'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'}
      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
      <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500, overflow:'hidden',
          textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {incident.device_name || incident.device_serial}
        </div>
        <div style={{ fontSize:11, color:'var(--text-secondary)' }}>
          {incident.network_name} — {incident.incident_type?.replace(/_/g,' ')}
        </div>
      </div>
      <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace', flexShrink:0 }}>{ts}</div>
      <div className={`badge ${incident.status==='open'?'critical':incident.status==='resolved'?'ok':'warning'}`}>
        {incident.status}
      </div>
    </div>
  )
}

// ── Incident Modal ─────────────────────────────────────────
function IncidentModal({ title, incidents, onClose, onSelect }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.3)', backdropFilter:'blur(2px)' }}/>
      <div onClick={e=>e.stopPropagation()}
        style={{ position:'relative', zIndex:1, background:'var(--bg-surface)',
          borderRadius:16, border:'1px solid var(--bg-border)',
          width:'min(680px,95vw)', maxHeight:'80vh',
          display:'flex', flexDirection:'column',
          boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--bg-border)',
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontWeight:600, fontSize:15 }}>{title}</span>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>
              {incidents.length} incident{incidents.length!==1?'s':''}
            </span>
            <button onClick={onClose}
              style={{ background:'var(--bg-elevated)', border:'1px solid var(--bg-border)',
                borderRadius:6, padding:'4px 8px', cursor:'pointer',
                display:'flex', alignItems:'center' }}>
              <X size={14} color="var(--text-secondary)"/>
            </button>
          </div>
        </div>
        <div style={{ overflowY:'auto', flex:1 }}>
          {incidents.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
              <CheckCircle size={32} style={{ margin:'0 auto 8px', display:'block', opacity:0.3 }}/>
              <div>No incidents in this category</div>
            </div>
          ) : incidents.map(i => (
            <IncidentRow key={i._id} incident={i}
              onSelect={inc => { onClose(); onSelect(inc) }}/>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Section Header ─────────────────────────────────────────
function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--bg-border)',
      display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div>
        <span style={{ fontWeight:600, fontSize:13 }}>{title}</span>
        {subtitle && <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:8 }}>{subtitle}</span>}
      </div>
      <div className="pulse-dot" style={{ background:'var(--gruve-green)' }}/>
    </div>
  )
}


// ── Event Log Colors ───────────────────────────────────────
const EV_COLOR = {
  port_status_change:      { color:'#D97706', label:'Port'     },
  association:             { color:'#2563EB', label:'WiFi Join' },
  disassociation:          { color:'#6B7280', label:'WiFi Leave'},
  vpn_connectivity_change: { color:'#16A34A', label:'VPN'      },
  security_event:          { color:'#DC2626', label:'Security'  },
  dhcp_lease:              { color:'#2563EB', label:'DHCP'      },
  device_packet_flood:     { color:'#DC2626', label:'Flood'     },
  splash_auth:             { color:'#16A34A', label:'Auth'      },
  default:                 { color:'#6B7280', label:'Event'     },
}

function InlineEventLogs() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  const load = async () => {
    try {
      const r = await fetch(`${API}/api/v1/logs?limit=100`)
      const d = await r.json()
      setLogs(Array.isArray(d) ? d : d.logs || d.events || [])
    } catch(e) {}
    finally { setLoading(false) }
  }

  useEffect(() => { load(); const t=setInterval(load,15000); return()=>clearInterval(t) }, [])

  const filtered = search.trim()
    ? logs.filter(l =>
        (l.device_name||'').toLowerCase().includes(search.toLowerCase()) ||
        (l.device_serial||'').toLowerCase().includes(search.toLowerCase()) ||
        (l.description||'').toLowerCase().includes(search.toLowerCase()) ||
        (l.event_type||'').toLowerCase().includes(search.toLowerCase())
      )
    : logs

  if (loading) return (
    <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)', fontSize:12 }}>
      Loading event logs…
    </div>
  )

  if (logs.length === 0) return (
    <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
      <Activity size={28} style={{ margin:'0 auto 8px', display:'block', opacity:0.3 }}/>
      <div style={{ fontSize:12 }}>No recent events</div>
    </div>
  )

  return (
    <div>
      {/* Search bar */}
      <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--bg-border)',
        background:'var(--bg-elevated)' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search device, event type, description..."
          style={{ width:'100%', fontSize:12, padding:'6px 10px',
            borderRadius:6, border:'1px solid var(--bg-border)',
            background:'var(--bg-surface)', color:'var(--text-primary)',
            outline:'none' }}
          onFocus={e => e.target.style.borderColor='var(--gruve-green)'}
          onBlur={e  => e.target.style.borderColor='var(--bg-border)'}
        />
      </div>
      <div style={{ overflowY:'auto', maxHeight:300 }}>
      {/* Header row */}
      <div style={{ display:'grid', gridTemplateColumns:'70px 90px 130px 1fr',
        padding:'6px 16px', borderBottom:'2px solid var(--bg-border)',
        fontSize:10, fontWeight:600, color:'var(--text-muted)',
        textTransform:'uppercase', letterSpacing:'0.06em',
        background:'var(--bg-elevated)' }}>
        <div>Time</div>
        <div>Type</div>
        <div>Device</div>
        <div>Description</div>
      </div>
      {filtered.length === 0 && search ? (
        <div style={{ padding:20, textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>No logs matching "{search}"</div>
      ) : filtered.map((log, i) => {
        const ev   = EV_COLOR[log.event_type] || EV_COLOR.default
        const time = log.occurred_at
          ? new Date(log.occurred_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})
          : '—'
        return (
          <div key={i} style={{ display:'grid',
            gridTemplateColumns:'70px 90px 130px 1fr',
            padding:'7px 16px', borderBottom:'1px solid var(--bg-border)',
            alignItems:'center', fontSize:11,
            background: i%2===0 ? 'transparent' : 'rgba(0,0,0,0.01)',
            transition:'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'}
            onMouseLeave={e => e.currentTarget.style.background=i%2===0?'transparent':'rgba(0,0,0,0.01)'}>
            <div style={{ fontFamily:'monospace', fontSize:10,
              color:'var(--text-muted)' }}>{time}</div>
            <div>
              <span style={{ padding:'2px 6px', borderRadius:8,
                background:`${ev.color}15`, border:`1px solid ${ev.color}35`,
                fontSize:10, fontWeight:500, color:ev.color }}>
                {ev.label}
              </span>
            </div>
            <div style={{ color:'var(--text-primary)', fontWeight:500,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {log.device_name || log.device_serial || '—'}
            </div>
            <div style={{ color:'var(--text-secondary)', overflow:'hidden',
              textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {log.description || log.event_type?.replace(/_/g,' ') || '—'}
            </div>
          </div>
        )
      })}
      </div>
    </div>
  )
}

// ── Dashboard ──────────────────────────────────────────────
export default function Dashboard({ stats, incidents, onSelect, onQuickAction }) {
  const [summary, setSummary] = useState(null)
  const [modal,   setModal]   = useState(null)

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/v1/dashboard/summary`)
        setSummary(await r.json())
      } catch(e) {}
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  const dh = summary?.device_health || { total:0, online:0, offline:0, pct_up:0 }

  const modalIncidents = () => {
    if (!modal) return []
    if (modal === 'total') return incidents
    return (incidents||[]).filter(i=>i.status===modal)
  }
  const modalTitle = () => ({
    total:'All Incidents', open:'Open Incidents',
    remediating:'Remediating Incidents', resolved:'Resolved Incidents'
  }[modal]||'')

  const recent = (incidents||[]).slice(0,8)

  return (
    <div style={{ padding:24, overflowY:'auto', height:'100%' }}>

      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)' }}>NOC Dashboard</h1>
        <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:3 }}>
          Governed execution layer for agentic operations powered by Ansible Automation Platform
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display:'flex', gap:14, marginBottom:20 }}>
        <StatCard label="Total Incidents" value={stats.total} icon={Activity}
          sublabel="All time" onClick={() => setModal('total')}/>
        <StatCard label="Open" value={stats.open} icon={AlertTriangle} color="#DC2626"
          sublabel="Needs attention" onClick={() => setModal('open')}/>
        <StatCard label="Remediating" value={stats.remediating} icon={Zap} color="#D97706"
          sublabel="AAP running" onClick={() => setModal('remediating')}/>
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle} color="#16A34A"
          sublabel="Last 24h" onClick={() => setModal('resolved')}/>
      </div>

      {/* Row 2: Device health + Type bars + Quick Actions */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14, marginBottom:20 }}>

        <div className="card" style={{ padding:0 }}>
          <SectionHeader title="Device Health"
            subtitle={dh.total > 0 ? `${dh.total} devices` : ''}/>
          <div style={{ padding:20 }}>
            {dh.total === 0
              ? <div style={{ textAlign:'center', padding:'20px 0',
                  color:'var(--text-muted)', fontSize:12 }}>Loading device data…</div>
              : <DonutChart pct={dh.pct_up} online={dh.online}
                  offline={dh.offline} total={dh.total}/>
            }
          </div>
        </div>

        <div className="card" style={{ padding:0 }}>
          <SectionHeader title="Incidents by Type"/>
          <div style={{ padding:20 }}>
            <TypeBars byType={summary?.by_type || stats.by_type || {}}/>
          </div>
        </div>

        <div className="card" style={{ padding:0 }}>
          <SectionHeader title="⚡ Quick Actions" subtitle="→ Gruve AI"/>
          <div style={{ padding:16 }}>
            <QuickActions onQuickAction={onQuickAction}/>
          </div>
        </div>
      </div>

      {/* Row 3: Mini Map + Recent Incidents */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr', gap:14 }}>

        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <SectionHeader title="🗺 Network Map" subtitle="live"/>
          <MiniMap/>
        </div>

        <div className="card" style={{ padding:0 }}>
          <SectionHeader title="📋 Event Logs" subtitle="live · 30s TTL"/>
          <InlineEventLogs/>
        </div>
      </div>

      {modal && (
        <IncidentModal title={modalTitle()} incidents={modalIncidents()}
          onClose={() => setModal(null)} onSelect={onSelect}/>
      )}
    </div>
  )
}
