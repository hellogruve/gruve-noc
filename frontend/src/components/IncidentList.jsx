import { useState } from 'react'
import { Search, Zap, ExternalLink } from 'lucide-react'

const TYPE_COLOR = {
  DEVICE_DOWN:      'critical',
  INTERNET_DOWN:    'critical',
  VM_SERVICE_DOWN:  'critical',
  DEVICE_STALE:     'warning',
  DEVICE_RECOVERED: 'ok',
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
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600 }}>Incidents</h1>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
          {incidents.length} total &middot;{' '}
          {incidents.filter(i => i.status === 'open').length} open
        </p>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search
            size={14}
            style={{
              position: 'absolute', left: 10, top: '50%',
              transform: 'translateY(-50%)', color: 'var(--text-muted)'
            }}
          />
          <input
            placeholder="Search device, network, type..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32, width: '100%' }}
          />
        </div>

        {/* Status filter buttons */}
        {['all', 'open', 'approved', 'remediating', 'resolved'].map(f => (
          <button
            key={f}
            className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(f)}
            style={{ textTransform: 'capitalize', fontSize: 12 }}
          >
            {f}
            {f !== 'all' && (
              <span style={{
                marginLeft: 5,
                background: 'rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: '1px 6px',
                fontSize: 11
              }}>
                {incidents.filter(i => i.status === f).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 80px',
        gap: 12,
        padding: '8px 16px',
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        borderBottom: '1px solid var(--border)'
      }}>
        <div>Device</div>
        <div>Type</div>
        <div>Network</div>
        <div>Snow Ticket</div>
        <div>Status</div>
        <div style={{ textAlign: 'right' }}>Action</div>
      </div>

      {/* Incident rows */}
      <div>
        {filtered.length === 0 && (
          <div style={{
            padding: '40px 16px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: 13
          }}>
            {search || filter !== 'all'
              ? 'No incidents match your filters.'
              : 'No incidents detected. Monitoring is active.'}
          </div>
        )}

        {filtered.map(incident => (
          <div
            key={incident._id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1fr 1fr 1fr 80px',
              gap: 12,
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              alignItems: 'center',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            onClick={() => onSelect(incident)}
          >
            {/* Device */}
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                {incident.device_name || '—'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {incident.created_at
                  ? new Date(incident.created_at).toLocaleString()
                  : '—'}
              </div>
            </div>

            {/* Type badge */}
            <div>
              <span className={`badge badge-${TYPE_COLOR[incident.incident_type] || 'warning'}`}>
                {incident.incident_type?.replace(/_/g, ' ') || '—'}
              </span>
            </div>

            {/* Network */}
            <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              {incident.network_name || incident.network_id || '—'}
            </div>

            {/* ServiceNow ticket */}
            <div>
              {incident.snow_ticket_id ? (
                <span style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  {incident.snow_ticket_id}
                  <ExternalLink size={10} />
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
              )}
            </div>

            {/* Status */}
            <div>
              <span className={`badge badge-${
                incident.status === 'open'        ? 'critical' :
                incident.status === 'approved'    ? 'warning'  :
                incident.status === 'remediating' ? 'warning'  :
                incident.status === 'resolved'    ? 'ok'       : 'warning'
              }`}>
                {incident.status}
              </span>
            </div>

            {/* Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                style={{ padding: '4px 12px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={e => { e.stopPropagation(); onSelect(incident); }}
              >
                <Zap size={11} />
                {incident.status === 'open' ? 'Approve' : 'View'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
