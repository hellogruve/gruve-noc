import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, Bot, User, Loader, Terminal, BookOpen, CheckCircle, XCircle, Clock } from 'lucide-react'

const now = () => new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })

// ── Job status badge ───────────────────────────────────────
function JobStatusBadge({ status }) {
  const cfg = {
    pending:    { color:'#f59e0b', bg:'rgba(245,158,11,0.1)',  icon:'⏳', label:'Pending'    },
    waiting:    { color:'#f59e0b', bg:'rgba(245,158,11,0.1)',  icon:'⏳', label:'Waiting'    },
    running:    { color:'#60a5fa', bg:'rgba(96,165,250,0.1)',  icon:'🔄', label:'Running'    },
    successful: { color:'#00d4aa', bg:'rgba(0,212,170,0.1)',   icon:'✅', label:'Successful' },
    failed:     { color:'#ef4444', bg:'rgba(239,68,68,0.1)',   icon:'❌', label:'Failed'     },
    error:      { color:'#ef4444', bg:'rgba(239,68,68,0.1)',   icon:'❌', label:'Error'      },
    canceled:   { color:'#94a3b8', bg:'rgba(148,163,184,0.1)', icon:'⚠️', label:'Canceled'   },
  }
  const c = cfg[status] || cfg['pending']
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4,
      color:c.color, background:c.bg,
      border:`1px solid ${c.color}40`,
      borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:600 }}>
      {c.icon} {c.label}
    </span>
  )
}

