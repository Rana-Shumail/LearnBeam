import { useState } from "react";
import { BarChart2, Check, ClipboardList, Edit2, Plus, Trash2, X } from "lucide-react";
import { upsertAssignment, deleteAssignment as dbDeleteAssignment } from "../../../lib/db";
import { formatDueForDisplay, type StoredCourseInsights } from "../../../lib/courseData";
import { F, card, sHead, computeGrade, EmptyState, type Assignment } from "./types.tsx";
import { useIsMobile } from "../ui/use-mobile";

/* ── Assignments Tab ─────────────────────────────────── */
export function AssignmentsTab({
  assignments, setAssignments, courseColor, courseId, onAutoReminderUpsert, onAutoReminderDelete,
}: {
  assignments: Assignment[];
  setAssignments: React.Dispatch<React.SetStateAction<Assignment[]>>;
  courseColor: string;
  courseId: string;
  onAutoReminderUpsert: (assignment: Assignment) => Promise<void>;
  onAutoReminderDelete: (assignmentId: string) => Promise<void>;
}) {
  const isMobile = useIsMobile();
  const [addingNew, setAddingNew] = useState(false);
  const [draft, setDraft]         = useState({ label: "", type: "Assignment", due: "", weight: 10 });
  const [editingGrade, setEditingGrade] = useState<string | null>(null);
  const [gradeDraft, setGradeDraft]     = useState("");

  const { display: gradeDisplay, pct } = computeGrade(assignments);

  const saveGrade = async (id: string) => {
    const val = parseFloat(gradeDraft);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      const a = assignments.find(x => x.id === id);
      if (a) {
        const updated = { ...a, grade: val, status: "completed" as const };
        setAssignments(prev => prev.map(x => x.id === id ? updated : x));
        await upsertAssignment({ id, course_id: courseId, label: a.label, type: a.type, due: a.due || null, weight: a.weight, grade: val, status: "completed" });
        await onAutoReminderDelete(id);
      }
    }
    setEditingGrade(null);
    setGradeDraft("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {/* Grade summary strip */}
      {assignments.length > 0 && (
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: "14px", padding: "14px 18px", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "13px", borderLeft: `4px solid ${courseColor}` }}>
          <div>
            <div style={{ fontFamily: F.body, fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "3px" }}>Running Average</div>
            <div style={{ fontFamily: F.heading, fontSize: "1.6rem", fontWeight: 900, color: courseColor, lineHeight: 1 }}>{gradeDisplay}</div>
          </div>
          {pct !== null && (
            <div style={{ flex: 1 }}>
              <div style={{ height: "6px", borderRadius: "99px", background: "var(--bg-secondary)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: courseColor, borderRadius: "99px", transition: "width 0.5s ease" }}/>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px" }}>
                <span style={{ fontFamily: F.body, fontSize: "0.67rem", color: "var(--text-muted)" }}>{assignments.filter(a => a.grade !== null).length} graded</span>
                <span style={{ fontFamily: F.body, fontSize: "0.67rem", color: "var(--text-muted)" }}>{assignments.filter(a => a.grade === null).length} pending</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div style={card}>
        <div style={sHead}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <ClipboardList size={13} style={{ color: "var(--accent)" }}/>
            <span style={{ fontFamily: F.heading, fontSize: "0.86rem", fontWeight: 800, color: "var(--text-primary)" }}>Assignments & Deadlines</span>
          </div>
          <button onClick={() => setAddingNew(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", background: "var(--accent)", color: "var(--primary-foreground)", border: "none", borderRadius: "7px", padding: "5px 10px", fontFamily: F.heading, fontSize: "0.73rem", fontWeight: 700, cursor: "pointer", width: isMobile ? "100%" : "auto" }}>
            <Plus size={11}/> Add
          </button>
        </div>

        {addingNew && (
          <div style={{ display: "flex", gap: "7px", padding: "12px 16px", borderBottom: "1px solid var(--border)", flexWrap: "wrap", background: "var(--accent-soft)" }}>
            {[
              { key: "label",  placeholder: "Item name (required)", flex: 3, type: "text"   },
              { key: "type",   placeholder: "Type",                 flex: 1, type: "text"   },
              { key: "due",    placeholder: "Due date",             flex: 1, type: "text"   },
              { key: "weight", placeholder: "Weight %",             flex: 1, type: "number" },
            ].map(f => (
              <input key={f.key} placeholder={f.placeholder} value={(draft as any)[f.key]}
                onChange={e => setDraft(d => ({ ...d, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                type={f.type}
                style={{ flex: isMobile ? "1 1 100%" : f.flex, padding: "7px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--input)", fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-primary)", outline: "none", minWidth: isMobile ? "100%" : "80px", width: isMobile ? "100%" : undefined }}
              />
            ))}
            <button onClick={async () => {
              if (draft.label.trim()) {
                const tempId = crypto.randomUUID();
                const tempA: Assignment = { id: tempId, ...draft, grade: null, status: "upcoming" };
                setAssignments(prev => [...prev, tempA]);
                const db = await upsertAssignment({ id: tempId, course_id: courseId, label: draft.label, type: draft.type, due: draft.due || null, weight: draft.weight, grade: null, status: "upcoming" });
                const savedAssignment = db
                  ? { id: db.id, label: db.label, type: db.type, due: db.due ?? draft.due, weight: db.weight, grade: db.grade, status: db.status }
                  : tempA;
                if (db) setAssignments(prev => prev.map(a => a.id === tempId ? savedAssignment : a));
                await onAutoReminderUpsert(savedAssignment);
              }
              setAddingNew(false); setDraft({ label: "", type: "Assignment", due: "", weight: 10 });
            }} style={{ background: "var(--accent)", color: "var(--primary-foreground)", border: "none", borderRadius: "7px", padding: "7px 13px", fontFamily: F.heading, fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", flex: isMobile ? "1 1 100%" : undefined, width: isMobile ? "100%" : undefined }}>Save</button>
            <button onClick={() => setAddingNew(false)} style={{ background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "7px", padding: "7px 12px", fontFamily: F.body, fontSize: "0.8rem", cursor: "pointer", flex: isMobile ? "1 1 100%" : undefined, width: isMobile ? "100%" : undefined }}>Cancel</button>
          </div>
        )}

        {assignments.length === 0 && !addingNew && (
          <div style={{ padding: "36px 24px", textAlign: "center" }}>
            <ClipboardList size={30} style={{ color: "var(--text-muted)", marginBottom: "11px" }}/>
            <p style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.92rem", color: "var(--text-primary)", margin: "0 0 5px" }}>No assignments yet</p>
            <p style={{ fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>Click "Add" to track assignments, quizzes, exams or any scored item.</p>
          </div>
        )}

        {assignments.map((item, i) => (
          <div key={item.id} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", gap: "11px", padding: "13px 18px", borderTop: i !== 0 || addingNew ? "1px solid var(--border)" : undefined }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: item.grade !== null ? courseColor : item.status === "overdue" ? "#ef4444" : "var(--border)" }}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: F.heading, fontSize: "0.88rem", fontWeight: 700, color: "var(--text-primary)" }}>{item.label}</div>
              <div style={{ fontFamily: F.body, fontSize: "0.71rem", color: "var(--text-muted)" }}>{item.type}{item.weight ? ` · ${item.weight}% weight` : ""}{item.due ? ` · Due ${formatDueForDisplay(item.due)}` : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, flexWrap: "wrap", width: isMobile ? "100%" : "auto", justifyContent: isMobile ? "space-between" : "flex-start" }}>
              {editingGrade === item.id ? (
                <>
                  <input value={gradeDraft} onChange={e => setGradeDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") saveGrade(item.id); if (e.key === "Escape") { setEditingGrade(null); setGradeDraft(""); } }}
                    placeholder="0-100" type="number" min="0" max="100" autoFocus
                    style={{ width: "72px", padding: "5px 8px", borderRadius: "7px", border: `1.5px solid ${courseColor}`, background: "var(--input)", fontFamily: F.mono, fontSize: "0.82rem", color: "var(--text-primary)", outline: "none", textAlign: "center" }}
                  />
                  <button onClick={() => saveGrade(item.id)} style={{ width: "28px", height: "28px", borderRadius: "7px", background: courseColor, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><Check size={13}/></button>
                  <button onClick={() => { setEditingGrade(null); setGradeDraft(""); }} style={{ width: "28px", height: "28px", borderRadius: "7px", background: "var(--bg-secondary)", color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={13}/></button>
                </>
              ) : (
                <>
                  {item.grade !== null ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "1rem", color: courseColor }}>{item.grade}%</span>
                      <button onClick={() => { setEditingGrade(item.id); setGradeDraft(String(item.grade)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}><Edit2 size={11}/></button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditingGrade(item.id); setGradeDraft(""); }}
                      style={{ fontFamily: F.body, fontSize: "0.74rem", padding: "4px 11px", borderRadius: "99px", border: "1px dashed var(--border)", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontWeight: 500, transition: "all 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = courseColor; (e.currentTarget as HTMLButtonElement).style.color = courseColor; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}>
                      + Grade
                    </button>
                  )}
                  <button onClick={async () => { setAssignments(prev => prev.filter(x => x.id !== item.id)); await dbDeleteAssignment(item.id); await onAutoReminderDelete(item.id); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}><Trash2 size={12}/></button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Grades Tab ──────────────────────────────────────── */
export function GradesTab({
  assignments, courseColor, insights,
}: {
  assignments: Assignment[];
  courseColor: string;
  insights: StoredCourseInsights | null;
}) {
  const isMobile = useIsMobile();
  const graded = assignments.filter(a => a.grade !== null);
  const { display } = computeGrade(assignments);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {insights && insights.gradingPolicy.length > 0 && (
        <div style={{ ...card, padding: "16px 18px" }}>
          <div style={{ fontFamily: F.heading, fontSize: "0.9rem", fontWeight: 800, color: "var(--text-primary)", marginBottom: "10px" }}>Syllabus Grade Weights</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
            {insights.gradingPolicy.map((item) => (
              <div key={item.label} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "flex-start" : "center", justifyContent: "space-between", gap: "12px" }}>
                <div>
                  <div style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.85rem", color: "var(--text-primary)" }}>{item.label}</div>
                  {item.notes && <div style={{ fontFamily: F.body, fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>{item.notes}</div>}
                </div>
                <span style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "0.92rem", color: courseColor }}>{item.weight !== null ? `${item.weight}%` : "—"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {graded.length === 0 ? (
        <EmptyState icon={<BarChart2 size={24}/>} title="No grades recorded" body="Enter grades in the Assignments tab — they'll appear here and update your running average automatically."/>
      ) : (
        <>
          <div style={{ ...card, padding: "18px 20px", borderLeft: `4px solid ${courseColor}` }}>
            <div style={{ fontFamily: F.body, fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "var(--text-muted)", marginBottom: "4px" }}>Overall Average</div>
            <div style={{ fontFamily: F.heading, fontSize: "2.2rem", fontWeight: 900, color: courseColor, lineHeight: 1 }}>{display}</div>
          </div>
          <div style={card}>
            <div style={sHead}>
              <span style={{ fontFamily: F.heading, fontSize: "0.84rem", fontWeight: 700, color: "var(--text-primary)" }}>Grade Breakdown</span>
              <span style={{ fontFamily: F.body, fontSize: "0.74rem", color: "var(--text-muted)" }}>{graded.length} of {assignments.length} graded</span>
            </div>
            {graded.map((a, i) => (
              <div key={a.id} style={{ display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", padding: "12px 18px", borderTop: i !== 0 ? "1px solid var(--border)" : undefined, gap: isMobile ? "10px" : "12px" }}>
                <div>
                  <div style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.88rem", color: "var(--text-primary)" }}>{a.label}</div>
                  <div style={{ fontFamily: F.body, fontSize: "0.72rem", color: "var(--text-muted)" }}>{a.type}{a.weight ? ` · ${a.weight}% weight` : ""}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", width: isMobile ? "100%" : "auto" }}>
                  <div style={{ width: isMobile ? "100%" : "80px", height: "4px", borderRadius: "99px", background: "var(--bg-secondary)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${a.grade!}%`, background: courseColor, borderRadius: "99px" }}/>
                  </div>
                  <span style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "1rem", color: courseColor, minWidth: "42px", textAlign: "right" }}>{a.grade}%</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
