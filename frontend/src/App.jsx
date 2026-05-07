import { useState, useEffect } from 'react'
import { Activity, Bell, Server, Bot, Zap, Puzzle, BarChart3, Menu, ChevronRight } from 'lucide-react'
import Dashboard from './components/Dashboard.jsx'
import IncidentList from './components/IncidentList.jsx'
import RemediationPanel from './components/RemediationPanel.jsx'
import NocAI from './components/NocAI.jsx'
import Integrations from './components/Integrations.jsx'
import DeviceMap from './components/DeviceMap.jsx'
import EventLogs from './components/EventLogs.jsx'
import gruveLogo from './assets/gruve-logo.png'

const API = import.meta.env.VITE_API_BASE_URL || ''

// ── Navigation structure ──────────────────────────────────────────────────────
const MAIN_TABS = [
  {
    id: 'operations',
    label: 'Operations',
    icon: Activity,
    items: [
      { id: 'dashboard',       icon: Activity,  label: 'Dashboard' },
      { id: 'incidents',       icon: Bell,      label: 'Incidents & Events' },
      { id: 'infrastructure',  icon: Server,    label: 'Infrastructure & Observability' },
    ]
  },
  {
    id: 'ai_automation',
    label: 'AI & Automation',
    icon: Bot,
    items: [
      { id: 'ai_ops',       icon: Bot,  label: 'AI Operations Center' },
      { id: 'remediation',  icon: Zap,  label: 'Automation & Remediation' },
    ]
  },
  {
    id: 'platform',
    label: 'Platform',
    icon: Puzzle,
    items: [
      { id: 'integrations',  icon: Puzzle,    label: 'Integrations & ITSM' },
      { id: 'governance',    icon: BarChart3,  label: 'Governance & Reports' },
    ]
  },
]

// ── Governance stub component ─────────────────────────────────────────────────
function Governance() {
  const cards = [
    { label: 'Total Automations Run',   value: '—', sub: 'All time'      },
    { label: 'Approval Rate',           value: '—', sub: 'Last 30 days'  },
    { label: 'Avg MTTR',                value: '—', sub: 'Last 30 days'  },
    { label: 'SLA Compliance',          value: '—', sub: 'This month'    },
  ]
  return (
    <div style={{ padding: 28 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Governance & Reports</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 28 }}>
        Audit trails, AI decision logs, approval history and operational analytics
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 16, marginBottom: 32 }}>
        {cards.map(c => (
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
        borderRadius: 10, padding: 24, textAlign: 'center', color: 'var(--text-muted)'
      }}>
        <BarChart3 size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
        <div style={{ fontSize: 14, fontWeight: 600 }}>Reports coming soon</div>
        <div style={{ fontSize: 12, marginTop: 6 }}>
          Automation success metrics, MTTR trends, AI governance logs and SLA reports will appear here.
        </div>
      </div>
    </div>
  )
}

