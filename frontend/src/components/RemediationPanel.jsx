import { useState, useEffect, useRef } from 'react'
import { Zap, CheckCircle, XCircle, Loader, ExternalLink, AlertTriangle, ShieldCheck, Clock } from 'lucide-react'

export default function RemediationPanel({ incident, api }) {
  const [jobStatus,  setJobStatus]  = useState(null)
  const [running,    setRunning]    = useState(false)
  const [approved,   setApproved]   = useState(false)
  const [incStatus,  setIncStatus]  = useState(incident?.status)
  const pollRef = useRef(null)

  useEffect(() => {
    setJobStatus(null)
    setRunning(false)
    setApproved(false)
    setIncStatus(incident?.status)
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
  }, [incident?._id])

  // Poll incident status after approval
  const startPolling = (incidentId) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${api}/api/v1/incidents/${incidentId}`)
        const d = await r.json()
        setIncStatus(d.status)
        if (d.status === 'resolved') {
          clearInterval(pollRef.current)
          pollRef.current = null
          setJobStatus({ status: 'resolved' })
          setRunning(false)
        }
      } catch {}
    }, 10000)
  }

  const handleApprove = async () => {
    if (!incident) return
    setRunning(true)
    setJobStatus({ status: 'approving' })
    try {
      const r = await fetch(`${api}/api/v1/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incident_id: incident._id })
      })
      const d = await r.json()
      setApproved(true)
      setJobStatus({
        status: 'eda_triggered',
        eda_status: d.eda_status,
        message: d.eda_status === 200
          ? 'EDA webhook fired — AAP workflow starting. Approve in AAP UI to continue.'
          : `EDA webhook returned ${d.eda_status} — check EDA logs`
      })
      // Start polling for resolution
      startPolling(incident._id)
    } catch (e) {
      setJobStatus({ status: 'error', message: e.message })
      setRunning(false)
    }
  }

  const handleRemediate = async () => {
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
    DEVICE_DOWN:      { label:'Critical', cls:'critical' },
    INTERNET_DOWN:    { label:'Critical', cls:'critical' },
    DEVICE_STALE:     { label:'Warning',  cls:'warning'  },
    DEVICE_RECOVERED: { label:'Resolved', cls:'ok'       },
  }

  if (!incident) {
    return (
      <div style={{ padding:28, display:'flex', alignItems:'center', justifyContent:'center', height:'100%' }}>
        <div style={{ textAlign:'center', color:'var(--text-muted)' }}>
          <Zap size={40} style={{ margin:'0 auto 12px', display:'block', opacity:0.2 }}/>
          <div style={{ fontSize:15, fontWeight:500, marginBottom:6 }}>No incident selected</div>
          <div style={{ fontSize:13 }}>Select an incident from the Incidents tab</div>
        </div>
      </div>
    )
  }

  const severity  = SEVERITY[incident.incident_type] || { label:'Unknown', cls:'unknown' }
  const isResolved = incStatus === 'resolved'

  // Flow step states
  const step1Done = true
  const step2Done = approved || isResolved
  const step3Done = isResolved
  const step4Done = isResolved

  const StepPill = ({ num, label, done, active }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 20,
      background: done ? 'rgba(0,212,106,0.12)' : active ? 'rgba(59,139,222,0.12)' : 'var(--bg-elevated)',
      border: `1px solid ${done ? 'rgba(0,212,106,0.4)' : active ? 'rgba(59,139,222,0.4)' : 'var(--bg-border)'}`,
      fontSize: 11,
      color: done ? 'var(--status-ok)' : active ? '#3B8BDE' : 'var(--text-muted)'
    }}>
      {done
        ? <CheckCircle size={11}/>
        : active
          ? <Loader size={11} style={{ animation:'spin 1s linear infinite' }}/>
          : <Clock size={11}/>
      }
      {num}. {label}
    </div>
  )

  return (
    <div style={{ padding:28, maxWidth:900 }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:600 }}>Remediation</h1>
        <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:3 }}>
          Review AI plan → Approve → EDA triggers AAP workflow → ServiceNow updated
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
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span className={`badge ${isResolved ? 'ok' : severity.cls}`}>
              {isResolved ? 'Resolved' : severity.label}
            </span>
            <span style={{
              fontSize:11, padding:'2px 10px', borderRadius:10,
              background: isResolved ? 'rgba(0,212,106,0.1)' : 'rgba(255,183,0,0.1)',
              color: isResolved ? 'var(--status-ok)' : 'var(--status-warning)',
              border: `1px solid ${isResolved ? 'rgba(0,212,106,0.3)' : 'rgba(255,183,0,0.3)'}`
            }}>
              {incStatus}
            </span>
          </div>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
          {[
            { label:'Incident type', value: incident.incident_type?.replace(/_/g,' ') },
            { label:'Status',        value: incStatus },
            { label:'Detected',      value: incident.created_at ? new Date(incident.created_at).toLocaleString() : '—' },
            { label:'Device serial', value: incident.device_serial },
            { label:'Network ID',    value: incident.network_id || '—' },
            { label:'ServiceNow',    value: incident.snow_ticket_id
                ? <a href={`https://dev380179.service-now.com/incident.do?sysparm_query=number=${incident.snow_ticket_id}`}
                    target="_blank" rel="noreferrer"
                    style={{ color:'var(--gruve-green)', textDecoration:'none', fontWeight:600 }}>
                    {incident.snow_ticket_id} ↗
                  </a>
                : <span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>Pending</span> },
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
          <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:4 }}>Generated by Qwen 2.5 7B</span>
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
            AI plan being generated...
          </div>
        )}
      </div>

      {/* Remediation Actions */}
      <div className="card">
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
          <div style={{ width:6, height:6, borderRadius:'50%',
            background: isResolved ? 'var(--status-ok)' : 'var(--status-warning)' }}/>
          <span style={{ fontWeight:500, fontSize:14 }}>Remediation Actions</span>
        </div>

        {/* Flow steps */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:20, flexWrap:'wrap' }}>
          <StepPill num={1} label="Review AI Plan"          done={step1Done} active={false}/>
          <span style={{ color:'var(--text-muted)', fontSize:12 }}>→</span>
          <StepPill num={2} label="Approve (NOC Engineer)"  done={step2Done} active={!step2Done}/>
          <span style={{ color:'var(--text-muted)', fontSize:12 }}>→</span>
          <StepPill num={3} label="EDA → AAP → Execute"    done={step3Done} active={step2Done && !step3Done}/>
          <span style={{ color:'var(--text-muted)', fontSize:12 }}>→</span>
          <StepPill num={4} label="ServiceNow Closed"       done={step4Done} active={step3Done && !step4Done}/>
        </div>

        {/* Resolved state */}
        {isResolved && (
          <div style={{
            display:'flex', alignItems:'center', gap:12,
            padding:'16px 20px',
            background:'rgba(0,212,106,0.08)',
            borderRadius:'var(--radius-sm)',
            border:'1px solid rgba(0,212,106,0.3)'
          }}>
            <CheckCircle size={24} color="var(--status-ok)"/>
            <div>
              <div style={{ fontSize:14, fontWeight:600, color:'var(--status-ok)' }}>
                Remediation Complete
              </div>
              <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:2 }}>
                Device remediated · ServiceNow ticket closed · Incident resolved
              </div>
            </div>
          </div>
        )}

        {/* Action buttons — only show if not resolved */}
        {!isResolved && !jobStatus && (
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <button
              className="btn btn-primary"
              onClick={handleApprove}
              disabled={running || incStatus === 'approved'}
              style={{ gap:8 }}
            >
              <ShieldCheck size={15}/>
              {incStatus === 'approved' ? 'Waiting for AAP Approval...' : 'Approve and Remediate via EDA'}
            </button>
            <div style={{ width:1, height:30, background:'var(--bg-border)' }}/>
            <button
              className="btn btn-secondary"
              onClick={handleRemediate}
              disabled={running}
              title="Direct AAP trigger — bypasses EDA"
            >
              <Zap size={14}/> Direct AAP
            </button>
          </div>
        )}

        {/* Status display */}
        {!isResolved && jobStatus && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{
              display:'flex', alignItems:'center', gap:12,
              padding:'12px 16px',
              background:'var(--bg-elevated)',
              borderRadius:'var(--radius-sm)',
              border:'1px solid var(--bg-border)'
            }}>
              {jobStatus.status === 'approving'     && <Loader size={16} color="var(--status-warning)" style={{animation:'spin 1s linear infinite'}}/>}
              {jobStatus.status === 'eda_triggered' && <Loader size={16} color="var(--status-info)"    style={{animation:'spin 1s linear infinite'}}/>}
              {jobStatus.status === 'launching'     && <Loader size={16} color="var(--status-warning)" style={{animation:'spin 1s linear infinite'}}/>}
              {jobStatus.status === 'running'       && <Loader size={16} color="var(--status-info)"    style={{animation:'spin 1s linear infinite'}}/>}
              {jobStatus.status === 'successful'    && <CheckCircle size={16} color="var(--status-ok)"/>}
              {jobStatus.status === 'failed'        && <XCircle size={16} color="var(--status-critical)"/>}
              {jobStatus.status === 'error'         && <AlertTriangle size={16} color="var(--status-critical)"/>}
              {jobStatus.status === 'not_configured'&& <AlertTriangle size={16} color="var(--status-warning)"/>}

              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:500 }}>
                  {jobStatus.status === 'approving'      && 'Processing approval...'}
                  {jobStatus.status === 'eda_triggered'  && 'EDA triggered — waiting for senior approval in AAP UI'}
                  {jobStatus.status === 'launching'      && 'Launching AAP job...'}
                  {jobStatus.status === 'running'        && `Job #${jobStatus.job_id} running`}
                  {jobStatus.status === 'successful'     && `Job #${jobStatus.job_id} completed successfully`}
                  {jobStatus.status === 'failed'         && `Job #${jobStatus.job_id} failed`}
                  {jobStatus.status === 'error'          && 'Error occurred'}
                  {jobStatus.status === 'not_configured' && 'No AAP template configured'}
                </div>
                {jobStatus.message && (
                  <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>
                    {jobStatus.message}
                  </div>
                )}
                {jobStatus.status === 'eda_triggered' && (
                  <div style={{ marginTop:8, display:'flex', gap:12 }}>
                    
                    <a href="https://aap-aap.apps.ocp-mig2.gruveai.com/execution/administration/workflow-approvals?page=1&perPage=10&sort=name"
                      target="_blank" rel="noreferrer"
                      style={{ fontSize:11, color:'var(--gruve-green)', textDecoration:'none', display:'flex', alignItems:'center', gap:4 }}
                    >
                      <ExternalLink size={11}/> Approve in AAP →
                    </a>
                    <span style={{ fontSize:11, color:'var(--text-muted)' }}>
                      Polling for completion every 10s...
                    </span>
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

            {['failed','error','not_configured'].includes(jobStatus.status) && (
              <button
                className="btn btn-secondary"
                style={{ alignSelf:'flex-start' }}
                onClick={() => { setJobStatus(null); setRunning(false); setApproved(false) }}
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
