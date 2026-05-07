// SetupModal.jsx — Complete file
// Location: frontend/src/components/SetupModal.jsx

import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_BASE_URL || "";

const RUN_AS_STYLE = {
  "root on VM":          { bg: "#FEF3C7", color: "#92400E", border: "#FDE68A" },
  "bastion":             { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" },
  "Administrator on VM": { bg: "#FFF1F2", color: "#BE123C", border: "#FECDD3" },
};

export default function SetupModal({ integration, onClose }) {
  const [activeStep, setActiveStep] = useState(0);
  const [setup, setSetup]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [aapStatus, setAapStatus]   = useState(null);
  const [aapResult, setAapResult]   = useState(null);
  const [copied, setCopied]         = useState({});

  const isVM = integration && ["linux_vm", "windows_vm"].includes(integration.tool_id);

  // Load setup steps
  useEffect(() => {
    if (!integration) return;
    setLoading(true);
    fetch(`${API}/api/v1/integrations/${integration.id}/setup-script`)
      .then(r => r.json())
      .then(d => { setSetup(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [integration]);

  // Auto-register in AAP
  useEffect(() => {
    if (!integration || !isVM) return;
    setAapStatus("loading");
    fetch(`${API}/api/v1/integrations/${integration.id}/register-aap`, { method: "POST" })
      .then(r => r.json())
      .then(d => { setAapResult(d); setAapStatus(d.status === "success" || d.status === "skipped" ? "success" : "error"); })
      .catch(() => setAapStatus("error"));
  }, [integration]);

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(p => ({ ...p, [key]: true }));
    setTimeout(() => setCopied(p => ({ ...p, [key]: false })), 2000);
  };

  if (!integration) return null;

  const totalTabs = isVM && setup ? setup.steps.length + 1 : 0; // +1 for AAP tab

  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.5)", backdropFilter:"blur(4px)",
               display:"flex", alignItems:"center", justifyContent:"center", zIndex:1100, padding:"20px" }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .sm-copy:hover { opacity:.85 !important; }
        .sm-tab:hover  { color: #374151 !important; }
        .sm-nav:hover  { background: #F9FAFB !important; }
      `}</style>

      <div style={{ background:"#fff", borderRadius:"16px", width:"100%", maxWidth:"780px",
                    maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column",
                    boxShadow:"0 24px 64px rgba(0,0,0,.25)" }}>

        {/* ── Header ── */}
        <div style={{ padding:"20px 28px 0", borderBottom:"1px solid #E5E7EB",
                      display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" }}>
              <span style={{ background:"#DCFCE7", color:"#15803D", fontSize:"11px",
                             fontWeight:"700", padding:"2px 10px", borderRadius:"20px" }}>
                ✓ Integration Added
              </span>
              <span style={{ fontSize:"12px", color:"#6B7280" }}>
                {integration.name} · {integration.tool_id}
              </span>
            </div>
            <h2 style={{ fontSize:"18px", fontWeight:"700", color:"#111827", margin:"0 0 14px" }}>
              {isVM ? "VM Setup Instructions" : "Integration Ready"}
            </h2>

            {/* Step tabs */}
            {isVM && setup && (
              <div style={{ display:"flex", gap:0, overflowX:"auto" }}>
                {setup.steps.map((s, i) => (
                  <button key={i} className="sm-tab"
                    onClick={() => setActiveStep(i)}
                    style={{ padding:"8px 14px", fontSize:"12px", whiteSpace:"nowrap",
                             fontWeight: activeStep===i ? "600":"400",
                             color: activeStep===i ? "#16A34A":"#6B7280",
                             background:"none", border:"none", cursor:"pointer",
                             borderBottom: activeStep===i ? "2px solid #16A34A":"2px solid transparent",
                             marginBottom:"-1px", fontFamily:"inherit" }}
                  >
                    Step {i} — {s.title}
                  </button>
                ))}
                <button className="sm-tab"
                  onClick={() => setActiveStep(setup.steps.length)}
                  style={{ padding:"8px 14px", fontSize:"12px", whiteSpace:"nowrap",
                           fontWeight: activeStep===setup.steps.length ? "600":"400",
                           color: activeStep===setup.steps.length ? "#16A34A":"#6B7280",
                           background:"none", border:"none", cursor:"pointer",
                           borderBottom: activeStep===setup.steps.length ? "2px solid #16A34A":"2px solid transparent",
                           marginBottom:"-1px", fontFamily:"inherit" }}
                >
                  AAP Registration
                </button>
              </div>
            )}
          </div>
          <button onClick={onClose}
            style={{ background:"none", border:"none", cursor:"pointer",
                     fontSize:"22px", color:"#9CA3AF", padding:"2px 8px", lineHeight:1, marginTop:"4px" }}>
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ padding:"24px 28px", overflowY:"auto", flex:1 }}>

          {loading && (
            <div style={{ textAlign:"center", padding:"40px", color:"#9CA3AF" }}>
              Generating setup instructions…
            </div>
          )}

          {/* Non-VM integration — just show webhook URL */}
          {!loading && !isVM && (
            <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0",
                          borderRadius:"12px", padding:"24px", textAlign:"center" }}>
              <div style={{ fontSize:"40px", marginBottom:"10px" }}>✓</div>
              <div style={{ fontSize:"16px", fontWeight:"700", color:"#15803D", marginBottom:"6px" }}>
                {integration.name} registered successfully
              </div>
              <div style={{ fontSize:"13px", color:"#4B7A57", marginBottom:"20px" }}>
                Configure the webhook URL in {integration.name} to receive real-time events in Gruve NOC.
              </div>
              {integration.webhook_url && (
                <div style={{ background:"#fff", border:"1px solid #BBF7D0", borderRadius:"8px",
                              padding:"14px 18px", display:"flex", alignItems:"center",
                              gap:"12px", justifyContent:"space-between", maxWidth:"600px", margin:"0 auto" }}>
                  <code style={{ fontSize:"13px", color:"#166534", fontFamily:"monospace", wordBreak:"break-all", textAlign:"left" }}>
                    {window.location.origin}{integration.webhook_url}
                  </code>
                  <button className="sm-copy"
                    onClick={() => copy(window.location.origin + integration.webhook_url, "wh")}
                    style={{ background:"#16A34A", color:"#fff", border:"none", borderRadius:"6px",
                             padding:"6px 16px", fontSize:"12px", cursor:"pointer",
                             fontFamily:"inherit", fontWeight:"600", flexShrink:0 }}>
                    {copied.wh ? "Copied!" : "Copy"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VM step panels */}
          {!loading && isVM && setup && activeStep < setup.steps.length && (
            <StepPanel step={setup.steps[activeStep]} copied={copied} onCopy={copy} />
          )}

          {/* AAP Registration panel */}
          {!loading && isVM && setup && activeStep === setup.steps.length && (
            <AapPanel status={aapStatus} result={aapResult} integration={integration} />
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ padding:"16px 28px", borderTop:"1px solid #E5E7EB",
                      display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontSize:"12px", color:"#9CA3AF" }}>
            {isVM && setup ? `Step ${activeStep} of ${setup.steps.length}` : "Integration registered"}
          </div>
          <div style={{ display:"flex", gap:"10px" }}>
            {isVM && setup && activeStep > 0 && (
              <button className="sm-nav"
                onClick={() => setActiveStep(p => p - 1)}
                style={{ background:"#fff", color:"#374151", border:"1px solid #D1D5DB",
                         borderRadius:"7px", padding:"9px 20px", fontSize:"13px",
                         cursor:"pointer", fontFamily:"inherit" }}>
                ← Back
              </button>
            )}
            {isVM && setup && activeStep < totalTabs - 1 && (
              <button onClick={() => setActiveStep(p => p + 1)}
                style={{ background:"#16A34A", color:"#fff", border:"none",
                         borderRadius:"7px", padding:"9px 20px", fontSize:"13px",
                         fontWeight:"600", cursor:"pointer", fontFamily:"inherit" }}>
                {activeStep === setup.steps.length - 1 ? "View AAP Status →" : "Next →"}
              </button>
            )}
            {(!isVM || !setup || activeStep === totalTabs - 1) && (
              <button onClick={onClose}
                style={{ background:"#16A34A", color:"#fff", border:"none",
                         borderRadius:"7px", padding:"9px 20px", fontSize:"13px",
                         fontWeight:"600", cursor:"pointer", fontFamily:"inherit" }}>
                Done ✓
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step Panel ────────────────────────────────────────────────────────────────
function StepPanel({ step, copied, onCopy }) {
  const rs = RUN_AS_STYLE[step.run_as] || RUN_AS_STYLE["bastion"];
  return (
    <div>
      <div style={{ marginBottom:"16px" }}>
        <h3 style={{ fontSize:"15px", fontWeight:"700", color:"#111827", margin:"0 0 6px" }}>
          {step.title}
        </h3>
        <span style={{ display:"inline-block", fontSize:"11px", fontWeight:"700",
                       padding:"3px 12px", borderRadius:"20px",
                       background: rs.bg, color: rs.color, border:`1px solid ${rs.border}` }}>
          Run as: {step.run_as}
        </span>
      </div>

      <div style={{ position:"relative" }}>
        <div style={{ background:"#0F172A", borderRadius:"10px", padding:"20px",
                      maxHeight:"440px", overflowY:"auto" }}>
          <pre style={{ margin:0, fontSize:"12px", color:"#E2E8F0", lineHeight:"1.7",
                        fontFamily:"'JetBrains Mono','Fira Code','Courier New',monospace",
                        whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
            {step.command}
          </pre>
        </div>
        <button className="sm-copy"
          onClick={() => onCopy(step.command, `s${step.step}`)}
          style={{ position:"absolute", top:"12px", right:"12px",
                   background: copied[`s${step.step}`] ? "#16A34A" : "rgba(255,255,255,.12)",
                   color:"#fff", border:"none", borderRadius:"6px",
                   padding:"5px 14px", fontSize:"11px", fontWeight:"600",
                   cursor:"pointer", fontFamily:"inherit", transition:"background .15s" }}>
          {copied[`s${step.step}`] ? "✓ Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ── AAP Panel ─────────────────────────────────────────────────────────────────
function AapPanel({ status, result, integration }) {
  return (
    <div>
      <h3 style={{ fontSize:"15px", fontWeight:"700", color:"#111827", margin:"0 0 6px" }}>
        AAP Inventory Registration
      </h3>
      <p style={{ fontSize:"13px", color:"#6B7280", margin:"0 0 20px", lineHeight:"1.6" }}>
        Automatically adds this VM to the <strong>NJ-Infrastructure</strong> inventory in Ansible
        Automation Platform so remediation playbooks can SSH in and fix services.
      </p>

      {status === "loading" && (
        <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:"10px",
                      padding:"20px", display:"flex", alignItems:"center", gap:"12px" }}>
          <div style={{ width:"20px", height:"20px", border:"2px solid #3B82F6",
                        borderTopColor:"transparent", borderRadius:"50%",
                        animation:"spin .8s linear infinite", flexShrink:0 }}/>
          <span style={{ fontSize:"13px", color:"#1D4ED8" }}>Registering in AAP…</span>
        </div>
      )}

      {status === "success" && result && (
        <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:"10px", padding:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}>
            <span style={{ fontSize:"28px" }}>✓</span>
            <div>
              <div style={{ fontSize:"14px", fontWeight:"700", color:"#15803D" }}>
                {result.action === "created" ? "Host registered in AAP" : "Host updated in AAP"}
              </div>
              <div style={{ fontSize:"12px", color:"#4B7A57", marginTop:"2px" }}>{result.message}</div>
            </div>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px", marginBottom:"14px" }}>
            {[["Host Name", result.name], ["Host IP", result.host],
              ["Inventory", result.aap_inventory || "NJ-Infrastructure"],
              ["AAP Host ID", result.aap_host_id]
            ].map(([label, value]) => (
              <div key={label} style={{ background:"#fff", border:"1px solid #BBF7D0",
                                        borderRadius:"8px", padding:"10px 14px" }}>
                <div style={{ fontSize:"10px", fontWeight:"700", color:"#4B7A57",
                              textTransform:"uppercase", letterSpacing:"0.5px" }}>{label}</div>
                <div style={{ fontSize:"13px", color:"#111827", marginTop:"3px", fontFamily:"monospace" }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ background:"#fff", border:"1px solid #BBF7D0",
                        borderRadius:"8px", padding:"14px 16px" }}>
            <div style={{ fontSize:"11px", fontWeight:"700", color:"#4B7A57",
                          textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"8px" }}>
              What this means
            </div>
            <div style={{ fontSize:"12px", color:"#374151", lineHeight:"1.8" }}>
              ✓ AAP can SSH into this VM using the shared ansible key<br/>
              ✓ <code style={{ background:"#F0FDF4", padding:"1px 5px", borderRadius:"3px", fontFamily:"monospace" }}>vm-service-restart</code> playbook will target this host<br/>
              ✓ All future playbooks targeting NJ-Infrastructure will include this VM<br/>
              ✓ Host variables include configured service list for targeted restarts<br/>
              ✓ One credential (HAProxy-SSH) manages all Linux VMs
            </div>
          </div>
        </div>
      )}

      {status === "error" && (
        <div style={{ background:"#FFF1F2", border:"1px solid #FECACA",
                      borderRadius:"10px", padding:"20px" }}>
          <div style={{ fontSize:"14px", fontWeight:"700", color:"#DC2626", marginBottom:"10px" }}>
            ✗ AAP Registration Failed
          </div>
          <div style={{ fontSize:"13px", color:"#7F1D1D", lineHeight:"1.6", marginBottom:"14px" }}>
            Could not automatically register in AAP. Add it manually:
          </div>
          <div style={{ background:"#0F172A", borderRadius:"8px", padding:"16px" }}>
            <pre style={{ margin:0, fontSize:"12px", color:"#E2E8F0",
                          fontFamily:"monospace", lineHeight:"1.6" }}>
{`# AAP → Inventories → NJ-Infrastructure → Hosts → Add
Name: ${integration.name}
Variables:
  ansible_host: ${integration.credentials?.host || "YOUR_VM_IP"}
  ansible_user: ansible
  ansible_connection: ssh`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
