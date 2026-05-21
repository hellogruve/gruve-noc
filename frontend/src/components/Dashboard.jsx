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
  const [tick,     setTick]     = useState(0)

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
  useEffect(() => { const t=setInterval(()=>setTick(x=>x+1),50); return()=>clearInterval(t) }, [])

  const selGroup = data?.groups?.find(g => g.networkId === selected)

  const worldPaths = [
    "M214,35 L226,32 L255,28 L306,27 L357,25 L390,30 L408,35 L415,42 L404,49 L392,58 L375,65 L361,74 L349,80 L332,85 L313,87 L274,85 L255,80 L236,74 L221,67 L210,57 L204,49 L206,41 Z",
    "M361,12 L390,9 L419,11 L434,18 L427,26 L405,30 L379,28 L361,22 Z",
    "M277,92 L306,94 L313,101 L298,106 L280,104 L270,97 Z",
    "M284,109 L313,105 L342,108 L362,117 L372,130 L376,148 L368,165 L350,178 L326,182 L286,182 L268,175 L260,158 L262,141 L270,125 Z",
    "M642,29 L668,26 L693,27 L712,32 L722,38 L715,45 L696,50 L678,52 L656,50 L638,43 L634,36 Z",
    "M659,15 L674,12 L688,15 L692,23 L683,28 L662,26 L654,20 Z",
    "M619,29 L630,26 L638,30 L635,36 L622,36 L614,32 Z",
    "M654,60 L682,56 L714,58 L741,63 L757,74 L762,90 L757,107 L741,122 L717,133 L694,138 L669,136 L646,127 L630,113 L624,96 L628,79 L636,67 Z",
    "M712,19 L788,12 L875,9 L963,11 L1050,15 L1116,19 L1152,26 L1168,34 L1152,43 L1107,47 L1050,49 L990,48 L932,46 L868,45 L809,44 L757,42 L720,39 L706,32 Z",
    "M712,60 L744,57 L769,60 L781,68 L778,77 L748,81 L723,79 L703,71 Z",
    "M814,60 L854,56 L882,58 L901,67 L901,79 L888,90 L869,97 L848,99 L826,95 L803,84 L802,72 Z",
    "M927,68 L961,65 L980,70 L984,79 L969,86 L947,88 L928,83 L916,74 Z",
    "M934,38 L992,33 L1048,36 L1077,43 L1080,54 L1063,61 L1029,64 L988,62 L956,58 L932,52 Z",
    "M1092,40 L1107,37 L1120,40 L1120,47 L1107,50 L1092,47 Z",
    "M1004,169 L1050,163 L1100,165 L1134,173 L1144,184 L1134,196 L1109,203 L1072,205 L1038,200 L1008,191 L994,180 Z",
    "M1167,202 L1178,197 L1189,202 L1186,212 L1169,215 L1160,209 Z",
  ]


  const connectedGroups = !loading && data?.groups
    ? data.groups.filter(g => NETWORK_LOCATIONS[g.networkName])
    : []

  const positions = connectedGroups.map(g => ({
    ...g,
    pos: latLngToPercent(NETWORK_LOCATIONS[g.networkName].lat, NETWORK_LOCATIONS[g.networkName].lng)
  }))

  return (
    <div style={{ display:"flex", height:265, overflow:"hidden" }}>
      <div style={{ flex:1, position:"relative", overflow:"hidden",
        background:"linear-gradient(160deg,#060d1a 0%,#0a1628 40%,#0d1f38 100%)",
        minWidth:0 }}>

        <svg width="100%" height="100%" style={{ position:"absolute",top:0,left:0,opacity:0.08 }}>
          {[-150,-120,-90,-60,-30,0,30,60,90,120,150].map(lng=>(
            <line key={"v"+lng}
              x1={((lng+180)/360)*100+"%"} y1="0"
              x2={((lng+180)/360)*100+"%"} y2="100%"
              stroke="#4ade80" strokeWidth="0.4" strokeDasharray="2 8"/>
          ))}
          {[-60,-30,0,30,60].map(lat=>(
            <line key={"h"+lat} x1="0"
              y1={((90-lat)/180)*100+"%"} x2="100%"
              y2={((90-lat)/180)*100+"%"}
              stroke="#4ade80" strokeWidth="0.4" strokeDasharray="2 8"/>
          ))}
        </svg>

        <svg viewBox="0 0 960 480" width="100%" height="100%"
          preserveAspectRatio="xMidYMid meet"
          style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%" }}
          style={{ position:"absolute",top:0,left:0 }}>
          <defs>
            <radialGradient id="oceanGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0d2040" stopOpacity="0"/>
              <stop offset="100%" stopColor="#060d1a" stopOpacity="0.5"/>
            </radialGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="pinGlow">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          <rect width="1200" height="320" fill="url(#oceanGrad)"/>

          {worldPaths.map((d,i) => (
            <path key={i} d={d}
              fill="rgba(30,58,95,0.75)"
              stroke="rgba(96,165,250,0.22)"
              strokeWidth="0.8"/>
          ))}

          <line x1="0" y1="160" x2="1200" y2="160"
            stroke="rgba(96,165,250,0.10)" strokeWidth="1" strokeDasharray="6 12"/>

          {positions.map((p1,i) => positions.slice(i+1).map((p2,j) => {
            const x1 = p1.pos.x * 12.0
            const y1 = p1.pos.y * 3.2
            const x2 = p2.pos.x * 12.0
            const y2 = p2.pos.y * 3.2
            const mx = (x1+x2)/2
            const my = Math.min(y1,y2) - 45
            const allOnline = p1.offline===0 && p2.offline===0
            const color = allOnline ? "rgba(74,222,128,0.3)" : "rgba(248,113,113,0.3)"
            const dotColor = allOnline ? "#4ade80" : "#f87171"
            const speed = 0.006
            const t1 = (tick * speed) % 1
            const t2 = ((tick * speed) + 0.5) % 1
            const bx1 = (1-t1)*(1-t1)*x1 + 2*(1-t1)*t1*mx + t1*t1*x2
            const by1 = (1-t1)*(1-t1)*y1 + 2*(1-t1)*t1*my + t1*t1*y2
            const bx2 = (1-t2)*(1-t2)*x2 + 2*(1-t2)*t2*mx + t2*t2*x1
            const by2 = (1-t2)*(1-t2)*y2 + 2*(1-t2)*t2*my + t2*t2*y1
            return (
              <g key={i+"-"+j}>
                <path d={"M"+x1+","+y1+" Q"+mx+","+my+" "+x2+","+y2}
                  fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="6 4"/>
                <circle cx={bx1} cy={by1} r="2.8" fill={dotColor} filter="url(#glow)" opacity="0.95"/>
                <circle cx={bx2} cy={by2} r="2" fill={dotColor} opacity="0.5"/>
              </g>
            )
          }))}

          {positions.map(group => {
            const x = group.pos.x * 12.0
            const y = group.pos.y * 3.2
            const ok = group.offline === 0
            const isSel = selected === group.networkId
            const pulseR = 7 + Math.sin(tick * 0.06) * 3
            const color = ok ? "#4ade80" : "#f87171"
            const labelW = group.networkName.length * 6.8 + 24
            return (
              <g key={group.networkId}
                onClick={() => setSelected(group.networkId)}
                style={{ cursor:"pointer" }}>
                <circle cx={x} cy={y} r={pulseR + (isSel?5:0)}
                  fill="none" stroke={color} strokeWidth="1"
                  opacity={0.25 + Math.sin(tick*0.06)*0.15}/>
                <circle cx={x} cy={y} r={isSel?8:5}
                  fill={isSel ? color+"40" : color+"20"}
                  stroke={color} strokeWidth={isSel?2:1.2}
                  filter="url(#pinGlow)"/>
                <circle cx={x} cy={y} r={isSel?4:3}
                  fill={color} filter="url(#pinGlow)"/>
                <rect x={x+10} y={y-10} width={labelW} height={20}
                  rx="3" fill="rgba(6,13,26,0.88)" stroke={color+"50"} strokeWidth="0.8"/>
                <text x={x+15} y={y+4}
                  fontSize="11" fill={color}
                  fontFamily="monospace" fontWeight="700">
                  {group.networkName} {group.online}/{group.total}
                </text>
              </g>
            )
          })}
        </svg>

        {loading && (
          <div style={{ position:"absolute",inset:0,display:"flex",
            alignItems:"center",justifyContent:"center",
            color:"rgba(255,255,255,0.3)",fontSize:12 }}>
            Loading map…
          </div>
        )}
      </div>

      <div style={{ width:180, borderLeft:"1px solid var(--bg-border)",
        display:"flex", flexDirection:"column", overflow:"hidden",
        background:"var(--bg-surface)" }}>
        {selGroup ? (
          <>
            <div style={{ padding:"10px 12px", borderBottom:"1px solid var(--bg-border)",
              background:"linear-gradient(to bottom, rgba(22,163,74,0.04), transparent)" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"var(--text-primary)",
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {selGroup.networkName}
              </div>
              <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:2 }}>
                {NETWORK_LOCATIONS[selGroup.networkName]?.city}
              </div>
              <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
                <span style={{ fontSize:10, color:"#15803D", fontWeight:700,
                  background:"rgba(22,163,74,0.10)", borderRadius:10, padding:"1px 7px",
                  border:"1px solid rgba(22,163,74,0.18)" }}>
                  {selGroup.online}↑ online
                </span>
                {selGroup.offline > 0 && (
                  <span style={{ fontSize:10, color:"#DC2626", fontWeight:700,
                    background:"rgba(220,38,38,0.10)", borderRadius:10, padding:"1px 7px",
                    border:"1px solid rgba(220,38,38,0.18)" }}>
                    {selGroup.offline}↓ offline
                  </span>
                )}
              </div>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"6px 8px" }}>
              {selGroup.devices.map(dev => {
                const info = TYPE_ICON_MAP[dev.productType] || TYPE_ICON_MAP.default
                const on   = dev.status === "online"
                return (
                  <div key={dev.serial} style={{ display:"flex", alignItems:"center", gap:6,
                    padding:"5px 4px", borderBottom:"1px solid var(--bg-border)",
                    borderRadius:4, transition:"background 0.1s" }}
                    onMouseEnter={e=>e.currentTarget.style.background="var(--bg-elevated)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{ width:6, height:6, borderRadius:"50%", flexShrink:0,
                      background:on?"#16A34A":"#DC2626",
                      boxShadow:"0 0 5px "+(on?"rgba(22,163,74,0.7)":"rgba(220,38,38,0.7)")}}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:10, fontWeight:600, color:"var(--text-primary)",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        {dev.name}
                      </div>
                      <div style={{ fontSize:9, color:"var(--text-muted)" }}>{info.label}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
            color:"var(--text-muted)", fontSize:11, textAlign:"center", padding:12 }}>
            Click a pin to see devices
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stat Card ──────────────────────────────────────────────
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
  // Pick accent class based on color
  const accentClass = color === '#DC2626' ? 'stat-card-critical'
    : color === '#D97706' ? 'stat-card-warning'
    : color === '#16A34A' ? 'stat-card-success'
    : 'stat-card-neutral'
  return (
    <div
      className={`card ${accentClass}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex:1,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        transform: hovered && onClick ? 'translateY(-4px)' : 'none',
        boxShadow: hovered && onClick
          ? `0 14px 32px ${color ? color+'25' : 'rgba(0,0,0,0.12)'},0 4px 8px rgba(0,0,0,0.04)` : 'var(--shadow-card)',
      }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)',
          textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</div>
        <div style={{
          width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center',
          background: color ? `${color}18` : 'var(--bg-elevated)',
          border: color ? `1px solid ${color}30` : '1px solid var(--bg-border)',
          flexShrink:0, boxShadow: color ? `0 2px 8px ${color}25` : 'none'
        }}>
          <Icon size={18} color={color || '#94A3B8'} strokeWidth={1.75}/>
        </div>
      </div>
      <div style={{
        fontSize:42, fontWeight:800,
        color: color || 'var(--text-primary)',
        lineHeight:1, marginBottom:6,
        fontVariantNumeric:'tabular-nums',
        letterSpacing:'-0.03em',
      }}>{value ?? '—'}</div>
      {sublabel && (
        <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:500 }}>{sublabel}</div>
      )}
      {onClick && (
        <div style={{
          fontSize:11, color: color || 'var(--gruve-green)', fontWeight:600,
          marginTop:12, opacity: hovered ? 1 : 0, transition:'opacity 0.15s',
          display:'flex', alignItems:'center', gap:4
        }}>
          View all <span style={{ fontSize:13 }}>→</span>
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
    <div style={{
      padding:'12px 16px', borderBottom:'1px solid var(--bg-border)',
      display:'flex', justifyContent:'space-between', alignItems:'center',
      background:'linear-gradient(to right, rgba(22,163,74,0.03), transparent)'
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontWeight:700, fontSize:13, color:'var(--text-primary)', letterSpacing:'-0.01em' }}>{title}</span>
        {subtitle && (
          <span style={{
            fontSize:10, fontWeight:600, color:'var(--gruve-green)',
            background:'rgba(22,163,74,0.08)', border:'1px solid rgba(22,163,74,0.15)',
            borderRadius:20, padding:'1px 8px', letterSpacing:'0.03em', textTransform:'uppercase'
          }}>{subtitle}</span>
        )}
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
  const [vuln,    setVuln]    = useState(null)

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

  useEffect(() => {
    const loadVuln = async () => {
      try {
        const r = await fetch(`${API}/api/v1/vulnerabilities/summary/fleet`)
        setVuln(await r.json())
      } catch(e) {}
    }
    loadVuln()
    const t = setInterval(loadVuln, 60000)
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
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <h1 style={{ fontSize:22, fontWeight:800, color:'var(--text-primary)', letterSpacing:'-0.02em' }}>
              Dashboard
            </h1>
            <span style={{
              display:'inline-flex', alignItems:'center', gap:5,
              fontSize:11, fontWeight:600, color:'var(--status-ok)',
              background:'rgba(22,163,74,0.10)', border:'1px solid rgba(22,163,74,0.20)',
              borderRadius:20, padding:'2px 10px'
            }}>
              <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--status-ok)',
                display:'inline-block', animation:'pulse-dot 2s ease-in-out infinite' }}/>
              Live
            </span>
          </div>
          <p style={{ fontSize:13, color:'var(--text-muted)', fontWeight:400 }}>
            Governed execution layer · Ansible Automation Platform · Real-time monitoring
          </p>
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'right', paddingTop:4 }}>
          <div style={{ fontWeight:600, color:'var(--text-secondary)' }}>
            {new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
          </div>
          <div>{new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })}</div>
        </div>
      </div>

      {/* Row 1: Network Map — full width */}
      <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:20 }}>
        <SectionHeader title="🗺 Network Map" subtitle="live"/>
        <MiniMap/>
      </div>

      {/* Row 2: Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:14, marginBottom:20 }}>
        <StatCard label="Total Incidents" value={stats.total} icon={Activity}
          sublabel="All time" onClick={() => setModal('total')}/>
        <StatCard label="Open" value={stats.open} icon={AlertTriangle} color="#DC2626"
          sublabel="Needs attention" onClick={() => setModal('open')}/>
        <StatCard label="Remediating" value={stats.remediating} icon={Zap} color="#D97706"
          sublabel="AAP running" onClick={() => setModal('remediating')}/>
        <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle} color="#16A34A"
          sublabel="Last 24h" onClick={() => setModal('resolved')}/>
      </div>

      {/* Row 2b: Vulnerability Risk Tile */}
      {vuln && (
        <div className="card" style={{ marginBottom:20, padding:'16px 20px',
          borderLeft: vuln.total_critical > 0 ? '3px solid #DC2626'
            : vuln.total_important > 0 ? '3px solid #D97706'
            : '3px solid var(--gruve-green)',
          background: vuln.total_critical > 0
            ? 'linear-gradient(135deg, rgba(220,38,38,0.04) 0%, #ffffff 40%)'
            : vuln.total_important > 0
            ? 'linear-gradient(135deg, rgba(217,119,6,0.04) 0%, #ffffff 40%)'
            : 'linear-gradient(135deg, rgba(22,163,74,0.04) 0%, #ffffff 40%)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:16 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:800, marginBottom:4, letterSpacing:'-0.01em' }}>
                  Vulnerability Risk
                </div>
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                  {vuln.scanned_vms} VMs scanned · Last updated just now
                </div>
              </div>
              {/* Risk score */}
              <div style={{ textAlign:'center', padding:'8px 20px',
                borderRadius:12, minWidth:80,
                background: vuln.fleet_risk_score >= 70 ? 'rgba(220,38,38,0.08)' : vuln.fleet_risk_score >= 40 ? 'rgba(217,119,6,0.08)' : 'rgba(22,163,74,0.08)',
                border: `1px solid ${vuln.fleet_risk_score >= 70 ? 'rgba(220,38,38,0.20)' : vuln.fleet_risk_score >= 40 ? 'rgba(217,119,6,0.20)' : 'rgba(22,163,74,0.20)'}` }}>
                <div style={{ fontSize:34, fontWeight:900, lineHeight:1, letterSpacing:'-0.03em',
                  color: vuln.fleet_risk_score >= 70 ? '#DC2626'
                    : vuln.fleet_risk_score >= 40 ? '#D97706'
                    : vuln.fleet_risk_score >= 20 ? '#B45309'
                    : '#16A34A' }}>
                  {vuln.fleet_risk_score}
                </div>
                <div style={{ fontSize:9, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Risk Score</div>
              </div>
            </div>
            {/* Severity counts */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {[
                { label:'Critical',  value:vuln.total_critical,  color:'#f87171',  bg:'rgba(220,38,38,0.12)'  },
                { label:'Important', value:vuln.total_important, color:'#fb923c',  bg:'rgba(234,88,12,0.12)'  },
                { label:'Moderate',  value:vuln.total_moderate,  color:'#facc15',  bg:'rgba(202,138,4,0.12)'  },
                { label:'Patched',   value:vuln.patched_vms,     color:'#4ade80',  bg:'rgba(22,163,74,0.12)'  },
              ].map(s => (
                <div key={s.label} style={{ textAlign:'center', padding:'6px 14px',
                  borderRadius:8, background:s.bg, minWidth:70 }}>
                  <div style={{ fontSize:20, fontWeight:700, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:10, color:'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {/* Link to vuln page */}
            <button
              onClick={() => onQuickAction && onQuickAction('vulnerability')}
              style={{ padding:'7px 16px', fontSize:12, borderRadius:8,
                background:'var(--gruve-green)', border:'none', color:'#000',
                fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              View Details →
            </button>
          </div>
        </div>
      )}

      {/* Row 3: Device Health + Incidents by Type */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
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
      </div>

      {/* Row 4: Event Logs — full width */}
      <div className="card" style={{ padding:0 }}>
        <SectionHeader title="📋 Event Logs" subtitle="live · 30s TTL"/>
        <InlineEventLogs/>
      </div>

      {modal && (
        <IncidentModal title={modalTitle()} incidents={modalIncidents()}
          onClose={() => setModal(null)} onSelect={onSelect}/>
      )}
    </div>
  )
}
