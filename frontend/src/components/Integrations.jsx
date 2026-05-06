import { useState, useEffect, useCallback } from "react";

const API = import.meta.env.VITE_API_BASE_URL || "";

// ── Vendor icon SVG paths (inline, no external dep) ──────────────────────────
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
      <rect width="40" height="40" rx="8" fill="#FCC624" fillOpacity=".15"/>
      <path d="M20 6c-3.3 0-6 2.7-6 6v8l-3 4h18l-3-4v-8c0-3.3-2.7-6-6-6zm-2 22h4v2h-4v-2z" fill="#FCC624"/>
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

const CATEGORY_COLORS = {
  Network:    { bg: "rgba(0,188,242,.08)",  border: "#00BCF2", text: "#00BCF2"  },
  VM:         { bg: "rgba(100,200,100,.08)",border: "#4CAF50", text: "#4CAF50"  },
  Monitoring: { bg: "rgba(245,166,35,.08)", border: "#F5A623", text: "#F5A623"  },
  CMDB:       { bg: "rgba(155,89,182,.08)", border: "#9B59B6", text: "#9B59B6"  },
  ITSM:       { bg: "rgba(0,82,204,.08)",   border: "#0052CC", text: "#0052CC"  },
  Security:   { bg: "rgba(220,53,69,.08)",  border: "#DC3545", text: "#DC3545"  },
};

