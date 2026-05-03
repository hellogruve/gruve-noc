import { useState, useEffect, useRef } from 'react'
import { Send, Bot, User, Loader, Terminal, BookOpen } from 'lucide-react'

const now = () => new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })

// ── Message bubble ─────────────────────────────────────────
function Bubble({ msg }) {
  const isUser = msg.role === 'user'
  return (
    <div style={{ display:'flex', gap:10,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems:'flex-start', marginBottom:16,
      animation:'fadeUp 0.2s ease' }}>

      <div style={{ width:30, height:30, borderRadius:8, flexShrink:0,
        background: isUser ? 'var(--gruve-green)' : 'var(--bg-elevated)',
        border:'1px solid var(--bg-border)',
        display:'flex', alignItems:'center', justifyContent:'center' }}>
        {isUser
          ? <User size={14} color="#000"/>
          : <Bot  size={14} color="var(--gruve-green)"/>}
      </div>

      <div style={{ maxWidth:'78%', display:'flex', flexDirection:'column',
        alignItems: isUser ? 'flex-end' : 'flex-start' }}>

        {/* Tool badge */}
        {msg.tool && (
          <div style={{ display:'flex', alignItems:'center', gap:5,
            marginBottom:5, fontSize:11, color:'var(--gruve-green)',
            background:'var(--gruve-green-glow)',
            border:'1px solid rgba(0,212,170,0.25)',
            borderRadius:4, padding:'2px 8px', fontFamily:'monospace' }}>
            <Terminal size={10}/> {msg.tool.replace(/_/g,' ')}
          </div>
        )}

        {/* Sources badge */}
        {msg.sources > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:5,
            marginBottom:5, fontSize:11, color:'#a78bfa',
            background:'rgba(167,139,250,0.1)',
            border:'1px solid rgba(167,139,250,0.25)',
            borderRadius:4, padding:'2px 8px' }}>
            <BookOpen size={10}/> {msg.sources} KB source{msg.sources!==1?'s':''}
          </div>
        )}

        <div style={{
          padding:'10px 14px',
          borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
          background: isUser ? 'var(--gruve-green-glow)' : 'var(--bg-elevated)',
          border:'1px solid var(--bg-border)',
          fontSize:13, lineHeight:1.7,
          color: msg.error ? 'var(--status-critical)' : 'var(--text-primary)',
          whiteSpace:'pre-wrap', wordBreak:'break-word'
        }}>
          {msg.content}
        </div>
        <span style={{ fontSize:10, color:'var(--text-muted)', marginTop:4 }}>{msg.time}</span>
      </div>
    </div>
  )
}

// ── Thinking indicator ─────────────────────────────────────
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

