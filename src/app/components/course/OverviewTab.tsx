import {
  AlertCircle, BarChart2, BookOpen, BookOpenCheck, Brain,
  CalendarClock, ClipboardList, FileUp, Lightbulb, Sparkles, Zap,
} from "lucide-react";
import { SparkLogo } from "../SparkLogo";
import { compareDueStrings, formatDueForDisplay, type StoredCourseInsights } from "../../../lib/courseData";
import { type SparkSuggestion } from "../../../lib/courseAI";
import { F, card, sHead, computeGrade, type Doc, type Assignment, type SyllabusImportState } from "./types.tsx";
import { useIsMobile } from "../ui/use-mobile";

export function OverviewTab({
  courseCode, courseColor, docs, assignments, onUploadSyllabus,
  insights, importState, suggestions, suggestionsLoading, suggestionsError, documentsSyncing,
}: {
  courseCode: string;
  courseColor: string;
  docs: Doc[];
  assignments: Assignment[];
  onUploadSyllabus: (f: File) => void;
  insights: StoredCourseInsights | null;
  importState: SyllabusImportState;
  suggestions: SparkSuggestion[];
  suggestionsLoading: boolean;
  suggestionsError: string | null;
  documentsSyncing: boolean;
}) {
  const isMobile = useIsMobile();
  const { display: gradeDisplay } = computeGrade(assignments);
  const nextDue = assignments.filter(a => a.status === "upcoming").sort((a, b) => compareDueStrings(a.due, b.due))[0];
  const detailRows = [
    { label: "Course",     value: insights?.courseName },
    { label: "Instructor", value: insights?.instructor },
    { label: "Term",       value: insights?.term },
    { label: "Meets",      value: insights?.meetingSchedule },
    { label: "Location",   value: insights?.location },
  ].filter((item) => item.value);

  const isFirstUse = docs.length === 0 && !insights && !importState.active && !importState.error;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

      {/* First-use onboarding hero */}
      {isFirstUse && (
        <div style={{ ...card, padding: "28px 26px", borderLeft: `4px solid ${courseColor}`, background: "var(--bg-surface)" }}>
          <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: "20px", alignItems: isMobile ? "stretch" : "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "10px" }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "10px", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}>
                  <BookOpen size={17}/>
                </div>
                <span style={{ fontFamily: F.heading, fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)" }}>Get started with {courseCode}</span>
              </div>
              <p style={{ fontFamily: F.body, fontSize: "0.85rem", color: "var(--text-secondary)", margin: "0 0 8px", lineHeight: 1.75 }}>
                Upload your <strong>syllabus</strong> and LearnBeam will automatically extract assignments, deadlines, grading details, and reminders — no manual entry needed.
              </p>
              <p style={{ fontFamily: F.body, fontSize: "0.8rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.65 }}>
                You can also upload lecture notes, readings, or past exams to unlock AI-powered study quizzes and Spark suggestions.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "9px", flexShrink: 0 }}>
              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: courseColor, color: "#fff", border: "none", borderRadius: "10px", padding: "11px 20px", fontFamily: F.body, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", whiteSpace: "nowrap", transition: "opacity 0.15s", width: isMobile ? "100%" : "auto" }}
                onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.opacity = "0.88"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.opacity = "1"; }}>
                <FileUp size={14}/>
                Upload Syllabus
                <input type="file" accept="*/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onUploadSyllabus(f); e.currentTarget.value = ""; }}/>
              </label>
              <p style={{ fontFamily: F.body, fontSize: "0.68rem", color: "var(--text-muted)", margin: 0, textAlign: "center" }}>PDF, DOCX, or TXT</p>
            </div>
          </div>
          {/* Step indicators */}
          <div style={{ display: "flex", gap: "10px", marginTop: "18px", flexWrap: "wrap" }}>
            {[
              { icon: <FileUp size={12}/>, text: "Upload syllabus" },
              { icon: <Sparkles size={12}/>, text: "Spark extracts details" },
              { icon: <ClipboardList size={12}/>, text: "Assignments auto-filled" },
              { icon: <Brain size={12}/>, text: "Study tools unlocked" },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 9px", borderRadius: "99px", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <span style={{ color: "var(--accent)" }}>{icon}</span>
                <span style={{ fontFamily: F.body, fontSize: "0.7rem", color: "var(--text-secondary)", fontWeight: 600 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: "13px" }}>
        {[
          { label: "Current Grade",  value: gradeDisplay, sub: computeGrade(assignments).pct !== null ? "weighted avg" : "No grades yet", icon: <BarChart2 size={15}/> },
          { label: "Assignments",    value: assignments.length > 0 ? String(assignments.length) : "—", sub: assignments.length > 0 ? `${assignments.filter(a => a.grade !== null).length} graded` : "None added yet", icon: <ClipboardList size={15}/> },
          { label: "Next Deadline",  value: nextDue ? formatDueForDisplay(nextDue.due) : "—", sub: nextDue ? nextDue.label : "Nothing upcoming", icon: <CalendarClock size={15}/> },
        ].map(({ label, value, sub, icon }) => (
          <div key={label} style={{ ...card, padding: "15px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", flexShrink: 0 }}>{icon}</div>
              <span style={{ fontFamily: F.body, fontSize: "0.66rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)" }}>{label}</span>
            </div>
            <div style={{ fontFamily: F.heading, fontSize: "1.25rem", fontWeight: 800, color: courseColor, lineHeight: 1, marginBottom: "3px" }}>{value}</div>
            <div style={{ fontFamily: F.body, fontSize: "0.68rem", color: "var(--text-muted)" }}>{sub}</div>
          </div>
        ))}
      </div>

      {(importState.active || importState.error || importState.success) && (
        <div style={{ ...card, padding: "16px 18px", borderLeft: `4px solid ${importState.error ? "#ef4444" : "var(--accent)"}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <div style={{ width: "30px", height: "30px", borderRadius: "9px", background: importState.error ? "rgba(239,68,68,0.12)" : "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", color: importState.error ? "#ef4444" : "var(--accent)" }}>
              {importState.error ? <AlertCircle size={15}/> : <Sparkles size={15}/>}
            </div>
            <div>
              <p style={{ fontFamily: F.heading, fontSize: "0.9rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 2px" }}>
                {importState.active ? importState.title : importState.error ? "Syllabus import hit a snag" : "Syllabus imported"}
              </p>
              <p style={{ fontFamily: F.body, fontSize: "0.78rem", color: importState.error ? "#ef4444" : "var(--text-muted)", margin: 0, lineHeight: 1.65 }}>
                {importState.error ?? importState.success ?? importState.detail}
              </p>
            </div>
          </div>
          {importState.active && (
            <div style={{ height: "7px", borderRadius: "99px", background: "var(--bg-secondary)", overflow: "hidden", marginTop: "12px" }}>
              <div style={{ height: "100%", width: "70%", borderRadius: "99px", background: "linear-gradient(90deg, var(--accent), var(--accent-hover))", animation: "overviewScan 1.2s ease-in-out infinite" }}/>
              <style>{`@keyframes overviewScan{0%{transform:translateX(-35%)}50%{transform:translateX(18%)}100%{transform:translateX(70%)}}`}</style>
            </div>
          )}
        </div>
      )}

      {insights && (
        <div style={card}>
          <div style={sHead}>
            <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
              <BookOpenCheck size={13} style={{ color: "var(--accent)" }}/>
              <span style={{ fontFamily: F.heading, fontSize: "0.86rem", fontWeight: 800, color: "var(--text-primary)" }}>Syllabus Details</span>
            </div>
            <span style={{ fontFamily: F.body, fontSize: "0.7rem", color: "var(--text-muted)" }}>Last analyzed {new Date(insights.analyzedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          </div>
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {detailRows.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
                {detailRows.map((row) => (
                  <div key={row.label} style={{ padding: "12px 13px", borderRadius: "11px", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <div style={{ fontFamily: F.body, fontSize: "0.66rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "5px" }}>{row.label}</div>
                    <div style={{ fontFamily: F.heading, fontSize: "0.86rem", fontWeight: 700, color: "var(--text-primary)", lineHeight: 1.55 }}>{row.value}</div>
                  </div>
                ))}
              </div>
            )}
            {insights.summary && (
              <div>
                <div style={{ fontFamily: F.body, fontSize: "0.66rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "6px" }}>Course Snapshot</div>
                <p style={{ fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.72 }}>{insights.summary}</p>
              </div>
            )}
            {insights.gradingPolicy.length > 0 && (
              <div>
                <div style={{ fontFamily: F.body, fontSize: "0.66rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "8px" }}>Grading Policy</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {insights.gradingPolicy.map((item) => (
                    <div key={item.label} style={{ padding: "8px 11px", borderRadius: "999px", background: "var(--accent-soft)", border: "1px solid var(--border)", color: "var(--accent)", fontFamily: F.body, fontSize: "0.75rem", fontWeight: 700 }}>
                      {item.label}{item.weight !== null ? ` · ${item.weight}%` : ""}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {insights.warnings.length > 0 && (
              <div style={{ padding: "11px 12px", borderRadius: "10px", background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.18)" }}>
                <p style={{ fontFamily: F.body, fontSize: "0.78rem", color: "#b45309", margin: 0, lineHeight: 1.7 }}>
                  {insights.warnings.join(" ")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spark suggestions */}
      <div style={card}>
        <div style={sHead}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <SparkLogo size={20}/>
            <span style={{ fontFamily: F.heading, fontSize: "0.86rem", fontWeight: 800, color: "var(--text-primary)" }}>Spark Suggestions</span>
          </div>
          <span style={{ fontFamily: F.body, fontSize: "0.7rem", color: "var(--text-muted)", fontStyle: "italic" }}>
            {docs.length > 0 ? "from your documents" : "upload documents to unlock"}
          </span>
        </div>
        {docs.length === 0 ? (
          <div style={{ padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <BookOpen size={16} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: "2px" }}/>
            <p style={{ fontFamily: F.body, fontSize: "0.84rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.7 }}>
              Upload your course materials and Spark will surface relevant study suggestions, key concept alerts and personalized tips here.
            </p>
          </div>
        ) : (suggestionsLoading && suggestions.length === 0) || (documentsSyncing && suggestions.length === 0) ? (
          <div style={{ padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <Brain size={16} style={{ color: "var(--accent)", flexShrink: 0, marginTop: "2px" }}/>
            <p style={{ fontFamily: F.body, fontSize: "0.84rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.7 }}>
              Spark is reading your uploaded files and building course-specific suggestions from them.
            </p>
          </div>
        ) : suggestionsError && suggestions.length === 0 ? (
          <div style={{ padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <AlertCircle size={16} style={{ color: "#ef4444", flexShrink: 0, marginTop: "2px" }}/>
            <p style={{ fontFamily: F.body, fontSize: "0.84rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.7 }}>{suggestionsError}</p>
          </div>
        ) : suggestions.length === 0 ? (
          <div style={{ padding: "18px 20px", display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <BookOpen size={16} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: "2px" }}/>
            <p style={{ fontFamily: F.body, fontSize: "0.84rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.7 }}>
              Spark needs readable document text to generate suggestions. Text-based PDFs, DOCX files, and TXT notes work best.
            </p>
          </div>
        ) : (
          suggestions.map((suggestion, index) => (
            <div key={suggestion.id} style={{ padding: "16px 20px", display: "flex", alignItems: "flex-start", gap: "12px", borderTop: index !== 0 ? "1px solid var(--border)" : undefined }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--accent)" }}>
                {index === 0 ? <Lightbulb size={14}/> : index === 1 ? <BookOpen size={14}/> : <Zap size={14}/>}
              </div>
              <div>
                <div style={{ fontFamily: F.heading, fontSize: "0.87rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "4px" }}>{suggestion.title}</div>
                <p style={{ fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-secondary)", margin: "0 0 4px", lineHeight: 1.7 }}>{suggestion.detail}</p>
                {suggestion.sourceDoc && (
                  <p style={{ fontFamily: F.body, fontSize: "0.72rem", color: "var(--text-muted)", margin: 0 }}>Based on {suggestion.sourceDoc}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Optional syllabus upload hint */}
      {!docs.some(d => d.type === "syllabus") && (
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: "12px", padding: "12px 16px", background: "var(--bg-secondary)", borderRadius: "11px", border: "1px solid var(--border)", opacity: 0.85 }}>
          <FileUp size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }}/>
          <p style={{ fontFamily: F.body, fontSize: "0.79rem", color: "var(--text-muted)", margin: 0, flex: 1, lineHeight: 1.5 }}>
            Optionally upload a syllabus to auto-fill assignments, grading details, and reminders.
          </p>
          <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", fontFamily: F.body, fontWeight: 600, fontSize: "0.75rem", cursor: "pointer", color: "var(--text-secondary)", whiteSpace: "nowrap", transition: "all 0.15s", flexShrink: 0, width: isMobile ? "100%" : "auto" }}
            onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLLabelElement).style.color = "var(--accent)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLLabelElement).style.color = "var(--text-secondary)"; }}>
            Upload
            <input type="file" accept="*/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) onUploadSyllabus(f); e.currentTarget.value = ""; }}/>
          </label>
        </div>
      )}
    </div>
  );
}
