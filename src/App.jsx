import { useState, useEffect, useRef, useCallback } from "react";

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_HEADER = "Thank you for getting your lab tests done. Here is my interpretation of your results.";
const DEFAULT_FOOTER = "Other lab abnormalities not mentioned are not of any importance to your health. If you have further questions about your results, please send me a MyHealth message or schedule a video visit so we can discuss in more detail.";

const DEFAULT_SNIPPETS = [
  { id:"tsh_low_on_meds",      group:"TSH", trigger:"TSH low on meds",        text:"Your TSH is low which suggests your thyroid dose is too high. I'll send in a prescription to your pharmacy with a lower dose. Please start this as soon as you can. We should repeat a blood test to confirm your thyroid level is back to normal. I've sent the order into your lab. Please mark your calendar to get the tests done in 6-8 weeks.", actions:["Send lower-dose thyroid Rx to pharmacy","Order TSH recheck in 6–8 weeks"] },
  { id:"tsh_low_not_on_meds",  group:"TSH", trigger:"TSH low (not on meds)",  text:"Your TSH (thyroid) is low which suggests you may have a hyperactive thyroid gland which can sometimes cause symptoms like a fast heartbeat, feeling warm, or unintended weight loss. We should recheck your blood test to confirm this. I've sent the order into your lab. Please mark your calendar to get the tests done in 6-8 weeks.", actions:["Order TSH recheck in 6–8 weeks"] },
  { id:"tsh_normal_on_meds",   group:"TSH", trigger:"TSH normal on meds",     text:"Your thyroid level (TSH) looks great. Your medication is working well and keeping your thyroid in the normal range. Keep taking it as prescribed.", actions:[] },
  { id:"tsh_normal_not_on_meds",group:"TSH",trigger:"TSH normal (not on meds)",text:"Your thyroid level (TSH) is normal.", actions:[] },
  { id:"tsh_high_on_meds",     group:"TSH", trigger:"TSH high on meds",       text:"Your TSH is higher than it should be which suggests you may need a higher dose of your thyroid medication if you've been taking it as prescribed. I'll send in a prescription to your pharmacy with a slightly higher dose. Please start this as soon as you can. We should repeat a blood test to confirm your thyroid level is back to normal. I've sent the order into your lab. Please mark your calendar to get the tests done in 6-8 weeks.", actions:["Send higher-dose thyroid Rx to pharmacy","Order TSH recheck in 6–8 weeks"] },
  { id:"tsh_high_not_on_meds", group:"TSH", trigger:"TSH high (not on meds)", text:"Your TSH is high which indicates your thyroid level is lower than normal. This can sometimes cause symptoms like fatigue, feeling cold, or weight gain. If you are feeling fine, we can just recheck in a year. If you are troubled by any of those symptoms, let me know and we can start a low dose of thyroid medication to see if it helps.", actions:[] },
  { id:"cbc_normal",           group:"CBC", trigger:"CBC normal",              text:"Your complete blood count, which checks your red blood cells, white blood cells, and platelets, is all normal.", actions:[] },
  { id:"mild_anemia",          group:"CBC", trigger:"Mild anemia needs labs",  text:"Your blood count shows a mild anemia, meaning your red blood cells are slightly lower than normal. I've ordered some additional lab tests to investigate why you have anemia. I'd like you to get these done in the next 2-3 weeks and schedule a follow-up visit with me (video visit OK) so we can review results and discuss next steps.", actions:["Order anemia workup labs","Schedule follow-up visit with patient (video OK)"] },
  { id:"bmp_normal",           group:"BMP", trigger:"BMP normal",              text:"Your electrolytes and kidney function are normal.", actions:[] },
  { id:"lfts_normal",          group:"LFTs",trigger:"LFTs normal",             text:"Your liver tests are normal.", actions:[] },
  { id:"transaminitis_new",    group:"LFTs",trigger:"Transaminitis new",       text:"Your liver enzymes (ALT, AST) are higher than normal. We need to repeat the test and include some others to look for the cause of this. Possible causes include alcohol, herbal medications or supplements, or fat collection in the liver. I've ordered repeat blood tests that I'd like you to do in about a month.", actions:["Order repeat LFTs + liver workup in ~1 month"] },
  { id:"transaminitis_still",  group:"LFTs",trigger:"Transaminitis still",     text:"Your liver enzymes remain mildly elevated as they have been previously. This is due to MASLD (metabolic-associated steatotic liver disease, previously known as fatty liver disease). Treat this with avoiding alcohol, herbs or supplements which can further irritate the liver and through weight loss. We should recheck blood tests every 6 months to monitor this condition.", actions:["Order repeat LFTs in 6 months"] },
  { id:"still_prediabetes",    group:"A1c", trigger:"Still prediabetes",       text:"Your A1c remains in the prediabetes range. Continue to limit sweets and simple carbohydrates (bread, rice, pasta, potatoes). Weight loss often helps eliminate prediabetes. We should recheck your A1c in one year. If you make significant changes and would like to see the effect on your A1c sooner, we can repeat tests as often as every 3 months.", actions:[] },
  { id:"new_prediabetes",      group:"A1c", trigger:"New prediabetes",         text:"Your A1c indicates that you have prediabetes (also known as borderline diabetes). With healthy diet and lifestyle and weight loss we can reduce the risk of you developing diabetes in the coming years. Limit sweets and simple carbohydrates (bread, rice, pasta, potatoes). Eat more fruits, vegetables, and whole grains. Weight loss through diet, exercise, and/or medication often helps eliminate prediabetes. We should recheck your A1c in one year. If you make significant changes and would like to see the effect on your A1c sooner, we can repeat tests as often as every 3 months.", actions:[] },
];

