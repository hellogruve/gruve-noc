import { useState, useEffect, useCallback } from "react";
import SetupModal from "./SetupModal.jsx";

const API = import.meta.env.VITE_API_BASE_URL || "";

const ICONS = {
  meraki: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#00BCF2" fillOpacity=".15"/>
      <path d="M20 8c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12S26.627 8 20 8zm0 4a8 8 0 110 16 8 8 0 010-16zm0 3a5 5 0 100 10 5 5 0 000-10z" fill="#00BCF2"/>
    </svg>
  ),
  cisco: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#049FD9" fillOpacity=".15"/>
      <path d="M8 22h4v-6H8v6zm6-9h4v12h-4V13zm6-3h4v18h-4V10zm6 3h4v12h-4V13zm-18 9h4v3H8v-3z" fill="#049FD9"/>
    </svg>
  ),
  paloalto: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#FF6B35" fillOpacity=".15"/>
      <path d="M20 8l12 20H8L20 8zm0 6l-7 12h14L20 14z" fill="#FF6B35"/>
    </svg>
  ),
  arista: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#00A4E4" fillOpacity=".15"/>
      <circle cx="20" cy="20" r="8" stroke="#00A4E4" strokeWidth="2.5" fill="none"/>
      <circle cx="20" cy="20" r="3" fill="#00A4E4"/>
    </svg>
  ),
  linux: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#FCC624" fillOpacity=".2"/>
      <path d="M20 6c-3.3 0-6 2.7-6 6v8l-3 4h18l-3-4v-8c0-3.3-2.7-6-6-6zm-2 22h4v2h-4v-2z" fill="#D4A017"/>
    </svg>
  ),
  windows: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#00ADEF" fillOpacity=".15"/>
      <path d="M8 11.5l9.5-1.3V19H8v-7.5zm11.5-1.6L32 8v11h-12.5V9.9zM8 21h9.5v8.5L8 28.2V21zm11.5 8.3V21H32v10.8l-12.5-1.5z" fill="#00ADEF"/>
    </svg>
  ),
  solarwinds: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#F5A623" fillOpacity=".15"/>
      <path d="M20 10c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10S25.5 10 20 10zm3 15l-8-5 8-5v10z" fill="#F5A623"/>
    </svg>
  ),
  prometheus: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#E6522C" fillOpacity=".15"/>
      <circle cx="20" cy="20" r="10" stroke="#E6522C" strokeWidth="2" fill="none"/>
      <path d="M15 25l2.5-5 2.5 3 2.5-7 2.5 9" stroke="#E6522C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    </svg>
  ),
  splunk: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#65A637" fillOpacity=".15"/>
      <path d="M10 15h14l-4 5h10l-14 5 4-5H10l0-5z" fill="#65A637"/>
    </svg>
  ),
  datadog: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#632CA6" fillOpacity=".15"/>
      <path d="M20 10c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10S25.5 10 20 10zm1 14h-2v-6h2v6zm0-8h-2v-2h2v2z" fill="#632CA6"/>
    </svg>
  ),
  netbox: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#9B59B6" fillOpacity=".15"/>
      <rect x="10" y="10" width="8" height="8" rx="2" fill="#9B59B6"/>
      <rect x="22" y="10" width="8" height="8" rx="2" fill="#9B59B6" fillOpacity=".6"/>
      <rect x="10" y="22" width="8" height="8" rx="2" fill="#9B59B6" fillOpacity=".6"/>
      <rect x="22" y="22" width="8" height="8" rx="2" fill="#9B59B6"/>
    </svg>
  ),
  jira: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#0052CC" fillOpacity=".15"/>
      <path d="M20 8l8 12-8 12L12 20 20 8zm0 5l-5 7 5 7 5-7-5-7z" fill="#0052CC"/>
    </svg>
  ),
  snow: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#62D84E" fillOpacity=".15"/>
      <path d="M20 8v24M8 20h24M12 12l16 16M28 12L12 28" stroke="#62D84E" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  ),
  azure: (
    <svg viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="8" fill="#0078D4" fillOpacity=".15"/>
      <path d="M10 28l8-18 6 10-4 2 6 6H10zm20 0l-6-6 3-2-5-8 8 16z" fill="#0078D4"/>
    </svg>
  ),
};