// ── Job progress tracker (live polling) ───────────────────
function JobTracker({ jobId, api, onComplete }) {
  const [info,    setInfo]    = useState({ status:'pending', output:'', finished:false })
  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef(null)
  const timerRef    = useRef(null)

  useEffect(() => {
    // elapsed timer — stops when job finishes
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)

    // poll every 5s until finished
    const poll = async () => {
      try {
        const r = await fetch(`${api}/api/v1/ai/job/${jobId}`)
        const d = await r.json()
        setInfo(d)
        if (d.finished) {
          clearInterval(intervalRef.current)
          clearInterval(timerRef.current)
          // notify parent but DON'T unmount — keep showing final state
          onComplete && onComplete(d)
        }
      } catch(e) {
        // keep polling on transient errors
      }
    }
    poll() // immediate first call
    intervalRef.current = setInterval(poll, 5000)

    return () => {
      clearInterval(intervalRef.current)
      clearInterval(timerRef.current)
    }
  }, [jobId, api])

  const stages = [
    { key:'pending',    label:'Queued'    },
    { key:'waiting',    label:'Waiting'   },
    { key:'running',    label:'Running'   },
    { key:'successful', label:'Complete'  },
  ]
  const stageIndex = {
    pending:0, waiting:1, running:2, successful:3, failed:3, error:3, canceled:3
  }
  const current = stageIndex[info.status] ?? 0
  const failed  = ['failed','error','canceled'].includes(info.status)

  return (
    <div style={{ marginTop:10, padding:12,
      background:'rgba(255,255,255,0.03)',
      border:'1px solid var(--bg-border)',
      borderRadius:8 }}>

      {/* Job ID + status */}
      <div style={{ display:'flex', justifyContent:'space-between',
        alignItems:'center', marginBottom:10 }}>
        <span style={{ fontSize:12, fontFamily:'monospace', color:'var(--text-secondary)' }}>
          Job #{jobId}
        </span>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {!info.finished && (
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>
              {elapsed}s
            </span>
          )}
          <JobStatusBadge status={info.status}/>
        </div>
      </div>

      {/* Stage pipeline */}
      <div style={{ display:'flex', alignItems:'center', gap:0, marginBottom:10 }}>
        {stages.map((stage, i) => {
          const done    = i < current || (i === current && info.finished && !failed)
          const active  = i === current && !info.finished
          const isFail  = i === current && failed
          const color   = isFail ? '#ef4444' : done ? 'var(--gruve-green)' : active ? '#60a5fa' : 'var(--bg-border)'
          const textCol = isFail ? '#ef4444' : done ? 'var(--gruve-green)' : active ? '#60a5fa' : 'var(--text-muted)'
          return (
            <div key={stage.key} style={{ display:'flex', alignItems:'center', flex:1 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1 }}>
                <div style={{ width:20, height:20, borderRadius:'50%',
                  border:`2px solid ${color}`,
                  background: done ? color : 'transparent',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:10, color: done ? '#000' : color,
                  position:'relative' }}>
                  {done && !isFail ? '✓' : isFail ? '✗' : active ? (
                    <div style={{ width:6, height:6, borderRadius:'50%',
                      background:'#60a5fa',
                      animation:'aiPulse 1s ease-in-out infinite' }}/>
                  ) : ''}
                </div>
                <span style={{ fontSize:9, color:textCol, marginTop:3,
                  whiteSpace:'nowrap' }}>{stage.label}</span>
              </div>
              {i < stages.length-1 && (
                <div style={{ height:2, flex:1, marginBottom:12,
                  background: i < current ? 'var(--gruve-green)' : 'var(--bg-border)',
                  transition:'background 0.3s' }}/>
              )}
            </div>
          )
        })}
      </div>

      {/* Output details */}
      {info.output && (
        <pre style={{ margin:0, fontSize:11, fontFamily:'monospace',
          color:'var(--text-secondary)', lineHeight:1.6,
          background:'var(--bg-base)', borderRadius:6,
          padding:'8px 10px', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
          {info.output}
        </pre>
      )}
    </div>
  )
}

// ── Message bubble ─────────────────────────────────────────
function Bubble({ msg, api }) {
  const isUser = msg.role === 'user'
  // extract job_id from content if this was a job launch
  const jobId = msg.jobId || null

  return (
    <div style={{ display:'flex', gap:10,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems:'flex-start', marginBottom:16,
      animation:'fadeUp 0.2s ease' }}>

      <div style={{ width:30, height:30, borderRadius:8, flexShrink:0,
        background: isUser ? 'var(--gruve-green)' : 'var(--bg-elevated)',
        border:'1px solid var(--bg-border)',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {isUser ? <User size={14} color="#000"/> : <Bot size={14} color="var(--gruve-green)"/>}
      </div>

      <div style={{ maxWidth:'80%', display:'flex', flexDirection:'column',
        alignItems: isUser ? 'flex-end' : 'flex-start' }}>

        {/* Tool badge */}
        {msg.tool && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:5, marginBottom:5,
            fontSize:11, color:'var(--gruve-green)', background:'var(--gruve-green-glow)',
            border:'1px solid rgba(0,212,170,0.25)', borderRadius:4,
            padding:'2px 8px', fontFamily:'monospace' }}>
            <Terminal size={10}/> {msg.tool.replace(/_/g,' ')}
          </div>
        )}

        {/* KB sources */}
        {msg.sources > 0 && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:5, marginBottom:5,
            fontSize:11, color:'#a78bfa', background:'rgba(167,139,250,0.1)',
            border:'1px solid rgba(167,139,250,0.25)', borderRadius:4, padding:'2px 8px' }}>
            <BookOpen size={10}/> {msg.sources} KB source{msg.sources!==1?'s':''}
          </div>
        )}

        {/* Message body */}
        <div style={{
          padding:'10px 14px',
          borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
          background: isUser ? 'var(--gruve-green-glow)' : 'var(--bg-elevated)',
          border:'1px solid var(--bg-border)',
          fontSize:13, lineHeight:1.7,
          color: msg.error ? 'var(--status-critical)' : 'var(--text-primary)',
          whiteSpace:'pre-wrap', wordBreak:'break-word',
          width:'100%'
        }}>
          {msg.content}

          {/* Live job tracker — always visible once a job is launched */}
          {jobId && (
            <JobTracker
              jobId={jobId}
              api={api}
              onComplete={() => {}}
            />
          )}
        </div>

        <span style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>{msg.time}</span>
      </div>
    </div>
  )
}

// ── Thinking ───────────────────────────────────────────────
function Thinking() {
  return (
    <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:16 }}>
      <div style={{ width:30, height:30, borderRadius:8,
        background:'var(--bg-elevated)', border:'1px solid var(--bg-border)',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        <Bot size={14} color="var(--gruve-green)"/>
      </div>
      <div style={{ padding:'10px 14px', background:'var(--bg-elevated)',
        border:'1px solid var(--bg-border)', borderRadius:'4px 12px 12px 12px',
        display:'flex', alignItems:'center', gap:8 }}>
        <Loader size={13} color="var(--gruve-green)"
          style={{ animation:'spin 1s linear infinite' }}/>
        <span style={{ fontSize:12, color:'var(--text-secondary)' }}>Thinking...</span>
      </div>
    </div>
  )
}

