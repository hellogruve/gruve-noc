import { useState, useEffect, useRef } from 'react'

function ToolBadge({ name }) {
  if (!name) return null
  return (
    <span style={{
      display:'inline-block', background:'rgba(0,212,170,0.15)', color:'var(--gruve-green)',
      border:'1px solid rgba(0,212,170,0.3)', borderRadius:4, padding:'1px 8px',
      fontSize:11, fontFamily:'monospace', marginBottom:6
    }}>
      ⚙ {name.replace(/_/g,' ')}
    </span>
  )
}

function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display:'flex', justifyContent:isUser?'flex-end':'flex-start',
      marginBottom:16, animation:'fadeInUp 0.2s ease' }}>
      {!isUser && (
        <div style={{ width:30, height:30, borderRadius:'50%', flexShrink:0, marginRight:10,
          marginTop:2, background:'linear-gradient(135deg,var(--gruve-green),#0088cc)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🤖</div>
      )}
      <div style={{ maxWidth:'78%', display:'flex', flexDirection:'column',
        alignItems:isUser?'flex-end':'flex-start' }}>
        {msg.tool && <ToolBadge name={msg.tool}/>}
        <div style={{
          background: isUser ? 'linear-gradient(135deg,var(--gruve-green),#00b894)' : 'var(--bg-elevated)',
          color: isUser ? '#0a0e1a' : 'var(--text-primary)',
          padding:'10px 14px',
          borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          border: isUser ? 'none' : '1px solid var(--bg-border)',
          fontSize:13, lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word'
        }}>{msg.content}</div>
        <span style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>{msg.time}</span>
      </div>
      {isUser && (
        <div style={{ width:30, height:30, borderRadius:'50%', flexShrink:0, marginLeft:10,
          marginTop:2, background:'var(--bg-elevated)', border:'1px solid var(--bg-border)',
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>👤</div>
      )}
    </div>
  )
}

function Thinking() {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
      <div style={{ width:30, height:30, borderRadius:'50%', flexShrink:0,
        background:'linear-gradient(135deg,var(--gruve-green),#0088cc)',
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>🤖</div>
      <div style={{ background:'var(--bg-elevated)', border:'1px solid var(--bg-border)',
        borderRadius:'4px 16px 16px 16px', padding:'12px 16px',
        display:'flex', gap:5, alignItems:'center' }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width:7, height:7, borderRadius:'50%',
            background:'var(--gruve-green)',
            animation:`mcpPulse 1.2s ease-in-out ${i*0.2}s infinite` }}/>
        ))}
      </div>
    </div>
  )
}