const CAT_STYLES = {
  Network:    { bg: "#EFF9FF", border: "#B8E4F9", text: "#0369A1", dot: "#0EA5E9" },
  VM:         { bg: "#F0FDF4", border: "#BBF7D0", text: "#15803D", dot: "#22C55E" },
  Monitoring: { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E", dot: "#F59E0B" },
  CMDB:       { bg: "#FAF5FF", border: "#E9D5FF", text: "#6D28D9", dot: "#8B5CF6" },
  ITSM:       { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8", dot: "#3B82F6" },
  Security:   { bg: "#FFF1F2", border: "#FECDD3", text: "#BE123C", dot: "#F43F5E" },
};

const HEALTH_META = {
  healthy: { color: "#16A34A", label: "Healthy" },
  down:    { color: "#DC2626", label: "Down"    },
  unknown: { color: "#6B7280", label: "Unknown" },
  degraded:{ color: "#D97706", label: "Degraded"},
};

export default function Integrations() {
  const [view, setView]               = useState("catalogue");
  const [catalogue, setCatalogue]     = useState({});
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [form, setForm]               = useState({ name: "", description: "" });
  const [creds, setCreds]             = useState({});
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState(null);
  const [search, setSearch]           = useState("");
  const [healthChecking, setHealthChecking] = useState({});
  const [setupIntegration, setSetupIntegration] = useState(null);

  // Load catalogue
  useEffect(() => {
    fetch(`${API}/api/v1/integrations/catalogue`)
      .then(r => r.json())
      .then(d => setCatalogue(d.catalogue || {}))
      .catch(() => {});
  }, []);

  const loadIntegrations = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/v1/integrations/`)
      .then(r => r.json())
      .then(d => setIntegrations(d.integrations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (view === "active") loadIntegrations();
  }, [view, loadIntegrations]);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const openAdd = (toolItem) => {
    setSelectedTool(toolItem);
    // For VMs, leave name empty so user types the actual hostname
    const defaultName = ["linux_vm", "windows_vm"].includes(toolItem.tool_id) ? "" : toolItem.label;
    setForm({ name: defaultName, description: toolItem.description });
    setCreds({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTool(null);
    setForm({ name: "", description: "" });
    setCreds({});
  };

  const submitIntegration = async () => {
    if (!selectedTool) return;
    setSaving(true);
    try {
      const resp = await fetch(`${API}/api/v1/integrations/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:        form.name,
          description: form.description,
          tool_id:     selectedTool.tool_id,
          credentials: creds,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail || "Failed to save");
      closeModal();
      loadIntegrations();
      setView("active");
      // Show setup modal for VM types, toast for everything else
      if (["linux_vm", "windows_vm"].includes(selectedTool.tool_id)) {
        setSetupIntegration(data.integration);
      } else {
        showToast(`✓ ${form.name} added successfully`);
      }
    } catch (e) {
      showToast(`✗ ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  const deleteIntegration = async (id, name) => {
    if (!window.confirm(`Remove "${name}"?`)) return;
    try {
      const resp = await fetch(`${API}/api/v1/integrations/${id}`, { method: "DELETE" });
      if (!resp.ok) throw new Error("Delete failed");
      showToast(`✓ ${name} removed`);
      loadIntegrations();
    } catch (e) {
      showToast(`✗ ${e.message}`, "error");
    }
  };

  const runHealthCheck = async (id) => {
    setHealthChecking(p => ({ ...p, [id]: true }));
    try {
      const resp = await fetch(`${API}/api/v1/integrations/${id}/health-check`, { method: "POST" });
      const data = await resp.json();
      showToast(`${data.status === "healthy" ? "✓" : "✗"} ${data.message}`);
      loadIntegrations();
    } catch {
      showToast("✗ Health check failed", "error");
    } finally {
      setHealthChecking(p => ({ ...p, [id]: false }));
    }
  };

  const copyWebhook = (url) => {
    navigator.clipboard.writeText(window.location.origin + url);
    showToast("✓ Webhook URL copied to clipboard");
  };

  // Filter catalogue
  const filteredCatalogue = {};
  Object.entries(catalogue).forEach(([cat, items]) => {
    const f = items.filter(i =>
      !search ||
      i.label.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase()) ||
      cat.toLowerCase().includes(search.toLowerCase())
    );
    if (f.length) filteredCatalogue[cat] = f;
  });

  const catOrder = ["Network", "VM", "Monitoring", "CMDB", "ITSM", "Security"];
  const sortedCats = Object.keys(filteredCatalogue).sort(
    (a, b) => catOrder.indexOf(a) - catOrder.indexOf(b)
  );

  const totalTypes = Object.values(catalogue).flat().length;

  return (
    <div style={{ padding: "24px", minHeight: "100%", fontFamily: "inherit" }}>
      <style>{`
        .int-card:hover { background: #F0FDF4 !important; border-color: #86EFAC !important; }
        .int-card.sel { background: #F0FDF4 !important; border-color: #22C55E !important; }
        .int-row:hover { background: #F9FAFB !important; }
        .int-tab-active { border-bottom: 2px solid #16A34A !important; color: #16A34A !important; font-weight: 600 !important; }
        .int-tab { border-bottom: 2px solid transparent; color: #6B7280; font-weight: 400; }
        .int-tab:hover { color: #374151 !important; }
        @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .int-input:focus { outline: none; border-color: #22C55E !important; box-shadow: 0 0 0 3px rgba(34,197,94,.1); }
        .int-btn-primary { background: #16A34A; color: #fff; border: none; border-radius: 7px; padding: 9px 20px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background .15s; font-family: inherit; }
        .int-btn-primary:hover { background: #15803D; }
        .int-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .int-btn-secondary { background: #fff; color: #374151; border: 1px solid #D1D5DB; border-radius: 7px; padding: 9px 20px; font-size: 13px; cursor: pointer; font-family: inherit; transition: background .15s; }
        .int-btn-secondary:hover { background: #F9FAFB; }
        .int-action-btn { background: #fff; border: 1px solid #E5E7EB; border-radius: 6px; padding: 5px 10px; font-size: 11px; cursor: pointer; font-family: inherit; transition: all .1s; color: #374151; }
        .int-action-btn:hover { background: #F9FAFB; border-color: #D1D5DB; }
        .int-delete-btn { background: #fff; border: 1px solid #FECACA; border-radius: 6px; padding: 5px 10px; font-size: 11px; cursor: pointer; font-family: inherit; color: #DC2626; transition: all .1s; }
        .int-delete-btn:hover { background: #FFF1F2; }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "700", color: "var(--text-primary, #111827)", margin: 0 }}>
            Integrations
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary, #6B7280)", marginTop: "3px" }}>
            {totalTypes} device types available &nbsp;·&nbsp; {integrations.filter(i => i.is_active).length} active
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <input
            placeholder="Search device types…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="int-input"
            style={{
              border: "1px solid #D1D5DB", borderRadius: "7px", padding: "8px 14px",
              fontSize: "13px", color: "#111827", width: "220px",
              background: "#fff", fontFamily: "inherit"
            }}
          />
          <button
            className="int-btn-primary"
            onClick={() => setView("catalogue")}
          >
            + Add Integration
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: "0", marginBottom: "24px", borderBottom: "1px solid #E5E7EB" }}>
        {[["catalogue", "Device Catalogue"], ["active", "Active Integrations"]].map(([v, l]) => (
          <button
            key={v}
            className={view === v ? "int-tab-active int-tab" : "int-tab"}
            onClick={() => setView(v)}
            style={{
              padding: "10px 20px", fontSize: "13px", background: "none",
              border: "none", cursor: "pointer", marginBottom: "-1px",
              fontFamily: "inherit", transition: "color .15s",
            }}
          >
            {l}
            {v === "active" && integrations.length > 0 && (
              <span style={{
                marginLeft: "7px", background: "#DCFCE7", color: "#15803D",
                borderRadius: "10px", padding: "1px 8px", fontSize: "11px", fontWeight: "600"
              }}>
                {integrations.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Catalogue view ── */}
      {view === "catalogue" && (
        <div>
          {sortedCats.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF", fontSize: "14px" }}>
              No device types match your search.
            </div>
          )}
          {sortedCats.map(cat => {
            const cs = CAT_STYLES[cat] || CAT_STYLES.Network;
            return (
              <div key={cat} style={{ marginBottom: "32px" }}>
                {/* Category header */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                  <span style={{
                    fontSize: "11px", fontWeight: "700", padding: "3px 12px",
                    borderRadius: "20px", background: cs.bg, color: cs.text,
                    border: `1px solid ${cs.border}`, letterSpacing: "0.7px",
                    textTransform: "uppercase"
                  }}>
                    {cat}
                  </span>
                  <div style={{ flex: 1, height: "1px", background: cs.border }} />
                </div>

                {/* Cards grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                  {filteredCatalogue[cat].map(item => (
                    <div
                      key={item.tool_id}
                      className="int-card"
                      onClick={() => openAdd(item)}
                      style={{
                        background: "#fff", border: "1px solid #E5E7EB",
                        borderRadius: "10px", padding: "16px", cursor: "pointer",
                        transition: "all .15s", display: "flex", flexDirection: "column", gap: "8px",
                        boxShadow: "0 1px 3px rgba(0,0,0,.04)"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "36px", height: "36px", flexShrink: 0 }}>
                          {ICONS[item.icon] || ICONS.netbox}
                        </div>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827", lineHeight: "1.3" }}>
                          {item.label}
                        </span>
                      </div>
                      <p style={{ fontSize: "11px", color: "#6B7280", lineHeight: "1.5", margin: 0 }}>
                        {item.description}
                      </p>
                      {item.webhook_url_template && (
                        <span style={{ fontSize: "10px", color: "#16A34A", fontWeight: "500" }}>
                          ⚡ Webhook supported
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Active integrations view ── */}
      {view === "active" && (
        <div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF", fontSize: "14px" }}>
              Loading integrations…
            </div>
          ) : integrations.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#9CA3AF", fontSize: "14px" }}>
              No integrations onboarded yet.{" "}
              <span
                style={{ color: "#16A34A", cursor: "pointer", textDecoration: "underline" }}
                onClick={() => setView("catalogue")}
              >
                Add your first device
              </span>
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: "10px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
              {/* Table header */}
              <div style={{
                display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1fr 120px",
                padding: "11px 20px", background: "#F9FAFB",
                borderBottom: "1px solid #E5E7EB", fontSize: "11px",
                fontWeight: "700", color: "#6B7280", letterSpacing: "0.6px", textTransform: "uppercase"
              }}>
                <span>Name</span><span>Type</span><span>Category</span>
                <span>Health</span><span>Webhook</span>
                <span style={{ textAlign: "right" }}>Actions</span>
              </div>

              {integrations.map((integ, idx) => {
                const hm = HEALTH_META[integ.health_status] || HEALTH_META.unknown;
                const cs = CAT_STYLES[integ.category] || CAT_STYLES.Network;
                return (
                  <div
                    key={integ.id}
                    className="int-row"
                    style={{
                      display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1fr 120px",
                      padding: "13px 20px", borderBottom: idx < integrations.length - 1 ? "1px solid #F3F4F6" : "none",
                      alignItems: "center", fontSize: "13px", transition: "background .1s"
                    }}
                  >
                    {/* Name */}
                    <div>
                      <div style={{ fontWeight: "600", color: "#111827" }}>{integ.name}</div>
                      <div style={{ fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                        {integ.base_url || "—"}
                      </div>
                    </div>
                    {/* Tool ID */}
                    <div style={{ fontSize: "12px", color: "#374151", fontFamily: "monospace" }}>
                      {integ.tool_id}
                    </div>
                    {/* Category badge */}
                    <div>
                      <span style={{
                        fontSize: "11px", padding: "2px 10px", borderRadius: "20px",
                        background: cs.bg, color: cs.text, border: `1px solid ${cs.border}`,
                        fontWeight: "600"
                      }}>
                        {integ.category}
                      </span>
                    </div>
                    {/* Health */}
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
                      <span style={{
                        width: "8px", height: "8px", borderRadius: "50%",
                        background: hm.color, display: "inline-block", flexShrink: 0,
                        boxShadow: integ.health_status === "healthy" ? `0 0 5px ${hm.color}` : "none"
                      }} />
                      <span style={{ color: hm.color, fontWeight: "500" }}>{hm.label}</span>
                      {integ.last_health_check && (
                        <span style={{ color: "#9CA3AF", fontSize: "10px" }}>
                          {new Date(integ.last_health_check).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    {/* Webhook */}
                    <div>
                      {integ.webhook_url ? (
                        <button className="int-action-btn" onClick={() => copyWebhook(integ.webhook_url)}>
                          Copy URL
                        </button>
                      ) : (
                        <span style={{ color: "#D1D5DB", fontSize: "12px" }}>—</span>
                      )}
                    </div>
                    {/* Actions */}
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      <button
                        className="int-action-btn"
                        onClick={() => runHealthCheck(integ.id)}
                        disabled={healthChecking[integ.id]}
                        title="Run health check"
                      >
                        {healthChecking[integ.id] ? "…" : "⟳ Check"}
                      </button>
                      <button
                        className="int-delete-btn"
                        onClick={() => deleteIntegration(integ.id, integ.name)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Add Integration Modal ── */}
      {showModal && selectedTool && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
            backdropFilter: "blur(4px)", display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 1000, padding: "20px"
          }}
          onClick={e => e.target === e.currentTarget && closeModal()}
        >
          <div style={{
            background: "#fff", borderRadius: "14px", width: "100%", maxWidth: "560px",
            maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column",
            boxShadow: "0 20px 60px rgba(0,0,0,.2)", animation: "slideUp .2s ease"
          }}>
            {/* Modal header */}
            <div style={{
              padding: "20px 24px 16px", borderBottom: "1px solid #E5E7EB",
              display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", flexShrink: 0 }}>
                  {ICONS[selectedTool.icon] || ICONS.netbox}
                </div>
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#111827", margin: 0 }}>
                    Add {selectedTool.label}
                  </h3>
                  <p style={{ fontSize: "12px", color: "#6B7280", marginTop: "2px" }}>
                    {selectedTool.description}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "20px", color: "#9CA3AF", padding: "2px 6px", borderRadius: "4px", lineHeight: 1
                }}
              >×</button>
            </div>

            {/* Modal body */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {/* Name */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Integration Name <span style={{ color: "#DC2626" }}>*</span>
                </label>
                <input
                  className="int-input"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={["linux_vm","windows_vm"].includes(selectedTool.tool_id) ? "VM hostname (e.g. gruve-noc-test-vm-2)" : `My ${selectedTool.label}`}
                  style={{
                    width: "100%", border: "1px solid #D1D5DB", borderRadius: "7px",
                    padding: "9px 13px", fontSize: "13px", color: "#111827",
                    fontFamily: "inherit", boxSizing: "border-box"
                  }}
                />
              </div>
              {["linux_vm","windows_vm"].includes(selectedTool.tool_id) && (
                <p style={{ fontSize: "11px", color: "#D97706", marginTop: "-8px", marginBottom: "12px" }}>
                  ⚠ Name must match the VM hostname exactly (run <code>hostname</code> on the VM to check)
                </p>
              )}

              {/* Description */}
              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Description
                </label>
                <input
                  className="int-input"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                  style={{
                    width: "100%", border: "1px solid #D1D5DB", borderRadius: "7px",
                    padding: "9px 13px", fontSize: "13px", color: "#111827",
                    fontFamily: "inherit", boxSizing: "border-box"
                  }}
                />
              </div>

              {/* Credentials divider */}
              <div style={{ borderTop: "1px solid #F3F4F6", margin: "4px 0 16px", position: "relative" }}>
                <span style={{
                  position: "absolute", top: "-9px", left: "0", background: "#fff",
                  paddingRight: "10px", fontSize: "11px", color: "#9CA3AF",
                  letterSpacing: "0.5px", textTransform: "uppercase", fontWeight: "600"
                }}>
                  Credentials
                </span>
              </div>

              {/* Dynamic credential fields */}
              {selectedTool.credential_fields?.map(field => (
                <div key={field.key} style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {field.label}
                    {field.required && <span style={{ color: "#DC2626", marginLeft: "3px" }}>*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      className="int-input"
                      value={creds[field.key] || ""}
                      onChange={e => setCreds(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={`Paste ${field.label.toLowerCase()} here`}
                      style={{
                        width: "100%", border: "1px solid #D1D5DB", borderRadius: "7px",
                        padding: "9px 13px", fontSize: "12px", color: "#111827",
                        fontFamily: "monospace", boxSizing: "border-box",
                        resize: "vertical", minHeight: "80px"
                      }}
                    />
                  ) : (
                    <input
                      className="int-input"
                      type={field.type || "text"}
                      value={creds[field.key] || ""}
                      onChange={e => setCreds(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.default || ""}
                      style={{
                        width: "100%", border: "1px solid #D1D5DB", borderRadius: "7px",
                        padding: "9px 13px", fontSize: "13px", color: "#111827",
                        fontFamily: "inherit", boxSizing: "border-box"
                      }}
                    />
                  )}
                  {field.key === "snmp_community" && (
                    <p style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>
                      Make sure SNMP is enabled on the device and this community string matches.
                    </p>
                  )}
                  {field.key === "host" && (
                    <p style={{ fontSize: "11px", color: "#D97706", marginTop: "4px" }}>
                      ⚠ Enter IP address only (e.g. 10.7.51.136) — not the hostname.
                    </p>
                  )}
                  {field.key === "services" && (
                    <p style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>
                      e.g. haproxy, sshd, firewalld — leave blank to monitor all.
                    </p>
                  )}
                  {field.key === "webhook_secret" && (
                    <p style={{ fontSize: "11px", color: "#6B7280", marginTop: "4px" }}>
                      Optional. Configure in the external system to sign payloads (HMAC-SHA512).
                    </p>
                  )}
                </div>
              ))}

              {/* Webhook info */}
              {selectedTool.webhook_url_template && (
                <div style={{
                  background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "8px",
                  padding: "12px 16px", marginTop: "8px"
                }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#15803D", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Webhook URL (generated after save)
                  </div>
                  <div style={{ fontSize: "12px", color: "#166534", fontFamily: "monospace" }}>
                    {window.location.origin}/api/v1/webhooks/&lt;integration-id&gt;
                  </div>
                  <p style={{ fontSize: "11px", color: "#4B7A57", marginTop: "6px" }}>
                    Configure this URL in {selectedTool.label} to receive real-time events.
                  </p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #E5E7EB", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button className="int-btn-secondary" onClick={closeModal}>Cancel</button>
              <button
                className="int-btn-primary"
                onClick={submitIntegration}
                disabled={saving || !form.name}
              >
                {saving ? "Saving…" : `Add ${selectedTool.label}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast notification ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px",
          background: toast.type === "error" ? "#FFF1F2" : "#F0FDF4",
          border: `1px solid ${toast.type === "error" ? "#FECACA" : "#BBF7D0"}`,
          borderRadius: "8px", padding: "12px 18px", fontSize: "13px",
          color: toast.type === "error" ? "#DC2626" : "#15803D",
          zIndex: 9999, boxShadow: "0 4px 16px rgba(0,0,0,.1)",
          animation: "slideUp .2s ease", fontWeight: "500"
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── VM Setup Modal ── */}
      {setupIntegration && (
        <SetupModal
          integration={setupIntegration}
          onClose={() => {
            setSetupIntegration(null);
            showToast(`✓ ${setupIntegration.name} fully configured`);
          }}
        />
      )}
    </div>
  );
}
