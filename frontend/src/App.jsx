import { useState, useEffect } from 'react'
import { Activity, Bell, Server, Bot, Zap, Puzzle, BarChart3, Menu, ChevronRight } from 'lucide-react'
import Dashboard from './components/Dashboard.jsx'
import IncidentList from './components/IncidentList.jsx'
import RemediationPanel from './components/RemediationPanel.jsx'
import NocAI from './components/NocAI.jsx'
import Integrations from './components/Integrations.jsx'
import DeviceMap from './components/DeviceMap.jsx'
import EventLogs from './components/EventLogs.jsx'
import VulnerabilityManagement from './components/VulnerabilityManagement.jsx'
import gruveLogo from './assets/gruve-logo.png'

const API = import.meta.env.VITE_API_BASE_URL || ''

const GROUPS = [
  {
    id: 'operations',
    icon: Activity,
    label: 'Operations',
    items: [
      { id: 'dashboard',      icon: Activity, label: 'Dashboard'                      },
      { id: 'incidents',      icon: Bell,     label: 'Incidents & Events', badge: true },
      { id: 'infrastructure', icon: Server,   label: 'Vulnerability Management' },
    ]
  },
  {
    id: 'ai_automation',
    icon: Bot,
    label: 'AI & Automation',
    items: [
      { id: 'ai_ops',      icon: Bot, label: 'AI Operations Center'   },
      { id: 'remediation', icon: Zap, label: 'Automation & Remediation' },
    ]
  },
  {
    id: 'platform',
    icon: Puzzle,
    label: 'Platform',
    items: [
      { id: 'integrations', icon: Puzzle,   label: 'Integrations & ITSM'   },
      { id: 'governance',   icon: BarChart3, label: 'Governance & Reports'  },
    ]
  },
]

// ── Governance stub ───────────────────────────────────────────────────────────
function Governance() {
  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Governance & Reports</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>
        Audit trails, AI decision logs, approval history and operational analytics
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Total Automations', value: '—', sub: 'All time'     },
          { label: 'Approval Rate',     value: '—', sub: 'Last 30 days' },
          { label: 'Avg MTTR',          value: '—', sub: 'Last 30 days' },
          { label: 'SLA Compliance',    value: '—', sub: 'This month'   },
        ].map(c => (
          <div key={c.label} style={{
            background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
            borderRadius: 10, padding: '20px 24px'
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--gruve-green)' }}>{c.value}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{c.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
        borderRadius: 10, padding: 32, textAlign: 'center', color: 'var(--text-muted)'
      }}>
        <BarChart3 size={40} style={{ opacity: 0.25, marginBottom: 12 }} />
        <div style={{ fontSize: 14, fontWeight: 600 }}>Reports coming soon</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>
          Automation metrics, MTTR trends, AI governance logs and SLA reports will appear here.
        </div>
      </div>
    </div>
  )
}

