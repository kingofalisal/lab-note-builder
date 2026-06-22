import { useState, useEffect, useRef } from "react";

const HEADER = "Thank you for getting your lab tests done. Here is my interpretation of your results.";
const FOOTER = "Other lab abnormalities not mentioned are not of any importance to your health. If you have further questions about your results, please send me a MyHealth message or schedule a video visit so we can discuss in more detail.";

const DEFAULT_SNIPPETS = [
  {
    id: "tsh_low_on_meds",
    trigger: "TSH low on meds",
    text: "Your TSH is low which suggests your thyroid dose is too high. I'll send in a prescription to your pharmacy with a lower dose. Please start this as soon as you can. We should repeat a blood test to confirm your thyroid level is back to normal. I've sent the order into your lab. Please mark your calendar to get the tests done in 6-8 weeks.",
    actions: ["Send lower-dose thyroid Rx to pharmacy", "Order TSH recheck in 6–8 weeks"]
  },
  {
    id: "tsh_low_not_on_meds",
    trigger: "TSH low (not on meds)",
    text: "Your TSH (thyroid) is low which suggests you may have a hyperactive thyroid gland which can sometimes cause symptoms like a fast heartbeat, feeling warm, or unintended weight loss. We should recheck your blood test to confirm this. I've sent the order into your lab. Please mark your calendar to get the tests done in 6-8 weeks.",
    actions: ["Order TSH recheck in 6–8 weeks"]
  },
  {
    id: "tsh_normal_on_meds",
    trigger: "TSH normal on meds",
    text: "Your thyroid level (TSH) looks great. Your medication is working well and keeping your thyroid in the normal range. Keep taking it as prescribed.",
    actions: []
  },
  {
    id: "tsh_normal_not_on_meds",
    trigger: "TSH normal (not on meds)",
    text: "Your thyroid level (TSH) is normal.",
    actions: []
  },
  {
    id: "tsh_high_on_meds",
    trigger: "TSH high on meds",
    text: "Your TSH is higher than it should be which suggests you may need a higher dose of your thyroid medication if you've been taking it as prescribed. I'll send in a prescription to your pharmacy with a slightly higher dose. Please start this as soon as you can. We should repeat a blood test to confirm your thyroid level is back to normal. I've sent the order into your lab. Please mark your calendar to get the tests done in 6-8 weeks.",
    actions: ["Send higher-dose thyroid Rx to pharmacy", "Order TSH recheck in 6–8 weeks"]
  },
  {
    id: "tsh_high_not_on_meds",
    trigger: "TSH high (not on meds)",
    text: "Your TSH is high which indicates your thyroid level is lower than normal. This can sometimes cause symptoms like fatigue, feeling cold, or weight gain. If you are feeling fine, we can just recheck in a year. If you are troubled by any of those symptoms, let me know and we can start a low dose of thyroid medication to see if it helps.",
    actions: []
  },
  {
    id: "cbc_normal",
    trigger: "CBC normal",
    text: "Your complete blood count, which checks your red blood cells, white blood cells, and platelets, is all normal.",
    actions: []
  },
  {
    id: "mild_anemia",
    trigger: "Mild anemia needs labs",
    text: "Your blood count shows a mild anemia, meaning your red blood cells are slightly lower than normal. I've ordered some additional lab tests to investigate why you have anemia. I'd like you to get these done in the next 2-3 weeks and schedule a follow-up visit with me (video visit OK) so we can review results and discuss next steps.",
    actions: ["Order anemia workup labs", "Schedule follow-up visit with patient (video OK)"]
  },
  {
    id: "bmp_normal",
    trigger: "BMP normal",
    text: "Your electrolytes and kidney function are normal.",
    actions: []
  },
  {
    id: "lfts_normal",
    trigger: "LFTs normal",
    text: "Your liver tests are normal.",
    actions: []
  },
  {
    id: "transaminitis_new",
    trigger: "Transaminitis new",
    text: "Your liver enzymes (ALT, AST) are higher than normal. We need to repeat the test and include some others to look for the cause of this. Possible causes include alcohol, herbal medications or supplements, or fat collection in the liver. I've ordered repeat blood tests that I'd like you to do in about a month.",
    actions: ["Order repeat LFTs + liver workup in ~1 month"]
  },
  {
    id: "transaminitis_still",
    trigger: "Transaminitis still",
    text: "Your liver enzymes remain mildly elevated as they have been previously. This is due to MASLD (metabolic-associated steatotic liver disease, previously known as fatty liver disease). Treat this with avoiding alcohol, herbs or supplements which can further irritate the liver and through weight loss. We should recheck blood tests every 6 months to monitor this condition.",
    actions: ["Order repeat LFTs in 6 months"]
  },
  {
    id: "still_prediabetes",
    trigger: "Still prediabetes",
    text: "Your A1c remains in the prediabetes range. Continue to limit sweets and simple carbohydrates (bread, rice, pasta, potatoes). Weight loss often helps eliminate prediabetes. We should recheck your A1c in one year. If you make significant changes and would like to see the effect on your A1c sooner, we can repeat tests as often as every 3 months.",
    actions: []
  },
  {
    id: "new_prediabetes",
    trigger: "New prediabetes",
    text: "Your A1c indicates that you have prediabetes (also known as borderline diabetes). With healthy diet and lifestyle and weight loss we can reduce the risk of you developing diabetes in the coming years. Limit sweets and simple carbohydrates (bread, rice, pasta, potatoes). Eat more fruits, vegetables, and whole grains. Weight loss through diet, exercise, and/or medication often helps eliminate prediabetes. We should recheck your A1c in one year. If you make significant changes and would like to see the effect on your A1c sooner, we can repeat tests as often as every 3 months.",
    actions: []
  }
];

