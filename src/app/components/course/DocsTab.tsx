import { useState, useEffect, useCallback } from "react";
import { AlertCircle, Bell, BellOff, BellRing, CheckCircle2, FileText, FileUp, Plus, RefreshCw, ShieldCheck, Trash2, X } from "lucide-react";
import { SUPABASE_CONFIGURED } from "../../../lib/supabase";
import { deleteDocument as dbDeleteDocument, upsertReminder, deleteReminder as dbDeleteReminder } from "../../../lib/db";
import {
  formatDueForDisplay, mergeCourseReminders,
  patchStoredCourseData, loadStoredCourseData,
} from "../../../lib/courseData";
import {
  factCheckAllDocs,
  getDocumentFactCheckStatus,
  FactCheckQuotaError,
  primePersistedFactCheckCache,
  type FactCheckReport,
  type FactCheckVerdict,
} from "../../../lib/factCheck";
import { F, card, sHead, EmptyState, type Doc, type Assignment } from "./types.tsx";
import { useIsMobile } from "../ui/use-mobile";

/* ── Fact Check Report Button (per-doc) ──────────────── */
function FactCheckButton({ doc, factChecking, onFactCheck }: {
  doc: Doc;
  factChecking: string | null;
  onFactCheck: (doc: Doc) => void;
}) {
  const hasText    = Boolean(doc.textContent?.trim());
  const isActive   = factChecking === doc.id;
  const isBusy     = factChecking !== null;
  const isDisabled = isBusy || !hasText;
  return (
    <button
      onClick={() => { if (!isDisabled) onFactCheck(doc); }}
      disabled={isDisabled}
      title={!hasText
        ? "Fact check unavailable — text not yet extracted. Try again in a moment."
        : "Open fact check report for this document"}
      style={{
        display: "flex", alignItems: "center", gap: "4px",
        fontFamily: F.body, fontSize: "0.71rem", padding: "4px 9px",
        borderRadius: "99px", border: "1px solid var(--border)",
        background: "transparent",
        color: isActive ? "var(--accent)" : "var(--text-muted)",
        cursor: isDisabled ? "not-allowed" : "pointer",
        fontWeight: 600, transition: "all 0.15s", whiteSpace: "nowrap",
        opacity: !hasText ? 0.38 : 1,
      }}
      onMouseEnter={e => {
        if (!isDisabled) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
        }
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLButtonElement).style.color = isActive ? "var(--accent)" : "var(--text-muted)";
      }}
    >
      <ShieldCheck size={11} style={{ animation: isActive ? "spin 1s linear infinite" : "none" }}/>
      {isActive ? "Checking…" : "Fact Check Report"}
    </button>
  );
}