// ── Infrastructure stub combining DeviceMap + EventLogs ───────────────────────
function Infrastructure({ incidents, onSelect }) {
  const [view, setView] = useState('map')
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Sub-tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--bg-border)',
        padding: '0 28px', background: 'var(--bg-surface)'
      }}>
        {[['map','Network Map'], ['logs','Event Logs']].map(([v, l]) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              padding: '12px 20px', fontSize: 13, background: 'none', border: 'none',
              borderBottom: view === v ? '2px solid var(--gruve-green)' : '2px solid transparent',
              color: view === v ? 'var(--gruve-green)' : 'var(--text-secondary)',
              fontWeight: view === v ? 600 : 400,
              cursor: 'pointer', marginBottom: '-1px', fontFamily: 'inherit'
            }}
          >
            {l}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {view === 'map'  && <DeviceMap incidents={incidents} onSelect={onSelect} />}
        {view === 'logs' && <EventLogs />}
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeMain, setActiveMain]     = useState('operations')
  const [activeTab,  setActiveTab]      = useState('dashboard')
  const [selectedIncident, setIncident] = useState(null)
  const [incidents, setIncidents]       = useState([])
  const [stats,     setStats]           = useState({})
  const [openCount, setOpenCount]       = useState(0)
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [pendingCmd,  setPendingCmd]    = useState(null)
  const [hoveredMain, setHoveredMain]   = useState(null)
  const [hoveredItem, setHoveredItem]   = useState(null)

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const r = await fetch(`${API}/api/v1/incidents?limit=50`)
        const d = await r.json()
        setIncidents(d.incidents || [])
        setOpenCount((d.incidents || []).filter(i => i.status === 'open').length)
      } catch (e) {}
    }
    const fetchStats = async () => {
      try {
        const r = await fetch(`${API}/api/v1/incidents/stats/summary`)
        setStats(await r.json())
      } catch (e) {}
    }
    fetchIncidents()
    fetchStats()
    const t1 = setInterval(fetchIncidents, 30000)
    const t2 = setInterval(fetchStats, 60000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [])

  const handleSelectIncident = (incident) => {
    setIncident(incident)
    setActiveMain('ai_automation')
    setActiveTab('remediation')
  }

  const currentGroup = MAIN_TABS.find(t => t.id === activeMain)

  const handleMainTab = (tabId) => {
    setActiveMain(tabId)
    // Auto-select first item of the group
    const group = MAIN_TABS.find(t => t.id === tabId)
    if (group) setActiveTab(group.items[0].id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <style>{`
        .main-tab-btn { transition: all 0.15s; }
        .main-tab-btn:hover { background: rgba(22,163,74,0.08) !important; color: var(--gruve-green) !important; }
        .main-tab-btn:hover .main-tab-icon { color: var(--gruve-green) !important; }
        .sidebar-item { transition: all 0.15s; }
        .sidebar-item:hover { background: var(--gruve-green-glow) !important; color: var(--gruve-green) !important; }
      `}</style>

      {/* ── Top bar ── */}
      <header style={{
        height: 56, display: 'flex', alignItems: 'center',
        background: 'var(--bg-surface)', borderBottom: '1px solid var(--bg-border)',
        padding: '0 20px', gap: 0, flexShrink: 0, zIndex: 100
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 32, minWidth: 160 }}>
          <button
            onClick={() => setSidebarOpen(o => !o)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6
            }}
          >
            <Menu size={16} color="var(--text-secondary)" />
          </button>
          <img src={gruveLogo} alt="Gruve" style={{ height: 26 }} />
        </div>

        {/* Main tabs */}
        <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
          {MAIN_TABS.map(tab => {
            const Icon    = tab.icon
            const active  = activeMain === tab.id
            const hovered = hoveredMain === tab.id
            return (
              <button
                key={tab.id}
                className="main-tab-btn"
                onClick={() => handleMainTab(tab.id)}
                onMouseEnter={() => setHoveredMain(tab.id)}
                onMouseLeave={() => setHoveredMain(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  background: active ? 'rgba(22,163,74,0.1)' : 'transparent',
                  color: active ? 'var(--gruve-green)' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  cursor: 'pointer', fontFamily: 'inherit',
                  borderBottom: active ? '2px solid var(--gruve-green)' : '2px solid transparent',
                  borderRadius: '8px 8px 0 0', marginBottom: '-1px'
                }}
              >
                <Icon
                  size={15}
                  className="main-tab-icon"
                  color={active || hovered ? 'var(--gruve-green)' : 'var(--text-secondary)'}
                />
                {tab.label}
                {/* Badge for incidents */}
                {tab.id === 'operations' && openCount > 0 && (
                  <span style={{
                    background: 'var(--status-critical)', color: '#fff',
                    fontSize: 10, fontWeight: 700, padding: '1px 6px',
                    borderRadius: 10, minWidth: 18, textAlign: 'center'
                  }}>{openCount}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="pulse-dot" style={{ background: 'var(--gruve-green)' }} />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Live</span>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        {sidebarOpen && (
          <aside style={{
            width: 240, flexShrink: 0,
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--bg-border)',
            display: 'flex', flexDirection: 'column',
            transition: 'width 0.2s ease'
          }}>
            {/* Group label */}
            <div style={{
              padding: '16px 20px 8px',
              fontSize: 10, fontWeight: 700,
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase'
            }}>
              {currentGroup?.label}
            </div>

            {/* Sidebar items */}
            <nav style={{ flex: 1, padding: '4px 10px' }}>
              {currentGroup?.items.map(item => {
                const Icon   = item.icon
                const active = activeTab === item.id
                const badge  = item.id === 'incidents' ? openCount : 0
                return (
                  <button
                    key={item.id}
                    className="sidebar-item"
                    onClick={() => setActiveTab(item.id)}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)', border: 'none',
                      background: active ? 'var(--gruve-green-glow)' : 'transparent',
                      color: active ? 'var(--gruve-green)' : 'var(--text-secondary)',
                      fontSize: 13, fontWeight: active ? 600 : 400,
                      cursor: 'pointer', marginBottom: 2,
                      textAlign: 'left', fontFamily: 'inherit'
                    }}
                  >
                    <Icon size={15} />
                    {item.label}
                    {badge > 0 && (
                      <span style={{
                        marginLeft: 'auto',
                        background: 'var(--status-critical)',
                        color: '#fff', fontSize: 10, fontWeight: 700,
                        padding: '1px 6px', borderRadius: 10,
                        minWidth: 18, textAlign: 'center'
                      }}>{badge}</span>
                    )}
                    {active && (
                      <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                    )}
                  </button>
                )
              })}
            </nav>

            {/* Bottom status */}
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--bg-border)',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <div className="pulse-dot" style={{ background: 'var(--gruve-green)' }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Governed Autonomous AIOps
              </span>
            </div>
          </aside>
        )}

        {/* ── Main content ── */}
        <main style={{
          flex: 1, overflow: 'auto',
          background: 'var(--bg-base)', position: 'relative'
        }}>
          {/* OPERATIONS */}
          {activeTab === 'dashboard'      && <Dashboard stats={stats} incidents={incidents} onSelect={handleSelectIncident} onQuickAction={(cmd) => { setPendingCmd(cmd); setActiveMain('ai_automation'); setActiveTab('ai_ops') }} />}
          {activeTab === 'incidents'      && <IncidentList incidents={incidents} onSelect={handleSelectIncident} />}
          {activeTab === 'infrastructure' && <Infrastructure incidents={incidents} onSelect={handleSelectIncident} />}

          {/* AI & AUTOMATION */}
          {activeTab === 'ai_ops'      && <NocAI api={API} pendingCmd={pendingCmd} onCmdConsumed={() => setPendingCmd(null)} />}
          {activeTab === 'remediation' && <RemediationPanel incident={selectedIncident} api={API} />}

          {/* PLATFORM */}
          {activeTab === 'integrations' && <Integrations />}
          {activeTab === 'governance'   && <Governance />}
        </main>
      </div>
    </div>
  )
}