function loadSnippets() {
  try {
    const saved = localStorage.getItem("lab_snippets");
    if (!saved) return DEFAULT_SNIPPETS;
    const parsed = JSON.parse(saved);
    // Merge: keep default structure, overlay saved text/actions per id
    return DEFAULT_SNIPPETS.map(def => {
      const override = parsed.find(s => s.id === def.id);
      return override ? { ...def, text: override.text, actions: override.actions } : def;
    });
  } catch {
    return DEFAULT_SNIPPETS;
  }
}

function saveSnippets(snippets) {
  localStorage.setItem("lab_snippets", JSON.stringify(snippets));
}

export default function App() {
  const [snippets, setSnippets] = useState(loadSnippets);
  const [activeTab, setActiveTab] = useState("compose"); // compose | manage
  const [triggered, setTriggered] = useState([]); // array of snippet ids in order
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [status, setStatus] = useState("idle"); // idle | listening | classifying | matched | nomatch | error
  const [lastMatch, setLastMatch] = useState(null);
  const [copied, setCopied] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editActions, setEditActions] = useState("");
  const recognitionRef = useRef(null);

  // Actions panel: collect all actions from triggered snippets, deduped
  const allActions = [];
  triggered.forEach(id => {
    const s = snippets.find(sn => sn.id === id);
    if (s) s.actions.forEach(a => { if (!allActions.includes(a)) allActions.push(a); });
  });
  const [checkedActions, setCheckedActions] = useState({});

  const toggleAction = (a) => setCheckedActions(prev => ({ ...prev, [a]: !prev[a] }));

  // Build note text
  const noteLines = triggered.map(id => snippets.find(s => s.id === id)?.text).filter(Boolean);
  const fullNote = noteLines.length > 0
    ? `${HEADER}\n\n${noteLines.map(l => `• ${l}`).join("\n\n")}\n\n${FOOTER}`
    : "";

  // Speech recognition
  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setStatus("error");
      setTranscript("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => { setIsListening(true); setStatus("listening"); setTranscript(""); };
    recognition.onresult = async (e) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
      setStatus("classifying");
      setIsListening(false);
      await classify(text);
    };
    recognition.onerror = (e) => {
      setIsListening(false);
      setStatus("error");
      setTranscript(e.error === "not-allowed" ? "Microphone access was denied. Please allow microphone access and try again." : `Error: ${e.error}`);
    };
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setStatus("idle");
  };

  const classify = async (text) => {
    try {
      const triggerList = snippets.map(s => s.trigger).join("\n");
      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text, triggers: triggerList })
      });
      const data = await res.json();
      if (data.match && data.match !== "none") {
        const matched = snippets.find(s => s.trigger.toLowerCase() === data.match.toLowerCase());
        if (matched) {
          setTriggered(prev => prev.includes(matched.id) ? prev : [...prev, matched.id]);
          setLastMatch(matched.trigger);
          setStatus("matched");
          return;
        }
      }
      setStatus("nomatch");
      setLastMatch(null);
    } catch {
      setStatus("error");
      setTranscript("Could not reach the classification service. Check your internet connection.");
    }
  };

  const removeTriggered = (id) => setTriggered(prev => prev.filter(x => x !== id));
  const clearAll = () => { setTriggered([]); setCheckedActions({}); setStatus("idle"); setTranscript(""); setLastMatch(null); };

  const copyNote = () => {
    navigator.clipboard.writeText(fullNote).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Snippet editor
  const startEdit = (s) => {
    setEditingId(s.id);
    setEditText(s.text);
    setEditActions(s.actions.join("\n"));
  };
  const saveEdit = () => {
    const updated = snippets.map(s => s.id === editingId
      ? { ...s, text: editText, actions: editActions.split("\n").map(a => a.trim()).filter(Boolean) }
      : s
    );
    setSnippets(updated);
    saveSnippets(updated);
    setEditingId(null);
  };
  const resetToDefault = (id) => {
    const def = DEFAULT_SNIPPETS.find(s => s.id === id);
    const updated = snippets.map(s => s.id === id ? { ...s, text: def.text, actions: def.actions } : s);
    setSnippets(updated);
    saveSnippets(updated);
    if (editingId === id) { setEditText(def.text); setEditActions(def.actions.join("\n")); }
  };

  const isCustomized = (id) => {
    const def = DEFAULT_SNIPPETS.find(s => s.id === id);
    const cur = snippets.find(s => s.id === id);
    return def && cur && (def.text !== cur.text || JSON.stringify(def.actions) !== JSON.stringify(cur.actions));
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#8C1515", padding: "0 2rem", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
          </svg>
          <span style={{ color: "white", fontWeight: 600, fontSize: 16, letterSpacing: "-0.01em" }}>Lab Results Note Builder</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["compose", "manage"].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              background: activeTab === tab ? "rgba(255,255,255,0.2)" : "transparent",
              color: "white", border: "none", borderRadius: 6, padding: "6px 14px",
              cursor: "pointer", fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
              textTransform: "capitalize"
            }}>{tab === "compose" ? "Compose Note" : "Manage Snippets"}</button>
          ))}
        </div>
      </div>

      {activeTab === "compose" && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1rem", display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem" }}>

          {/* Left: mic + note */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Mic card */}
            <div style={{ background: "white", borderRadius: 12, padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Voice Input</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <button
                  onClick={isListening ? stopListening : startListening}
                  style={{
                    width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer",
                    background: isListening ? "#ef4444" : "#8C1515",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: isListening ? "0 0 0 8px rgba(239,68,68,0.15)" : "none",
                    transition: "all 0.2s", flexShrink: 0
                  }}
                  title={isListening ? "Stop listening" : "Start listening"}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {isListening
                      ? <><rect x="6" y="6" width="12" height="12" rx="2"/></>
                      : <><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></>
                    }
                  </svg>
                </button>
                <div style={{ flex: 1 }}>
                  {status === "idle" && <div style={{ color: "#9ca3af", fontSize: 14 }}>Press the mic and speak a trigger phrase</div>}
                  {status === "listening" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite" }}/>
                      <span style={{ color: "#ef4444", fontSize: 14, fontWeight: 500 }}>Listening…</span>
                    </div>
                  )}
                  {status === "classifying" && <div style={{ color: "#6366f1", fontSize: 14 }}>Heard: "<em>{transcript}</em>" — matching…</div>}
                  {status === "matched" && <div style={{ color: "#16a34a", fontSize: 14, fontWeight: 500 }}>✓ Matched: <strong>{lastMatch}</strong></div>}
                  {status === "nomatch" && <div style={{ color: "#d97706", fontSize: 14 }}>No match found for "<em>{transcript}</em>" — try again</div>}
                  {status === "error" && <div style={{ color: "#dc2626", fontSize: 14 }}>{transcript}</div>}
                </div>
              </div>
              {status !== "idle" && (
                <button onClick={() => { setStatus("idle"); setTranscript(""); setLastMatch(null); }}
                  style={{ marginTop: 10, fontSize: 12, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Clear status
                </button>
              )}
            </div>

            {/* Triggered snippets list */}
            {triggered.length > 0 && (
              <div style={{ background: "white", borderRadius: 12, padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Triggered ({triggered.length})</div>
                  <button onClick={clearAll} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}>Clear all</button>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {triggered.map(id => {
                    const s = snippets.find(sn => sn.id === id);
                    return s ? (
                      <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 20, padding: "4px 10px 4px 12px" }}>
                        <span style={{ fontSize: 13, color: "#166534", fontWeight: 500 }}>{s.trigger}</span>
                        <button onClick={() => removeTriggered(id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#86efac", lineHeight: 1, padding: 0, fontSize: 16 }}>×</button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            {/* Note preview */}
            <div style={{ background: "white", borderRadius: 12, padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Patient Note Preview</div>
                {noteLines.length > 0 && (
                  <button onClick={copyNote} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: copied ? "#16a34a" : "#8C1515", color: "white",
                    border: "none", borderRadius: 7, padding: "7px 16px", cursor: "pointer",
                    fontSize: 13, fontWeight: 500, transition: "background 0.2s"
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {copied
                        ? <><polyline points="20 6 9 17 4 12"/></>
                        : <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>
                      }
                    </svg>
                    {copied ? "Copied!" : "Copy note"}
                  </button>
                )}
              </div>
              {noteLines.length === 0 ? (
                <div style={{ color: "#d1d5db", fontSize: 14, fontStyle: "italic", padding: "2rem 0", textAlign: "center" }}>
                  Your note will appear here as you speak trigger phrases
                </div>
              ) : (
                <div style={{ fontSize: 14, lineHeight: 1.7, color: "#1f2937" }}>
                  <div style={{ color: "#374151", marginBottom: "1rem", fontStyle: "italic", borderLeft: "3px solid #e5e7eb", paddingLeft: 12 }}>{HEADER}</div>
                  {noteLines.map((line, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, marginBottom: "0.75rem" }}>
                      <span style={{ color: "#8C1515", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>•</span>
                      <span>{line}</span>
                    </div>
                  ))}
                  <div style={{ color: "#374151", marginTop: "1rem", fontStyle: "italic", borderLeft: "3px solid #e5e7eb", paddingLeft: 12 }}>{FOOTER}</div>
                </div>
              )}
            </div>
          </div>

          {/* Right: action items */}
          <div>
            <div style={{ background: "white", borderRadius: 12, padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", position: "sticky", top: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em" }}>Physician To-Do</div>
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16 }}>Required actions from this note</div>
              {allActions.length === 0 ? (
                <div style={{ color: "#d1d5db", fontSize: 13, fontStyle: "italic", textAlign: "center", padding: "1.5rem 0" }}>
                  Action items will appear here when relevant results are triggered
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {allActions.map((a, i) => (
                    <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                      <input type="checkbox" checked={!!checkedActions[a]} onChange={() => toggleAction(a)}
                        style={{ marginTop: 2, accentColor: "#8C1515", width: 15, height: 15, flexShrink: 0 }} />
                      <span style={{
                        fontSize: 13, lineHeight: 1.5, color: checkedActions[a] ? "#9ca3af" : "#1f2937",
                        textDecoration: checkedActions[a] ? "line-through" : "none"
                      }}>{a}</span>
                    </label>
                  ))}
                </div>
              )}
              {allActions.length > 0 && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #f3f4f6", fontSize: 12, color: "#9ca3af" }}>
                  {Object.values(checkedActions).filter(Boolean).length} of {allActions.length} completed
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === "manage" && (
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "1.5rem 1rem" }}>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
            Edits are saved to this browser only. Use "Reset to default" to restore the original text at any time.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {snippets.map(s => (
              <div key={s.id} style={{ background: "white", borderRadius: 12, padding: "1.25rem 1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: editingId === s.id ? 12 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#1f2937" }}>{s.trigger}</span>
                    {isCustomized(s.id) && <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", borderRadius: 10, padding: "2px 8px", fontWeight: 500 }}>Customized</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {editingId !== s.id && (
                      <>
                        <button onClick={() => startEdit(s)} style={{ fontSize: 12, color: "#6366f1", background: "none", border: "1px solid #e0e7ff", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Edit</button>
                        {isCustomized(s.id) && (
                          <button onClick={() => resetToDefault(s.id)} style={{ fontSize: 12, color: "#dc2626", background: "none", border: "1px solid #fee2e2", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Reset</button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {editingId === s.id ? (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>Patient-facing text</div>
                    <textarea value={editText} onChange={e => setEditText(e.target.value)}
                      style={{ width: "100%", minHeight: 100, fontSize: 13, lineHeight: 1.6, border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginTop: 12, marginBottom: 4 }}>Physician action items (one per line, leave blank if none)</div>
                    <textarea value={editActions} onChange={e => setEditActions(e.target.value)}
                      style={{ width: "100%", minHeight: 60, fontSize: 13, lineHeight: 1.6, border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none" }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button onClick={saveEdit} style={{ fontSize: 13, background: "#8C1515", color: "white", border: "none", borderRadius: 7, padding: "7px 16px", cursor: "pointer", fontWeight: 500 }}>Save changes</button>
                      <button onClick={() => setEditingId(null)} style={{ fontSize: 13, background: "none", color: "#6b7280", border: "1px solid #d1d5db", borderRadius: 7, padding: "7px 16px", cursor: "pointer" }}>Cancel</button>
                      <button onClick={() => resetToDefault(s.id)} style={{ fontSize: 13, background: "none", color: "#dc2626", border: "1px solid #fee2e2", borderRadius: 7, padding: "7px 16px", cursor: "pointer", marginLeft: "auto" }}>Reset to default</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6, lineHeight: 1.6 }}>{s.text.slice(0, 120)}{s.text.length > 120 ? "…" : ""}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        * { box-sizing: border-box; }
        textarea:focus, input:focus { border-color: #8C1515 !important; box-shadow: 0 0 0 3px rgba(140,21,21,0.1); }
        @media (max-width: 768px) {
          .grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
