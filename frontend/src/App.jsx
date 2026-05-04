import { useState, useEffect } from 'react'
import { Activity, MessageSquare, Zap, Bell, Map, ScrollText, Terminal, Bot, Menu } from 'lucide-react'
import Dashboard from './components/Dashboard.jsx'
import IncidentList from './components/IncidentList.jsx'
import RemediationPanel from './components/RemediationPanel.jsx'
import DeviceMap from './components/DeviceMap.jsx'
import EventLogs from './components/EventLogs.jsx'
import NocAI from './components/NocAI.jsx'
import gruveLogo from './assets/gruve-logo.png'

const API = import.meta.env.VITE_API_BASE_URL || ''

export default function App() {
  const [activeTab, setActiveTab]       = useState('dashboard')
  const [selectedIncident, setIncident] = useState(null)
  const [incidents, setIncidents]       = useState([])
  const [stats, setStats]               = useState({})
  const [openCount, setOpenCount]       = useState(0)
  const [sidebarOpen, setSidebarOpen]   = useState(true)
  const [pendingCmd,  setPendingCmd]    = useState(null)

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
    setActiveTab('remediation')
  }

  const NAV = [
    { id: 'dashboard',   icon: Activity,      label: 'Dashboard' },
    { id: 'incidents',   icon: Bell,          label: 'Incidents',   badge: openCount },
    { id: 'networkmap',  icon: Map,           label: 'Network Map' },
    { id: 'eventlogs',   icon: ScrollText,    label: 'Event Logs' },
    { id: 'nocai',      icon: Bot,           label: 'Gruve AI'  },
    { id: 'remediation', icon: Zap,           label: 'Remediation' },
  ]

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <aside style={{
        width: sidebarOpen ? 230 : 0, minWidth: sidebarOpen ? 230 : 0,
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--bg-border)',
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--bg-border)' }}>
          <img src={gruveLogo} alt="Gruve"
            style={{ width: '100%', maxWidth: 130, display: 'block', marginBottom: 10 }}/>
          <div style={{ fontSize: 10, color: 'var(--gruve-green)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 500 }}>
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 3 }}>
            Autonomous AI NOC
          </div>
        </div>

        <nav style={{ flex:1, padding:'12px 10px' }}>
          {NAV.map(item => {
            const Icon   = item.icon
            const active = activeTab === item.id
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
                display: 'flex', alignItems: 'center',
                gap: 10, width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none', cursor: 'pointer',
                background: active ? 'var(--gruve-green-glow)' : 'transparent',
                color: active ? 'var(--gruve-green)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: active ? 500 : 400,
                marginBottom: 2, transition: 'all 0.15s', textAlign: 'left'
              }}>
                <Icon size={16}/>
                {item.label}
                {item.badge > 0 && (
                  <span style={{
                    marginLeft: 'auto', background: 'var(--status-critical)',
                    color: '#fff', fontSize: 10, fontWeight: 600,
                    padding: '1px 6px', borderRadius: 10,
                    minWidth: 18, textAlign: 'center'
                  }}>{item.badge}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--bg-border)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="pulse-dot" style={{ background: 'var(--gruve-green)' }}/>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Live monitoring active</span>
        </div>
      </aside>

      <main style={{ flex:1, overflow:'auto', background:'var(--bg-base)', position:'relative' }}>
        <button
          onClick={() => setSidebarOpen(o => !o)}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          style={{
            position: 'fixed', top: 14, left: sidebarOpen ? 194 : 14, zIndex: 200,
            width: 28, height: 28, borderRadius: 6,
            background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'left 0.25s ease',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)'
          }}>
          <Menu size={14} color="var(--text-secondary)"/>
        </button>
        {activeTab === 'dashboard'   && <Dashboard stats={stats} incidents={incidents} onSelect={handleSelectIncident} onQuickAction={(cmd) => { setPendingCmd(cmd); setActiveTab('nocai') }}/>}
        {activeTab === 'incidents'   && <IncidentList incidents={incidents} onSelect={handleSelectIncident}/>}
        {activeTab === 'networkmap'  && <DeviceMap/>}
        {activeTab === 'eventlogs'   && <EventLogs/>}
        {activeTab === 'nocai'       && <NocAI api={API} pendingCmd={pendingCmd} onCmdConsumed={() => setPendingCmd(null)}/>}
        {activeTab === 'remediation' && <RemediationPanel incident={selectedIncident} api={API}/>}
      </main>
    </div>
  )
}