// ── Infrastructure (DeviceMap + EventLogs) ────────────────────────────────────
function Infrastructure({ incidents, onSelect }) {
  const [view, setView] = useState('map')
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '1px solid var(--bg-border)',
        padding: '0 28px', background: 'var(--bg-surface)', flexShrink: 0
      }}>
        {[['map','Network Map'],['logs','Event Logs']].map(([v,l]) => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: '11px 20px', fontSize: 13, background: 'none', border: 'none',
            borderBottom: view===v ? '2px solid var(--gruve-green)' : '2px solid transparent',
            color: view===v ? 'var(--gruve-green)' : 'var(--text-secondary)',
            fontWeight: view===v ? 600 : 400,
            cursor: 'pointer', marginBottom: '-1px', fontFamily: 'inherit'
          }}>{l}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {view==='map'  && <DeviceMap incidents={incidents} onSelect={onSelect} />}
        {view==='logs' && <EventLogs />}
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeGroup, setActiveGroup]   = useState('operations')
  const [activeTab,   setActiveTab]     = useState('dashboard')
  const [selectedIncident, setIncident] = useState(null)
  const [incidents,   setIncidents]     = useState([])
  const [stats,       setStats]         = useState({})
  const [openCount,   setOpenCount]     = useState(0)
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [pendingCmd,  setPendingCmd]    = useState(null)
  const [hoveredGroup, setHoveredGroup] = useState(null)

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const r = await fetch(`${API}/api/v1/incidents?limit=50`)
        const d = await r.json()
        setIncidents(d.incidents || [])
        setOpenCount((d.incidents||[]).filter(i=>i.status==='open').length)
      } catch(e) {}
    }
    const fetchStats = async () => {
      try {
        const r = await fetch(`${API}/api/v1/incidents/stats/summary`)
        setStats(await r.json())
      } catch(e) {}
    }
    fetchIncidents(); fetchStats()
    const t1 = setInterval(fetchIncidents, 30000)
    const t2 = setInterval(fetchStats, 60000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [])

  const handleSelectIncident = (incident) => {
    setIncident(incident)
    setActiveGroup('ai_automation')
    setActiveTab('remediation')
  }

  const handleGroupClick = (groupId) => {
    setActiveGroup(groupId)
    const group = GROUPS.find(g => g.id === groupId)
    if (group) setActiveTab(group.items[0].id)
  }

  const currentGroup = GROUPS.find(g => g.id === activeGroup)

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <style>{`
        .rail-btn:hover { background: rgba(22,163,74,0.12) !important; }
        .rail-btn:hover svg { color: var(--gruve-green) !important; }
        .rail-btn:hover .rail-label { color: var(--gruve-green) !important; }
        .sub-item:hover { background: var(--gruve-green-glow) !important; color: var(--gruve-green) !important; }
        .sub-item:hover svg { color: var(--gruve-green) !important; }
      `}</style>

      {/* ── Icon rail ── */}
      <div style={{
        width: 88, flexShrink: 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--bg-border)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 0,
        paddingBottom: 0,
        justifyContent: 'space-between',
        zIndex: 10
      }}>
        {/* Logo */}
        <div style={{
          width: 64, height: 64, marginBottom: 32,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(22,163,74,0.08)', borderRadius: 14
        }}>
          <img src={gruveLogo} alt="G" style={{ width: 48, height: 48, objectFit: 'contain' }} />
        </div>

        {/* Group icons — vertically centered */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:20, paddingTop:'8%', paddingBottom:'8%' }}>
        {GROUPS.map(group => {
          const Icon   = group.icon
          const active = activeGroup === group.id
          const hasBadge = group.id === 'operations' && openCount > 0
          return (
            <button
              key={group.id}
              className="rail-btn"
              onClick={() => handleGroupClick(group.id)}
              onMouseEnter={() => setHoveredGroup(group.id)}
              onMouseLeave={() => setHoveredGroup(null)}
              title={group.label}
              style={{
                position: 'relative',
                width: 64, padding: '14px 0',
                marginBottom: 16,
                borderRadius: 10, border: 'none', cursor: 'pointer',
                background: active ? 'rgba(22,163,74,0.15)' : 'transparent',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 4,
                transition: 'background 0.15s'
              }}
            >
              {/* Active indicator bar */}
              {active && (
                <div style={{
                  position: 'absolute', left: 0, top: '20%', bottom: '20%',
                  width: 3, borderRadius: '0 3px 3px 0',
                  background: 'var(--gruve-green)'
                }} />
              )}
              <Icon
                size={20}
                color={active ? 'var(--gruve-green)' : 'var(--text-muted)'}
              />
              <span
                className="rail-label"
                style={{
                  fontSize: 9, fontWeight: 600,
                  color: active ? 'var(--gruve-green)' : 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  lineHeight: 1.2, textAlign: 'center',
                  maxWidth: 52
                }}
              >
                {group.label.split(' ')[0]}
              </span>
              {/* Badge */}
              {hasBadge && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  background: 'var(--status-critical)', color: '#fff',
                  fontSize: 9, fontWeight: 700,
                  width: 16, height: 16, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>{openCount > 9 ? '9+' : openCount}</span>
              )}
            </button>
          )
        })}

        </div>
        {/* Spacer placeholder */}
        <div style={{ height: 8 }} />

        {/* Collapse button */}
        <button
          onClick={() => setSidebarOpen(o => !o)}
          style={{
            width: 52, height: 36, marginBottom: 16,
            borderRadius: 8, border: 'none',
            background: 'transparent', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
          title="Toggle sidebar"
        >
          <Menu size={16} color="var(--text-muted)" />
        </button>
      </div>

      {/* ── Sub-sidebar ── */}
      {sidebarOpen && (
        <aside style={{
          width: 220, flexShrink: 0,
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--bg-border)',
          display: 'flex', flexDirection: 'column'
        }}>
          {/* Group header */}
          <div style={{
            padding: '20px 20px 12px',
            borderBottom: '1px solid var(--bg-border)'
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 4
            }}>
              {currentGroup?.label}
            </div>
          </div>

          {/* Sub-items */}
          <nav style={{ flex: 1, padding: '10px 10px' }}>
            {currentGroup?.items.map(item => {
              const Icon   = item.icon
              const active = activeTab === item.id
              const badge  = item.badge ? openCount : 0
              return (
                <button
                  key={item.id}
                  className="sub-item"
                  onClick={() => setActiveTab(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '11px 14px',
                    borderRadius: 8, border: 'none',
                    background: active ? 'var(--gruve-green-glow)' : 'transparent',
                    color: active ? 'var(--gruve-green)' : 'var(--text-secondary)',
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    cursor: 'pointer', marginBottom: 8,
                    textAlign: 'left', fontFamily: 'inherit',
                    transition: 'all 0.15s'
                  }}
                >
                  <Icon
                    size={15}
                    color={active ? 'var(--gruve-green)' : 'var(--text-muted)'}
                  />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {badge > 0 && (
                    <span style={{
                      background: 'var(--status-critical)',
                      color: '#fff', fontSize: 10, fontWeight: 700,
                      padding: '1px 6px', borderRadius: 10,
                      minWidth: 18, textAlign: 'center'
                    }}>{badge}</span>
                  )}
                  {active && <ChevronRight size={12} style={{ opacity: 0.4 }} />}
                </button>
              )
            })}
          </nav>

          {/* Bottom */}
          <div style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--bg-border)',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            <div className="pulse-dot" style={{ background: 'var(--gruve-green)' }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.3 }}>
              Intelligent Operations Platform
            </span>
          </div>
        </aside>
      )}

      {/* ── Main content ── */}
      <main style={{
        flex: 1, overflow: 'auto',
        background: 'var(--bg-base)'
      }}>
        {activeTab === 'dashboard'      && <Dashboard stats={stats} incidents={incidents} onSelect={handleSelectIncident} onQuickAction={(cmd) => { setPendingCmd(cmd); setActiveGroup('ai_automation'); setActiveTab('ai_ops') }} />}
        {activeTab === 'incidents'      && <IncidentList incidents={incidents} onSelect={handleSelectIncident} />}
        {activeTab === 'infrastructure' && <VulnerabilityManagement />}
        {activeTab === 'ai_ops'         && <NocAI api={API} pendingCmd={pendingCmd} onCmdConsumed={() => setPendingCmd(null)} />}
        {activeTab === 'remediation'    && <RemediationPanel incident={selectedIncident} api={API} />}
        {activeTab === 'integrations'   && <Integrations />}
        {activeTab === 'governance'     && <Governance />}
      </main>
    </div>
  )
}