// ── Resource list ──────────────────────────────────────────
function ResourceList({ title, items, color }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ marginBottom:16 }}>
      <div onClick={() => setOpen(o=>!o)} style={{ display:'flex',
        justifyContent:'space-between', alignItems:'center',
        cursor:'pointer', padding:'6px 0',
        borderBottom:'1px solid var(--bg-border)' }}>
        <span style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)',
          textTransform:'uppercase', letterSpacing:'0.08em' }}>{title}</span>
        <span style={{ fontSize:10, color:'var(--text-muted)' }}>{open?'▾':'▸'}</span>
      </div>
      {open && (
        <div style={{ paddingTop:6 }}>
          {items.length === 0
            ? <div style={{ fontSize:11, color:'var(--text-muted)', padding:'4px 0' }}>Loading…</div>
            : items.map(item => (
              <div key={item.id} style={{ display:'flex', alignItems:'center',
                gap:6, padding:'3px 0', fontSize:12, color:'var(--text-secondary)' }}>
                <span style={{ fontSize:10, color:color||'var(--gruve-green)',
                  background:'var(--gruve-green-glow)', borderRadius:3,
                  padding:'1px 5px', fontFamily:'monospace',
                  minWidth:26, textAlign:'center' }}>{item.id}</span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis',
                  whiteSpace:'nowrap' }}>{item.name}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

// ── Quick commands ─────────────────────────────────────────
const QUICK = [
  { label:'❓ Network health',      cmd:'what is the current network health status' },
  { label:'🖥 List hosts',          cmd:'list all hosts' },
  { label:'🔄 Recent jobs',         cmd:'show recent jobs' },
  { label:'📦 Job templates',       cmd:'list job templates' },
  { label:'🔧 Restart haproxy',     cmd:'restart haproxy service' },
  { label:'💾 Check disk space',    cmd:'check disk space on all servers' },
]

// ── Extract job ID from launch response ───────────────────
function extractJobId(content) {
  const match = content.match(/Job ID:\s*(\d+)/)
  return match ? parseInt(match[1]) : null
}

// ── Main component ─────────────────────────────────────────
export default function NocAI({ api = '' }) {
  const [messages,  setMessages]  = useState([{
    id:0, role:'assistant', tool:null, sources:0, time:now(),
    error:false, jobId:null,
    content:'👋 Hello! I\'m Gruve NOC AI.\n\nI combine network knowledge with live automation — ask me anything about your Meraki network, or give me a command to run in AAP.\n\n💬 Questions:  "why is haproxy down?" · "how do I check SNMP traps?"\n⚡ Actions:    "list all hosts" · "patch haproxy" · "check disk space"'
  }])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [ctx,       setCtx]       = useState({ job_templates:[], inventories:[], hosts:[] })
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    fetch(`${api}/api/v1/ai/context`)
      .then(r => r.json())
      .then(d => { setCtx(d); setConnected(true) })
      .catch(() => setConnected(false))
  }, [api])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior:'smooth' })
  }, [messages, loading])

  async function send(text) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, {
      id:Date.now(), role:'user', tool:null, sources:0,
      time:now(), error:false, jobId:null, content:msg
    }])
    setLoading(true)
    try {
      const resp = await fetch(`${api}/api/v1/ai/chat`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ message: msg })
      })
      const d = await resp.json()

      // Extract job ID — detect by tool name OR by "Job launched!" in content
      const isLaunch = d.tool === 'job_templates_launch_create' ||
                       d.tool === 'workflow_job_templates_launch_create' ||
                       d.tool === 'jobs_relaunch_create' ||
                       (d.content || '').includes('Job launched!')
      const jobId = isLaunch ? extractJobId(d.content || '') : null

      setMessages(prev => [...prev, {
        id:       Date.now()+1,
        role:     'assistant',
        tool:     d.tool    || null,
        sources:  d.sources_used || 0,
        time:     now(),
        error:    d.type === 'error',
        jobId:    jobId,
        content:  d.content || 'No response received.'
      }])
    } catch(e) {
      setMessages(prev => [...prev, {
        id:Date.now()+1, role:'assistant', tool:null, sources:0,
        time:now(), error:true, jobId:null,
        content:`Could not reach the NOC backend: ${e.message}`
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* Sidebar */}
      <div style={{ width:220, minWidth:220, background:'var(--bg-surface)',
        borderRight:'1px solid var(--bg-border)',
        display:'flex', flexDirection:'column', flexShrink:0 }}>

        <div style={{ padding:'16px', borderBottom:'1px solid var(--bg-border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:6, flexShrink:0,
              background:'linear-gradient(135deg,var(--gruve-green),#0088cc)',
              display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Bot size={15} color="#000"/>
            </div>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>
                Gruve NOC AI
              </div>
              <div style={{ fontSize:10, display:'flex', alignItems:'center', gap:4,
                color: connected ? 'var(--gruve-green)' : 'var(--status-warning)' }}>
                <div style={{ width:5, height:5, borderRadius:'50%',
                  background: connected ? 'var(--gruve-green)' : 'var(--status-warning)' }}/>
                {connected ? 'AAP + RAG ready' : 'Connecting…'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'14px 12px' }}>
          <ResourceList title="📦 Job Templates" items={ctx.job_templates||[]} color="var(--gruve-green)"/>
          <ResourceList title="🖥 Hosts"         items={ctx.hosts||[]}         color="#60a5fa"/>
          <ResourceList title="📁 Inventories"   items={ctx.inventories||[]}   color="#a78bfa"/>
        </div>

        <div style={{ padding:'12px', borderTop:'1px solid var(--bg-border)' }}>
          <div style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)',
            textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
            Quick Commands
          </div>
          {QUICK.map((q,i) => (
            <button key={i} onClick={() => send(q.cmd)} disabled={loading}
              onMouseEnter={e => { e.target.style.background='var(--gruve-green-glow)'; e.target.style.color='var(--gruve-green)' }}
              onMouseLeave={e => { e.target.style.background='var(--bg-elevated)'; e.target.style.color='var(--text-secondary)' }}
              style={{ width:'100%', textAlign:'left', background:'var(--bg-elevated)',
                border:'1px solid var(--bg-border)', borderRadius:6,
                color:'var(--text-secondary)', fontSize:11, padding:'5px 8px',
                marginBottom:4, cursor:loading?'not-allowed':'pointer', transition:'all 0.15s' }}>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex:1, display:'flex', flexDirection:'column',
        overflow:'hidden', background:'var(--bg-base)' }}>

        <div style={{ padding:'14px 20px', background:'var(--bg-surface)',
          borderBottom:'1px solid var(--bg-border)',
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>
              Gruve NOC AI
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>
              Meraki RAG · Ansible MCP · {ctx.job_templates?.length||0} templates · {ctx.hosts?.length||0} hosts
            </div>
          </div>
          <button onClick={() => setMessages(m => [m[0]])}
            style={{ background:'var(--bg-elevated)', border:'1px solid var(--bg-border)',
              borderRadius:6, color:'var(--text-secondary)', fontSize:11,
              padding:'5px 10px', cursor:'pointer' }}>
            Clear
          </button>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:20 }}>
          {messages.map(m => <Bubble key={m.id} msg={m} api={api}/>)}
          {loading && <Thinking/>}
          <div ref={bottomRef}/>
        </div>

        <div style={{ padding:'14px 20px', background:'var(--bg-surface)',
          borderTop:'1px solid var(--bg-border)' }}>
          <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
            <textarea ref={inputRef} value={input} rows={2}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }}
              disabled={loading}
              placeholder="Ask anything or give a command... (Enter to send)"
              onFocus={e => e.target.style.borderColor='var(--gruve-green)'}
              onBlur={e  => e.target.style.borderColor='var(--bg-border)'}
              style={{ flex:1, minHeight:44, maxHeight:120, resize:'none',
                background:'var(--bg-elevated)', border:'1px solid var(--bg-border)',
                borderRadius:10, color:'var(--text-primary)', fontSize:13,
                padding:'10px 14px', outline:'none', fontFamily:'inherit',
                lineHeight:1.5, transition:'border-color 0.15s' }}/>
            <button onClick={() => send()} disabled={loading||!input.trim()}
              className="btn btn-primary"
              style={{ padding:'10px 16px', alignSelf:'flex-end',
                opacity: loading||!input.trim() ? 0.4 : 1 }}>
              <Send size={14}/>
            </button>
          </div>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:6 }}>
            💬 Ask questions · ⚡ Execute automation · 📊 Live job tracking
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp  { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes aiPulse { 0%,100%{opacity:0.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }
      `}</style>
    </div>
  )
}
