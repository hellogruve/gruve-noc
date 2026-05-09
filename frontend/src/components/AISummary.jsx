import { useState, useEffect, useCallback } from 'react'
import {
  ShieldAlert, RefreshCw, AlertTriangle, CheckCircle,
  Server, FileText, Zap, Clock, ChevronDown, ChevronUp
} from 'lucide-react'

const API = import.meta.env.VITE_API_BASE_URL || ''

const SEV_COLOR = {
  critical:  '#f87171',
  important: '#fb923c',
  moderate:  '#facc15',
  low:       '#60a5fa',
  clean:     '#4ade80',
}

const RISK_COLOR = {
  critical: '#f87171',
  high:     '#fb923c',
  medium:   '#facc15',
  low:      '#60a5fa',
  clean:    '#4ade80',
}

function RiskGauge({ score }) {
  const color = score >= 70 ? '#f87171'
    : score >= 40 ? '#fb923c'
    : score >= 20 ? '#facc15'
    : score > 0  ? '#60a5fa'
    : '#4ade80'

  const label = score >= 70 ? 'Critical Risk'
    : score >= 40 ? 'High Risk'
    : score >= 20 ? 'Medium Risk'
    : score > 0  ? 'Low Risk'
    : 'Clean'

  // Circle gauge
  const radius = 54
  const circ   = 2 * Math.PI * radius
  const offset = circ - (score / 100) * circ

  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
      <svg width={140} height={140} viewBox="0 0 140 140">
        {/* Background circle */}
        <circle cx={70} cy={70} r={radius}
          fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={12}/>
        {/* Score arc */}
        <circle cx={70} cy={70} r={radius}
          fill="none" stroke={color} strokeWidth={12}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{transition:'stroke-dashoffset 1s ease'}}/>
        {/* Score text */}
        <text x={70} y={66} textAnchor="middle"
          fill={color} fontSize={32} fontWeight={700} fontFamily="monospace">
          {score}
        </text>
        <text x={70} y={84} textAnchor="middle"
          fill="rgba(255,255,255,0.5)" fontSize={11}>
          / 100
        </text>
      </svg>
      <div style={{fontSize:14,fontWeight:700,color}}>{label}</div>
    </div>
  )
}

