import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader } from 'lucide-react'

export default function ChatBot({ api }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hello! I am the Gruve IntelliOps assistant.\nAsk me anything about your Meraki network — device issues, remediation steps, or network health."
    }
  ])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef             = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setMessages(m => [...m, { role:'user', content:text }])
    setInput('')
    setLoading(true)
    try {
      const r = await fetch(`${api}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      })
      const d = await r.json()
      setMessages(m => [...m, {
        role: 'assistant',
        content: d.answer || 'No response received.',
        sources: d.sources_used
      }])
    } catch (e) {
      setMessages(m => [...m, {
        role: 'assistant',
        content: 'Could not reach the NOC backend. Check that the backend service is running.',
        error: true
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', padding:28 }}>
      <div style={{ marginBottom:20 }}>
        <h1 style={{ fontSize:20, fontWeight:600 }}>NOC Chat</h1>
        <p style={{ fontSize:13, color:'var(--text-secondary)', marginTop:3 }}>
          AI-powered assistant — ask about incidents, remediation steps, or network health
        </p>
      </div>

      {/* Messages */}
      <div className="card" style={{
        flex:1, overflow:'auto', padding:16,
        display:'flex', flexDirection:'column', gap:16,
        marginBottom:16
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display:'flex', gap:10,
            flexDirection: msg.role==='user' ? 'row-reverse' : 'row',
            alignItems:'flex-start'
          }}>
            <div style={{
              width:30, height:30, borderRadius:8,
              background: msg.role==='user' ? 'var(--gruve-green)' : 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0
            }}>
              {msg.role==='user'
                ? <User size={14} color="#000"/>
                : <Bot  size={14} color="var(--gruve-green)"/>
              }
            </div>
            <div style={{
              maxWidth:'75%',
              padding:'10px 14px',
              borderRadius: msg.role==='user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
              background: msg.role==='user' ? 'var(--gruve-green-glow)' : 'var(--bg-elevated)',
              border: '1px solid var(--bg-border)',
              fontSize:13, lineHeight:1.7,
              color: msg.error ? 'var(--status-critical)' : 'var(--text-primary)',
              whiteSpace:'pre-wrap'
            }}>
              {msg.content}
              {msg.sources > 0 && (
                <div style={{ marginTop:8, fontSize:10, color:'var(--text-muted)' }}>
                  {msg.sources} knowledge base source{msg.sources!==1?'s':''} used
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <div style={{
              width:30, height:30, borderRadius:8,
              background:'var(--bg-elevated)',
              border:'1px solid var(--bg-border)',
              display:'flex', alignItems:'center', justifyContent:'center'
            }}>
              <Bot size={14} color="var(--gruve-green)"/>
            </div>
            <div style={{
              padding:'10px 14px',
              background:'var(--bg-elevated)',
              border:'1px solid var(--bg-border)',
              borderRadius:'4px 12px 12px 12px',
              display:'flex', alignItems:'center', gap:8
            }}>
              <Loader size={13} color="var(--gruve-green)"
                style={{ animation:'spin 1s linear infinite' }}/>
              <span style={{ fontSize:12, color:'var(--text-secondary)' }}>Thinking...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{ display:'flex', gap:10 }}>
        <textarea
          placeholder="Ask about an incident, device, or remediation step... (Enter to send)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          style={{ flex:1, minHeight:44, maxHeight:120, resize:'none' }}
          rows={1}
        />
        <button
          className="btn btn-primary"
          onClick={send}
          disabled={!input.trim() || loading}
          style={{ padding:'8px 16px', alignSelf:'flex-end' }}
        >
          <Send size={14}/>
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
