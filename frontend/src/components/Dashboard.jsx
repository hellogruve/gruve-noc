import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, CheckCircle, Zap, Activity, X, Wifi, WifiOff, Clock } from 'lucide-react'

const API = import.meta.env.VITE_API_BASE_URL || ''

const TYPE_COLOR = {
  DEVICE_DOWN:     '#DC2626',
  INTERNET_DOWN:   '#DC2626',
  DEVICE_STALE:    '#D97706',
  DEVICE_RECOVERED:'#16A34A',
}
const TYPE_LABEL = {
  DEVICE_DOWN:     'Device Down',
  INTERNET_DOWN:   'Internet Down',
  DEVICE_STALE:    'Device Stale',
  DEVICE_RECOVERED:'Recovered',
}
const STATUS_COLOR = {
  open:        '#DC2626',
  remediating: '#D97706',
  resolved:    '#16A34A',
}

// ── Pure SVG Donut Chart ───────────────────────────────────
function DonutChart({ pct, online, offline, total }) {
  const r = 52, cx = 64, cy = 64
  const circ = 2 * Math.PI * r
  const filled = (pct / 100) * circ
  const color  = pct >= 90 ? '#16A34A' : pct >= 70 ? '#D97706' : '#DC2626'
  return (
    <div style={{ display:'flex', alignItems:'center', gap:24 }}>
      <svg width={128} height={128} viewBox="0 0 128 128">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke="var(--bg-border)" strokeWidth={14}/>
        {/* Fill */}
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={color} strokeWidth={14}
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition:'stroke-dasharray 0.6s ease' }}/>
        {/* Center text */}
        <text x={cx} y={cy-6} textAnchor="middle"
          fontSize={20} fontWeight={700} fill="var(--text-primary)"
          fontFamily="monospace">{pct}%</text>
        <text x={cx} y={cy+12} textAnchor="middle"
          fontSize={10} fill="var(--text-muted)">devices up</text>
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

// ── Horizontal Bar Chart ───────────────────────────────────
function TypeBars({ byType }) {
  const entries = Object.entries(byType).sort((a,b) => b[1]-a[1])
  const max     = Math.max(...entries.map(e => e[1]), 1)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {entries.length === 0
        ? <div style={{ fontSize:12, color:'var(--text-muted)', padding:'20px 0',
            textAlign:'center' }}>No incidents recorded</div>
        : entries.map(([type, count]) => (
          <div key={type}>
            <div style={{ display:'flex', justifyContent:'space-between',
              marginBottom:4, fontSize:12 }}>
              <span style={{ color:'var(--text-secondary)' }}>
                {TYPE_LABEL[type] || type.replace(/_/g,' ')}
              </span>
              <span style={{ fontWeight:600, fontFamily:'monospace',
                color: TYPE_COLOR[type] || 'var(--text-primary)' }}>{count}</span>
            </div>
            <div style={{ height:7, background:'var(--bg-border)',
              borderRadius:4, overflow:'hidden' }}>
              <div style={{
                height:'100%', borderRadius:4,
                background: TYPE_COLOR[type] || 'var(--gruve-green)',
                width:`${(count/max)*100}%`,
                transition:'width 0.6s ease'
              }}/>
            </div>
          </div>
        ))
      }
    </div>
  )
}

// ── Quick Actions ──────────────────────────────────────────
const QUICK_JOBS = [
  { id:12, label:'Restart Service',    icon:'🔧', color:'#2563EB' },
  { id:18, label:'Check Disk Usage',   icon:'💾', color:'#16A34A' },
  { id:11, label:'Check Essential Svcs',icon:'🩺', color:'#7C3AED' },
  { id:9,  label:'Patch RHEL VMs',     icon:'📦', color:'#D97706' },
  { id:13, label:'Remediate Service',  icon:'⚡', color:'#DC2626' },
]

