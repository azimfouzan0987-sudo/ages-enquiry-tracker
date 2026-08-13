import { useState, useEffect, useMemo } from "react";
import { subscribeToEnquiries, addEnquiryToDb, updateEnquiryInDb, deleteEnquiryFromDb } from "./firebase";

const STATUSES = [
  { key: "received", label: "Enquiry Received", color: "#3B82F6", bg: "#EFF6FF" },
  { key: "quoted", label: "Quote Sent", color: "#8B5CF6", bg: "#F5F3FF" },
  { key: "followup", label: "Follow-up", color: "#F59E0B", bg: "#FFFBEB" },
  { key: "won", label: "Won", color: "#10B981", bg: "#ECFDF5" },
  { key: "lost", label: "Lost", color: "#EF4444", bg: "#FEF2F2" },
  { key: "noresponse", label: "No Response", color: "#6B7280", bg: "#F9FAFB" },
];
const SM = Object.fromEntries(STATUSES.map((s) => [s.key, s]));

function nextId(enquiries) {
  const nums = enquiries.map((e) => {
    const m = e.id?.match(/ENQ-(\d+)/);
    return m ? parseInt(m[1]) : 0;
  });
  return "ENQ-" + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, "0");
}

function parseWA(text) {
  const lines = text.trim().split("\n").map((l) => l.trim()).filter(Boolean);
  const first = lines[0] || "";
  const dm = first.match(/^(.+?)\s*[-–]\s*(.+)$/);
  let client = dm ? dm[1].trim() : first;
  let site = dm ? dm[2].trim() : "";
  const acts = [];
  lines.forEach((l) => {
    const m = l.match(/^Activity\s*\d+\s*[:\-–]?\s*(.+)/i);
    if (m) acts.push(m[1].trim());
  });
  const gt = text.match(/Grand Total\s+([\d,]+(?:\.\d+)?)/i);
  const total = gt ? gt[1].replace(/,/g, "") : "";
  return { client, site, scope: acts.length ? acts.join(" + ") : site, total };
}

function fmt(n) {
  return parseFloat(n).toLocaleString("en-AE");
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid #E5E7EB",
  borderRadius: 10,
  fontSize: 14,
  color: "#111827",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: "inherit",
};
const primaryBtn = {
  width: "100%",
  padding: "14px",
  background: "#0D1F3C",
  color: "#fff",
  border: "none",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
};
const secondaryBtn = {
  width: "100%",
  padding: "12px",
  background: "#fff",
  color: "#374151",
  border: "1.5px solid #E5E7EB",
  borderRadius: 12,
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
};
const labelStyle = { fontSize: 12, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 };

