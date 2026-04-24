/**
 * Shared types, style constants, and tiny utility components
 * used across every CoursePage tab.
 */
import {
  BellRing, BarChart2, Brain, ClipboardList, FileText, Sparkles, X, HelpCircle, Bell,
} from "lucide-react";
import type { StoredSparkCitation, StoredSparkMessage } from "../../../lib/courseData";
import { formatDueForTimeline } from "../../../lib/courseData";
import { useIsMobile } from "../ui/use-mobile";

/* ── Font stack ─────────────────────────────────── */
export const F = {
  heading: "'Nunito', 'Trebuchet MS', system-ui, sans-serif",
  body:    "'Plus Jakarta Sans', 'Segoe UI', system-ui, sans-serif",
  mono:    "'DM Mono', 'Fira Code', monospace",
} as const;

/* ── Shared card styles ─────────────────────────── */
export const card: React.CSSProperties = {
  background: "var(--bg-surface)",
  border: "1px solid var(--border)",
  borderRadius: "13px",
  overflow: "hidden",
};

export const sHead: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "8px",
  padding: "11px 18px",
  background: "var(--section-bg)",
  borderBottom: "1px solid var(--border)",
};

/* ── Domain types ───────────────────────────────── */
export type TabId = "overview" | "assignments" | "grades" | "docs" | "reminders" | "activities";

export type Doc = {
  id: string;
  name: string;
  type: "syllabus" | "notes" | "reading" | "past-exam" | "other";
  size: string;
  uploadedAt: string;
  used: boolean;
  storagePath: string | null;
  textContent: string | null;
};

export type Assignment = {
  id: string;
  label: string;
  type: string;
  due: string;
  weight: number;
  grade: number | null;
  status: "upcoming" | "completed" | "overdue";
};

export type SyllabusImportState = {
  active: boolean;
  title: string;
  detail: string;
  error: string | null;
  success: string | null;
};

export type Citation = StoredSparkCitation;
export type ChatMsg  = StoredSparkMessage;

/* ── Tab bar config ─────────────────────────────── */
export const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview",    label: "Overview",    icon: <Sparkles      size={13} /> },
  { id: "assignments", label: "Assignments", icon: <ClipboardList size={13} /> },
  { id: "grades",      label: "Grades",      icon: <BarChart2     size={13} /> },
  { id: "docs",        label: "Documents",   icon: <FileText      size={13} /> },
  { id: "reminders",   label: "Reminders",   icon: <BellRing      size={13} /> },
  { id: "activities",  label: "Activities",  icon: <Brain         size={13} /> },
];

export const TAB_TIPS: Record<TabId, string> = {
  overview:    "Your course at a glance — stats, grade and Spark suggestions from your documents.",
  assignments: "Track everything with a score. Grades you enter here automatically update your course average.",
  grades:      "Your grade history. Every logged grade feeds the running average shown in Overview.",
  docs:        "Everything Spark knows about this course. Files uploaded here or via Spark chat appear in this list.",
  reminders:   "Deadlines specific to this course. Add custom ones anytime.",
  activities:  "AI-powered study activities built from your uploaded documents — none of these affect your grade.",
};

/* ── Chat helpers ───────────────────────────────── */
export function createChatMessage(
  message: Omit<ChatMsg, "id" | "createdAt" | "citations" | "flagged" | "flagNote" | "provider" | "mode"> &
    Partial<Pick<ChatMsg, "citations" | "flagged" | "flagNote" | "provider" | "mode">>,
): ChatMsg {
  return {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    citations: message.citations ?? [],
    flagged: message.flagged ?? false,
    flagNote: message.flagNote ?? null,
    provider: message.provider ?? null,
    mode: message.mode ?? null,
    ...message,
  };
}

export function createDefaultSparkMessages(): ChatMsg[] {
  return [
    createChatMessage({ role: "system", text: "Spark — course AI assistant" }),
    createChatMessage({
      role: "ai",
      text: "Hi! I'm Spark. Use Course Sources for answers from your uploaded class files, or Spark Open for broader help beyond your documents.",
    }),
  ];
}