function ResourceSection({ title, icon, items, color }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ marginBottom:16 }}>
      <div onClick={() => setOpen(o=>!o)} style={{ display:'flex',
        justifyContent:'space-between', alignItems:'center', cursor:'pointer',
        padding:'6px 0', borderBottom:'1px solid var(--bg-border)' }}>
        <span style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)',
          textTransform:'uppercase', letterSpacing:'0.08em' }}>{icon} {title}</span>
        <span style={{ fontSize:10, color:'var(--text-muted)' }}>{open?'▾':'▸'}</span>
      </div>
      {open && (
        <div style={{ paddingTop:6 }}>
          {items.length === 0
            ? <div style={{ fontSize:11, color:'var(--text-muted)', padding:'4px 0' }}>Loading…</div>
            : items.map(item => (
              <div key={item.id} style={{ display:'flex', alignItems:'center',
                gap:6, padding:'4px 0', fontSize:12, color:'var(--text-secondary)' }}>
                <span style={{ fontSize:10, color: color || 'var(--gruve-green)',
                  background:'var(--gruve-green-glow)', borderRadius:3, padding:'1px 5px',
                  fontFamily:'monospace', minWidth:28, textAlign:'center' }}>{item.id}</span>
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {item.name}</span>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

const QUICK = [
  { label:'📋 List hosts',       cmd:'list all hosts' },
  { label:'🔄 Recent jobs',      cmd:'show recent jobs' },
  { label:'📦 Job templates',    cmd:'list job templates' },
  { label:'🔧 Restart haproxy',  cmd:'restart haproxy service' },
  { label:'💾 Check disk space', cmd:'check disk space on all servers' },
  { label:'📡 Ping all hosts',   cmd:'ping all hosts' },
]

const now = () => new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })

export default function OpsConsole({ api = '' }) {
  const [messages,  setMessages]  = useState([{
    id:0, role:'assistant', tool:null, time:now(),
    content:'👋 Hello! I\'m the Ops Console powered by Ansible MCP.\n\nI can run job templates, check hosts, launch patches, and execute automation workflows — just ask in plain English.\n\nTry: "list all hosts" or "show recent jobs"'
  }])
  const [input,     setInput]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [ctx,       setCtx]       = useState({ job_templates:[], inventories:[], hosts:[] })
  const [connected, setConnected] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    fetch(`${api}/api/v1/ops/context`)
      .then(r => r.json())
      .then(d => { setCtx(d); setConnected(true) })
      .catch(() => setConnected(false))
  }, [api])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }) }, [messages, loading])

  async function send(text) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    setMessages(prev => [...prev, { id:Date.now(), role:'user', tool:null, time:now(), content:msg }])
    setLoading(true)
    try {
      const resp = await fetch(`${api}/api/v1/ops/chat`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ message: msg })
      })
      const data = await resp.json()
      setMessages(prev => [...prev, {
        id:Date.now()+1, role:'assistant',
        tool:data.tool || null, time:now(),
        content: data.content || 'No response received.'
      }])
    } catch(e) {
      setMessages(prev => [...prev, {
        id:Date.now()+1, role:'assistant', tool:null, time:now(),
        content:`❌ Connection error: ${e.message}`
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
        borderRight:'1px solid var(--bg-border)', display:'flex', flexDirection:'column' }}>

        <div style={{ padding:'16px', borderBottom:'1px solid var(--bg-border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ width:28, height:28, borderRadius:6, flexShrink:0,
              background:'linear-gradient(135deg,var(--gruve-green),#0088cc)',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>⚡</div>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>Ops Console</div>
              <div style={{ fontSize:10, display:'flex', alignItems:'center', gap:4,
                color: connected ? 'var(--gruve-green)' : 'var(--status-warning)' }}>
                <div style={{ width:5, height:5, borderRadius:'50%',
                  background: connected ? 'var(--gruve-green)' : 'var(--status-warning)' }}/>
                {connected ? 'AAP Connected' : 'Connecting…'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'14px 12px' }}>
          <ResourceSection title="Job Templates" icon="📦" items={ctx.job_templates||[]} color="var(--gruve-green)"/>
          <ResourceSection title="Hosts"         icon="🖥"  items={ctx.hosts||[]}         color="#60a5fa"/>
          <ResourceSection title="Inventories"   icon="📁" items={ctx.inventories||[]}   color="#a78bfa"/>
        </div>

        <div style={{ padding:'12px', borderTop:'1px solid var(--bg-border)' }}>
          <div style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)',
            textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>Quick Commands</div>
          {QUICK.map((q,i) => (
            <button key={i} onClick={() => send(q.cmd)} disabled={loading}
              style={{ width:'100%', textAlign:'left', background:'var(--bg-elevated)',
                border:'1px solid var(--bg-border)', borderRadius:6,
                color:'var(--text-secondary)', fontSize:11, padding:'5px 8px',
                marginBottom:4, cursor:loading?'not-allowed':'pointer', transition:'all 0.15s' }}
              onMouseEnter={e => { e.target.style.background='var(--gruve-green-glow)'; e.target.style.color='var(--gruve-green)' }}
              onMouseLeave={e => { e.target.style.background='var(--bg-elevated)'; e.target.style.color='var(--text-secondary)' }}
            >{q.label}</button>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--bg-base)' }}>

        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--bg-border)',
          display:'flex', justifyContent:'space-between', alignItems:'center',
          background:'var(--bg-surface)' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:600, color:'var(--text-primary)' }}>
              Ansible Automation Agent
            </div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>
              Qwen 2.5-7B · Ansible MCP · {ctx.job_templates?.length||0} templates · {ctx.hosts?.length||0} hosts
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
          {messages.map(m => <Bubble key={m.id} msg={m}/>)}
          {loading && <Thinking/>}
          <div ref={bottomRef}/>
        </div>

        <div style={{ padding:'14px 20px', borderTop:'1px solid var(--bg-border)',
          background:'var(--bg-surface)' }}>
          <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
            <textarea ref={inputRef} value={input} rows={2}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }}
              disabled={loading}
              placeholder="e.g. patch my haproxy server  /  list all hosts  /  show recent jobs"
              onFocus={e => e.target.style.borderColor='var(--gruve-green)'}
              onBlur={e  => e.target.style.borderColor='var(--bg-border)'}
              style={{ flex:1, background:'var(--bg-elevated)', border:'1px solid var(--bg-border)',
                borderRadius:10, color:'var(--text-primary)', fontSize:13, padding:'10px 14px',
                resize:'none', outline:'none', fontFamily:'inherit', lineHeight:1.5,
                transition:'border-color 0.15s' }}/>
            <button onClick={() => send()} disabled={loading||!input.trim()}
              style={{ background: loading||!input.trim() ? 'var(--bg-elevated)' : 'var(--gruve-green)',
                border:'none', borderRadius:10,
                color: loading||!input.trim() ? 'var(--text-muted)' : '#0a0e1a',
                fontWeight:700, fontSize:13, padding:'10px 18px',
                cursor: loading||!input.trim() ? 'not-allowed' : 'pointer',
                transition:'all 0.15s', minWidth:72, height:48 }}>
              {loading ? '…' : 'Send'}
            </button>
          </div>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:6 }}>
            Enter to send · Shift+Enter for new line
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeInUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mcpPulse { 0%,60%,100%{transform:scale(1);opacity:0.4} 30%{transform:scale(1.3);opacity:1} }
      `}</style>
    </div>
  )
}