export default function App() {
  const [enquiries, setEnquiries] = useState([]);
  const [view, setView] = useState("dashboard");
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);

  // Real-time subscription — everyone on the team sees the same live data
  useEffect(() => {
    const unsubscribe = subscribeToEnquiries((data) => {
      setEnquiries(data);
      setLoaded(true);
    });
    return () => unsubscribe();
  }, []);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  async function addEnquiry(data) {
    const id = nextId(enquiries);
    const newEnq = { ...data, id, createdAt: new Date().toISOString() };
    try {
      await addEnquiryToDb(newEnq);
      showToast(id + " saved");
      setView("dashboard");
    } catch (err) {
      showToast("Error saving — check connection");
      console.error(err);
    }
  }

  async function updateEnquiry(id, changes) {
    const target = enquiries.find((e) => e.id === id);
    if (!target?.firestoreId) return;
    try {
      await updateEnquiryInDb(target.firestoreId, changes);
      showToast("Updated");
    } catch (err) {
      showToast("Error updating");
      console.error(err);
    }
  }

  async function deleteEnquiry(id) {
    const target = enquiries.find((e) => e.id === id);
    if (!target?.firestoreId) return;
    try {
      await deleteEnquiryFromDb(target.firestoreId);
      setView("dashboard");
      showToast("Deleted");
    } catch (err) {
      showToast("Error deleting");
      console.error(err);
    }
  }

  const filtered = useMemo(() => {
    return enquiries.filter((e) => {
      const matchStatus = filterStatus === "all" || e.status === filterStatus;
      const q = search.toLowerCase();
      const matchSearch =
        !q || [e.client, e.scope, e.location, e.id, e.contact, e.quoteId].some((f) => f?.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [enquiries, filterStatus, search]);

  const today = new Date().toDateString();
  const todayFollowups = enquiries.filter((e) => e.followUpDate && new Date(e.followUpDate).toDateString() === today);
  const won = enquiries.filter((e) => e.status === "won").length;
  const pending = enquiries.filter((e) => ["received", "quoted", "followup"].includes(e.status)).length;
  const selected = enquiries.find((e) => e.id === selectedId);

  if (!loaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0D1F3C", color: "#7EC8E3", fontFamily: "system-ui" }}>
        Loading AGES Tracker...
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7FB", fontFamily: "'Inter', system-ui, sans-serif", maxWidth: 480, margin: "0 auto", position: "relative" }}>
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: "#10B981", color: "#fff", padding: "10px 20px", borderRadius: 10, zIndex: 9999, fontSize: 14, fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)" }}>
          {toast}
        </div>
      )}

      {todayFollowups.length > 0 && view === "dashboard" && (
        <div style={{ background: "#FEF3C7", borderBottom: "1px solid #FCD34D", padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#92400E" }}>
          ⏰ {todayFollowups.length} follow-up{todayFollowups.length > 1 ? "s" : ""} due today: {todayFollowups.map((e) => e.client).join(", ")}
        </div>
      )}

      {view === "dashboard" && (
        <Dashboard
          enquiries={filtered}
          allCount={enquiries.length}
          won={won}
          pending={pending}
          search={search}
          setSearch={setSearch}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          onSelect={(id) => { setSelectedId(id); setView("detail"); }}
          onNew={() => setView("new-quick")}
          onWaParse={() => setView("wa-parse")}
        />
      )}
      {view === "new-quick" && <QuickForm onSave={addEnquiry} onCancel={() => setView("dashboard")} />}
      {view === "wa-parse" && <WaParser onSave={addEnquiry} onCancel={() => setView("dashboard")} />}
      {view === "detail" && selected && (
        <DetailView
          enquiry={selected}
          onBack={() => setView("dashboard")}
          onUpdate={updateEnquiry}
          onDelete={deleteEnquiry}
        />
      )}
    </div>
  );
}

function Dashboard({ enquiries, allCount, won, pending, search, setSearch, filterStatus, setFilterStatus, onSelect, onNew, onWaParse }) {
  return (
    <div>
      <div style={{ background: "#0D1F3C", padding: "20px 16px 16px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "#7EC8E3", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>Ahmed Ghanim · AGES</div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5 }}>Enquiry Tracker</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onWaParse} style={{ background: "#25D366", border: "none", borderRadius: 10, padding: "8px 12px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              💬 WhatsApp
            </button>
            <button onClick={onNew} style={{ background: "#E87722", border: "none", borderRadius: 10, padding: "8px 12px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
              ＋ New
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
          {[{ label: "Total", value: allCount }, { label: "Pending", value: pending }, { label: "Won", value: won }].map((s) => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "10px 12px" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#7EC8E3", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          🔍
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search client, scope, ID..." style={{ background: "none", border: "none", outline: "none", color: "#fff", fontSize: 14, flex: 1, fontFamily: "inherit" }} />
        </div>
      </div>

      <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "0 16px", display: "flex", gap: 0, overflowX: "auto" }}>
        {[{ key: "all", label: "All" }, ...STATUSES].map((s) => (
          <button key={s.key} onClick={() => setFilterStatus(s.key)} style={{ background: "none", border: "none", borderBottom: filterStatus === s.key ? "2px solid #0D1F3C" : "2px solid transparent", padding: "10px 12px", fontSize: 12, fontWeight: filterStatus === s.key ? 700 : 500, color: filterStatus === s.key ? "#0D1F3C" : "#6B7280", cursor: "pointer", whiteSpace: "nowrap" }}>
            {s.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {enquiries.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div style={{ fontWeight: 600, fontSize: 15 }}>No enquiries yet</div>
            <div style={{ fontSize: 13 }}>Tap + New or paste a WhatsApp quote</div>
          </div>
        )}
        {enquiries.map((e) => (
          <EnquiryCard key={e.id} enquiry={e} onClick={() => onSelect(e.id)} />
        ))}
      </div>
    </div>
  );
}

function EnquiryCard({ enquiry, onClick }) {
  const s = SM[enquiry.status] || SM.received;
  const date = new Date(enquiry.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const today = new Date().toDateString();
  const isFollowupToday = enquiry.followUpDate && new Date(enquiry.followUpDate).toDateString() === today;

  return (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", cursor: "pointer", border: isFollowupToday ? "1.5px solid #F59E0B" : "1.5px solid transparent" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#0D1F3C", background: "#EFF6FF", padding: "2px 7px", borderRadius: 6 }}>{enquiry.id}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: s.color, background: s.bg, padding: "3px 9px", borderRadius: 20 }}>{s.label}</span>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", marginBottom: 3 }}>{enquiry.client || "—"}</div>
      <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{enquiry.scope || "No scope"}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#9CA3AF" }}>{enquiry.location && `📍 ${enquiry.location} · `}{date}</span>
        {enquiry.total && <span style={{ fontSize: 13, fontWeight: 700, color: "#10B981" }}>AED {fmt(enquiry.total)}</span>}
      </div>
      {isFollowupToday && <div style={{ marginTop: 8, fontSize: 11, color: "#92400E", background: "#FEF3C7", padding: "4px 8px", borderRadius: 6, fontWeight: 600 }}>⏰ Follow-up due today</div>}
      {enquiry.quoteId && <div style={{ marginTop: 6, fontSize: 11, color: "#8B5CF6", fontWeight: 600 }}>📎 {enquiry.quoteId}</div>}
      {enquiry.oneDriveFolder && <div style={{ marginTop: 4, fontSize: 11, color: "#0369A1", fontWeight: 600 }}>📁 OneDrive folder linked</div>}
    </div>
  );
}

function QuickForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ client: "", scope: "", contact: "", notes: "", source: "phone", status: "received" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7FB" }}>
      <div style={{ background: "#0D1F3C", padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "#7EC8E3", cursor: "pointer", fontSize: 20 }}>✕</button>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Quick Capture</div>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "#FEF3C7", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#92400E", fontWeight: 600 }}>
          📝 Quick capture — fill in the essentials now, add details later
        </div>
        <div><label style={labelStyle}>Company / Client Name *</label><input value={form.client} onChange={(e) => set("client", e.target.value)} placeholder="e.g. ENME" style={inputStyle} /></div>
        <div><label style={labelStyle}>Scope *</label><input value={form.scope} onChange={(e) => set("scope", e.target.value)} placeholder='e.g. Hot Tapping 8" x 4 Nos' style={inputStyle} /></div>
        <div><label style={labelStyle}>Contact Person</label><input value={form.contact} onChange={(e) => set("contact", e.target.value)} placeholder="e.g. Mohammed Ali" style={inputStyle} /></div>
        <div><label style={labelStyle}>Notes</label><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Any quick notes..." style={inputStyle} /></div>
        <div>
          <label style={labelStyle}>Source</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[{ k: "phone", l: "📞 Phone" }, { k: "whatsapp", l: "💬 WhatsApp" }, { k: "email", l: "📧 Email" }].map((s) => (
              <button key={s.k} onClick={() => set("source", s.k)} style={{ flex: 1, padding: "8px 4px", border: "1.5px solid", borderColor: form.source === s.k ? "#0D1F3C" : "#E5E7EB", borderRadius: 10, background: form.source === s.k ? "#0D1F3C" : "#fff", color: form.source === s.k ? "#fff" : "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {s.l}
              </button>
            ))}
          </div>
        </div>
        <button onClick={() => { if (!form.client || !form.scope) return alert("Client and scope are required"); onSave(form); }} style={primaryBtn}>Save Enquiry</button>
      </div>
    </div>
  );
}

function WaParser({ onSave, onCancel }) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState(null);
  const [form, setForm] = useState({});
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  function parse() {
    const p = parseWA(raw);
    setParsed(p);
    setForm({
      client: p.client,
      scope: p.scope,
      location: p.site !== p.client ? p.site : "",
      total: p.total,
      source: "whatsapp",
      status: "quoted",
      rawMessage: raw, // preserved permanently — editing client name later won't touch this
    });
  }

  if (parsed) {
    return (
      <div style={{ minHeight: "100vh", background: "#F4F7FB" }}>
        <div style={{ background: "#25D366", padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setParsed(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 20 }}>✕</button>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Review Parsed Quote</div>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#166534", fontWeight: 600 }}>
            ✅ Quote parsed — review and confirm the details below
          </div>
          <div style={{ background: "#fff", borderRadius: 12, padding: "12px 14px", border: "1px solid #E5E7EB" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Extracted From Quote</div>
            <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
              <div><span style={{ color: "#6B7280" }}>Client: </span><strong>{parsed.client}</strong></div>
              <div><span style={{ color: "#6B7280" }}>Site: </span><strong>{parsed.site}</strong></div>
              <div><span style={{ color: "#6B7280" }}>Scope: </span><strong>{parsed.scope}</strong></div>
              {parsed.total && <div><span style={{ color: "#6B7280" }}>Total: </span><strong style={{ color: "#10B981" }}>AED {fmt(parsed.total)}</strong></div>}
            </div>
          </div>
          <div><label style={labelStyle}>Client Name *</label><input value={form.client || ""} onChange={(e) => set("client", e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Scope</label><input value={form.scope || ""} onChange={(e) => set("scope", e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Location / Site</label><input value={form.location || ""} onChange={(e) => set("location", e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Contact Person</label><input value={form.contact || ""} onChange={(e) => set("contact", e.target.value)} style={inputStyle} /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Amount (AED)</label><input type="number" value={form.total || ""} onChange={(e) => set("total", e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Status</label>
              <select value={form.status || "quoted"} onChange={(e) => set("status", e.target.value)} style={inputStyle}>
                {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div><label style={labelStyle}>Quote ID (if you have one)</label><input value={form.quoteId || ""} onChange={(e) => set("quoteId", e.target.value)} placeholder="QT-001" style={inputStyle} /></div>
          <div>
            <label style={labelStyle}>📁 OneDrive Folder Link</label>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6 }}>Right-click the enquiry folder in OneDrive → Share → Copy link</div>
            <input value={form.oneDriveFolder || ""} onChange={(e) => set("oneDriveFolder", e.target.value)} placeholder="Paste OneDrive folder link..." style={inputStyle} />
          </div>
          <div><label style={labelStyle}>⏰ Follow-up Date</label><input type="date" value={form.followUpDate || ""} onChange={(e) => set("followUpDate", e.target.value)} style={inputStyle} /></div>
          <button onClick={() => { if (!form.client) return alert("Client is required"); onSave({ ...form, status: form.status || "quoted" }); }} style={{ ...primaryBtn, background: "#25D366" }}>Save to Tracker</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7FB" }}>
      <div style={{ background: "#25D366", padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 20 }}>✕</button>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Paste WhatsApp Quote</div>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#166534" }}>
          Paste the quote message you sent on WhatsApp — we'll extract the client, scope, and amount automatically.
        </div>
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={12} placeholder={'ENME - ONE ZABEEL\nActivity 1: Hot Tapping\n8" X 8" Tapping...\n\nGrand Total 150,000.00 + Vat 5%'} style={{ ...inputStyle, fontFamily: "monospace", fontSize: 13, lineHeight: 1.6 }} />
        <button onClick={parse} disabled={!raw.trim()} style={{ ...primaryBtn, background: raw.trim() ? "#25D366" : "#D1FAE5", color: raw.trim() ? "#fff" : "#9CA3AF" }}>Parse Quote →</button>
      </div>
    </div>
  );
}

function DetailView({ enquiry, onBack, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...enquiry });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const s = SM[enquiry.status] || SM.received;

  useEffect(() => setForm({ ...enquiry }), [enquiry]);

  if (editing) {
    return (
      <div style={{ minHeight: "100vh", background: "#F4F7FB" }}>
        <div style={{ background: "#0D1F3C", padding: "16px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => setEditing(false)} style={{ background: "none", border: "none", color: "#7EC8E3", cursor: "pointer", fontSize: 20 }}>✕</button>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>Edit {enquiry.id}</div>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={labelStyle}>Client Name</label><input value={form.client || ""} onChange={(e) => set("client", e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Scope</label><input value={form.scope || ""} onChange={(e) => set("scope", e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Contact Person</label><input value={form.contact || ""} onChange={(e) => set("contact", e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Location</label><input value={form.location || ""} onChange={(e) => set("location", e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value)} style={inputStyle}>
              {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div><label style={labelStyle}>Amount (AED)</label><input type="number" value={form.total || ""} onChange={(e) => set("total", e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Quote ID</label><input value={form.quoteId || ""} onChange={(e) => set("quoteId", e.target.value)} placeholder="QT-001" style={inputStyle} /></div>
          </div>
          <div>
            <label style={labelStyle}>📁 OneDrive Folder Link</label>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6 }}>Right-click the enquiry folder in OneDrive → Share → Copy link</div>
            <input value={form.oneDriveFolder || ""} onChange={(e) => set("oneDriveFolder", e.target.value)} placeholder="Paste OneDrive folder link..." style={inputStyle} />
          </div>
          <div><label style={labelStyle}>⏰ Follow-up Date</label><input type="date" value={form.followUpDate || ""} onChange={(e) => set("followUpDate", e.target.value)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Notes</label><textarea value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} rows={3} style={inputStyle} /></div>
          <button onClick={() => { onUpdate(enquiry.id, form); setEditing(false); }} style={primaryBtn}>Save Changes</button>
          <button onClick={() => { if (confirm("Delete this enquiry?")) onDelete(enquiry.id); }} style={{ ...secondaryBtn, color: "#EF4444", borderColor: "#FCA5A5" }}>Delete Enquiry</button>
        </div>
      </div>
    );
  }

  const createdDate = new Date(enquiry.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const today = new Date().toDateString();
  const followDate = enquiry.followUpDate ? new Date(enquiry.followUpDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;
  const isToday = enquiry.followUpDate && new Date(enquiry.followUpDate).toDateString() === today;

  return (
    <div style={{ minHeight: "100vh", background: "#F4F7FB" }}>
      <div style={{ background: "#0D1F3C", padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: "#7EC8E3", cursor: "pointer", fontSize: 20 }}>✕</button>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 16, flex: 1 }}>{enquiry.id}</div>
          <button onClick={() => setEditing(true)} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, padding: "6px 10px", color: "#fff", cursor: "pointer", fontSize: 12 }}>✏️ Edit</button>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: s.color, background: s.bg, padding: "4px 12px", borderRadius: 20 }}>{s.label}</span>
          {enquiry.source === "whatsapp" && <span style={{ fontSize: 12, fontWeight: 700, color: "#25D366", background: "#F0FDF4", padding: "4px 10px", borderRadius: 20 }}>WhatsApp</span>}
        </div>
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <InfoRow label="Client" value={enquiry.client} />
          <InfoRow label="Scope" value={enquiry.scope} />
          {enquiry.contact && <InfoRow label="Contact" value={enquiry.contact} />}
          {enquiry.location && <InfoRow label="Location" value={enquiry.location} />}
          <InfoRow label="Date Received" value={createdDate} />
          {enquiry.notes && <InfoRow label="Notes" value={enquiry.notes} />}
        </div>

        {enquiry.rawMessage && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
              💬 Original WhatsApp Message
            </div>
            <div style={{ background: "#F0FDF4", border: "1px solid #D1FAE5", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: "#065F46", whiteSpace: "pre-wrap", fontFamily: "monospace", lineHeight: 1.6 }}>
              {enquiry.rawMessage}
            </div>
          </div>
        )}

        {(enquiry.total || enquiry.quoteId || enquiry.oneDriveFolder) && (
          <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Quote Details</div>
            {enquiry.total && <InfoRow label="Amount" value={`AED ${fmt(enquiry.total)} + VAT 5%`} highlight />}
            {enquiry.quoteId && <InfoRow label="Quote ID" value={enquiry.quoteId} />}
            {enquiry.oneDriveFolder && (
              <div style={{ marginTop: 10 }}>
                <a href={enquiry.oneDriveFolder} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#0369A1", fontWeight: 700, textDecoration: "none", background: "#E0F2FE", padding: "10px 14px", borderRadius: 10 }}>
                  📁 Open Quote Folder on OneDrive ↗
                </a>
                <div style={{ marginTop: 6, fontSize: 11, color: "#9CA3AF" }}>All versions of this quote — Word, PDF — are in this folder</div>
              </div>
            )}
          </div>
        )}

        {followDate && (
          <div style={{ background: isToday ? "#FEF3C7" : "#fff", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <span style={{ fontSize: 18 }}>⏰</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>Follow-up Reminder</div>
              <div style={{ fontSize: 13, color: "#78350F" }}>{followDate}</div>
            </div>
          </div>
        )}

        <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Update Status</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {STATUSES.map((st) => (
              <button key={st.key} onClick={() => onUpdate(enquiry.id, { status: st.key })} style={{ padding: "6px 12px", borderRadius: 20, border: "1.5px solid", borderColor: enquiry.status === st.key ? st.color : "#E5E7EB", background: enquiry.status === st.key ? st.bg : "#fff", color: enquiry.status === st.key ? st.color : "#6B7280", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                {st.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, highlight }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "6px 0", borderBottom: "1px solid #F3F4F6" }}>
      <div style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, minWidth: 90 }}>{label}</div>
      <div style={{ fontSize: 13, color: highlight ? "#10B981" : "#111827", fontWeight: highlight ? 700 : 500, flex: 1 }}>{value || "—"}</div>
    </div>
  );
}