// ── Storage helpers ──────────────────────────────────────────────────────────
function loadSnippets() {
  try {
    const saved = localStorage.getItem("lab_snippets_v2");
    if (!saved) return DEFAULT_SNIPPETS;
    const parsed = JSON.parse(saved);
    const merged = DEFAULT_SNIPPETS.map(def => {
      const ov = parsed.find(s => s.id === def.id);
      return ov ? { ...def, text: ov.text, actions: ov.actions } : def;
    });
    const custom = parsed.filter(s => s.custom);
    return [...merged, ...custom];
  } catch { return DEFAULT_SNIPPETS; }
}
function saveSnippets(snippets) {
  localStorage.setItem("lab_snippets_v2", JSON.stringify(snippets));
}
function loadHeaderFooter() {
  try {
    const s = localStorage.getItem("lab_headerfooter");
    if (!s) return { header: DEFAULT_HEADER, footer: DEFAULT_FOOTER };
    return JSON.parse(s);
  } catch { return { header: DEFAULT_HEADER, footer: DEFAULT_FOOTER }; }
}
function saveHeaderFooter(hf) {
  localStorage.setItem("lab_headerfooter", JSON.stringify(hf));
}

function isCustomized(snippet) {
  if (snippet.custom) return true;
  const def = DEFAULT_SNIPPETS.find(d => d.id === snippet.id);
  if (!def) return false;
  return def.text !== snippet.text || JSON.stringify(def.actions) !== JSON.stringify(snippet.actions);
}

// ── Group helpers ────────────────────────────────────────────────────────────
function getGroups(snippets) {
  const groups = {};
  snippets.forEach(s => {
    const g = s.group || "Other";
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  });
  // Other always last
  const sorted = Object.keys(groups).filter(g => g !== "Other").sort();
  if (groups["Other"]) sorted.push("Other");
  return sorted.map(g => ({ name: g, snippets: groups[g] }));
}

// ── Conflict detection ───────────────────────────────────────────────────────
function getConflicts(triggeredIds, snippets) {
  const conflicts = new Set();
  const groupCounts = {};
  triggeredIds.forEach(id => {
    const s = snippets.find(sn => sn.id === id);
    if (!s || s.isWildcard) return;
    const g = s.group || "Other";
    if (!groupCounts[g]) groupCounts[g] = [];
    groupCounts[g].push(id);
  });
  Object.values(groupCounts).forEach(ids => {
    if (ids.length > 1) ids.forEach(id => conflicts.add(id));
  });
  return conflicts;
}