// ── Sidebar resource list ──────────────────────────────────
function ResourceList({ title, icon: Icon, items, color }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ marginBottom:16 }}>
      <div onClick={() => setOpen(o=>!o)} style={{ display:'flex',
        justifyContent:'space-between', alignItems:'center',
        cursor:'pointer', padding:'6px 0',
        borderBottom:'1px solid var(--bg-border)' }}>
        <span style={{ display:'flex', alignItems:'center', gap:5,
          fontSize:11, fontWeight:600, color:'var(--text-muted)',
          textTransform:'uppercase', letterSpacing:'0.08em' }}>
          <Icon size={11}/> {title}
        </span>
        <span style={{ fontSize:10, color:'var(--text-muted)' }}>{open?'▾':'▸'}</span>
      </div>
      {open && (
        <div style={{ paddingTop:6 }}>
          {items.length === 0
            ? <div style={{ fontSize:11, color:'var(--text-muted)', padding:'4px 0' }}>Loading…</div>
            : items.map(item => (
              <div key={item.id} style={{ display:'flex', alignItems:'center',
                gap:6, padding:'3px 0', fontSize:12, color:'var(--text-secondary)' }}>
                <span style={{ fontSize:10, color: color||'var(--gruve-green)',
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
  // Questions
  { label:'❓ Why is device down?',    cmd:'explain why a device might go down on Meraki' },
  { label:'📊 Network health',         cmd:'what is the current network health status' },
  // Actions
  { label:'🖥 List hosts',             cmd:'list all hosts' },
  { label:'🔄 Recent jobs',            cmd:'show recent jobs' },
  { label:'🔧 Restart haproxy',        cmd:'restart haproxy service' },
  { label:'📡 Ping all hosts',         cmd:'ping all hosts' },
  { label:'💾 Check disk space',       cmd:'check disk space on all servers' },
  { label:'📦 Job templates',          cmd:'list job templates' },
]

// ── Main component ─────────────────────────────────────────
export default function NocAI({ api = '' }) {
  const [messages,  setMessages]  = useState([{
    id:0, role:'assistant', tool:null, sources:0, time:now(), error:false,
    content:'👋 Hello! I\'m Gruve NOC AI.\n\nI combine network knowledge with live automation — ask me anything about your Meraki network, or tell me to take action in AAP.\n\n💬 Questions:  "why is haproxy down?" · "how do I check SNMP traps?"\n⚡ Actions:    "list all hosts" · "patch haproxy" · "show recent jobs"'
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
      id:Date.now(), role:'user', tool:null, sources:0, time:now(), error:false, content:msg
    }])
    setLoading(true)
    try {
      const resp = await fetch(`${api}/api/v1/ai/chat`, {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ message: msg })
      })
      const d = await resp.json()
      setMessages(prev => [...prev, {
        id:Date.now()+1, role:'assistant',
        tool:     d.tool    || null,
        sources:  d.sources_used || 0,
        time:     now(),
        error:    d.type === 'error',
        content:  d.content || 'No response received.'
      }])
    } catch(e) {
      setMessages(prev => [...prev, {
        id:Date.now()+1, role:'assistant', tool:null, sources:0,
        time:now(), error:true,
        content:`Could not reach the NOC backend: ${e.message}`
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div style={{ display:'flex', height:'100%', overflow:'hidden' }}>

      {/* ── Sidebar ── */}
      <div style={{ width:220, minWidth:220, background:'var(--bg-surface)',
        borderRight:'1px solid var(--bg-border)',
        display:'flex', flexDirection:'column', flexShrink:0 }}>

        {/* Header */}
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

        {/* AAP Resources */}
        <div style={{ flex:1, overflowY:'auto', padding:'14px 12px' }}>
          <ResourceList title="Job Templates" icon={Terminal}   items={ctx.job_templates||[]} color="var(--gruve-green)"/>
          <ResourceList title="Hosts"         icon={Terminal}   items={ctx.hosts||[]}         color="#60a5fa"/>
          <ResourceList title="Inventories"   icon={Terminal}   items={ctx.inventories||[]}   color="#a78bfa"/>
        </div>

        {/* Quick commands */}
        <div style={{ padding:'12px', borderTop:'1px solid var(--bg-border)' }}>
          <div style={{ fontSize:10, fontWeight:600, color:'var(--text-muted)',
            textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
            Quick Commands
          </div>
          {QUICK.map((q,i) => (
            <button key={i} onClick={() => send(q.cmd)} disabled={loading}
              onMouseEnter={e => {
                e.target.style.background='var(--gruve-green-glow)'
                e.target.style.color='var(--gruve-green)'
              }}
              onMouseLeave={e => {
                e.target.style.background='var(--bg-elevated)'
                e.target.style.color='var(--text-secondary)'
              }}
              style={{ width:'100%', textAlign:'left', background:'var(--bg-elevated)',
                border:'1px solid var(--bg-border)', borderRadius:6,
                color:'var(--text-secondary)', fontSize:11, padding:'5px 8px',
                marginBottom:4, cursor:loading?'not-allowed':'pointer',
                transition:'all 0.15s' }}>
              {q.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat area ── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column',
        overflow:'hidden', background:'var(--bg-base)' }}>

        {/* Header bar */}
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

        {/* Messages */}
        <div style={{ flex:1, overflowY:'auto', padding:20 }}>
          {messages.map(m => <Bubble key={m.id} msg={m}/>)}
          {loading && <Thinking/>}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <div style={{ padding:'14px 20px', background:'var(--bg-surface)',
          borderTop:'1px solid var(--bg-border)' }}>
          <div style={{ display:'flex', gap:10, alignItems:'flex-end' }}>
            <textarea ref={inputRef} value={input} rows={2}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()} }}
              disabled={loading}
              placeholder="Ask anything or give a command... (Enter to send, Shift+Enter for new line)"
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
            💬 Ask questions · ⚡ Execute automation · 📚 Searches knowledge base automatically
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  )
}
