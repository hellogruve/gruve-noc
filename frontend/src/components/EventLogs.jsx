import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Activity, Wifi, Shield, Network, Filter } from 'lucide-react'

const API = import.meta.env.VITE_API_BASE_URL || ''

const EVENT_COLOR = {
  port_status_change:        { color: '#FFB300', label: 'Port' },
  association:               { color: '#3B8BDE', label: 'WiFi Join' },
  disassociation:            { color: '#8B8FA8', label: 'WiFi Leave' },
  vpn_connectivity_change:   { color: '#00D46A', label: 'VPN' },
  security_event:            { color: '#FF4757', label: 'Security' },
  dhcp_lease:                { color: '#3B8BDE', label: 'DHCP' },
  device_packet_flood:       { color: '#FF4757', label: 'Flood' },
  splash_auth:               { color: '#00D46A', label: 'Auth' },
  default:                   { color: '#8B8FA8', label: 'Event' }
}

function EventRow({ log, index }) {
  const eventInfo = EVENT_COLOR[log.event_type] || EVENT_COLOR.default
  const time = log.occurred_at
    ? new Date(log.occurred_at).toLocaleTimeString()
    : '—'
  const date = log.occurred_at
    ? new Date(log.occurred_at).toLocaleDateString()
    : ''

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '80px 100px 140px 130px 1fr',
      padding: '9px 16px',
      borderBottom: '1px solid var(--bg-border)',
      alignItems: 'center',
      fontSize: 12,
      background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
      transition: 'background 0.1s'
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
    onMouseLeave={e => e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}
    >
      {/* Time */}
      <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {time}
      </div>

      {/* Event type badge */}
      <div>
        <span style={{
          padding: '2px 8px', borderRadius: 10,
          background: `${eventInfo.color}18`,
          border: `1px solid ${eventInfo.color}40`,
          fontSize: 10, fontWeight: 500,
          color: eventInfo.color
        }}>
          {eventInfo.label}
        </span>
      </div>

      {/* Device */}
      <div style={{ color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {log.device_name || log.device_serial || '—'}
      </div>

      {/* Network */}
      <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {log.network_id?.split('_').pop() || '—'}
      </div>

      {/* Description */}
      <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {log.description || log.event_type?.replace(/_/g, ' ') || '—'}
      </div>
    </div>
  )
}

export default function EventLogs() {
  const [logs, setLogs]           = useState([])
  const [stats, setStats]         = useState({})
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('')
  const [autoRefresh, setAuto]    = useState(true)
  const [lastRefresh, setLast]    = useState(null)
  const timerRef                  = useRef(null)

  const fetchLogs = async () => {
    try {
      const r = await fetch(`${API}/api/v1/logs?limit=200`)
      const d = await r.json()
      setLogs(d.logs || [])
      setStats(d.stats || {})
      setLast(new Date())
    } catch (e) {
      console.error('Failed to fetch logs:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLogs()
  }, [])

  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(fetchLogs, 30000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [autoRefresh])

  // Filter logs by device name or event type
  const filtered = logs.filter(log => {
    if (!filter) return true
    const q = filter.toLowerCase()
    return (
      log.device_name?.toLowerCase().includes(q) ||
      log.event_type?.toLowerCase().includes(q) ||
      log.description?.toLowerCase().includes(q)
    )
  })

  // Count by event type for summary
  const typeCounts = {}
  logs.forEach(l => {
    const t = l.event_type || 'unknown'
    typeCounts[t] = (typeCounts[t] || 0) + 1
  })
  const topTypes = Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>Device Event Logs</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 3 }}>
            Last 30 minutes of Meraki network events · Auto-deletes after 30 min
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastRefresh && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            className={`btn ${autoRefresh ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setAuto(!autoRefresh)}
            style={{ padding: '6px 12px', fontSize: 11 }}
          >
            <Activity size={12}/>
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button className="btn btn-secondary" onClick={fetchLogs} style={{ padding: '6px 12px' }}>
            <RefreshCw size={13}/>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'monospace', color: 'var(--gruve-green)' }}>
            {stats.total_last_30min || 0}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500 }}>Events</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Last 30 min</div>
          </div>
        </div>
        <div className="card" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: 'monospace', color: 'var(--status-info)' }}>
            {stats.last_5min || 0}
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500 }}>Recent</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Last 5 min</div>
          </div>
        </div>
        {topTypes.map(([type, count]) => {
          const info = EVENT_COLOR[type] || EVENT_COLOR.default
          return (
            <div key={type} style={{
              padding: '6px 14px', borderRadius: 20, alignSelf: 'center',
              background: `${info.color}15`, border: `1px solid ${info.color}40`,
              fontSize: 12, color: info.color, fontWeight: 500
            }}>
              {info.label} {count}
            </div>
          )
        })}
      </div>

      {/* Filter */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Filter size={13} style={{
          position: 'absolute', left: 10, top: '50%',
          transform: 'translateY(-50%)', color: 'var(--text-muted)'
        }}/>
        <input
          placeholder="Filter by device, event type, or description..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          style={{ paddingLeft: 32 }}
        />
      </div>

      {/* Log table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '80px 100px 140px 130px 1fr',
          padding: '10px 16px',
          background: 'var(--bg-elevated)',
          borderBottom: '1px solid var(--bg-border)',
          fontSize: 11, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '0.06em'
        }}>
          <div>Time</div>
          <div>Type</div>
          <div>Device</div>
          <div>Network</div>
          <div>Description</div>
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 520, overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading events...
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Activity size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.2 }}/>
              <div>No events yet</div>
              <div style={{ fontSize: 11, marginTop: 4 }}>
                Events will appear here after the next poll cycle (up to 120s)
              </div>
            </div>
          )}
          {!loading && filtered.map((log, i) => (
            <EventRow key={log._id || i} log={log} index={i}/>
          ))}
        </div>

        {/* Footer */}
        {filtered.length > 0 && (
          <div style={{
            padding: '8px 16px',
            borderTop: '1px solid var(--bg-border)',
            fontSize: 11, color: 'var(--text-muted)',
            display: 'flex', justifyContent: 'space-between'
          }}>
            <span>Showing {filtered.length} of {logs.length} events</span>
            <span>Events auto-expire after 30 minutes</span>
          </div>
        )}
      </div>
    </div>
  )
}
