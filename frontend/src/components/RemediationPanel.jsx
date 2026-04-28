import { useState, useEffect } from 'react'
import { Zap, CheckCircle, XCircle, Loader, ExternalLink, AlertTriangle } from 'lucide-react'

export default function RemediationPanel({ incident, api }) {
  const [jobStatus, setJobStatus] = useState(null)
  const [running,   setRunning]   = useState(false)
  const [pollTimer, setPollTimer] = useState(null)

  useEffect(() => {
    setJobStatus(null)
    setRunning(false)
    if (pollTimer) { clearInterval(pollTimer); setPollTimer(null) }
  }, [incident?._id])

  const triggerRemediation = async () => {
    if (!incident) return
    setRunning(true)
    setJobStatus({ status: 'launching' })
    try {
      const r = await fetch(`${api}/api/v1/remediate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incident._id })
      })
      const d = await r.json()
      if (d.aap_job_id) {
        setJobStatus({ status: 'running', job_id: d.aap_job_id, job_url: d.aap_job_url })
        const t = setInterval(async () => {
          try {
            const r2 = await fetch(`${api}/api/v1/remediate/${d.aap_job_id}/status`)
            const d2 = await r2.json()
            setJobStatus(prev => ({ ...prev, ...d2 }))
            if (['successful','failed','error'].includes(d2.status)) {
              setRunning(false)
              clearInterval(t)
            }
          } catch {}
        }, 10000)
        setPollTimer(t)
      } else {
        setJobStatus({ status: 'not_configured', message: d.message || 'No AAP template configured.' })
        setRunning(false)
      }
    } catch (e) {
      setJobStatus({ status: 'error', message: e.message })
      setRunning(false)
    }
  }

  const SEVERITY = {
    DEVICE_DOWN:     { label:'Critical', cls:'critical' },
    INTERNET_DOWN:   { label:'Critical', cls:'critical' },
    DEVICE_STALE:    { label:'Warning',  cls:'warning'  },
    DEVICE_RECOVERED:{ label:'Resolved', cls:'ok'       },
  }

  if (!incident) {
    return (
      <div style={{ padding:28, display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
        <div style={{ textAlign:'center', color:'var(--text-muted)' }}>
          <Zap size={40} style={{ margin:'0 auto 12px', display:'block', opacity:0.2 }}/>
          <div style={{ fontSize:15, fontWeight:500, marginBottom:6 }}>No incident selected</div>
          <div style={{ fontSize:13 }}>
            Select an incident from the Incidents tab to view the AI remediation plan
          </div>
        </div>
      </div>
    )
  }

  const severity = SEVERITY[incident.incident_type] || { label:'Unknown', cls:'unknown' }

  return (
    <div style={{ padding:28, maxWidth:900 }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:600 }}>Remediation</h1>
        <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:3 }}>
          AI-generated plan and Ansible automation for the selected incident
        </p>
      </div>

      {/* Incident summary */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
          <div>
            <div style={{ fontSize:16, fontWeight:600 }}>
              {incident.device_name || incident.device_serial}
            </div>
            <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:3 }}>
              {incident.network_name}
            </div>
          </div>
          <span className={`badge ${severity.cls}`}>{severity.label}</span>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[
            { label:'Incident type', value: incident.incident_type?.replace(/_/g,' ') },
            { label:'Status',        value: incident.status },
            { label:'Detected',      value: incident.created_at ? new Date(incident.created_at).toLocaleString() : '—' },
            { label:'Device serial', value: incident.device_serial },
            { label:'Network ID',    value: incident.network_id || '—' },
            { label:'ServiceNow',    value: incident.snow_ticket_id || 'Pending' },
          ].map(f => (
            <div key={f.label} style={{
              background:'var(--bg-elevated)', padding:'10px 14px',
              borderRadius:'var(--radius-sm)'
            }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 }}>
                {f.label}
              </div>
              <div className="mono" style={{ fontSize:12 }}>{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Plan */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--gruve-green)' }}/>
          <span style={{ fontWeight:500, fontSize:14 }}>AI Remediation Plan</span>
          <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:4 }}>
            Generated by Qwen 2.5 7B
          </span>
        </div>
        {incident.ai_plan ? (
          <pre style={{
            fontSize:13, lineHeight:1.8,
            color:'var(--text-primary)',
            whiteSpace:'pre-wrap', wordBreak:'break-word',
            fontFamily:"'Fira Code', monospace",
            background:'var(--bg-elevated)',
            padding:16, borderRadius:'var(--radius-sm)',
            border:'1px solid var(--bg-border)'
          }}>
            {incident.ai_plan}
          </pre>
        ) : (
          <div style={{ padding:20, textAlign:'center', color:'var(--text-muted)' }}>
            <Loader size={20} style={{ margin:'0 auto 8px', display:'block', opacity:0.4 }}/>
            AI plan being generated...
          </div>
        )}
      </div>

      {/* Ansible execution */}
      <div className="card">
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--status-warning)' }}/>
          <span style={{ fontWeight:500, fontSize:14 }}>Ansible Automation</span>
          <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:4 }}>via AAP Controller</span>
        </div>

        {!jobStatus && (
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <button className="btn btn-primary" onClick={triggerRemediation} disabled={running}>
              <Zap size={14}/> Run Remediation
            </button>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>
              Launches the mapped AAP job template for {incident.incident_type?.replace(/_/g,' ')}
            </span>
          </div>
        )}

        {jobStatus && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'12px 16px',
              background:'var(--bg-elevated)',
              borderRadius:'var(--radius-sm)',
              border:'1px solid var(--bg-border)'
            }}>
              {jobStatus.status === 'launching'      && <Loader       size={16} color="var(--status-warning)" style={{animation:'spin 1s linear infinite'}}/>}
              {jobStatus.status === 'running'        && <Loader       size={16} color="var(--status-info)"    style={{animation:'spin 1s linear infinite'}}/>}
              {jobStatus.status === 'successful'     && <CheckCircle  size={16} color="var(--status-ok)"/>}
              {jobStatus.status === 'failed'         && <XCircle      size={16} color="var(--status-critical)"/>}
              {jobStatus.status === 'error'          && <AlertTriangle size={16} color="var(--status-critical)"/>}
              {jobStatus.status === 'not_configured' && <AlertTriangle size={16} color="var(--status-warning)"/>}
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>
                  {jobStatus.status === 'launching'      && 'Launching job...'}
                  {jobStatus.status === 'running'        && `Job #${jobStatus.job_id} running`}
                  {jobStatus.status === 'successful'     && `Job #${jobStatus.job_id} completed successfully`}
                  {jobStatus.status === 'failed'         && `Job #${jobStatus.job_id} failed`}
                  {jobStatus.status === 'error'          && 'Launch error'}
                  {jobStatus.status === 'not_configured' && 'No AAP template configured yet'}
                </div>
                {jobStatus.message && (
                  <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>
                    {jobStatus.message}
                  </div>
                )}
              </div>
              {jobStatus.job_url && (
                <a href={jobStatus.job_url} target="_blank" rel="noreferrer"
                  style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--gruve-green)', textDecoration:'none' }}>
                  View in AAP <ExternalLink size={11}/>
                </a>
              )}
            </div>
            {['successful','failed','error','not_configured'].includes(jobStatus.status) && (
              <button
                className="btn btn-secondary"
                style={{ alignSelf:'flex-start' }}
                onClick={() => { setJobStatus(null); setRunning(false) }}
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