const HEALTH_COLORS = {
  healthy: { color: "#4CAF50", label: "Healthy",  dot: "#4CAF50" },
  down:    { color: "#f44336", label: "Down",     dot: "#f44336" },
  unknown: { color: "#9E9E9E", label: "Unknown",  dot: "#9E9E9E" },
  degraded:{ color: "#FF9800", label: "Degraded", dot: "#FF9800" },
};

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  root: {
    fontFamily: "'IBM Plex Mono', 'JetBrains Mono', 'Fira Code', monospace",
    background: "transparent",
    minHeight: "100%",
    padding: "24px",
    color: "var(--color-text-primary, #e2e8f0)",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "28px",
    gap: "16px",
    flexWrap: "wrap",
  },
  title: {
    fontSize: "22px",
    fontWeight: "600",
    letterSpacing: "-0.5px",
    color: "var(--color-text-primary)",
    margin: 0,
  },
  subtitle: {
    fontSize: "13px",
    color: "var(--color-text-secondary)",
    marginTop: "4px",
    fontFamily: "inherit",
  },
  addBtn: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "#2E7D32",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 20px",
    fontSize: "13px",
    fontWeight: "600",
    fontFamily: "inherit",
    cursor: "pointer",
    letterSpacing: "0.3px",
    transition: "background .15s",
  },
  tabs: {
    display: "flex",
    gap: "4px",
    marginBottom: "24px",
    borderBottom: "1px solid rgba(255,255,255,.08)",
    paddingBottom: "0",
  },
  tab: (active) => ({
    padding: "8px 18px",
    fontSize: "13px",
    fontWeight: active ? "600" : "400",
    color: active ? "#fff" : "rgba(255,255,255,.45)",
    background: "none",
    border: "none",
    borderBottom: active ? "2px solid #4CAF50" : "2px solid transparent",
    cursor: "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.2px",
    marginBottom: "-1px",
    transition: "color .15s",
  }),
  // Catalogue grid
  catSection: { marginBottom: "36px" },
  catHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "14px",
  },
  catBadge: (cat) => ({
    fontSize: "11px",
    fontWeight: "700",
    padding: "3px 10px",
    borderRadius: "20px",
    background: CATEGORY_COLORS[cat]?.bg || "rgba(255,255,255,.08)",
    color: CATEGORY_COLORS[cat]?.text || "#fff",
    border: `1px solid ${CATEGORY_COLORS[cat]?.border || "rgba(255,255,255,.2)"}`,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    fontFamily: "inherit",
  }),
  catLine: (cat) => ({
    flex: 1,
    height: "1px",
    background: CATEGORY_COLORS[cat]?.border || "rgba(255,255,255,.1)",
    opacity: 0.3,
  }),
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
    gap: "12px",
  },
  catalogueCard: (selected) => ({
    background: selected ? "rgba(46,125,50,.15)" : "rgba(255,255,255,.04)",
    border: selected ? "1.5px solid #4CAF50" : "1px solid rgba(255,255,255,.08)",
    borderRadius: "10px",
    padding: "16px",
    cursor: "pointer",
    transition: "all .15s",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  }),
  cardTop: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  cardIcon: {
    width: "36px",
    height: "36px",
    flexShrink: 0,
  },
  cardLabel: {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--color-text-primary)",
    lineHeight: "1.3",
  },
  cardDesc: {
    fontSize: "11px",
    color: "rgba(255,255,255,.4)",
    lineHeight: "1.5",
  },
  // Active list
  tableWrap: {
    background: "rgba(255,255,255,.03)",
    border: "1px solid rgba(255,255,255,.07)",
    borderRadius: "10px",
    overflow: "hidden",
  },
  tableHead: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1fr 100px",
    padding: "12px 20px",
    background: "rgba(255,255,255,.04)",
    borderBottom: "1px solid rgba(255,255,255,.07)",
    fontSize: "11px",
    fontWeight: "700",
    color: "rgba(255,255,255,.35)",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  tableRow: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr 1fr 1.2fr 1fr 100px",
    padding: "14px 20px",
    borderBottom: "1px solid rgba(255,255,255,.04)",
    alignItems: "center",
    fontSize: "13px",
    transition: "background .1s",
  },
  healthDot: (h) => ({
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: HEALTH_COLORS[h]?.dot || "#9E9E9E",
    marginRight: "6px",
    boxShadow: h === "healthy" ? "0 0 5px #4CAF50" : "none",
  }),
  rowActions: {
    display: "flex",
    gap: "6px",
    justifyContent: "flex-end",
  },
  iconBtn: (color) => ({
    background: "none",
    border: `1px solid ${color || "rgba(255,255,255,.15)"}`,
    borderRadius: "6px",
    padding: "4px 8px",
    cursor: "pointer",
    fontSize: "11px",
    color: color || "rgba(255,255,255,.5)",
    fontFamily: "inherit",
    transition: "all .1s",
  }),
  empty: {
    textAlign: "center",
    padding: "60px 20px",
    color: "rgba(255,255,255,.25)",
    fontSize: "13px",
  },
  // Modal
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,.7)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modal: {
    background: "#0f1117",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: "14px",
    width: "100%",
    maxWidth: "620px",
    maxHeight: "90vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 24px 60px rgba(0,0,0,.6)",
  },
  modalHead: {
    padding: "20px 24px 16px",
    borderBottom: "1px solid rgba(255,255,255,.07)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
  },
  modalTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#fff",
    margin: 0,
  },
  modalSubtitle: {
    fontSize: "12px",
    color: "rgba(255,255,255,.4)",
    marginTop: "3px",
    fontFamily: "inherit",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,.4)",
    cursor: "pointer",
    fontSize: "20px",
    lineHeight: 1,
    padding: "2px 6px",
    borderRadius: "4px",
  },
  modalBody: {
    padding: "20px 24px",
    overflowY: "auto",
    flex: 1,
  },
  modalFoot: {
    padding: "16px 24px",
    borderTop: "1px solid rgba(255,255,255,.07)",
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
  },
  formGroup: { marginBottom: "16px" },
  label: {
    display: "block",
    fontSize: "11px",
    fontWeight: "700",
    color: "rgba(255,255,255,.4)",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    marginBottom: "6px",
    fontFamily: "inherit",
  },
  input: {
    width: "100%",
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    color: "#fff",
    fontFamily: "inherit",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color .15s",
  },
  textarea: {
    width: "100%",
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "12px",
    color: "#b0c4de",
    fontFamily: "'IBM Plex Mono', monospace",
    outline: "none",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: "80px",
  },
  required: { color: "#f44336", marginLeft: "3px" },
  hint: {
    fontSize: "11px",
    color: "rgba(255,255,255,.3)",
    marginTop: "4px",
    lineHeight: "1.4",
    fontFamily: "inherit",
  },
  primaryBtn: {
    background: "#2E7D32",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "10px 22px",
    fontSize: "13px",
    fontWeight: "600",
    fontFamily: "inherit",
    cursor: "pointer",
    transition: "background .15s",
  },
  secondaryBtn: {
    background: "transparent",
    color: "rgba(255,255,255,.5)",
    border: "1px solid rgba(255,255,255,.15)",
    borderRadius: "8px",
    padding: "10px 22px",
    fontSize: "13px",
    fontFamily: "inherit",
    cursor: "pointer",
  },
  webhookBox: {
    background: "rgba(46,125,50,.1)",
    border: "1px solid rgba(46,125,50,.35)",
    borderRadius: "8px",
    padding: "12px 16px",
    marginTop: "16px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  webhookLabel: {
    fontSize: "11px",
    color: "rgba(255,255,255,.4)",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    fontWeight: "700",
  },
  webhookUrl: {
    fontSize: "12px",
    color: "#80CBC4",
    fontFamily: "'IBM Plex Mono', monospace",
    wordBreak: "break-all",
  },
  copyBtn: {
    background: "rgba(255,255,255,.08)",
    border: "none",
    borderRadius: "5px",
    padding: "3px 10px",
    fontSize: "11px",
    color: "#aaa",
    cursor: "pointer",
    fontFamily: "inherit",
    flexShrink: 0,
  },
  toast: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    background: "#1b2a1b",
    border: "1px solid #4CAF50",
    borderRadius: "8px",
    padding: "12px 18px",
    fontSize: "13px",
    color: "#4CAF50",
    fontFamily: "'IBM Plex Mono', monospace",
    zIndex: 9999,
    boxShadow: "0 8px 24px rgba(0,0,0,.4)",
    animation: "fadeUp .2s ease",
  },
  searchBar: {
    background: "rgba(255,255,255,.05)",
    border: "1px solid rgba(255,255,255,.1)",
    borderRadius: "8px",
    padding: "9px 14px",
    fontSize: "13px",
    color: "#fff",
    fontFamily: "inherit",
    outline: "none",
    width: "240px",
  },
  statusPill: (cat) => ({
    fontSize: "11px",
    padding: "2px 10px",
    borderRadius: "20px",
    background: CATEGORY_COLORS[cat]?.bg || "rgba(255,255,255,.06)",
    color: CATEGORY_COLORS[cat]?.text || "rgba(255,255,255,.5)",
    border: `1px solid ${CATEGORY_COLORS[cat]?.border || "rgba(255,255,255,.1)"}`,
    letterSpacing: "0.5px",
  }),
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function Integrations() {
  const [view, setView]               = useState("catalogue"); // catalogue | active
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

  // Load catalogue
  useEffect(() => {
    fetch(`${API}/api/v1/integrations/catalogue`)
      .then(r => r.json())
      .then(d => setCatalogue(d.catalogue || {}))
      .catch(() => {});
  }, []);

  // Load active integrations
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
    setTimeout(() => setToast(null), 3000);
  };

  // Open add modal
  const openAdd = (toolItem) => {
    setSelectedTool(toolItem);
    setForm({ name: toolItem.label, description: toolItem.description });
    setCreds({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedTool(null);
    setForm({ name: "", description: "" });
    setCreds({});
  };

  // Submit new integration
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
      if (!resp.ok) throw new Error(data.detail || "Failed");
      showToast(`✓ ${form.name} added successfully`);
      closeModal();
      loadIntegrations();
      setView("active");
    } catch (e) {
      showToast(`✗ ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  // Delete
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

  // Health check
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

  // Copy webhook URL
  const copyWebhook = (url) => {
    navigator.clipboard.writeText(window.location.origin + url);
    showToast("✓ Webhook URL copied");
  };

  // ── Filter catalogue by search
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

  return (
    <div style={S.root}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap');
        .int-card:hover { background: rgba(255,255,255,.07) !important; border-color: rgba(255,255,255,.18) !important; }
        .int-card.sel:hover { background: rgba(46,125,50,.2) !important; }
        .int-row:hover { background: rgba(255,255,255,.03) !important; }
        .add-btn:hover { background: #388E3C !important; }
        .icon-btn:hover { opacity: .8; background: rgba(255,255,255,.06) !important; }
        .input-f:focus { border-color: rgba(46,125,50,.6) !important; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
      `}</style>

      {/* ── Top bar ── */}
      <div style={S.topBar}>
        <div>
          <h2 style={S.title}>Integrations</h2>
          <p style={S.subtitle}>
            {Object.values(catalogue).flat().length} device types available &nbsp;·&nbsp;{" "}
            {integrations.filter(i => i.is_active).length} active
          </p>
        </div>
        <div style={{ display:"flex", gap:"10px", alignItems:"center" }}>
          <input
            placeholder="Search device types…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={S.searchBar}
            className="input-f"
          />
          <button style={S.addBtn} className="add-btn" onClick={() => setView("catalogue")}>
            <span style={{ fontSize:"16px", lineHeight:1 }}>+</span> Add Integration
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={S.tabs}>
        {[["catalogue","Device Catalogue"], ["active","Active Integrations"]].map(([v, l]) => (
          <button key={v} style={S.tab(view === v)} onClick={() => setView(v)}>
            {l}
            {v === "active" && integrations.length > 0 && (
              <span style={{ marginLeft:"6px", background:"rgba(76,175,80,.2)", color:"#4CAF50", borderRadius:"10px", padding:"1px 7px", fontSize:"10px" }}>
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
            <div style={S.empty}>No device types match your search.</div>
          )}
          {sortedCats.map(cat => (
            <div key={cat} style={S.catSection}>
              <div style={S.catHeader}>
                <span style={S.catBadge(cat)}>{cat}</span>
                <div style={S.catLine(cat)} />
              </div>
              <div style={S.grid}>
                {filteredCatalogue[cat].map(item => (
                  <div
                    key={item.tool_id}
                    className={`int-card${selectedTool?.tool_id === item.tool_id ? " sel" : ""}`}
                    style={S.catalogueCard(selectedTool?.tool_id === item.tool_id)}
                    onClick={() => openAdd(item)}
                  >
                    <div style={S.cardTop}>
                      <div style={S.cardIcon}>{ICONS[item.icon] || ICONS.netbox}</div>
                      <span style={S.cardLabel}>{item.label}</span>
                    </div>
                    <p style={S.cardDesc}>{item.description}</p>
                    {item.webhook_url_template && (
                      <span style={{ fontSize:"10px", color:"rgba(76,175,80,.7)", letterSpacing:"0.3px" }}>
                        ⚡ Webhook supported
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Active integrations view ── */}
      {view === "active" && (
        <div>
          {loading ? (
            <div style={S.empty}>Loading integrations…</div>
          ) : integrations.length === 0 ? (
            <div style={S.empty}>
              No integrations onboarded yet.{" "}
              <span
                style={{ color:"#4CAF50", cursor:"pointer", textDecoration:"underline" }}
                onClick={() => setView("catalogue")}
              >
                Add your first device
              </span>
            </div>
          ) : (
            <div style={S.tableWrap}>
              <div style={S.tableHead}>
                <span>Name</span>
                <span>Type</span>
                <span>Category</span>
                <span>Health</span>
                <span>Webhook</span>
                <span style={{ textAlign:"right" }}>Actions</span>
              </div>
              {integrations.map(integ => {
                const h = HEALTH_COLORS[integ.health_status] || HEALTH_COLORS.unknown;
                return (
                  <div key={integ.id} className="int-row" style={S.tableRow}>
                    {/* Name */}
                    <div>
                      <div style={{ fontWeight:"600", color:"#fff", fontSize:"13px" }}>{integ.name}</div>
                      <div style={{ fontSize:"11px", color:"rgba(255,255,255,.3)", marginTop:"2px" }}>
                        {integ.base_url || "—"}
                      </div>
                    </div>
                    {/* Tool */}
                    <div style={{ fontSize:"12px", color:"rgba(255,255,255,.5)" }}>
                      {integ.tool_id}
                    </div>
                    {/* Category */}
                    <div>
                      <span style={S.statusPill(integ.category)}>{integ.category}</span>
                    </div>
                    {/* Health */}
                    <div style={{ display:"flex", alignItems:"center", fontSize:"12px" }}>
                      <span style={S.healthDot(integ.health_status)} />
                      <span style={{ color: h.color }}>{h.label}</span>
                      {integ.last_health_check && (
                        <span style={{ fontSize:"10px", color:"rgba(255,255,255,.25)", marginLeft:"6px" }}>
                          {new Date(integ.last_health_check).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
                        </span>
                      )}
                    </div>
                    {/* Webhook */}
                    <div>
                      {integ.webhook_url ? (
                        <button
                          style={{ ...S.copyBtn, color:"#80CBC4", fontFamily:"inherit" }}
                          onClick={() => copyWebhook(integ.webhook_url)}
                        >
                          Copy URL
                        </button>
                      ) : (
                        <span style={{ fontSize:"11px", color:"rgba(255,255,255,.2)" }}>—</span>
                      )}
                    </div>
                    {/* Actions */}
                    <div style={S.rowActions}>
                      <button
                        className="icon-btn"
                        style={S.iconBtn("#00BCF2")}
                        onClick={() => runHealthCheck(integ.id)}
                        disabled={healthChecking[integ.id]}
                        title="Run health check"
                      >
                        {healthChecking[integ.id] ? "…" : "⟳"}
                      </button>
                      <button
                        className="icon-btn"
                        style={S.iconBtn("#f44336")}
                        onClick={() => deleteIntegration(integ.id, integ.name)}
                        title="Remove integration"
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
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={S.modal}>
            <div style={S.modalHead}>
              <div>
                <h3 style={S.modalTitle}>Add {selectedTool.label}</h3>
                <p style={S.modalSubtitle}>{selectedTool.description}</p>
              </div>
              <button style={S.closeBtn} onClick={closeModal}>×</button>
            </div>

            <div style={S.modalBody}>
              {/* Basic info */}
              <div style={S.formGroup}>
                <label style={S.label}>Integration Name <span style={S.required}>*</span></label>
                <input
                  className="input-f"
                  style={S.input}
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={`My ${selectedTool.label}`}
                />
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>Description</label>
                <input
                  className="input-f"
                  style={S.input}
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>

              {/* Divider */}
              <div style={{ borderTop:"1px solid rgba(255,255,255,.07)", margin:"18px 0 16px", position:"relative" }}>
                <span style={{ position:"absolute", top:"-9px", left:"12px", background:"#0f1117", padding:"0 8px", fontSize:"10px", color:"rgba(255,255,255,.25)", letterSpacing:"0.7px", textTransform:"uppercase" }}>
                  Credentials
                </span>
              </div>

              {/* Dynamic credential fields */}
              {selectedTool.credential_fields?.map(field => (
                <div key={field.key} style={S.formGroup}>
                  <label style={S.label}>
                    {field.label}
                    {field.required && <span style={S.required}>*</span>}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      className="input-f"
                      style={S.textarea}
                      value={creds[field.key] || ""}
                      onChange={e => setCreds(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={`Paste ${field.label.toLowerCase()} here`}
                    />
                  ) : (
                    <input
                      className="input-f"
                      style={S.input}
                      type={field.type || "text"}
                      value={creds[field.key] || ""}
                      onChange={e => setCreds(p => ({ ...p, [field.key]: e.target.value }))}
                      placeholder={field.default || ""}
                    />
                  )}
                  {field.key === "snmp_community" && (
                    <p style={S.hint}>Make sure SNMP is enabled on the device and this community string matches.</p>
                  )}
                  {field.key === "services" && (
                    <p style={S.hint}>e.g. haproxy, sshd, firewalld — leave blank to monitor all.</p>
                  )}
                  {field.key === "ssh_key" && (
                    <p style={S.hint}>Paste the private key content (-----BEGIN ... PRIVATE KEY-----).</p>
                  )}
                  {field.key === "webhook_secret" && (
                    <p style={S.hint}>Optional. Configure this secret in the external system to sign webhook payloads (HMAC-SHA512).</p>
                  )}
                </div>
              ))}

              {/* Webhook info box */}
              {selectedTool.webhook_url_template && (
                <div style={S.webhookBox}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.webhookLabel}>Webhook URL (after save)</div>
                    <div style={S.webhookUrl}>
                      {window.location.origin}/api/v1/webhooks/{"<integration-id>"}
                    </div>
                    <p style={{ ...S.hint, marginTop:"6px" }}>
                      Configure this URL in {selectedTool.label} to push events in real-time.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div style={S.modalFoot}>
              <button style={S.secondaryBtn} onClick={closeModal}>Cancel</button>
              <button
                style={{ ...S.primaryBtn, opacity: saving ? 0.7 : 1 }}
                onClick={submitIntegration}
                disabled={saving || !form.name}
                className="add-btn"
              >
                {saving ? "Saving…" : `Add ${selectedTool.label}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          ...S.toast,
          borderColor: toast.type === "error" ? "#f44336" : "#4CAF50",
          color:        toast.type === "error" ? "#f44336" : "#4CAF50",
          background:   toast.type === "error" ? "#1a0d0d" : "#1b2a1b",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