function CommonAdvisoryRow({ adv, idx }) {
  const [open, setOpen] = useState(false)
  const color = SEV_COLOR[adv.severity] || SEV_COLOR.moderate
  return (
    <div style={{borderBottom:'1px solid var(--bg-border)'}}>
      <div onClick={() => setOpen(!open)} style={{
        display:'flex',alignItems:'center',gap:12,
        padding:'10px 16px',cursor:'pointer',
        background: open ? 'rgba(255,255,255,0.03)' : 'transparent'
      }}>
        <span style={{width:8,height:8,borderRadius:'50%',background:color,flexShrink:0}}/>
        <span style={{fontFamily:'monospace',fontSize:12,color:'var(--text-secondary)',width:160,flexShrink:0}}>
          {adv.advisory}
        </span>
        <span style={{fontSize:11,color,fontWeight:600,width:80,flexShrink:0,textTransform:'capitalize'}}>
          {adv.severity}
        </span>
        <span style={{fontSize:11,color:'var(--text-muted)',flex:1}}>
          {adv.packages.slice(0,3).join(', ')}{adv.packages.length>3 ? ` +${adv.packages.length-3} more` : ''}
        </span>
        <span style={{
          fontSize:11,padding:'2px 8px',borderRadius:4,flexShrink:0,
          background:'rgba(255,255,255,0.08)',color:'var(--text-secondary)'
        }}>
          {adv.vms.length} VM{adv.vms.length>1?'s':''}
        </span>
        {open ? <ChevronUp size={13} style={{color:'var(--text-muted)',flexShrink:0}}/> 
               : <ChevronDown size={13} style={{color:'var(--text-muted)',flexShrink:0}}/>}
      </div>
      {open && (
        <div style={{padding:'8px 16px 12px 36px',background:'rgba(0,0,0,0.15)'}}>
          <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:4}}>Affected VMs:</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {adv.vms.map(v => (
              <span key={v} style={{
                fontSize:11,padding:'2px 8px',borderRadius:4,
                background:'rgba(255,255,255,0.06)',color:'var(--text-secondary)',
                fontFamily:'monospace'
              }}>{v}</span>
            ))}
          </div>
          {adv.packages.length > 0 && (
            <>
              <div style={{fontSize:11,color:'var(--text-muted)',marginTop:8,marginBottom:4}}>Packages:</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {adv.packages.slice(0,10).map(p => (
                  <span key={p} style={{
                    fontSize:11,padding:'2px 8px',borderRadius:4,
                    background:'rgba(255,255,255,0.04)',color:'var(--text-muted)',
                    fontFamily:'monospace'
                  }}>{p}</span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function AISummary() {
  const [data,       setData]       = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error,      setError]      = useState(null)
  const [lastRefresh,setLastRefresh]= useState(null)

  const fetchSummary = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/v1/vulnerabilities/summary/fleet`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setData(await r.json())
      setLastRefresh(new Date())
      setError(null)
    } catch(e) {
      setError(`Failed to load: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSummary()
    const t = setInterval(fetchSummary, 30000)
    return () => clearInterval(t)
  }, [fetchSummary])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      await fetch(`${API}/api/v1/vulnerabilities/summary/generate`, {method:'POST'})
      // Poll for result
      setTimeout(fetchSummary, 8000)
      setTimeout(fetchSummary, 15000)
      setTimeout(fetchSummary, 25000)
    } catch(e) {
      alert(`Error: ${e.message}`)
    } finally {
      setTimeout(() => setGenerating(false), 8000)
    }
  }

  if (loading) return (
    <div style={{padding:28,textAlign:'center',color:'var(--text-muted)',fontSize:13}}>
      <div style={{marginBottom:12,color:'var(--gruve-green)',fontSize:22}}>⟳</div>
      Loading fleet summary...
    </div>
  )

  if (error) return (
    <div style={{padding:28}}>
      <div style={{padding:'12px 16px',borderRadius:10,
        background:'rgba(220,38,38,0.1)',border:'1px solid rgba(220,38,38,0.4)',
        fontSize:12,color:'#f87171'}}>
        {error}
      </div>
    </div>
  )

  const d = data || {}
  const score = d.fleet_risk_score || 0
  const hasData = d.total_vms > 0

  return (
    <div style={{padding:28,minHeight:'100vh'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',
        flexWrap:'wrap',gap:12,marginBottom:24}}>
        <div>
          <h2 style={{fontSize:20,fontWeight:700,marginBottom:6,
            display:'flex',alignItems:'center',gap:10}}>
            <FileText size={22} style={{color:'var(--gruve-green)'}}/> AI Summary
          </h2>
          <p style={{fontSize:12,color:'var(--text-muted)',margin:0}}>
            Fleet-wide vulnerability intelligence
            {lastRefresh && <span style={{marginLeft:10}}>· Updated {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={fetchSummary} style={{
            display:'flex',alignItems:'center',gap:6,padding:'7px 14px',
            fontSize:12,borderRadius:8,cursor:'pointer',
            background:'none',border:'1px solid var(--bg-border)',color:'var(--text-secondary)'}}>
            <RefreshCw size={13}/> Refresh
          </button>
          <button onClick={handleGenerate} disabled={generating} style={{
            display:'flex',alignItems:'center',gap:6,padding:'7px 16px',
            fontSize:12,borderRadius:8,cursor:'pointer',
            background:'var(--gruve-green)',border:'none',color:'#000',
            fontWeight:700,opacity:generating?0.6:1}}>
            {generating ? '⟳ Generating...' : <><Zap size={13}/> Generate AI Summary</>}
          </button>
        </div>
      </div>

      {!hasData ? (
        <div style={{textAlign:'center',padding:60,background:'var(--bg-surface)',
          border:'1px solid var(--bg-border)',borderRadius:12}}>
          <ShieldAlert size={44} style={{opacity:0.2,marginBottom:16}}/>
          <div style={{fontWeight:600,marginBottom:8}}>No scan data yet</div>
          <div style={{fontSize:12,color:'var(--text-muted)'}}>
            Run a vulnerability scan first to see the fleet summary
          </div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:20}}>

          {/* Row 1: Risk gauge + Fleet stats */}
          <div style={{display:'grid',gridTemplateColumns:'200px 1fr',gap:16}}>

            {/* Gauge */}
            <div style={{background:'var(--bg-surface)',border:'1px solid var(--bg-border)',
              borderRadius:12,padding:24,display:'flex',flexDirection:'column',
              alignItems:'center',justifyContent:'center'}}>
              <div style={{fontSize:11,color:'var(--text-muted)',marginBottom:12,textTransform:'uppercase',letterSpacing:'0.05em'}}>
                Fleet Risk Score
              </div>
              <RiskGauge score={score}/>
            </div>

            {/* Fleet stats grid */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))',gap:12}}>
              {[
                {label:'Total VMs',       value:d.total_vms,             color:'var(--text-secondary)'},
                {label:'Scanned',         value:d.scanned_vms,           color:'var(--text-secondary)'},
                {label:'Critical',        value:d.total_critical,        color:'#f87171'},
                {label:'Important',       value:d.total_important,       color:'#fb923c'},
                {label:'Moderate',        value:d.total_moderate,        color:'#facc15'},
                {label:'Low',             value:d.total_low,             color:'#60a5fa'},
                {label:'Total Vulns',     value:d.total_vulnerabilities, color:'var(--text-secondary)'},
                {label:'Patched VMs',     value:d.patched_vms,           color:'#4ade80'},
              ].map(s => (
                <div key={s.label} style={{background:'var(--bg-surface)',
                  border:'1px solid var(--bg-border)',borderRadius:10,padding:'14px 16px'}}>
                  <div style={{fontSize:24,fontWeight:700,color:s.color}}>{s.value}</div>
                  <div style={{fontSize:11,color:'var(--text-muted)',marginTop:3}}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Row 2: AI Executive Summary */}
          <div style={{background:'var(--bg-surface)',border:'1px solid var(--bg-border)',borderRadius:12,padding:24}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
              <div style={{fontWeight:600,fontSize:14,display:'flex',alignItems:'center',gap:8}}>
                <Zap size={16} style={{color:'var(--gruve-green)'}}/> Executive Summary
              </div>
              {d.ai_summary?.generated_at && (
                <span style={{fontSize:11,color:'var(--text-muted)',display:'flex',alignItems:'center',gap:4}}>
                  <Clock size={11}/> {new Date(d.ai_summary.generated_at).toLocaleString()}
                </span>
              )}
            </div>
            {d.ai_summary?.text ? (
              <div style={{fontSize:13,color:'var(--text-secondary)',lineHeight:1.8,
                whiteSpace:'pre-wrap',fontFamily:'inherit'}}>
                {d.ai_summary.text}
              </div>
            ) : (
              <div style={{textAlign:'center',padding:'32px 0',color:'var(--text-muted)',fontSize:12}}>
                {generating
                  ? '⟳ Generating executive summary...'
                  : 'Click "Generate AI Summary" to create an executive brief of your fleet\'s vulnerability posture'}
              </div>
            )}
          </div>

          {/* Row 3: Per-VM Risk Cards */}
          <div style={{background:'var(--bg-surface)',border:'1px solid var(--bg-border)',borderRadius:12,padding:24}}>
            <div style={{fontWeight:600,fontSize:14,marginBottom:16,
              display:'flex',alignItems:'center',gap:8}}>
              <Server size={16} style={{color:'var(--gruve-green)'}}/> VM Risk Overview
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
              {(d.vm_risk_scores||[]).map(vm => {
                const rc = RISK_COLOR[vm.risk_level] || '#94a3b8'
                return (
                  <div key={vm.vm_name} style={{
                    background:'rgba(255,255,255,0.03)',
                    border:`1px solid ${vm.risk_score>0 ? rc+'40' : 'var(--bg-border)'}`,
                    borderRadius:10,padding:16}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8}}>
                      <div>
                        <div style={{fontWeight:600,fontSize:12,marginBottom:2}}>{vm.vm_name}</div>
                        <div style={{fontSize:10,color:'var(--text-muted)'}}>{vm.vm_ip}</div>
                      </div>
                      <div style={{
                        fontSize:20,fontWeight:700,color:rc,
                        lineHeight:1
                      }}>{vm.risk_score}</div>
                    </div>
                    <div style={{fontSize:10,color:'var(--text-muted)',marginBottom:8}}>
                      {vm.rhel_version?.replace('Red Hat Enterprise Linux release ','RHEL ')}
                    </div>
                    <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                      {vm.critical>0  && <span style={{fontSize:10,padding:'1px 6px',borderRadius:3,background:'rgba(220,38,38,0.15)',color:'#f87171'}}>{vm.critical}C</span>}
                      {vm.important>0 && <span style={{fontSize:10,padding:'1px 6px',borderRadius:3,background:'rgba(234,88,12,0.15)',color:'#fb923c'}}>{vm.important}I</span>}
                      {vm.moderate>0  && <span style={{fontSize:10,padding:'1px 6px',borderRadius:3,background:'rgba(202,138,4,0.15)',color:'#facc15'}}>{vm.moderate}M</span>}
                      {vm.low>0       && <span style={{fontSize:10,padding:'1px 6px',borderRadius:3,background:'rgba(37,99,235,0.15)',color:'#60a5fa'}}>{vm.low}L</span>}
                      {vm.risk_level==='clean' && <span style={{fontSize:10,padding:'1px 6px',borderRadius:3,background:'rgba(22,163,74,0.15)',color:'#4ade80'}}>✓ Clean</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Row 4: Common Advisories */}
          {(d.common_advisories||[]).length > 0 && (
            <div style={{background:'var(--bg-surface)',border:'1px solid var(--bg-border)',borderRadius:12,overflow:'hidden'}}>
              <div style={{padding:'16px 20px',borderBottom:'1px solid var(--bg-border)',
                display:'flex',alignItems:'center',gap:8}}>
                <AlertTriangle size={16} style={{color:'#fb923c'}}/>
                <span style={{fontWeight:600,fontSize:14}}>
                  Common Advisories
                </span>
                <span style={{fontSize:11,color:'var(--text-muted)',marginLeft:4}}>
                  affecting multiple VMs
                </span>
              </div>
              {/* Table header */}
              <div style={{display:'flex',gap:12,padding:'8px 16px',
                background:'rgba(0,0,0,0.2)',
                fontSize:10,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.05em'}}>
                <span style={{width:8,flexShrink:0}}/>
                <span style={{width:160,flexShrink:0}}>Advisory</span>
                <span style={{width:80,flexShrink:0}}>Severity</span>
                <span style={{flex:1}}>Packages</span>
                <span style={{width:60,flexShrink:0}}>VMs</span>
                <span style={{width:16}}/>
              </div>
              {(d.common_advisories||[]).map((adv,i) => (
                <CommonAdvisoryRow key={adv.advisory} adv={adv} idx={i}/>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
