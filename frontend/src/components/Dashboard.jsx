import { AlertTriangle, CheckCircle, Zap, Activity } from 'lucide-react'

const INCIDENT_COLOR = {
  DEVICE_DOWN:     'var(--status-critical)',
  INTERNET_DOWN:   'var(--status-critical)',
  DEVICE_STALE:    'var(--status-warning)',
  DEVICE_RECOVERED:'var(--status-ok)',
}

function StatCard({ label, value, color, icon: Icon, sublabel }) {
  return (
    <div className="card" style={{ flex:1 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>
            {label}
          </div>
          <div style={{ fontSize:32, fontWeight:600, color: color || 'var(--text-primary)', fontFamily:'monospace' }}>
            {value ?? '—'}
          </div>
          {sublabel && <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:4 }}>{sublabel}</div>}
        </div>
        <div style={{ padding:10, background:'var(--bg-elevated)', borderRadius:10 }}>
          <Icon size={18} color={color || 'var(--text-muted)'} />
        </div>
      </div>
    </div>
  )
}

function IncidentRow({ incident, onSelect }) {
  const color = INCIDENT_COLOR[incident.incident_type] || 'var(--text-muted)'
  const ts = incident.created_at
    ? new Date(incident.created_at).toLocaleTimeString()
    : '—'

  return (
    <div
      onClick={() => onSelect(incident)}
      style={{
        display:'flex', alignItems:'center', gap:12,
        padding:'10px 16px',
        borderBottom:'1px solid var(--bg-border)',
        cursor:'pointer', transition:'background 0.1s'
      }}
      onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'}
      onMouseLeave={e => e.currentTarget.style.background='transparent'}
    >
      <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }}/>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:13, fontWeight:500 }}>
          {incident.device_name || incident.device_serial}
        </div>
        <div style={{ fontSize:11, color:'var(--text-secondary)' }}>
          {incident.network_name} — {incident.incident_type?.replace(/_/g,' ')}
        </div>
      </div>
      <div style={{ fontSize:11, color:'var(--text-muted)', fontFamily:'monospace' }}>{ts}</div>
      <div className={`badge ${incident.status==='open'?'critical':incident.status==='resolved'?'ok':'warning'}`}>
        {incident.status}
      </div>
    </div>
  )
}

export default function Dashboard({ stats, incidents, onSelect }) {
  const recent = (incidents || []).slice(0, 8)

  return (
    <div style={{ padding:28 }}>
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:20, fontWeight:600 }}>NOC Dashboard</h1>
        <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:3 }}>
          Real-time Meraki network monitoring — Gruve Autonomous AI NOC
        </p>
      </div>

      <div style={{ display:'flex', gap:16, marginBottom:24 }}>
        <StatCard label="Total incidents" value={stats.total}       icon={Activity}      />
        <StatCard label="Open"            value={stats.open}        icon={AlertTriangle} color="var(--status-critical)" sublabel="Needs attention" />
        <StatCard label="Remediating"     value={stats.remediating} icon={Zap}           color="var(--status-warning)"  sublabel="AAP running" />
        <StatCard label="Resolved"        value={stats.resolved}    icon={CheckCircle}   color="var(--status-ok)"       sublabel="Last 24h" />
      </div>

      <div className="card" style={{ padding:0 }}>
        <div style={{
          padding:'14px 16px',
          borderBottom:'1px solid var(--bg-border)',
          display:'flex', justifyContent:'space-between', alignItems:'center'
        }}>
          <span style={{ fontWeight:500, fontSize:14 }}>Recent incidents</span>
          <div className="pulse-dot" style={{ background:'var(--gruve-green)' }}/>
        </div>
        {recent.length === 0 ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
            <CheckCircle size={32} style={{ margin:'0 auto 8px', display:'block', opacity:0.3 }}/>
            <div>No incidents detected</div>
            <div style={{ fontSize:11, marginTop:4 }}>Monitoring is active</div>
          </div>
        ) : (
          recent.map(i => <IncidentRow key={i._id} incident={i} onSelect={onSelect}/>)
        )}
      </div>
    </div>
  )
}