function QuickActions({ onJobLaunch, onQuickAction }) {
  const [running, setRunning] = useState({})

  const launch = (job) => {
    if (onQuickAction) {
      onQuickAction(`launch job template id ${job.id} — ${job.label}`)
    }
  }


  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      {QUICK_JOBS.map(job => {
        const state = running[job.id]
        const busy  = state === 'launching' || state === 'launched'
        return (
          <button key={job.id} onClick={() => launch(job)} disabled={busy}
            onMouseEnter={e => { if(!busy) e.currentTarget.style.borderColor=job.color }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--bg-border)' }}
            style={{ display:'flex', alignItems:'center', gap:10,
              padding:'8px 12px', borderRadius:8, cursor: busy ? 'not-allowed' : 'pointer',
              background: busy ? `${job.color}10` : 'var(--bg-elevated)',
              border:`1px solid ${busy ? job.color+'40' : 'var(--bg-border)'}`,
              transition:'all 0.15s', width:'100%', textAlign:'left' }}>
            <span style={{ fontSize:14, lineHeight:1 }}>
              {state === 'launching' ? '⏳' : state === 'launched' ? '🚀' : job.icon}
            </span>
            <span style={{ flex:1, fontSize:12, fontWeight:500,
              color: busy ? job.color : 'var(--text-secondary)' }}>
              {job.label}
            </span>
            <span style={{ fontSize:10, fontFamily:'monospace',
              color:'var(--text-muted)' }}>#{job.id}</span>
          </button>
        )
      })}
    </div>
  )
}