/* ── Documents Tab ───────────────────────────────────── */
export function DocsTab({
  docs, onDocsChange, courseId, onFileUpload, onRescanSyllabus,
}: {
  docs: Doc[];
  onDocsChange: (d: Doc[]) => void;
  courseId: string;
  onFileUpload: (f: File) => void;
  onRescanSyllabus?: (doc: Doc) => void;
}) {
  const isMobile = useIsMobile();
  const [rescanning, setRescanning] = useState<string | null>(null);
  const [factChecking, setFactChecking] = useState<string | null>(null);
  const [factCheckReports, setFactCheckReports] = useState<FactCheckReport[] | null>(null);
  const [factCheckProgress, setFactCheckProgress] = useState<{ current: number; total: number; docName: string } | null>(null);
  const [factCheckQuotaError, setFactCheckQuotaError] = useState(false);
  const [, setFactCheckCacheVersion] = useState(0);

  const typeLabel: Record<Doc["type"], string> = { syllabus: "Syllabus", notes: "Lecture Notes", reading: "Reading", "past-exam": "Past Exam", other: "Other" };
  const typeColor: Record<Doc["type"], string> = { syllabus: "#66B539", notes: "#3b82f6", reading: "#f59e0b", "past-exam": "#8b5cf6", other: "#6b7280" };

  const handleFactCheck = async (doc?: Doc) => {
    const docsToCheck = doc
      ? [doc].filter(d => d.type !== "syllabus" && Boolean(d.textContent?.trim()))
      : docs.filter(d => d.type !== "syllabus" && d.used && Boolean(d.textContent?.trim()));
    if (docsToCheck.length === 0) return;
    setFactChecking(doc ? doc.id : "all");
    setFactCheckReports(null);
    setFactCheckQuotaError(false);
    setFactCheckProgress(null);
    try {
      const reports = await factCheckAllDocs(docsToCheck, (current, total, docName) => {
        setFactCheckProgress({ current, total, docName });
      });
      setFactCheckReports(reports);
    } catch (err) {
      if (err instanceof FactCheckQuotaError) {
        setFactCheckQuotaError(true);
      }
      // other errors: silently drop (network issues etc.)
    } finally {
      setFactChecking(null);
      setFactCheckProgress(null);
    }
  };

  const toggleDoc = (id: string) => onDocsChange(docs.map(d => d.id === id ? { ...d, used: !d.used } : d));
  const removeDoc = async (doc: Doc) => {
    onDocsChange(docs.filter(d => d.id !== doc.id));
    if (!SUPABASE_CONFIGURED || doc.id.startsWith("temp-")) return;
    await dbDeleteDocument({ id: doc.id, course_id: courseId, user_id: "", name: doc.name, type: doc.type, size: doc.size || null, storage_path: doc.storagePath, uploaded_at: "" });
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onFileUpload(file);
    e.target.value = "";
  };

  useEffect(() => {
    let cancelled = false;

    async function hydrateFactChecks() {
      const primed = await primePersistedFactCheckCache(docs).catch(() => 0);
      if (!cancelled && primed > 0) {
        setFactCheckCacheVersion((value) => value + 1);
      }
    }

    void hydrateFactChecks();
    return () => { cancelled = true; };
  }, [docs]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ ...card, padding: "18px 20px" }}>
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", marginBottom: "12px", gap: "12px" }}>
          <div>
            <p style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "0.92rem", color: "var(--text-primary)", margin: "0 0 2px" }}>Spark Knowledge Base</p>
            <p style={{ fontFamily: F.body, fontSize: "0.76rem", color: "var(--text-muted)", margin: 0 }}>These files power course-grounded answers, quizzes, and fact checks. Syllabi are used for course setup, not quizzes or fact-check reports.</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexShrink: 0, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
            {docs.filter(d => d.type !== "syllabus").length > 0 && (
              <button
                onClick={() => void handleFactCheck()}
                disabled={factChecking !== null}
                title="Open fact check report for all active documents"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", background: "var(--bg-secondary)", color: factChecking === "all" ? "var(--accent)" : "var(--text-secondary)", border: "1px solid var(--border)", borderRadius: "9px", padding: "9px 13px", fontFamily: F.heading, fontWeight: 700, fontSize: "0.79rem", cursor: factChecking !== null ? "not-allowed" : "pointer", whiteSpace: "nowrap", transition: "all 0.15s", flex: isMobile ? "1 1 100%" : undefined, width: isMobile ? "100%" : undefined }}
                onMouseEnter={e => { if (!factChecking) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; }}>
                <ShieldCheck size={13} style={{ animation: factChecking === "all" ? "spin 1s linear infinite" : "none" }}/>
                {factChecking === "all" ? (factCheckProgress ? `Checking ${factCheckProgress.current}/${factCheckProgress.total}…` : "Checking…") : "Fact Check Report"}
              </button>
            )}
            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", background: "var(--accent)", color: "var(--primary-foreground)", border: "none", borderRadius: "9px", padding: "9px 15px", fontFamily: F.heading, fontWeight: 700, fontSize: "0.79rem", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap", flex: isMobile ? "1 1 100%" : undefined, width: isMobile ? "100%" : undefined }}>
              <FileUp size={13}/> Upload Document
              <input type="file" accept="*/*" onChange={handleUpload} style={{ display: "none" }}/>
            </label>
          </div>
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {["PDF", "DOCX", "TXT", "PPTX", "XLS", "Any format"].map(f => (
            <span key={f} style={{ fontFamily: F.mono, fontSize: "0.67rem", padding: "2px 8px", borderRadius: "5px", background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-muted)" }}>{f}</span>
          ))}
        </div>
      </div>

      {docs.length === 0 ? (
          <EmptyState icon={<FileText size={24}/>} title="No documents yet" body="Upload your syllabus, lecture notes, readings, or past exams. Spark uses these for course answers, saved quizzes, and factual review reports."/>
      ) : (
        <div style={card}>
          <div style={sHead}>
            <span style={{ fontFamily: F.heading, fontSize: "0.84rem", fontWeight: 700, color: "var(--text-primary)" }}>{docs.length} document{docs.length > 1 ? "s" : ""}</span>
            <span style={{ fontFamily: F.body, fontSize: "0.74rem", color: "var(--text-muted)" }}>{docs.filter(d => d.used).length} active in Spark</span>
          </div>
          {docs.map((doc, i) => (
            <div key={doc.id} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: "13px", padding: "13px 18px", borderTop: i !== 0 ? "1px solid var(--border)" : undefined, opacity: doc.used ? 1 : 0.5, transition: "opacity 0.2s" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: `${typeColor[doc.type]}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FileText size={16} style={{ color: typeColor[doc.type] }}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F.heading, fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isMobile ? "normal" : "nowrap", lineHeight: 1.45 }}>{doc.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: F.body, fontSize: "0.69rem", padding: "1px 7px", borderRadius: "99px", background: `${typeColor[doc.type]}18`, color: typeColor[doc.type], fontWeight: 600 }}>{typeLabel[doc.type]}</span>
                  <span style={{ fontFamily: F.body, fontSize: "0.69rem", color: "var(--text-muted)" }}>{doc.size} · {doc.uploadedAt}</span>
                  {doc.type !== "syllabus" && (() => {
                    const fcStatus = getDocumentFactCheckStatus(doc);
                    if (!fcStatus) return null;
                    const fcConfig = {
                      accurate:      { label: "All accurate",   bg: "rgba(34,197,94,0.12)",  color: "#16a34a", border: "rgba(34,197,94,0.25)"  },
                      inaccurate:    { label: "Issues found",   bg: "rgba(239,68,68,0.10)",  color: "#dc2626", border: "rgba(239,68,68,0.22)"   },
                      mixed:         { label: "Mixed results",  bg: "rgba(245,158,11,0.12)", color: "#b45309", border: "rgba(245,158,11,0.25)"  },
                      unverifiable:  { label: "Unverifiable",   bg: "rgba(107,114,128,0.10)", color: "#6b7280", border: "rgba(107,114,128,0.2)" },
                    }[fcStatus];
                    return (
                      <span title="Fact-check report available — click Fact Check Report to view"
                        style={{ fontFamily: F.body, fontSize: "0.65rem", padding: "1px 7px", borderRadius: "99px", background: fcConfig.bg, color: fcConfig.color, border: `1px solid ${fcConfig.border}`, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "3px" }}>
                        <ShieldCheck size={9}/>{fcConfig.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
                <button onClick={() => toggleDoc(doc.id)} style={{ fontFamily: F.body, fontSize: "0.71rem", padding: "4px 10px", borderRadius: "99px", border: `1px solid ${doc.used ? "var(--accent)" : "var(--border)"}`, background: doc.used ? "var(--accent-soft)" : "transparent", color: doc.used ? "var(--accent)" : "var(--text-muted)", cursor: "pointer", fontWeight: 600, transition: "all 0.15s" }}>
                  {doc.used ? "✓ In Spark" : "Off"}
                </button>
                {doc.type === "syllabus" && onRescanSyllabus && (
                  <button
                    onClick={async () => {
                      setRescanning(doc.id);
                      try { await Promise.resolve(onRescanSyllabus(doc)); } finally { setRescanning(null); }
                    }}
                    disabled={rescanning === doc.id}
                    title="Re-scan with Spark — re-extract assignments, grades & reminders"
                    style={{ display: "flex", alignItems: "center", gap: "4px", fontFamily: F.body, fontSize: "0.71rem", padding: "4px 9px", borderRadius: "99px", border: "1px solid var(--border)", background: "transparent", color: rescanning === doc.id ? "var(--accent)" : "var(--text-muted)", cursor: rescanning === doc.id ? "not-allowed" : "pointer", fontWeight: 600, transition: "all 0.15s", whiteSpace: "nowrap" }}
                    onMouseEnter={e => { if (rescanning !== doc.id) { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; } }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = rescanning === doc.id ? "var(--accent)" : "var(--text-muted)"; }}>
                    <RefreshCw size={11} style={{ animation: rescanning === doc.id ? "spin 1s linear infinite" : "none" }}/>
                    {rescanning === doc.id ? "Scanning…" : "Re-scan"}
                  </button>
                )}
                {doc.type !== "syllabus" && (
                  <FactCheckButton
                    doc={doc}
                    factChecking={factChecking}
                    onFactCheck={d => void handleFactCheck(d)}
                  />
                )}
                <button onClick={() => removeDoc(doc)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}><Trash2 size={13}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "13px 16px", background: "var(--accent-soft)", borderRadius: "11px", border: "1px solid var(--border)" }}>
        <AlertCircle size={15} style={{ color: "var(--accent)", flexShrink: 0, marginTop: "1px" }}/>
        <p style={{ fontFamily: F.body, fontSize: "0.8rem", color: "var(--accent)", margin: 0, lineHeight: 1.65, fontWeight: 500 }}>
          Spark only reads documents you upload here. Every answer includes a citation showing exactly which document it came from.
        </p>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* ── Quota Unavailable Modal ── */}
      {factCheckQuotaError && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
          onClick={e => { if (e.target === e.currentTarget) setFactCheckQuotaError(false); }}
        >
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "18px", width: "100%", maxWidth: "420px", padding: "28px 28px 24px", boxShadow: "0 24px 64px rgba(0,0,0,0.28)", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ShieldCheck size={20} style={{ color: "#ef4444" }}/>
              </div>
              <div>
                <div style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "1rem", color: "var(--text-primary)" }}>Fact Check Report Unavailable</div>
                <div style={{ fontFamily: F.body, fontSize: "0.73rem", color: "var(--text-muted)", marginTop: "2px" }}>Spark verification is temporarily cooling down</div>
              </div>
              <button onClick={() => setFactCheckQuotaError(false)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px", display: "flex", borderRadius: "7px", flexShrink: 0 }}>
                <X size={17}/>
              </button>
            </div>
            <p style={{ fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.65, padding: "12px 14px", background: "rgba(239,68,68,0.06)", borderRadius: "10px", border: "1px solid rgba(239,68,68,0.15)" }}>
              Fact Check Reports use Spark's live verification workflow to check claims against real sources. Spark has hit a temporary provider limit for now, so please wait a minute and try again.
            </p>
            <div style={{ fontFamily: F.body, fontSize: "0.76rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Everyday Spark chat can keep running through its faster text provider, but live fact verification needs the search-backed Spark path.
            </div>
            <button
              onClick={() => setFactCheckQuotaError(false)}
              style={{ alignSelf: "flex-end", background: "var(--accent)", color: "var(--primary-foreground)", border: "none", borderRadius: "9px", padding: "9px 20px", fontFamily: F.heading, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── Fact Check Report Modal ── */}
      {factCheckReports !== null && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: isMobile ? "12px" : "20px" }}
          onClick={e => { if (e.target === e.currentTarget) setFactCheckReports(null); }}>
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "20px", width: "100%", maxWidth: "680px", maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,0.3)", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "16px 16px 14px" : "20px 24px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0, gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(102,181,57,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldCheck size={18} style={{ color: "var(--accent)" }}/>
                </div>
                <div>
                  <div style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "1rem", color: "var(--text-primary)" }}>Fact Check Report</div>
                  <div style={{ fontFamily: F.body, fontSize: "0.72rem", color: "var(--text-muted)" }}>Spark fact review of factual claims · strongest sources cited when available</div>
                </div>
              </div>
              <button onClick={() => setFactCheckReports(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "4px", display: "flex", borderRadius: "7px" }}>
                <X size={18}/>
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ overflowY: "auto", padding: isMobile ? "16px" : "20px 24px", display: "flex", flexDirection: "column", gap: "24px" }}>
              {factCheckReports.length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0" }}>
                  <ShieldCheck size={32} style={{ color: "var(--text-muted)", marginBottom: "12px" }}/>
                  <p style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)", margin: "0 0 5px" }}>No eligible documents</p>
                  <p style={{ fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>Enable at least one non-syllabus document in Spark to fact-check it.</p>
                </div>
              ) : factCheckReports.map((report, ri) => (
                <div key={ri}>
                  {/* Document header */}
                  <div style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "0.9rem", color: "var(--text-primary)", marginBottom: "6px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={14} style={{ color: "var(--accent)", flexShrink: 0 }}/>
                    {report.docName}
                  </div>
                  {/* Summary */}
                  {report.summary && (
                    <p style={{ fontFamily: F.body, fontSize: "0.81rem", color: "var(--text-secondary)", lineHeight: 1.65, margin: "0 0 14px", padding: "10px 14px", background: "var(--accent-soft)", borderRadius: "10px", border: "1px solid var(--border)" }}>
                      {report.summary}
                    </p>
                  )}
                  {/* Claims */}
                  {report.claims.length === 0 ? (
                    <p style={{ fontFamily: F.body, fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>No specific factual claims identified in this document.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {report.claims.map((claim, ci) => {
                        const verdictColor: Record<FactCheckVerdict, string> = { accurate: "#22c55e", inaccurate: "#ef4444", unverifiable: "#f59e0b" };
                        const verdictLabel: Record<FactCheckVerdict, string> = { accurate: "✓ Accurate", inaccurate: "✗ Inaccurate", unverifiable: "? Unverifiable" };
                        const verdictBg: Record<FactCheckVerdict, string> = { accurate: "rgba(34,197,94,0.08)", inaccurate: "rgba(239,68,68,0.08)", unverifiable: "rgba(245,158,11,0.08)" };
                        return (
                          <div key={ci} style={{ padding: "12px 14px", borderRadius: "11px", border: `1px solid ${verdictColor[claim.verdict]}30`, background: verdictBg[claim.verdict], borderLeft: `3px solid ${verdictColor[claim.verdict]}` }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "6px" }}>
                              <p style={{ fontFamily: F.body, fontWeight: 600, fontSize: "0.82rem", color: "var(--text-primary)", margin: 0, lineHeight: 1.5, flex: 1 }}>"{claim.claim}"</p>
                              <span style={{ fontFamily: F.heading, fontSize: "0.68rem", fontWeight: 700, padding: "2px 9px", borderRadius: "99px", background: `${verdictColor[claim.verdict]}18`, color: verdictColor[claim.verdict], flexShrink: 0, whiteSpace: "nowrap" }}>{verdictLabel[claim.verdict]}</span>
                            </div>
                            <p style={{ fontFamily: F.body, fontSize: "0.78rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>{claim.explanation}</p>
                            {claim.citation && (
                              <p style={{ fontFamily: F.mono, fontSize: "0.7rem", color: "var(--text-muted)", margin: "5px 0 0", fontStyle: "italic" }}>Source: {claim.citation}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Stat summary */}
                  {report.claims.length > 0 && (
                    <div style={{ display: "flex", gap: "10px", marginTop: "12px", flexWrap: "wrap" }}>
                      {(["accurate", "inaccurate", "unverifiable"] as FactCheckVerdict[]).map(v => {
                        const count = report.claims.filter(c => c.verdict === v).length;
                        if (count === 0) return null;
                        const colors: Record<FactCheckVerdict, string> = { accurate: "#22c55e", inaccurate: "#ef4444", unverifiable: "#f59e0b" };
                        const labels: Record<FactCheckVerdict, string> = { accurate: "Accurate", inaccurate: "Inaccurate", unverifiable: "Unverifiable" };
                        return (
                          <span key={v} style={{ fontFamily: F.body, fontSize: "0.72rem", fontWeight: 600, padding: "3px 10px", borderRadius: "99px", background: `${colors[v]}15`, color: colors[v], border: `1px solid ${colors[v]}30` }}>
                            {count} {labels[v]}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {ri < factCheckReports.length - 1 && <div style={{ height: "1px", background: "var(--border)", marginTop: "20px" }}/>}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
              <p style={{ fontFamily: F.body, fontSize: "0.72rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                <CheckCircle2 size={11} style={{ display: "inline", color: "var(--accent)", marginRight: "5px", verticalAlign: "middle" }}/>
                Reviewed with Spark's verification workflow when available. Syllabus files are excluded, and results should still be checked before you rely on them academically.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Reminders Tab ───────────────────────────────────── */
/* ── Browser notification helpers ────────────────────── */
const NOTIF_CACHE_KEY = "lb-notif-fired-v1";

function getNotifCache(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIF_CACHE_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(arr);
  } catch { return new Set(); }
}

function addToNotifCache(id: string) {
  const cache = getNotifCache();
  cache.add(id);
  // Prune old entries if cache grows beyond 500
  const arr = [...cache].slice(-500);
  localStorage.setItem(NOTIF_CACHE_KEY, JSON.stringify(arr));
}

// Returns items due within the next `windowMs` milliseconds
function getUpcomingItems(
  items: ReturnType<typeof mergeCourseReminders>,
  windowMs: number,
) {
  const now = Date.now();
  return items.filter((item) => {
    if (!item.due || item.done) return false;
    // Parse ISO date string
    const parsed = new Date(item.due.includes("T") ? item.due : `${item.due}T00:00:00`);
    if (isNaN(parsed.getTime())) return false;
    const diff = parsed.getTime() - now;
    return diff > 0 && diff <= windowMs;
  });
}

/* Stable cache-key for an item: id + due so re-fires if due changes */
function notifKey(item: { id: string; due: string }) {
  return `${item.id}::${item.due}`;
}

export function RemindersTab({
  courseCode, courseId, assignments, reminders, setReminders,
}: {
  courseCode: string;
  courseId: string;
  assignments: Assignment[];
  reminders: { id: string; text: string; due: string; done: boolean }[];
  setReminders: React.Dispatch<React.SetStateAction<{ id: string; text: string; due: string; done: boolean }[]>>;
}) {
  const isMobile = useIsMobile();
  const [addingNew, setAddingNew] = useState(false);
  const [draft, setDraft] = useState({ text: "", due: "" });
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "denied",
  );
  const items = mergeCourseReminders(assignments, reminders);

  // Fire browser notifications for items due within 24 h (once per item per due-date)
  const fireNotifications = useCallback(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const upcoming = getUpcomingItems(items, 24 * 60 * 60 * 1000);
    const fired = getNotifCache();
    for (const item of upcoming) {
      const key = notifKey(item);
      if (fired.has(key)) continue;
      new Notification(`LearnBeam · ${courseCode}`, {
        body: `${item.text}${item.due ? `  —  due ${formatDueForDisplay(item.due)}` : ""}`,
        icon: "/favicon.ico",
        tag: key,
      });
      addToNotifCache(key);
    }
  }, [items, courseCode]);

  // Request notification permission
  const requestPermission = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
    if (result === "granted") fireNotifications();
  };

  // Auto-fire whenever items change and permission is already granted
  useEffect(() => {
    if (notifPermission === "granted") fireNotifications();
  }, [fireNotifications, notifPermission]);

  const handleAddReminder = async () => {
    const text = draft.text.trim();
    const due = draft.due.trim();
    if (!text) return;

    const id = SUPABASE_CONFIGURED ? crypto.randomUUID() : Date.now().toString();
    const nextReminder = { id, text, due, done: false };

    setReminders((prev) => [...prev, nextReminder]);
    setDraft({ text: "", due: "" });
    setAddingNew(false);

    if (!SUPABASE_CONFIGURED || !courseId) {
      patchStoredCourseData(courseId, { reminders: [...loadStoredCourseData(courseId).reminders, nextReminder] });
      return;
    }

    const saved = await upsertReminder({ id, course_id: courseId, text, due: due || null, done: false });
    if (!saved) {
      setReminders((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    patchStoredCourseData(courseId, { reminders: [...reminders, nextReminder] });
  };

  const handleDeleteReminder = async (id: string) => {
    const updated = reminders.filter((item) => item.id !== id);
    setReminders(updated);
    if (!SUPABASE_CONFIGURED) {
      patchStoredCourseData(courseId, { reminders: updated });
      return;
    }
    await dbDeleteReminder(id);
    patchStoredCourseData(courseId, { reminders: updated });
  };

  const supportsNotifications = typeof Notification !== "undefined";

  return (
    <div style={card}>
      <div style={sHead}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <BellRing size={13} style={{ color: "var(--accent)" }}/>
          <span style={{ fontFamily: F.heading, fontSize: "0.86rem", fontWeight: 800, color: "var(--text-primary)" }}>{courseCode} — Reminders</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
          {/* Notification toggle */}
          {supportsNotifications && notifPermission !== "denied" && (
            notifPermission === "granted" ? (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 9px", borderRadius: "99px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.22)" }}
                title="Browser notifications are enabled — you'll be alerted for items due within 24 h">
                <Bell size={11} style={{ color: "#16a34a" }}/>
                <span style={{ fontFamily: F.body, fontSize: "0.68rem", fontWeight: 600, color: "#16a34a" }}>Alerts on</span>
              </div>
            ) : (
              <button onClick={() => void requestPermission()}
                title="Enable browser notifications for items due within 24 h"
                style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 9px", borderRadius: "99px", background: "var(--bg-secondary)", border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: F.body, fontSize: "0.68rem", fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}>
                <BellOff size={11}/> Enable alerts
              </button>
            )
          )}
          <button onClick={() => setAddingNew(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", background: "var(--accent)", color: "var(--primary-foreground)", border: "none", borderRadius: "7px", padding: "5px 10px", fontFamily: F.heading, fontSize: "0.73rem", fontWeight: 700, cursor: "pointer", width: isMobile ? "100%" : "auto" }}>
            <Plus size={11}/> Add
          </button>
        </div>
      </div>

      {addingNew && (
        <div style={{ display: "flex", gap: "7px", padding: "12px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", background: "var(--accent-soft)" }}>
          <input placeholder="Reminder text" value={draft.text} onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))}
            style={{ flex: isMobile ? "1 1 100%" : 2, padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--input)", fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-primary)", outline: "none", minWidth: isMobile ? "100%" : "150px", width: isMobile ? "100%" : undefined }}/>
          <input placeholder="Due date / time (optional)" value={draft.due} onChange={(e) => setDraft((prev) => ({ ...prev, due: e.target.value }))}
            style={{ flex: isMobile ? "1 1 100%" : 1, padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--input)", fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-primary)", outline: "none", minWidth: isMobile ? "100%" : "150px", width: isMobile ? "100%" : undefined }}/>
          <button onClick={() => void handleAddReminder()} style={{ background: "var(--accent)", color: "var(--primary-foreground)", border: "none", borderRadius: "7px", padding: "7px 13px", fontFamily: F.heading, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", flex: isMobile ? "1 1 100%" : undefined, width: isMobile ? "100%" : undefined }}>Save</button>
          <button onClick={() => { setAddingNew(false); setDraft({ text: "", due: "" }); }} style={{ background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "7px", padding: "7px 12px", fontFamily: F.body, fontSize: "0.8rem", cursor: "pointer", flex: isMobile ? "1 1 100%" : undefined, width: isMobile ? "100%" : undefined }}>Cancel</button>
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ padding: "32px 18px", textAlign: "center" }}>
          <BellRing size={24} style={{ color: "var(--text-muted)", marginBottom: "10px" }}/>
          <p style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)", margin: "0 0 5px" }}>No reminders yet</p>
          <p style={{ fontFamily: F.body, fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>Add a course reminder to keep upcoming deadlines visible.</p>
        </div>
      ) : items.map((r, i) => (
        <div key={r.id} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: "13px", padding: "13px 18px", borderTop: i !== 0 ? "1px solid var(--border)" : undefined }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: r.done ? "var(--border)" : r.source === "assignment" ? "#f59e0b" : "var(--accent)", flexShrink: 0 }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>{r.text}</div>
            <div style={{ fontFamily: F.body, fontSize: "0.72rem", color: "var(--text-muted)" }}>
              {r.due ? formatDueForDisplay(r.due) : "No due date set"}
              {r.source === "assignment" ? " · from assignment deadline" : ""}
            </div>
          </div>
          {r.source === "assignment" ? (
            <span style={{ fontFamily: F.body, fontSize: "0.68rem", color: "#b45309", padding: "2px 8px", borderRadius: "99px", background: "rgba(245,158,11,0.12)", fontWeight: 600 }}>Auto</span>
          ) : (
            <button onClick={() => void handleDeleteReminder(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}><Trash2 size={12}/></button>
          )}
        </div>
      ))}
    </div>
  );
}
