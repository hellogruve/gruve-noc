import { useState } from 'react'
import { Search, Zap } from 'lucide-react'

const TYPE_COLOR = {
  DEVICE_DOWN:     'critical',
  INTERNET_DOWN:   'critical',
  DEVICE_STALE:    'warning',
  DEVICE_RECOVERED:'ok',
}

export default function IncidentList({ incidents, onSelect }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  const filtered = (incidents || []).filter(i => {
    const matchSearch =
      !search ||
      i.device_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.network_name?.toLowerCase().includes(search.toLowerCase()) ||
      i.incident_type?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || i.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div style={{ padding:28 }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:600 }}>Incidents</h1>
        <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:3 }}>
          {incidents.length} total · {incidents.filter(i=>i.status==='open').length} open
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, marginBottom:16 }}>
        <div style={{ position:'relative', flex:1 }}>
          <Search size={14} style={{
            position:'absolute', left:10, top:'50%',
            transform:'translateY(-50%)', color:'var(--text-muted)'
          }}/>
          <input
            placeholder="Search device, network, type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft:32 }}
          />
        </div>
        {['all','open','remediating','resolved'].map(f => (
          <button
            key={f}
            className={`btn ${filter===f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding:0, overflow:'hidden' }}>
        <div style={{
          display:'grid',
          gridTemplateColumns:'1fr 1fr 150px 120px 160px 80px',
          padding:'10px 16px',
          background:'var(--bg-elevated)',
          borderBottom:'1px solid var(--bg-border)',
          fontSize:11, color:'var(--text-muted)',
          textTransform:'uppercase', letterSpacing:'0.06em'
        }}>
          <div>Device</div>
          <div>Network</div>
          <div>Type</div>
          <div>Status</div>
          <div>Detected</div>
          <div>Action</div>
        </div>

        {filtered.length === 0 && (
          <div style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
            No incidents match your filter
          </div>
        )}

        {filtered.map(incident => (
          <div
            key={incident._id}
            style={{
              display:'grid',
              gridTemplateColumns:'1fr 1fr 150px 120px 160px 80px',
              padding:'12px 16px',
              borderBottom:'1px solid var(--bg-border)',
              alignItems:'center', fontSize:13,
              transition:'background 0.1s'
            }}
            onMouseEnter={e => e.currentTarget.style.background='var(--bg-elevated)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}
          >
            <div>
              <div style={{ fontWeight:500 }}>
                {incident.device_name || incident.device_serial}
              </div>
              <div className="mono" style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>
                {incident.device_serial}
              </div>
            </div>
            <div style={{ color:'var(--text-secondary)' }}>
              {incident.network_name || '—'}
            </div>
            <div>
              <span className={`badge ${TYPE_COLOR[incident.incident_type] || 'unknown'}`}>
                {incident.incident_type?.replace(/_/g,' ')}
              </span>
            </div>
            <div>
              <span className={`badge ${incident.status==='open'?'critical':incident.status==='resolved'?'ok':'warning'}`}>
                {incident.status}
              </span>
            </div>
            <div className="mono" style={{ fontSize:11, color:'var(--text-secondary)' }}>
              {incident.created_at
                ? new Date(incident.created_at).toLocaleString()
                : '—'}
            </div>
            <div>
              <button
                className="btn btn-primary"
                style={{ padding:'4px 10px', fontSize:11 }}
                onClick={() => onSelect(incident)}
              >
                <Zap size={12}/> Run
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