// ── 12h Timeline Sparkline ─────────────────────────────────
function Timeline({ data }) {
  if (!data || data.length === 0) return (
    <div style={{ fontSize:12, color:'var(--text-muted)', textAlign:'center',
      padding:'20px 0' }}>No data</div>
  )
  const max    = Math.max(...data.map(d => d.count), 1)
  const W = 340, H = 64, pad = 4
  const bw    = (W - pad * 2) / data.length - 2

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H+20}`}
        style={{ overflow:'visible' }}>
        {data.map((d, i) => {
          const bh  = Math.max(d.count === 0 ? 2 : ((d.count/max) * H), 2)
          const x   = pad + i * ((W - pad*2) / data.length)
          const y   = H - bh + 4
          const col = d.count === 0 ? 'var(--bg-border)'
                    : d.count >= 3  ? '#DC2626'
                    : d.count >= 1  ? '#D97706'
                    : 'var(--gruve-green)'
          return (
            <g key={i}>
              <rect x={x} y={y} width={bw} height={bh}
                rx={2} fill={col}
                style={{ transition:'height 0.4s ease, y 0.4s ease' }}>
                <title>{d.hour}: {d.count} incident{d.count!==1?'s':''}</title>
              </rect>
              {i % 3 === 0 && (
                <text x={x + bw/2} y={H+16} textAnchor="middle"
                  fontSize={8} fill="var(--text-muted)">{d.hour}</text>
              )}
            </g>
          )
        })}
      </svg>
      <div style={{ display:'flex', gap:12, marginTop:4 }}>
        {[['#DC2626','3+ incidents'],['#D97706','1-2 incidents'],['var(--bg-border)','None']].map(([c,l]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:4,
            fontSize:10, color:'var(--text-muted)' }}>
            <div style={{ width:8, height:8, borderRadius:2, background:c }}/>
            {l}
          </div>
        ))}
      </div>
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
      style={{ flex:1, cursor: onClick ? 'pointer' : 'default',
        transition:'all 0.15s',
        transform: hovered && onClick ? 'translateY(-2px)' : 'none',
        boxShadow: hovered && onClick ? '0 4px 12px rgba(0,0,0,0.08)' : 'none',
        borderColor: hovered && onClick ? (color || 'var(--gruve-green)') : 'var(--bg-border)'
      }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase',
            letterSpacing:'0.06em', marginBottom:8 }}>{label}</div>
          <div style={{ fontSize:32, fontWeight:700,
            color: color || 'var(--text-primary)', fontFamily:'monospace' }}>
            {value ?? '—'}
          </div>
          {sublabel && (
            <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:4 }}>
              {sublabel}
            </div>
          )}
        </div>
        <div style={{ padding:10, borderRadius:10,
          background: color ? `${color}15` : 'var(--bg-elevated)',
          border: color ? `1px solid ${color}30` : '1px solid var(--bg-border)' }}>
          <Icon size={18} color={color || 'var(--text-muted)'}/>
        </div>
      </div>
      {onClick && (
        <div style={{ fontSize:10, color: color || 'var(--gruve-green)',
          marginTop:10, opacity: hovered ? 1 : 0, transition:'opacity 0.15s' }}>
          Click to view all →
        </div>
      )}
    </div>
  )
}

// ── Incident Row ───────────────────────────────────────────
function IncidentRow({ incident, onSelect }) {
  const color = TYPE_COLOR[incident.incident_type] || 'var(--text-muted)'
  const ts    = incident.created_at
    ? new Date(incident.created_at).toLocaleTimeString()
    : '—'
  return (
    <div onClick={() => onSelect(incident)}
      style={{ display:'flex', alignItems:'center', gap:12,
        padding:'10px 16px', borderBottom:'1px solid var(--bg-border)',
        cursor:'pointer', transition:'background 0.1s' }}
      onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'}
      onMouseLeave={e => e.currentTarget.style.background='transparent'}>
      <div style={{ width:8, height:8, borderRadius:'50%',
        background:color, flexShrink:0 }}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, fontWeight:500,
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {incident.device_name || incident.device_serial}
        </div>
        <div style={{ fontSize:11, color:'var(--text-secondary)' }}>
          {incident.network_name} — {incident.incident_type?.replace(/_/g,' ')}
        </div>
      </div>
      <div style={{ fontSize:11, color:'var(--text-muted)',
        fontFamily:'monospace', flexShrink:0 }}>{ts}</div>
      <div className={`badge ${
        incident.status==='open'       ? 'critical' :
        incident.status==='resolved'   ? 'ok' : 'warning'}`}>
        {incident.status}
      </div>
    </div>
  )
}

// ── Incidents Modal ────────────────────────────────────────
function IncidentModal({ title, incidents, onClose, onSelect }) {
  return (
    <div style={{ position:'fixed', inset:0, zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ position:'absolute', inset:0,
        background:'rgba(0,0,0,0.3)', backdropFilter:'blur(2px)' }}/>
      <div onClick={e => e.stopPropagation()}
        style={{ position:'relative', zIndex:1,
          background:'var(--bg-surface)', borderRadius:16,
          border:'1px solid var(--bg-border)',
          width:'min(680px, 95vw)', maxHeight:'80vh',
          display:'flex', flexDirection:'column',
          boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding:'16px 20px',
          borderBottom:'1px solid var(--bg-border)',
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontWeight:600, fontSize:15 }}>{title}</span>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>
              {incidents.length} incident{incidents.length!==1?'s':''}
            </span>
            <button onClick={onClose}
              style={{ background:'var(--bg-elevated)',
                border:'1px solid var(--bg-border)', borderRadius:6,
                padding:'4px 8px', cursor:'pointer',
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
          ) : (
            incidents.map(i => (
              <IncidentRow key={i._id} incident={i}
                onSelect={inc => { onClose(); onSelect(inc) }}/>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── Section header ─────────────────────────────────────────
function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--bg-border)',
      display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <div>
        <span style={{ fontWeight:600, fontSize:13 }}>{title}</span>
        {subtitle && <span style={{ fontSize:11, color:'var(--text-muted)',
          marginLeft:8 }}>{subtitle}</span>}
      </div>
      <div className="pulse-dot" style={{ background:'var(--gruve-green)' }}/>
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────
export default function Dashboard({ stats, incidents, onSelect, onQuickAction }) {
  const [summary,  setSummary]  = useState(null)
  const [modal,    setModal]    = useState(null) // 'total'|'open'|'remediating'|'resolved'

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/api/v1/dashboard/summary`)
        const d = await r.json()
        setSummary(d)
      } catch(e) {}
    }
    load()
    const t = setInterval(load, 30000)
    return () => clearInterval(t)
  }, [])

  const dh = summary?.device_health || { total:0, online:0, offline:0, pct_up:0 }

  // Filter incidents for modal
  const modalIncidents = () => {
    if (!modal) return []
    if (modal === 'total')       return incidents
    return (incidents || []).filter(i => i.status === modal)
  }

  const modalTitle = () => ({
    total:       'All Incidents',
    open:        'Open Incidents',
    remediating: 'Remediating Incidents',
    resolved:    'Resolved Incidents',
  }[modal] || '')

  const recent = (incidents || []).slice(0, 8)

  return (
    <div style={{ padding:24, overflowY:'auto', height:'100%' }}>

      {/* Header */}
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)' }}>
          NOC Dashboard
        </h1>
        <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:3 }}>
          Real-time Meraki network monitoring — Gruve Autonomous AI NOC
        </p>
      </div>

      {/* Stat cards — clickable */}
      <div style={{ display:'flex', gap:14, marginBottom:20 }}>
        <StatCard label="Total Incidents" value={stats.total}
          icon={Activity}
          sublabel="All time"
          onClick={() => setModal('total')}/>
        <StatCard label="Open"  value={stats.open}
          icon={AlertTriangle} color="#DC2626"
          sublabel="Needs attention"
          onClick={() => setModal('open')}/>
        <StatCard label="Remediating" value={stats.remediating}
          icon={Zap} color="#D97706"
          sublabel="AAP running"
          onClick={() => setModal('remediating')}/>
        <StatCard label="Resolved" value={stats.resolved}
          icon={CheckCircle} color="#16A34A"
          sublabel="Last 24h"
          onClick={() => setModal('resolved')}/>
      </div>

      {/* Row 2: Device health + Incident by type + By network */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
        gap:14, marginBottom:20 }}>

        {/* Device Health */}
        <div className="card" style={{ padding:0 }}>
          <SectionHeader title="Device Health"
            subtitle={dh.total > 0 ? `${dh.total} devices` : ''}/>
          <div style={{ padding:20 }}>
            {dh.total === 0 ? (
              <div style={{ textAlign:'center', padding:'20px 0',
                color:'var(--text-muted)', fontSize:12 }}>
                Loading device data…
              </div>
            ) : (
              <DonutChart
                pct={dh.pct_up}
                online={dh.online}
                offline={dh.offline}
                total={dh.total}
              />
            )}
          </div>
        </div>

        {/* Incidents by type */}
        <div className="card" style={{ padding:0 }}>
          <SectionHeader title="Incidents by Type"/>
          <div style={{ padding:20 }}>
            <TypeBars byType={summary?.by_type || stats.by_type || {}}/>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card" style={{ padding:0 }}>
          <SectionHeader title="⚡ Quick Actions" subtitle="one-click automation"/>
          <div style={{ padding:16 }}>
            <QuickActions onJobLaunch={(id) => console.log('launched', id)} onQuickAction={onQuickAction}/>
          </div>
        </div>
      </div>

      {/* Row 3: Timeline + Recent incidents */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.6fr',
        gap:14 }}>

        {/* 12h Timeline */}
        <div className="card" style={{ padding:0 }}>
          <SectionHeader title="12h Incident Timeline"
            subtitle="hourly"/>
          <div style={{ padding:20 }}>
            <Timeline data={summary?.timeline || []}/>
          </div>
        </div>

        {/* Recent incidents */}
        <div className="card" style={{ padding:0 }}>
          <SectionHeader title="Recent Incidents"/>
          {recent.length === 0 ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
              <CheckCircle size={32}
                style={{ margin:'0 auto 8px', display:'block', opacity:0.3 }}/>
              <div>No incidents detected</div>
              <div style={{ fontSize:11, marginTop:4 }}>Monitoring is active</div>
            </div>
          ) : (
            recent.map(i => (
              <IncidentRow key={i._id} incident={i} onSelect={onSelect}/>
            ))
          )}
        </div>
      </div>

      {/* Incident modal */}
      {modal && (
        <IncidentModal
          title={modalTitle()}
          incidents={modalIncidents()}
          onClose={() => setModal(null)}
          onSelect={onSelect}
        />
      )}
    </div>
  )
}