// ── Main Component ───────────────────────────────────────────────────────────
export default function App() {
  const [snippets, setSnippets] = useState(loadSnippets);
  const [hf, setHf] = useState(loadHeaderFooter);
  const [activeTab, setActiveTab] = useState("compose");
  const [triggered, setTriggered] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [matchStatus, setMatchStatus] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showNewNoteWarning, setShowNewNoteWarning] = useState(false);
  const [skipNewNoteWarning, setSkipNewNoteWarning] = useState(() => {
    try { return localStorage.getItem("lab_skip_new_note_warning") === "true"; } catch { return false; }
  });
  const [dontShowAgainChecked, setDontShowAgainChecked] = useState(false);

  const groups = getGroups(snippets);

  // Left accordion: all groups open by default
  const [leftOpen, setLeftOpen] = useState(() => {
    const initial = {};
    getGroups(loadSnippets()).forEach(g => { initial[g.name] = true; });
    return initial;
  });
  const [manageOpen, setManageOpen] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editActions, setEditActions] = useState("");
  const [editHf, setEditHf] = useState(null);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newTrigger, setNewTrigger] = useState({ trigger:"", text:"", actions:"", group:"", newGroup:"", useNew:false });
  const [showExport, setShowExport] = useState(false);
  const [exportEmail, setExportEmail] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [importDrag, setImportDrag] = useState(false);
  const recognitionRef = useRef(null);
  const matchTimerRef = useRef(null);
  const continuousRef = useRef(false);

  const conflicts = getConflicts(triggered, snippets);

  const allActions = [];
  triggered.forEach(id => {
    const s = snippets.find(sn => sn.id === id);
    if (s) s.actions?.forEach(a => { if (!allActions.includes(a)) allActions.push(a); });
  });
  const [checkedActions, setCheckedActions] = useState({});

  // Build ordered note lines: for each group, non-wildcards first, wildcards last
  const noteLines = (() => {
    const byGroup = {};
    triggered.forEach(id => {
      const s = snippets.find(sn => sn.id === id);
      if (!s) return;
      const g = s.group || "Other";
      if (!byGroup[g]) byGroup[g] = { normal:[], wildcards:[] };
      if (s.isWildcard) byGroup[g].wildcards.push(s);
      else byGroup[g].normal.push(s);
    });
    const lines = [];
    // preserve group order as triggered
    const seenGroups = [];
    triggered.forEach(id => {
      const s = snippets.find(sn => sn.id === id);
      if (!s) return;
      const g = s.group || "Other";
      if (!seenGroups.includes(g)) seenGroups.push(g);
    });
    seenGroups.forEach(g => {
      const entry = byGroup[g];
      if (!entry) return;
      entry.normal.forEach(s => lines.push({ id: s.id, text: s.text }));
      entry.wildcards.forEach(s => lines.push({ id: s.id, text: s.text }));
    });
    return lines;
  })();

  const fullNote = noteLines.length > 0
    ? `${hf.header}\n\n${noteLines.map(l => `• ${l.text}`).join("\n\n")}\n\n${hf.footer}`
    : "";

  // ── Speech recognition ─────────────────────────────────────────────────────
  const doClassify = useCallback(async (text) => {
    setMatchStatus({ text: `Heard: "${text}" — matching…`, type:"classifying" });
    try {
      const triggerList = snippets.map(s => s.trigger).join("\n");
      const res = await fetch("/api/classify", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ transcript: text, triggers: triggerList })
      });
      const data = await res.json();
      if (data.match && data.match !== "none") {
        const matched = snippets.find(s => s.trigger.toLowerCase() === data.match.toLowerCase());
        if (matched) {
          setTriggered(prev => [...prev, matched.id]);
          setMatchStatus({ text: `Matched: ${matched.trigger}`, type:"matched" });
          if (matchTimerRef.current) clearTimeout(matchTimerRef.current);
          matchTimerRef.current = setTimeout(() => {
            if (continuousRef.current) setMatchStatus(null);
          }, 1000);
          return;
        }
      }
      setMatchStatus({ text: `No match for "${text}"`, type:"nomatch" });
    } catch {
      setMatchStatus({ text:"Classification error — check connection", type:"error" });
    }
  }, [snippets]);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setMatchStatus({ text:"Speech recognition requires Chrome or Edge", type:"error" }); return; }

    continuousRef.current = true;
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = async (e) => {
      const text = e.results[0][0].transcript;
      await doClassify(text);
      // restart if still in continuous mode
      if (continuousRef.current) {
        try { recognition.start(); } catch {}
      }
    };
    recognition.onerror = (e) => {
      if (e.error === "no-speech" && continuousRef.current) {
        try { recognition.start(); } catch {}
        return;
      }
      if (e.error === "not-allowed") {
        setMatchStatus({ text:"Microphone access denied — check browser permissions", type:"error" });
        setIsListening(false);
        continuousRef.current = false;
      }
    };
    recognition.onend = () => {
      if (!continuousRef.current) setIsListening(false);
    };
    recognition.start();
  }, [doClassify]);

  const stopListening = useCallback(() => {
    continuousRef.current = false;
    recognitionRef.current?.stop();
    setIsListening(false);
    setMatchStatus(null);
  }, []);

  // ── Add trigger (from left menu or voice) ─────────────────────────────────
  const addTrigger = (id) => setTriggered(prev => [...prev, id]);

  const addWildcard = (group) => {
    const wcId = `wc_${group}_${Date.now()}`;
    const wc = { id: wcId, group, trigger:`${group} wildcard`, text:`${group}: ***`, actions:[], isWildcard:true, ephemeral:true };
    setSnippets(prev => [...prev, wc]);
    setTriggered(prev => [...prev, wcId]);
  };

  const removeTriggered = (idx) => setTriggered(prev => prev.filter((_, i) => i !== idx));

  const doNewNote = () => {
    setTriggered([]);
    setCheckedActions({});
    setMatchStatus(null);
    setCopied(false);
  };

  const handleNewNote = () => {
    if (triggered.length === 0) { doNewNote(); return; }
    if (skipNewNoteWarning) { doNewNote(); return; }
    setDontShowAgainChecked(false);
    setShowNewNoteWarning(true);
  };

  const confirmNewNote = () => {
    if (dontShowAgainChecked) {
      setSkipNewNoteWarning(true);
      try { localStorage.setItem("lab_skip_new_note_warning", "true"); } catch {}
    }
    setShowNewNoteWarning(false);
    doNewNote();
  };

  const clearAll = () => doNewNote();

  const copyNote = () => {
    navigator.clipboard.writeText(fullNote).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Snippet editing ────────────────────────────────────────────────────────
  const startEdit = (s) => { setEditingId(s.id); setEditText(s.text); setEditActions(s.actions?.join("\n") || ""); };
  const saveEdit = () => {
    const updated = snippets.map(s => s.id === editingId
      ? { ...s, text: editText, actions: editActions.split("\n").map(a=>a.trim()).filter(Boolean) }
      : s);
    setSnippets(updated); saveSnippets(updated); setEditingId(null);
  };
  const resetToDefault = (id) => {
    const def = DEFAULT_SNIPPETS.find(s => s.id === id);
    if (!def) return;
    const updated = snippets.map(s => s.id === id ? { ...s, text: def.text, actions: def.actions } : s);
    setSnippets(updated); saveSnippets(updated);
    if (editingId === id) { setEditText(def.text); setEditActions(def.actions.join("\n")); }
  };
  const deleteCustom = (id) => {
    const updated = snippets.filter(s => s.id !== id);
    setSnippets(updated); saveSnippets(updated);
  };

  // ── Header/footer editing ──────────────────────────────────────────────────
  const saveHf = () => { saveHeaderFooter(editHf); setHf(editHf); setEditHf(null); };

  // ── Add custom trigger ─────────────────────────────────────────────────────
  const saveCustom = () => {
    if (!newTrigger.trigger.trim() || !newTrigger.text.trim()) return;
    const group = newTrigger.useNew && newTrigger.newGroup.trim()
      ? newTrigger.newGroup.trim()
      : (newTrigger.group || "Other");
    const id = `custom_${Date.now()}`;
    const s = { id, group, trigger: newTrigger.trigger.trim(), text: newTrigger.text.trim(),
      actions: newTrigger.actions.split("\n").map(a=>a.trim()).filter(Boolean), custom:true };
    const updated = [...snippets, s];
    setSnippets(updated); saveSnippets(updated);
    setNewTrigger({ trigger:"", text:"", actions:"", group:"", newGroup:"", useNew:false });
    setShowAddCustom(false);
  };

  // ── Export / Import ────────────────────────────────────────────────────────
  const exportData = () => {
    const custom = snippets.filter(s => isCustomized(s));
    const hfData = hf;
    return JSON.stringify({ snippets: custom, headerFooter: hfData }, null, 2);
  };
  const handleDownload = () => {
    const blob = new Blob([exportData()], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download="lab-note-customizations.json"; a.click();
    URL.revokeObjectURL(url);
  };
  const handleEmailExport = () => {
    const data = exportData();
    const blob = new Blob([data], { type:"application/json" });
    const url = URL.createObjectURL(blob);
    const subject = encodeURIComponent("Lab Note Builder – My Customizations");
    const body = encodeURIComponent("My Lab Note Builder customizations are attached.");
    window.location.href = `mailto:${exportEmail}?subject=${subject}&body=${body}`;
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (data.snippets) {
          const updated = [...snippets];
          data.snippets.forEach(imp => {
            const idx = updated.findIndex(s => s.id === imp.id);
            if (idx >= 0) updated[idx] = { ...updated[idx], ...imp };
            else updated.push(imp);
          });
          setSnippets(updated); saveSnippets(updated);
        }
        if (data.headerFooter) { const newHf = { ...hf, ...data.headerFooter }; setHf(newHf); saveHeaderFooter(newHf); }
        setShowImport(false);
        alert("Import successful!");
      } catch { alert("Could not read file — make sure it is a valid export file."); }
    };
    reader.readAsText(file);
  };

  // ── Toggle left accordion ──────────────────────────────────────────────────
  const toggleLeft = (g) => setLeftOpen(p => ({ ...p, [g]: !p[g] }));
  const toggleManage = (g) => setManageOpen(p => ({ ...p, [g]: !p[g] }));

  // ── Existing groups for custom trigger dropdown ────────────────────────────
  const existingGroups = [...new Set(snippets.map(s => s.group || "Other").filter(g => g !== "Other"))].sort();

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh", background:"#eff6ff", fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* ── Outer frame centering wrapper ── */}
      <div style={{ maxWidth:1280, margin:"0 auto", minHeight:"100vh", background:"white", boxShadow:"0 0 40px rgba(30,64,175,0.08)" }}>

      {/* ── Header ── */}
      <div style={{ background:"linear-gradient(135deg,#1e40af 0%,#2563eb 100%)", padding:"0 1.5rem", display:"flex", alignItems:"center", justifyContent:"space-between", height:58, boxShadow:"0 2px 8px rgba(30,64,175,0.3)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
          </svg>
          <div>
            <span style={{ color:"white", fontWeight:700, fontSize:16, letterSpacing:"-0.01em" }}>Lab Results Note Builder</span>
            <span style={{ color:"rgba(255,255,255,0.7)", fontSize:12, marginLeft:10, fontStyle:"italic" }}>Speedy lab results notes in your words</span>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {/* New Note button */}
          <button onClick={handleNewNote} style={{
            display:"flex", alignItems:"center", gap:6,
            background:"rgba(255,255,255,0.15)", color:"white",
            border:"1px solid rgba(255,255,255,0.3)", borderRadius:7,
            padding:"5px 14px", cursor:"pointer", fontSize:13, fontWeight:500,
            transition:"background 0.15s"
          }}
            onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.25)"}
            onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.15)"}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New note
          </button>

          {/* Slider toggle */}
          <div style={{ display:"flex", background:"rgba(255,255,255,0.15)", borderRadius:30, padding:3, gap:2 }}>
            {[["compose","Compose Note"],["manage","Manage Snippets"]].map(([key,label]) => (
              <button key={key} onClick={() => setActiveTab(key)} style={{
                background: activeTab===key ? "white" : "transparent",
                color: activeTab===key ? "#1e40af" : "rgba(255,255,255,0.85)",
                border:"none", borderRadius:26, padding:"5px 16px", cursor:"pointer",
                fontSize:13, fontWeight: activeTab===key ? 600 : 400,
                transition:"all 0.2s", boxShadow: activeTab===key ? "0 1px 4px rgba(0,0,0,0.15)" : "none"
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── COMPOSE TAB ── */}
      {activeTab==="compose" && (
        <div style={{ maxWidth:1300, margin:"0 auto", padding:"1.25rem 1rem", display:"grid", gridTemplateColumns:"26% 1fr 26%", gap:"1rem" }}>

          {/* ── LEFT COLUMN: Click-to-add menu ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:"0.5rem" }}>
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 1px 3px rgba(0,0,0,0.08)", overflow:"hidden" }}>
              <div style={{ background:"#eff6ff", padding:"10px 14px", borderBottom:"1px solid #dbeafe" }}>
                <span style={{ fontSize:12, fontWeight:700, color:"#1e40af", textTransform:"uppercase", letterSpacing:"0.05em" }}>Add by clicking</span>
              </div>
              {groups.map(({ name, snippets:gSnippets }) => (
                <div key={name} style={{ borderBottom:"1px solid #f1f5f9" }}>
                  <button onClick={() => toggleLeft(name)} style={{
                    width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"9px 14px", background:"none", border:"none", cursor:"pointer",
                    fontSize:13, fontWeight:600, color:"#1e3a8a", textAlign:"left"
                  }}>
                    <span>{name}</span>
                    <span style={{ fontSize:10, color:"#93c5fd", transform: leftOpen[name]?"rotate(180deg)":"rotate(0)", transition:"0.2s" }}>▼</span>
                  </button>
                  {leftOpen[name] && (
                    <div style={{ background:"#f8fafc", borderTop:"1px solid #f1f5f9" }}>
                      {gSnippets.filter(s => !s.ephemeral).map(s => (
                        <button key={s.id} onClick={() => addTrigger(s.id)} style={{
                          width:"100%", textAlign:"left", padding:"7px 18px",
                          background:"none", border:"none", cursor:"pointer",
                          fontSize:12, color:"#374151", borderBottom:"1px solid #f1f5f9",
                          transition:"background 0.15s"
                        }}
                          onMouseEnter={e => e.currentTarget.style.background="#dbeafe"}
                          onMouseLeave={e => e.currentTarget.style.background="none"}
                        >
                          + {s.trigger}
                        </button>
                      ))}
                      {/* Wildcard */}
                      <button onClick={() => addWildcard(name)} style={{
                        width:"100%", textAlign:"left", padding:"7px 18px",
                        background:"none", border:"none", cursor:"pointer",
                        fontSize:12, color:"#6366f1", fontStyle:"italic", borderBottom:"1px solid #f1f5f9",
                        transition:"background 0.15s"
                      }}
                        onMouseEnter={e => e.currentTarget.style.background="#ede9fe"}
                        onMouseLeave={e => e.currentTarget.style.background="none"}
                      >
                        + {name}: ***
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── CENTER COLUMN ── */}
          <div style={{ display:"flex", flexDirection:"column", gap:"1rem" }}>

            {/* Mic card */}
            <div style={{ background:"white", borderRadius:12, padding:"1.25rem", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#6b7280", marginBottom:10, textTransform:"uppercase", letterSpacing:"0.05em" }}>Voice Input</div>
              <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                <button onClick={isListening ? stopListening : startListening} style={{
                  width:54, height:54, borderRadius:"50%", border:"none", cursor:"pointer", flexShrink:0,
                  background: isListening ? "#ef4444" : "#2563eb",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow: isListening ? "0 0 0 8px rgba(239,68,68,0.15)" : "0 2px 8px rgba(37,99,235,0.3)",
                  transition:"all 0.2s"
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {isListening
                      ? <rect x="6" y="6" width="12" height="12" rx="2"/>
                      : <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
                    }
                  </svg>
                </button>
                <div style={{ flex:1 }}>
                  {!matchStatus && !isListening && <div style={{ color:"#9ca3af", fontSize:13 }}>Press mic to start — keep speaking triggers, press stop when done</div>}
                  {isListening && !matchStatus && <div style={{ display:"flex", alignItems:"center", gap:8 }}><span style={{ width:8, height:8, borderRadius:"50%", background:"#ef4444", display:"inline-block", animation:"pulse 1s infinite" }}/><span style={{ color:"#ef4444", fontSize:13, fontWeight:500 }}>Listening…</span></div>}
                  {matchStatus?.type==="classifying" && <div style={{ color:"#6366f1", fontSize:13 }}>{matchStatus.text}</div>}
                  {matchStatus?.type==="matched" && <div style={{ display:"flex", alignItems:"center", gap:6 }}><span style={{ color:"#16a34a", fontSize:16 }}>✓</span><span style={{ color:"#16a34a", fontSize:13, fontWeight:500 }}>{matchStatus.text}</span></div>}
                  {matchStatus?.type==="nomatch" && <div style={{ color:"#d97706", fontSize:13 }}>{matchStatus.text}</div>}
                  {matchStatus?.type==="error" && <div style={{ color:"#dc2626", fontSize:13 }}>{matchStatus.text}</div>}
                </div>
              </div>
            </div>

            {/* Triggered pills */}
            {triggered.length > 0 && (
              <div style={{ background:"white", borderRadius:12, padding:"1.25rem", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.05em" }}>Triggered ({triggered.length})</div>
                  <button onClick={clearAll} style={{ fontSize:11, color:"#dc2626", background:"none", border:"none", cursor:"pointer" }}>Clear all</button>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                  {triggered.map((id, idx) => {
                    const s = snippets.find(sn => sn.id === id);
                    if (!s) return null;
                    const conflict = conflicts.has(id);
                    return (
                      <div key={`${id}-${idx}`} style={{
                        display:"flex", alignItems:"center", gap:5,
                        background: conflict ? "#fefce8" : "#eff6ff",
                        border: `1px solid ${conflict ? "#fde047" : "#93c5fd"}`,
                        borderRadius:20, padding:"4px 10px 4px 12px"
                      }}>
                        <span style={{ fontSize:12, color: conflict ? "#854d0e" : "#1e40af", fontWeight:500 }}>{s.trigger}</span>
                        <button onClick={() => removeTriggered(idx)} style={{ background:"none", border:"none", cursor:"pointer", color: conflict ? "#fde047" : "#93c5fd", fontSize:15, lineHeight:1, padding:0 }}>×</button>
                      </div>
                    );
                  })}
                </div>
                {conflicts.size > 0 && <div style={{ marginTop:10, fontSize:11, color:"#d97706" }}>⚠ Yellow items are from the same lab group — review for conflicts</div>}
              </div>
            )}

            {/* Note preview */}
            <div style={{ background:"white", borderRadius:12, padding:"1.25rem", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", flex:1 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.05em" }}>Patient Note Preview</div>
                {noteLines.length > 0 && (
                  <button onClick={copyNote} style={{
                    display:"flex", alignItems:"center", gap:6, background: copied ? "#16a34a" : "#2563eb",
                    color:"white", border:"none", borderRadius:7, padding:"6px 14px", cursor:"pointer",
                    fontSize:12, fontWeight:500, transition:"background 0.2s"
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      {copied ? <polyline points="20 6 9 17 4 12"/> : <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>}
                    </svg>
                    {copied ? "Copied!" : "Copy note"}
                  </button>
                )}
              </div>
              {noteLines.length === 0
                ? <div style={{ color:"#d1d5db", fontSize:13, fontStyle:"italic", textAlign:"center", padding:"2rem 0" }}>Your note will appear here as you add triggers</div>
                : <div style={{ fontSize:13, lineHeight:1.75, color:"#1f2937" }}>
                    <div style={{ color:"#374151", marginBottom:"1rem", fontStyle:"italic", borderLeft:"3px solid #bfdbfe", paddingLeft:12, fontSize:12 }}>{hf.header}</div>
                    {noteLines.map((line, i) => (
                      <div key={i} style={{ display:"flex", gap:8, marginBottom:"0.7rem" }}>
                        <span style={{ color:"#2563eb", fontWeight:700, flexShrink:0 }}>•</span>
                        <span>{line.text}</span>
                      </div>
                    ))}
                    <div style={{ color:"#374151", marginTop:"1rem", fontStyle:"italic", borderLeft:"3px solid #bfdbfe", paddingLeft:12, fontSize:12 }}>{hf.footer}</div>
                  </div>
              }
            </div>
          </div>

          {/* ── RIGHT COLUMN: Clinician To-Do ── */}
          <div>
            <div style={{ background:"white", borderRadius:12, padding:"1.25rem", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", position:"sticky", top:"1rem" }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:4 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <div style={{ fontSize:11, fontWeight:700, color:"#92400e", textTransform:"uppercase", letterSpacing:"0.05em" }}>Clinician To-Do</div>
              </div>
              <div style={{ fontSize:11, color:"#9ca3af", marginBottom:14 }}>Required actions from this note</div>
              {allActions.length === 0
                ? <div style={{ color:"#d1d5db", fontSize:12, fontStyle:"italic", textAlign:"center", padding:"1.5rem 0" }}>Action items appear here when relevant triggers are added</div>
                : <div style={{ display:"flex", flexDirection:"column", gap:9 }}>
                    {allActions.map((a, i) => (
                      <label key={i} style={{ display:"flex", alignItems:"flex-start", gap:9, cursor:"pointer" }}>
                        <input type="checkbox" checked={!!checkedActions[a]} onChange={() => setCheckedActions(p=>({...p,[a]:!p[a]}))}
                          style={{ marginTop:2, accentColor:"#2563eb", width:14, height:14, flexShrink:0 }} />
                        <span style={{ fontSize:12, lineHeight:1.5, color: checkedActions[a] ? "#9ca3af" : "#1f2937", textDecoration: checkedActions[a] ? "line-through" : "none" }}>{a}</span>
                      </label>
                    ))}
                  </div>
              }
              {allActions.length > 0 && (
                <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid #f3f4f6", fontSize:11, color:"#9ca3af" }}>
                  {Object.values(checkedActions).filter(Boolean).length} of {allActions.length} completed
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MANAGE SNIPPETS TAB ── */}
      {activeTab==="manage" && (
        <div style={{ maxWidth:860, margin:"0 auto", padding:"1.25rem 1rem" }}>

          {/* Header/footer edit */}
          <div style={{ background:"white", borderRadius:12, padding:"1.25rem", boxShadow:"0 1px 3px rgba(0,0,0,0.08)", marginBottom:"1rem" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontSize:12, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.05em" }}>Header &amp; Footer</div>
              {!editHf && <button onClick={() => setEditHf({...hf})} style={{ fontSize:12, color:"#2563eb", background:"none", border:"1px solid #bfdbfe", borderRadius:6, padding:"4px 10px", cursor:"pointer" }}>Edit</button>}
            </div>
            {editHf ? (
              <div style={{ marginTop:12 }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:4 }}>Header</div>
                <textarea value={editHf.header} onChange={e => setEditHf(p=>({...p,header:e.target.value}))}
                  style={{ width:"100%", minHeight:60, fontSize:13, border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }} />
                <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginTop:10, marginBottom:4 }}>Footer</div>
                <textarea value={editHf.footer} onChange={e => setEditHf(p=>({...p,footer:e.target.value}))}
                  style={{ width:"100%", minHeight:60, fontSize:13, border:"1px solid #d1d5db", borderRadius:8, padding:"8px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }} />
                <div style={{ display:"flex", gap:8, marginTop:10 }}>
                  <button onClick={saveHf} style={{ fontSize:12, background:"#2563eb", color:"white", border:"none", borderRadius:7, padding:"6px 14px", cursor:"pointer" }}>Save</button>
                  <button onClick={() => setEditHf(null)} style={{ fontSize:12, background:"none", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:7, padding:"6px 14px", cursor:"pointer" }}>Cancel</button>
                  <button onClick={() => { const def={header:DEFAULT_HEADER,footer:DEFAULT_FOOTER}; setEditHf(def); }} style={{ fontSize:12, background:"none", color:"#dc2626", border:"1px solid #fee2e2", borderRadius:7, padding:"6px 14px", cursor:"pointer", marginLeft:"auto" }}>Reset to default</button>
                </div>
              </div>
            ) : (
              <div style={{ marginTop:8, fontSize:12, color:"#6b7280", lineHeight:1.5 }}>
                <div><strong>Header:</strong> {hf.header.slice(0,80)}…</div>
                <div style={{ marginTop:4 }}><strong>Footer:</strong> {hf.footer.slice(0,80)}…</div>
              </div>
            )}
          </div>

          {/* Export / Import / Add Custom buttons */}
          <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap" }}>
            <button onClick={() => setShowAddCustom(true)} style={{ fontSize:12, background:"#2563eb", color:"white", border:"none", borderRadius:7, padding:"7px 14px", cursor:"pointer", fontWeight:500 }}>+ Add custom trigger</button>
            <button onClick={() => setShowExport(true)} style={{ fontSize:12, background:"white", color:"#2563eb", border:"1px solid #bfdbfe", borderRadius:7, padding:"7px 14px", cursor:"pointer" }}>Export customizations</button>
            <button onClick={() => setShowImport(true)} style={{ fontSize:12, background:"white", color:"#2563eb", border:"1px solid #bfdbfe", borderRadius:7, padding:"7px 14px", cursor:"pointer" }}>Import customizations</button>
          </div>

          {/* Snippets accordion by group */}
          {groups.map(({ name, snippets: gSnippets }) => (
            <div key={name} style={{ background:"white", borderRadius:12, boxShadow:"0 1px 3px rgba(0,0,0,0.08)", marginBottom:"0.75rem", overflow:"hidden" }}>
              <button onClick={() => toggleManage(name)} style={{
                width:"100%", display:"flex", justifyContent:"space-between", alignItems:"center",
                padding:"12px 18px", background: manageOpen[name] ? "#eff6ff" : "white",
                border:"none", cursor:"pointer", fontSize:14, fontWeight:600, color:"#1e3a8a"
              }}>
                <span>{name}</span>
                <span style={{ fontSize:11, color:"#93c5fd", transform: manageOpen[name]?"rotate(180deg)":"rotate(0)", transition:"0.2s" }}>▼</span>
              </button>
              {manageOpen[name] && (
                <div style={{ borderTop:"1px solid #dbeafe" }}>
                  {gSnippets.filter(s => !s.ephemeral).map(s => (
                    <div key={s.id} style={{ padding:"12px 18px", borderBottom:"1px solid #f8fafc" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontWeight:600, fontSize:13, color:"#1f2937" }}>{s.trigger}</span>
                          {isCustomized(s) && <span style={{ fontSize:10, background:"#fef3c7", color:"#92400e", borderRadius:10, padding:"2px 7px", fontWeight:500 }}>Customized</span>}
                        </div>
                        {editingId !== s.id && (
                          <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                            <button onClick={() => startEdit(s)} style={{ fontSize:11, color:"#2563eb", background:"none", border:"1px solid #bfdbfe", borderRadius:5, padding:"3px 9px", cursor:"pointer" }}>Edit</button>
                            {s.custom
                              ? <button onClick={() => deleteCustom(s.id)} style={{ fontSize:11, color:"#dc2626", background:"none", border:"1px solid #fee2e2", borderRadius:5, padding:"3px 9px", cursor:"pointer" }}>Delete</button>
                              : isCustomized(s) && <button onClick={() => resetToDefault(s.id)} style={{ fontSize:11, color:"#dc2626", background:"none", border:"1px solid #fee2e2", borderRadius:5, padding:"3px 9px", cursor:"pointer" }}>Reset</button>
                            }
                          </div>
                        )}
                      </div>
                      {editingId === s.id ? (
                        <div style={{ marginTop:10 }}>
                          <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:3 }}>Patient-facing text</div>
                          <textarea value={editText} onChange={e=>setEditText(e.target.value)}
                            style={{ width:"100%", minHeight:90, fontSize:12, border:"1px solid #d1d5db", borderRadius:7, padding:"8px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }} />
                          <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginTop:10, marginBottom:3 }}>Clinician action items (one per line)</div>
                          <textarea value={editActions} onChange={e=>setEditActions(e.target.value)}
                            style={{ width:"100%", minHeight:55, fontSize:12, border:"1px solid #d1d5db", borderRadius:7, padding:"8px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box" }} />
                          <div style={{ display:"flex", gap:7, marginTop:9 }}>
                            <button onClick={saveEdit} style={{ fontSize:12, background:"#2563eb", color:"white", border:"none", borderRadius:6, padding:"6px 13px", cursor:"pointer" }}>Save</button>
                            <button onClick={()=>setEditingId(null)} style={{ fontSize:12, background:"none", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:6, padding:"6px 13px", cursor:"pointer" }}>Cancel</button>
                            {!s.custom && <button onClick={()=>resetToDefault(s.id)} style={{ fontSize:12, background:"none", color:"#dc2626", border:"1px solid #fee2e2", borderRadius:6, padding:"6px 13px", cursor:"pointer", marginLeft:"auto" }}>Reset to default</button>}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize:12, color:"#6b7280", marginTop:5, lineHeight:1.5 }}>{s.text.slice(0,120)}{s.text.length>120?"…":""}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── MODAL: Add custom trigger ── */}
      {showAddCustom && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"white", borderRadius:14, padding:"1.5rem", width:500, maxWidth:"95vw", boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontWeight:700, fontSize:15, color:"#1e3a8a", marginBottom:14 }}>Add custom trigger &amp; snippet</div>
            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:3 }}>Trigger phrase (what you speak or click)</div>
            <input value={newTrigger.trigger} onChange={e=>setNewTrigger(p=>({...p,trigger:e.target.value}))}
              placeholder="e.g. Lipids normal" style={{ width:"100%", fontSize:13, border:"1px solid #d1d5db", borderRadius:7, padding:"7px 10px", boxSizing:"border-box", marginBottom:10 }} />
            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:3 }}>Patient-facing snippet text</div>
            <textarea value={newTrigger.text} onChange={e=>setNewTrigger(p=>({...p,text:e.target.value}))}
              placeholder="Text that appears in the note…" style={{ width:"100%", minHeight:80, fontSize:13, border:"1px solid #d1d5db", borderRadius:7, padding:"7px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box", marginBottom:10 }} />
            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:3 }}>Clinician action items (one per line, optional)</div>
            <textarea value={newTrigger.actions} onChange={e=>setNewTrigger(p=>({...p,actions:e.target.value}))}
              placeholder="Optional action items…" style={{ width:"100%", minHeight:50, fontSize:13, border:"1px solid #d1d5db", borderRadius:7, padding:"7px 10px", resize:"vertical", fontFamily:"inherit", boxSizing:"border-box", marginBottom:10 }} />
            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:5 }}>Lab group</div>
            <div style={{ display:"flex", gap:8, marginBottom:8, flexWrap:"wrap" }}>
              {existingGroups.map(g => (
                <button key={g} onClick={() => setNewTrigger(p=>({...p,group:g,useNew:false}))} style={{
                  fontSize:12, padding:"4px 10px", borderRadius:15, border:"1px solid",
                  borderColor: newTrigger.group===g && !newTrigger.useNew ? "#2563eb" : "#d1d5db",
                  background: newTrigger.group===g && !newTrigger.useNew ? "#eff6ff" : "white",
                  color: newTrigger.group===g && !newTrigger.useNew ? "#1e40af" : "#374151",
                  cursor:"pointer"
                }}>{g}</button>
              ))}
              <button onClick={() => setNewTrigger(p=>({...p,group:"Other",useNew:false}))} style={{
                fontSize:12, padding:"4px 10px", borderRadius:15, border:"1px solid",
                borderColor: newTrigger.group==="Other" && !newTrigger.useNew ? "#2563eb" : "#d1d5db",
                background: newTrigger.group==="Other" && !newTrigger.useNew ? "#eff6ff" : "white",
                color: newTrigger.group==="Other" && !newTrigger.useNew ? "#1e40af" : "#374151",
                cursor:"pointer"
              }}>Other</button>
              <button onClick={() => setNewTrigger(p=>({...p,useNew:true,group:""}))} style={{
                fontSize:12, padding:"4px 10px", borderRadius:15, border:"1px solid",
                borderColor: newTrigger.useNew ? "#2563eb" : "#d1d5db",
                background: newTrigger.useNew ? "#eff6ff" : "white",
                color: newTrigger.useNew ? "#1e40af" : "#374151",
                cursor:"pointer"
              }}>+ New group</button>
            </div>
            {newTrigger.useNew && (
              <input value={newTrigger.newGroup} onChange={e=>setNewTrigger(p=>({...p,newGroup:e.target.value}))}
                placeholder="New lab group name" style={{ width:"100%", fontSize:13, border:"1px solid #d1d5db", borderRadius:7, padding:"7px 10px", boxSizing:"border-box", marginBottom:10 }} />
            )}
            <div style={{ display:"flex", gap:8, marginTop:14 }}>
              <button onClick={saveCustom} disabled={!newTrigger.trigger.trim()||!newTrigger.text.trim()} style={{
                fontSize:13, background: (!newTrigger.trigger.trim()||!newTrigger.text.trim()) ? "#93c5fd" : "#2563eb",
                color:"white", border:"none", borderRadius:7, padding:"7px 16px", cursor:"pointer", fontWeight:500
              }}>Add trigger</button>
              <button onClick={() => setShowAddCustom(false)} style={{ fontSize:13, background:"none", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:7, padding:"7px 16px", cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Export ── */}
      {showExport && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"white", borderRadius:14, padding:"1.5rem", width:420, maxWidth:"95vw", boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontWeight:700, fontSize:15, color:"#1e3a8a", marginBottom:12 }}>Export customizations</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:16 }}>Export your customized snippets and header/footer so you can import them in another browser.</div>
            <button onClick={handleDownload} style={{ width:"100%", fontSize:13, background:"#2563eb", color:"white", border:"none", borderRadius:8, padding:"9px", cursor:"pointer", fontWeight:500, marginBottom:10 }}>
              ↓ Download file
            </button>
            <div style={{ fontSize:11, fontWeight:600, color:"#6b7280", marginBottom:5 }}>Or email to:</div>
            <div style={{ display:"flex", gap:7 }}>
              <input value={exportEmail} onChange={e=>setExportEmail(e.target.value)} placeholder="your@email.com"
                style={{ flex:1, fontSize:13, border:"1px solid #d1d5db", borderRadius:7, padding:"7px 10px" }} />
              <button onClick={handleEmailExport} disabled={!exportEmail.trim()} style={{ fontSize:13, background: exportEmail.trim() ? "#2563eb" : "#93c5fd", color:"white", border:"none", borderRadius:7, padding:"7px 12px", cursor:"pointer" }}>Send</button>
            </div>
            <button onClick={() => setShowExport(false)} style={{ marginTop:14, fontSize:12, background:"none", color:"#6b7280", border:"none", cursor:"pointer" }}>Close</button>
          </div>
        </div>
      )}

      {/* ── MODAL: Import ── */}
      {showImport && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:"white", borderRadius:14, padding:"1.5rem", width:420, maxWidth:"95vw", boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ fontWeight:700, fontSize:15, color:"#1e3a8a", marginBottom:12 }}>Import customizations</div>
            <div style={{ fontSize:13, color:"#6b7280", marginBottom:16 }}>Imported customizations will overwrite any matching local edits. Snippets not in the import file will be kept.</div>
            <div
              onDragOver={e => { e.preventDefault(); setImportDrag(true); }}
              onDragLeave={() => setImportDrag(false)}
              onDrop={e => { e.preventDefault(); setImportDrag(false); const f=e.dataTransfer.files[0]; if(f) handleImportFile(f); }}
              style={{
                border:`2px dashed ${importDrag ? "#2563eb" : "#bfdbfe"}`,
                background: importDrag ? "#eff6ff" : "#f8fafc",
                borderRadius:10, padding:"2rem", textAlign:"center", marginBottom:14, transition:"all 0.2s"
              }}
            >
              <div style={{ fontSize:13, color:"#6b7280", marginBottom:10 }}>Drag and drop your export file here</div>
              <label style={{ fontSize:12, background:"#2563eb", color:"white", borderRadius:7, padding:"7px 14px", cursor:"pointer" }}>
                Or select file
                <input type="file" accept=".json" onChange={e => { if(e.target.files[0]) handleImportFile(e.target.files[0]); }} style={{ display:"none" }} />
              </label>
            </div>
            <button onClick={() => setShowImport(false)} style={{ fontSize:12, background:"none", color:"#6b7280", border:"none", cursor:"pointer" }}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── MODAL: New Note warning ── */}
      {showNewNoteWarning && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200 }}>
          <div style={{ background:"white", borderRadius:14, padding:"1.75rem", width:400, maxWidth:"95vw", boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <div style={{ fontWeight:700, fontSize:15, color:"#1e3a8a" }}>Start a new note?</div>
            </div>
            <div style={{ fontSize:13, color:"#4b5563", lineHeight:1.6, marginBottom:20 }}>
              This will clear the current note and all triggered items. Your snippets and settings in Manage Snippets will not be affected.
            </div>
            <label style={{ display:"flex", alignItems:"center", gap:9, marginBottom:20, cursor:"pointer" }}>
              <input type="checkbox" checked={dontShowAgainChecked} onChange={e => setDontShowAgainChecked(e.target.checked)}
                style={{ width:15, height:15, accentColor:"#2563eb", flexShrink:0 }} />
              <span style={{ fontSize:13, color:"#6b7280" }}>Don't show this warning again</span>
            </label>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={confirmNewNote} style={{ fontSize:13, background:"#2563eb", color:"white", border:"none", borderRadius:7, padding:"8px 18px", cursor:"pointer", fontWeight:500 }}>
                Clear and start new
              </button>
              <button onClick={() => setShowNewNoteWarning(false)} style={{ fontSize:13, background:"none", color:"#6b7280", border:"1px solid #d1d5db", borderRadius:7, padding:"8px 18px", cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing:border-box; }
        textarea:focus, input:focus { outline:none; border-color:#2563eb !important; box-shadow:0 0 0 3px rgba(37,99,235,0.12); }
        @media(max-width:900px) { .three-col { grid-template-columns:1fr !important; } }
      `}</style>
      </div>{/* end frame */}
    </div>
  );
}
