import { useState, useRef, useEffect } from "react";
import {
  AlertCircle, BookOpen, CheckCircle2, ChevronDown, ChevronUp,
  Globe, Link, Paperclip, Send, User,
} from "lucide-react";
import { SparkLogo } from "../SparkLogo";
import { F, createChatMessage, type ChatMsg, type Doc } from "./types.tsx";
import { MarkdownText } from "./MarkdownText.tsx";

function getProviderBadge(provider: ChatMsg["provider"]) {
  if (provider === "cerebras") {
    return {
      label: "Powered by Cerebras",
      textColor: "#0f766e",
      background: "rgba(20, 184, 166, 0.12)",
      borderColor: "rgba(15, 118, 110, 0.18)",
    };
  }

  if (provider === "gemini") {
    return {
      label: "Powered by Gemini",
      textColor: "#6d28d9",
      background: "rgba(109, 40, 217, 0.10)",
      borderColor: "rgba(109, 40, 217, 0.16)",
    };
  }

  if (provider === "groq") {
    return {
      label: "Powered by Groq",
      textColor: "#0f172a",
      background: "rgba(148, 163, 184, 0.16)",
      borderColor: "rgba(71, 85, 105, 0.18)",
    };
  }

  return null;
}

/* ── Spark Message ───────────────────────────────────── */
export function SparkMessage({ msg, compact }: { msg: ChatMsg; compact?: boolean }) {
  const [citOpen, setCitOpen] = useState(false);
  const isAI     = msg.role === "ai";
  const isSystem = msg.role === "system";
  const providerBadge = isAI ? getProviderBadge(msg.provider) : null;

  if (isSystem) return (
    <div style={{ textAlign: "center", padding: "6px 0" }}>
      <span style={{ fontFamily: F.body, fontSize: "0.69rem", color: "var(--text-muted)", padding: "3px 10px", background: "var(--bg-secondary)", borderRadius: "99px", border: "1px solid var(--border)" }}>{msg.text}</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isAI ? "flex-start" : "flex-end", gap: "4px" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: compact ? "10px" : "12px", flexDirection: isAI ? "row" : "row-reverse", width: "100%", minWidth: 0 }}>
        <div style={{ width: compact ? "40px" : "50px", height: compact ? "40px" : "50px", borderRadius: "50%", background: isAI ? "var(--accent-soft)" : "rgba(102,181,57,0.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: isAI ? "1px solid var(--border)" : "1px solid rgba(102,181,57,0.2)" }}>
          {isAI ? <SparkLogo size={compact ? 28 : 34}/> : <User size={compact ? 18 : 22} style={{ color: "var(--accent)" }}/>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: isAI ? "flex-start" : "flex-end", gap: "5px", maxWidth: compact ? "calc(100% - 52px)" : "calc(100% - 64px)", minWidth: 0 }}>
          {providerBadge && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: compact ? "3px 8px" : "4px 9px",
                borderRadius: "999px",
                fontFamily: F.body,
                fontSize: compact ? "0.62rem" : "0.66rem",
                fontWeight: 700,
                letterSpacing: "0.01em",
                color: providerBadge.textColor,
                background: providerBadge.background,
                border: `1px solid ${providerBadge.borderColor}`,
                maxWidth: "100%",
              }}
            >
              {providerBadge.label}
            </span>
          )}
          <div style={{ width: "100%", minWidth: 0, padding: compact ? "10px 12px" : "12px 15px", borderRadius: "16px", fontFamily: F.body, fontSize: compact ? "0.78rem" : "0.86rem", lineHeight: 1.68, borderBottomRightRadius: !isAI ? 4 : 16, borderBottomLeftRadius: isAI ? 4 : 16, background: !isAI ? "var(--accent)" : "var(--bg-secondary)", color: !isAI ? "var(--primary-foreground)" : "var(--text-primary)", border: isAI ? "1px solid var(--border)" : "none", overflowWrap: "anywhere", wordBreak: "break-word" }}>
            {isAI ? <MarkdownText text={msg.text} compact={compact}/> : msg.text}
          </div>
        </div>
      </div>

      {isAI && msg.flagged && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "6px", marginLeft: compact ? "50px" : "62px", padding: "8px 11px", background: "#fff8e1", border: "1px solid #f59e0b", borderRadius: "11px", maxWidth: compact ? "calc(100% - 52px)" : "calc(100% - 64px)", minWidth: 0 }}>
          <AlertCircle size={13} style={{ color: "#f59e0b", flexShrink: 0, marginTop: "1px" }}/>
          <p style={{ fontFamily: F.body, fontSize: "0.74rem", color: "#92400e", margin: 0, lineHeight: 1.6, overflowWrap: "anywhere", wordBreak: "break-word" }}>{msg.flagNote}</p>
        </div>
      )}

      {isAI && msg.citations && msg.citations.length > 0 && (
        <div style={{ marginLeft: compact ? "50px" : "62px", maxWidth: compact ? "calc(100% - 52px)" : "calc(100% - 64px)", minWidth: 0 }}>
          <button onClick={() => setCitOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "none", cursor: "pointer", color: "var(--accent)", fontFamily: F.body, fontSize: "0.72rem", fontWeight: 600, padding: "3px 0", minWidth: 0 }}>
            <Link size={11}/>{msg.citations.length} source{msg.citations.length > 1 ? "s" : ""}{citOpen ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
          </button>
          {citOpen && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "4px" }}>
              {msg.citations.map((c, i) => (
                <div key={i} style={{ padding: "8px 11px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "9px", borderLeft: "3px solid var(--accent)", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                  {c.url ? (
                    <>
                      <a href={c.url} target="_blank" rel="noreferrer" style={{ fontFamily: F.heading, fontSize: "0.73rem", fontWeight: 700, color: "var(--accent)", margin: "0 0 3px", textDecoration: "none", display: "inline-block" }}>
                        {c.docName}
                      </a>
                      <p style={{ fontFamily: F.body, fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.55, wordBreak: "break-word" }}>{c.url}</p>
                    </>
                  ) : (
                    <>
                      <p style={{ fontFamily: F.heading, fontSize: "0.73rem", fontWeight: 700, color: "var(--accent)", margin: "0 0 3px" }}>{c.docName}</p>
                      <p style={{ fontFamily: F.body, fontSize: "0.75rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6, fontStyle: "italic" }}>"{c.excerpt}"</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Spark Chat Interface ────────────────────────────── */
export function SparkChat({
  courseCode, docs, messages, aiInput, onInputChange, onSend, compact, onFileUpload, isSending,
  mode = "course", onModeChange,
}: {
  courseCode: string;
  docs: Doc[];
  messages: ChatMsg[];
  aiInput: string;
  onInputChange: (v: string) => void;
  onSend: (t?: string) => void;
  compact?: boolean;
  onFileUpload: (f: File) => void;
  isSending?: boolean;
  mode?: "course" | "global";
  onModeChange?: (m: "course" | "global") => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isSending]);

  const activeDocs   = docs.filter(d => d.used);
  const quickPrompts = [`Summarise ${courseCode}`, "Explain key concepts", "What topics will be tested?", "Make a study plan"];

  // Detect when the last AI message signals it couldn't find an answer in course sources
  const lastAiMsg = [...messages].reverse().find(m => m.role === "ai");
  const showAskGeneralBtn =
    mode === "course" &&
    Boolean(onModeChange) &&
    !isSending &&
    lastAiMsg != null &&
    /couldn.t find|not (in|from) your (uploaded|course)|I don.t (have|see)|no (relevant|matching)|outside (my|the) (uploaded|course)|not covered|no (content|information|text)|unable to find/i.test(lastAiMsg.text);

  return (
    <>
      {mode === "global" ? (
        <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: compact ? "5px 12px" : "7px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexWrap: "wrap" }}>
          <Globe size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }}/>
          <span style={{ fontFamily: F.body, fontSize: "0.71rem", color: "var(--text-muted)", fontWeight: 500 }}>Spark Open mode · broader answers beyond your uploaded course files</span>
        </div>
      ) : activeDocs.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: compact ? "7px 12px" : "9px 16px", background: "#fff8e1", borderBottom: "1px solid #f59e0b" }}>
          <AlertCircle size={13} style={{ color: "#f59e0b", flexShrink: 0 }}/>
          <p style={{ fontFamily: F.body, fontSize: "0.75rem", color: "#92400e", margin: 0 }}>No documents yet — upload files so Spark can answer from your course sources.</p>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "7px", padding: compact ? "5px 12px" : "7px 16px", borderBottom: "1px solid var(--border)", background: "var(--accent-soft)", flexWrap: "wrap" }}>
          <CheckCircle2 size={12} style={{ color: "var(--accent)", flexShrink: 0 }}/>
          <span style={{ fontFamily: F.body, fontSize: "0.71rem", color: "var(--accent)", fontWeight: 600 }}>Reading from:</span>
          {activeDocs.slice(0, compact ? 2 : 4).map(d => (
            <span key={d.id} style={{ fontFamily: F.body, fontSize: "0.69rem", padding: "1px 7px", borderRadius: "99px", background: "var(--bg-surface)", border: "1px solid var(--border)", color: "var(--text-secondary)" }}>{d.name.replace(/\.[^.]+$/, "")}</span>
          ))}
          {activeDocs.length > (compact ? 2 : 4) && <span style={{ fontFamily: F.body, fontSize: "0.69rem", color: "var(--text-muted)" }}>+{activeDocs.length - (compact ? 2 : 4)} more</span>}
        </div>
      )}

      {/* ── Answer Mode Toggle ── */}
      {onModeChange && (
        <div style={{ padding: compact ? "8px 12px" : "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-primary)", flexShrink: 0 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", background: "var(--bg-secondary)", borderRadius: "14px", border: "1px solid var(--border)", padding: "3px", gap: "3px", width: "100%" }}>
            <button
              onClick={() => onModeChange("course")}
              disabled={isSending}
              title="Answer from the course files in Spark"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: compact ? "8px 10px" : "9px 12px", borderRadius: "11px", border: "none", cursor: isSending ? "not-allowed" : "pointer", fontFamily: F.body, fontSize: compact ? "0.7rem" : "0.74rem", fontWeight: 700, transition: "all 0.18s", background: mode === "course" ? "var(--accent)" : "transparent", color: mode === "course" ? "var(--primary-foreground)" : "var(--text-muted)", whiteSpace: "nowrap", minWidth: 0 }}>
              <BookOpen size={compact ? 12 : 13}/> Course Sources
            </button>
            <button
              onClick={() => onModeChange("global")}
              disabled={isSending}
              title="Use Spark Open for broader answers beyond your uploaded course files"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: compact ? "8px 10px" : "9px 12px", borderRadius: "11px", border: "none", cursor: isSending ? "not-allowed" : "pointer", fontFamily: F.body, fontSize: compact ? "0.7rem" : "0.74rem", fontWeight: 700, transition: "all 0.18s", background: mode === "global" ? "var(--accent)" : "transparent", color: mode === "global" ? "var(--primary-foreground)" : "var(--text-muted)", whiteSpace: "nowrap", minWidth: 0 }}>
              <Globe size={compact ? 12 : 13}/> Spark Open
            </button>
          </div>
        </div>
      )}

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: compact ? "12px" : "16px 20px", display: "flex", flexDirection: "column", gap: compact ? "10px" : "14px", background: "linear-gradient(180deg, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0) 22%), var(--bg-surface)" }}>
        {messages.map((m) => <SparkMessage key={m.id} msg={m} compact={compact}/>)}
        {isSending && <SparkMessage msg={createChatMessage({ role: "ai", text: "Spark is thinking…" })} compact={compact}/>}
      </div>

      {/* "Ask in General mode" nudge — appears when course sources can't answer */}
      {showAskGeneralBtn && (
        <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: compact ? "8px 12px" : "10px 18px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", flexWrap: "wrap" }}>
          <Globe size={13} style={{ color: "var(--accent)", flexShrink: 0 }}/>
          <span style={{ fontFamily: F.body, fontSize: compact ? "0.72rem" : "0.78rem", color: "var(--text-secondary)", flex: 1, lineHeight: 1.5 }}>
            Not in your course files? Try Spark Open for broader answers.
          </span>
          <button
            onClick={() => onModeChange!("global")}
            style={{ display: "flex", alignItems: "center", gap: "5px", padding: compact ? "5px 11px" : "6px 13px", borderRadius: "8px", border: "1px solid var(--accent)", background: "var(--accent-soft)", color: "var(--accent)", fontFamily: F.body, fontSize: compact ? "0.7rem" : "0.74rem", fontWeight: 700, cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", transition: "all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--primary-foreground)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--accent-soft)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
          >
            <Globe size={11}/> Ask in Spark Open
          </button>
        </div>
      )}

      {messages.filter(m => m.role === "user").length === 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", padding: compact ? "7px 11px" : "10px 18px", borderTop: "1px solid var(--border)" }}>
          {quickPrompts.map(s => (
            <button key={s} onClick={() => onSend(s)} disabled={isSending}
              style={{ fontFamily: F.body, fontSize: compact ? "0.68rem" : "0.74rem", padding: compact ? "4px 9px" : "5px 12px", borderRadius: "99px", border: "1px solid var(--border)", background: "var(--bg-secondary)", color: "var(--text-secondary)", cursor: isSending ? "not-allowed" : "pointer", opacity: isSending ? 0.6 : 1, transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
            >{s}</button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: "7px", padding: compact ? "8px 11px" : "12px 18px", borderTop: "1px solid var(--border)", flexShrink: 0, alignItems: "flex-end", background: "var(--bg-surface)" }}>
        <label title="Attach file to knowledge base"
          style={{ width: compact ? "30px" : "36px", height: compact ? "30px" : "36px", borderRadius: "9px", background: "var(--bg-secondary)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, color: "var(--text-muted)", transition: "all 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLLabelElement).style.color = "var(--accent)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLLabelElement).style.color = "var(--text-muted)"; }}>
          <Paperclip size={compact ? 12 : 14}/>
          <input type="file" accept="*/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onFileUpload(f); }} disabled={isSending}/>
        </label>

        <textarea value={aiInput} onChange={e => onInputChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          placeholder={mode === "global" ? "Ask Spark Open anything beyond your course files…" : activeDocs.length === 0 ? "Upload documents first…" : `Ask from your uploaded ${courseCode} sources…`}
          rows={compact ? 1 : 2}
          disabled={isSending}
          style={{ fontFamily: F.body, flex: 1, borderRadius: "9px", border: "1px solid var(--border)", background: "var(--input)", padding: compact ? "7px 10px" : "9px 12px", fontSize: compact ? "0.78rem" : "0.86rem", outline: "none", color: "var(--text-primary)", resize: "none", lineHeight: 1.5, opacity: isSending ? 0.75 : 1 }}
        />

        <button onClick={() => onSend()} disabled={!aiInput.trim() || isSending}
          style={{ width: compact ? "30px" : "38px", height: compact ? "30px" : "38px", borderRadius: "9px", background: "var(--accent)", border: "none", color: "var(--primary-foreground)", display: "flex", alignItems: "center", justifyContent: "center", cursor: aiInput.trim() && !isSending ? "pointer" : "not-allowed", flexShrink: 0, opacity: aiInput.trim() && !isSending ? 1 : 0.4, transition: "opacity 0.2s" }}>
          <Send size={compact ? 12 : 15}/>
        </button>
      </div>
    </>
  );
}