/* ── Grade calculation ──────────────────────────── */
export function computeGrade(assignments: Assignment[]): { display: string; pct: number | null } {
  const graded = assignments.filter(a => a.grade !== null);
  if (graded.length === 0) return { display: "—", pct: null };
  const totalW = graded.reduce((s, a) => s + (a.weight || 1), 0);
  const pct    = graded.reduce((s, a) => s + a.grade! * (a.weight || 1), 0) / totalW;
  const letter = pct >= 93 ? "A" : pct >= 90 ? "A-" : pct >= 87 ? "B+" : pct >= 83 ? "B"
               : pct >= 80 ? "B-" : pct >= 77 ? "C+" : pct >= 73 ? "C" : pct >= 70 ? "C-"
               : pct >= 67 ? "D+" : pct >= 60 ? "D" : "F";
  return { display: `${pct.toFixed(0)}%  ${letter}`, pct };
}

/* ── Shared UI primitives ───────────────────────── */
export function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div style={{ ...card, padding: "44px 24px", textAlign: "center" }}>
      <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "52px", height: "52px", borderRadius: "14px", background: "var(--accent-soft)", marginBottom: "14px", color: "var(--accent)" }}>{icon}</div>
      <p style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)", margin: "0 0 6px" }}>{title}</p>
      <p style={{ fontFamily: F.body, fontSize: "0.83rem", color: "var(--text-muted)", margin: 0, maxWidth: "300px", lineHeight: 1.7 }}>{body}</p>
    </div>
  );
}

export function HelpPanel({ tab, onClose }: { tab: TabId; onClose: () => void }) {
  const isMobile = useIsMobile();
  return (
    <div style={{ position: "fixed", bottom: isMobile ? "72px" : "80px", right: isMobile ? "12px" : "22px", zIndex: 110, width: isMobile ? "min(280px, calc(100vw - 24px))" : "280px", maxWidth: "calc(100vw - 24px)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "14px", boxShadow: "0 20px 55px rgba(0,0,0,0.14)", overflow: "hidden", animation: "panelIn 0.2s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 15px", borderBottom: "1px solid var(--border)", background: "var(--section-bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "7px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <HelpCircle size={13} style={{ color: "var(--primary-foreground)" }} />
          </div>
          <span style={{ fontFamily: F.heading, fontSize: "0.85rem", fontWeight: 800, color: "var(--text-primary)" }}>{TABS.find(t => t.id === tab)?.label}</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}><X size={13} /></button>
      </div>
      <div style={{ padding: "15px 16px" }}>
        <p style={{ fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-secondary)", margin: 0, lineHeight: 1.68 }}>{TAB_TIPS[tab]}</p>
      </div>
    </div>
  );
}

export function CourseRemindersPanel({
  courseCode, courseColor, items, onClose,
}: {
  courseCode: string;
  courseColor: string;
  items: { id: string; label: string; due: string; urgent: boolean }[];
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  return (
    <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 200, width: isMobile ? "min(300px, calc(100vw - 24px))" : "300px", maxWidth: "calc(100vw - 24px)", background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "15px", boxShadow: "0 22px 58px rgba(0,0,0,0.18)", overflow: "hidden", animation: "panelIn 0.2s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: "1px solid var(--border)", background: "var(--section-bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: courseColor }} />
          <span style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "0.88rem", color: "var(--text-primary)" }}>{courseCode} — Reminders</span>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}><X size={13} /></button>
      </div>
      {items.length === 0 ? (
        <div style={{ padding: "28px 18px", textAlign: "center" }}>
          <Bell size={22} style={{ color: "var(--text-muted)", marginBottom: "10px" }} />
          <p style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.86rem", color: "var(--text-primary)", margin: "0 0 5px" }}>No upcoming deadlines</p>
          <p style={{ fontFamily: F.body, fontSize: "0.76rem", color: "var(--text-muted)", margin: 0 }}>This course is caught up for now.</p>
        </div>
      ) : items.map((r, i) => (
        <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderTop: i !== 0 ? "1px solid var(--border)" : undefined }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: r.urgent ? "#ef4444" : courseColor, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.84rem", color: "var(--text-primary)" }}>{r.label}</div>
            <div style={{ fontFamily: F.body, fontSize: "0.72rem", color: "var(--text-muted)" }}>{formatDueForTimeline(r.due)}</div>
          </div>
          {r.urgent && <span style={{ fontFamily: F.body, fontSize: "0.67rem", padding: "2px 8px", borderRadius: "99px", background: "rgba(239,68,68,0.12)", color: "#ef4444", fontWeight: 600 }}>Soon</span>}
        </div>
      ))}
    </div>
  );
}
