import {
  AlertCircle, BookOpenCheck, CalendarDays, Check, CheckCircle2, ChevronRight,
  Clock3, Download, Leaf, ListTodo, RefreshCw, ShieldCheck, Sparkles, Target,
} from "lucide-react";
import { useIsMobile } from "../ui/use-mobile";
import { formatDueForDisplay, type StoredStudyPlan, type StoredStudySession } from "../../../lib/courseData";
import { formatStudySessionRange } from "../../../lib/studyPlanner";
import { F } from "./types.tsx";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function buildCalendarDays(sessions: StoredStudySession[]) {
  const today = startOfDay(new Date());
  const firstUpcoming = sessions
    .filter(session => !session.completed && new Date(session.startAt).getTime() >= today.getTime())
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())[0];
  const focusDate = firstUpcoming ? startOfDay(new Date(firstUpcoming.startAt)) : today;
  const mondayOffset = (focusDate.getDay() + 6) % 7;
  const monday = new Date(focusDate.getTime() - mondayOffset * DAY_MS);
  return Array.from({ length: 7 }, (_, index) => new Date(monday.getTime() + index * DAY_MS));
}

function priorityColor(priority: StoredStudySession["priority"], courseColor: string) {
  if (priority === "high") return "#e2a400";
  if (priority === "medium") return courseColor;
  return "#94a3b8";
}

export function StudyPlannerCard({
  courseColor, studyPlan, busy, error, onRefresh, onExport, onToggleSession,
}: {
  courseColor: string;
  studyPlan: StoredStudyPlan | null;
  busy: boolean;
  error: string | null;
  onRefresh: () => void;
  onExport: () => void;
  onToggleSession: (sessionId: string) => void;
}) {
  const isMobile = useIsMobile();
  const sessions = studyPlan?.sessions ?? [];
  const completedCount = sessions.filter(session => session.completed).length;
  const remainingCount = sessions.length - completedCount;
  const coveredTopics = studyPlan?.topics.filter(topic => topic.status === "covered") ?? [];
  const uncoveredTopics = studyPlan?.topics.filter(topic => topic.status === "uncovered") ?? [];
  const priorityTopics = studyPlan?.topics.filter(topic => topic.status === "priority") ?? [];
  const quizAttempts = studyPlan?.activity.quizAttempts ?? [];
  const quizPercentage = quizAttempts.length
    ? quizAttempts.reduce((sum, attempt) => sum + (attempt.total ? attempt.correct / attempt.total : 0), 0) / quizAttempts.length * 100
    : null;
  const progressSignals = [
    sessions.length ? completedCount / sessions.length * 100 : null,
    studyPlan?.topics.length ? coveredTopics.length / studyPlan.topics.length * 100 : null,
    quizPercentage,
    studyPlan?.activity.focusSessions ? Math.min(100, studyPlan.activity.focusSessions * 20) : null,
  ].filter((value): value is number => value !== null);
  const progress = progressSignals.length
    ? Math.round(progressSignals.reduce((sum, value) => sum + value, 0) / progressSignals.length)
    : 0;
  const nextSession = sessions.find(session => !session.completed) ?? sessions[0] ?? null;
  const calendarDays = buildCalendarDays(sessions);
  const weekLabel = `${calendarDays[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${calendarDays[6].toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const panel = {
    background: "color-mix(in srgb, var(--bg-surface) 96%, #ecfdf3 4%)",
    border: "1px solid color-mix(in srgb, var(--border) 78%, #70b97a 22%)",
    borderRadius: isMobile ? "18px" : "22px",
    boxShadow: "0 14px 42px rgba(20, 83, 45, 0.07)",
  } as const;
  const actionButton = (primary = false) => ({
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "7px",
    minHeight: "38px", padding: "8px 13px", borderRadius: "11px",
    border: primary ? "none" : "1px solid var(--border)",
    background: primary ? courseColor : "var(--bg-surface)",
    color: primary ? "white" : "var(--text-secondary)", fontFamily: F.body,
    fontSize: "0.75rem", fontWeight: 800, cursor: "pointer",
  } as const);

  if (!studyPlan || studyPlan.sessions.length === 0) {
    return (
      <div style={{ ...panel, minHeight: "540px", display: "grid", placeItems: "center", overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 85% 0%, rgba(66,174,87,.18), transparent 35%), radial-gradient(circle at 5% 100%, rgba(22,163,74,.10), transparent 30%)" }}/>
        <div style={{ position: "relative", maxWidth: "560px", textAlign: "center", padding: "32px" }}>
          <div style={{ width: "74px", height: "74px", borderRadius: "24px", background: "linear-gradient(145deg, #dcfce7, #bbf7d0)", color: "#15803d", display: "grid", placeItems: "center", margin: "0 auto 18px", boxShadow: "0 16px 34px rgba(21,128,61,.16)" }}><Sparkles size={32}/></div>
          <h2 style={{ margin: 0, fontFamily: F.heading, fontSize: isMobile ? "1.45rem" : "2rem", color: "var(--text-primary)", letterSpacing: "-.04em" }}>Your smart plan starts here</h2>
          <p style={{ margin: "12px auto 22px", fontFamily: F.body, color: "var(--text-muted)", lineHeight: 1.7, fontSize: ".9rem" }}>Add a syllabus, assignments, reminders, or readable course documents. LearnBeam will turn your saved course data into a focused weekly schedule.</p>
          <button onClick={onRefresh} disabled={busy} style={{ ...actionButton(true), opacity: busy ? .7 : 1 }}><RefreshCw size={15} className={busy ? "planner-spin" : ""}/>{busy ? "Building your plan" : "Build my study plan"}</button>
          {error && <p style={{ color: "#b91c1c", fontFamily: F.body, fontSize: ".78rem", marginTop: "14px" }}>{error}</p>}
        </div>
      </div>
    );
  }

  const topicColumns = [
    { title: "Covered Topics", count: coveredTopics.length, items: coveredTopics, icon: BookOpenCheck, color: "#16863a", wash: "rgba(34,197,94,.08)", empty: "Complete sessions to build your covered list." },
    { title: "Uncovered Topics", count: uncoveredTopics.length, items: uncoveredTopics, icon: ListTodo, color: "#b98200", wash: "rgba(250,204,21,.10)", empty: "No uncovered topics found." },
    { title: "Need to Study", count: priorityTopics.length, items: priorityTopics, icon: Target, color: courseColor, wash: "rgba(34,197,94,.07)", empty: "No priority topics right now." },
  ];

  return (
    <section className="planner-shell" style={{ position: "relative", display: "flex", flexDirection: "column", gap: isMobile ? "14px" : "18px", padding: isMobile ? "2px 0" : "4px 0 24px" }}>
      <div style={{ ...panel, position: "relative", overflow: "hidden", padding: isMobile ? "22px 18px" : "28px 30px" }}>
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 76% -30%, rgba(34,197,94,.19), transparent 40%), linear-gradient(120deg, rgba(255,255,255,.04), rgba(34,197,94,.03))" }}/>
        <div style={{ position: "absolute", right: isMobile ? "16px" : "42px", top: isMobile ? "16px" : "17px", opacity: .15, color: courseColor }}><Leaf size={isMobile ? 54 : 92}/></div>
        <div style={{ position: "relative", display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: isMobile ? "stretch" : "center", justifyContent: "space-between", gap: "18px" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "6px 10px", borderRadius: "999px", background: "rgba(34,197,94,.10)", color: "#15803d", fontFamily: F.body, fontWeight: 800, fontSize: ".68rem", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: "10px" }}><Sparkles size={13}/> AI-powered weekly guidance</div>
            <h1 style={{ margin: 0, fontFamily: F.heading, fontSize: isMobile ? "1.65rem" : "clamp(2rem, 3vw, 3.15rem)", lineHeight: 1, letterSpacing: "-.055em", color: "var(--text-primary)", fontWeight: 950 }}>Smart Study Planner</h1>
            <p style={{ margin: "10px 0 0", color: "var(--text-muted)", fontFamily: F.body, fontSize: isMobile ? ".8rem" : ".94rem", letterSpacing: ".04em" }}>Plan smarter. Learn deeper. Achieve more.</p>
          </div>
          <div style={{ display: "flex", gap: "9px", alignItems: "center", flexWrap: "wrap", position: "relative" }}>
            <button onClick={onRefresh} disabled={busy} style={{ ...actionButton(false), opacity: busy ? .65 : 1 }}><RefreshCw size={14} className={busy ? "planner-spin" : ""}/>{busy ? "Updating" : "Refresh plan"}</button>
            <button onClick={onExport} style={actionButton(true)}><Download size={14}/> Export calendar</button>
          </div>
        </div>
      </div>

      {error && <div style={{ display: "flex", gap: "9px", alignItems: "flex-start", padding: "12px 14px", borderRadius: "13px", color: "#b91c1c", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.18)", fontFamily: F.body, fontSize: ".78rem" }}><AlertCircle size={15}/>{error}</div>}

      <div className="planner-summary-grid" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1.08fr repeat(3, minmax(0, 1fr))", gap: "14px" }}>
        <article style={{ ...panel, padding: isMobile ? "20px" : "22px", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: "260px" }}>
          <h2 style={{ margin: 0, fontFamily: F.heading, fontSize: "1rem", color: "var(--text-primary)", fontWeight: 900 }}>Course Progress</h2>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "22px", flex: 1 }}>
            <div style={{ width: isMobile ? "138px" : "158px", height: isMobile ? "138px" : "158px", flexShrink: 0, borderRadius: "50%", padding: "17px", background: `conic-gradient(${courseColor} ${progress}%, #dbe6df ${progress}% 100%)`, boxShadow: `0 10px 28px ${courseColor}20` }}>
              <div style={{ width: "100%", height: "100%", borderRadius: "50%", display: "grid", placeItems: "center", textAlign: "center", background: "var(--bg-surface)" }}><div><strong style={{ display: "block", fontFamily: F.heading, fontSize: "2rem", color: "#075e2a", lineHeight: 1 }}>{progress}%</strong><span style={{ fontFamily: F.body, fontSize: ".78rem", color: "var(--text-secondary)" }}>Covered</span></div></div>
            </div>
            <div style={{ display: "grid", gap: "14px" }}><div><strong style={{ fontFamily: F.heading, fontSize: "1.05rem", color: "var(--text-primary)" }}>{completedCount}</strong><span style={{ display: "block", fontFamily: F.body, fontSize: ".7rem", color: "var(--text-muted)" }}>completed</span></div><div><strong style={{ fontFamily: F.heading, fontSize: "1.05rem", color: "var(--text-primary)" }}>{remainingCount}</strong><span style={{ display: "block", fontFamily: F.body, fontSize: ".7rem", color: "var(--text-muted)" }}>remaining</span></div></div>
          </div>
        </article>

        {topicColumns.map(({ title, count, items, icon: Icon, color, wash, empty }) => (
          <article key={title} style={{ ...panel, padding: "18px", minHeight: "260px", background: `linear-gradient(155deg, var(--bg-surface), ${wash})` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "14px", borderBottom: "1px solid var(--border)" }}><span style={{ width: "42px", height: "42px", borderRadius: "50%", display: "grid", placeItems: "center", background: wash, color }}><Icon size={20}/></span><h2 style={{ margin: 0, flex: 1, fontFamily: F.heading, fontSize: ".92rem", color: "var(--text-primary)", fontWeight: 900 }}>{title}</h2><span style={{ minWidth: "30px", height: "30px", padding: "0 8px", display: "grid", placeItems: "center", borderRadius: "50%", background: wash, color, fontFamily: F.heading, fontWeight: 900, fontSize: ".78rem" }}>{count}</span></div>
            <div style={{ display: "grid", gap: "11px", paddingTop: "15px" }}>
              {items.length ? items.slice(0, 5).map((topic, index) => (
                <div key={`${title}-${topic.label}`} title={`Source: ${topic.sourceLabel}`} style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}><span style={{ width: "23px", height: "23px", borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", background: title === "Covered Topics" ? color : "transparent", border: `2px solid ${color}`, color: "white" }}>{title === "Covered Topics" ? <Check size={13}/> : <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color }}/>}</span><span style={{ fontFamily: F.body, fontSize: ".77rem", color: "var(--text-secondary)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis" }}>{topic.label}</span>{index === 0 && title === "Need to Study" && <span style={{ marginLeft: "auto", fontFamily: F.body, fontSize: ".58rem", fontWeight: 800, color, textTransform: "uppercase" }}>Next</span>}</div>
              )) : <p style={{ margin: 0, fontFamily: F.body, fontSize: ".75rem", color: "var(--text-muted)", lineHeight: 1.55 }}>{empty}</p>}
            </div>
          </article>
        ))}
      </div>

      <div className="planner-lower-grid" style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0, 1.65fr) minmax(310px, .85fr)", gap: "14px", alignItems: "stretch" }}>
        <article style={{ ...panel, padding: isMobile ? "18px 14px" : "22px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "18px", flexWrap: "wrap" }}><div style={{ display: "flex", alignItems: "center", gap: "10px" }}><span style={{ width: "38px", height: "38px", borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(34,197,94,.10)", color: "#15803d" }}><CalendarDays size={19}/></span><div><h2 style={{ margin: 0, fontFamily: F.heading, fontSize: "1.05rem", color: "var(--text-primary)", fontWeight: 900 }}>Your Study Week</h2><span style={{ fontFamily: F.body, fontSize: ".68rem", color: "var(--text-muted)" }}>{weekLabel}</span></div></div><span style={{ fontFamily: F.body, fontSize: ".68rem", color: "var(--text-muted)" }}>{completedCount}/{sessions.length} sessions complete</span></div>
          <div className="planner-calendar" style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(7, minmax(112px, 1fr))" : "repeat(7, minmax(0, 1fr))", gap: "7px", overflowX: isMobile ? "auto" : "visible", paddingBottom: isMobile ? "8px" : 0 }}>
            {calendarDays.map(day => {
              const daySessions = sessions.filter(session => sameDay(new Date(session.startAt), day));
              const today = sameDay(day, new Date());
              return (
                <div key={day.toISOString()} style={{ minHeight: "220px", padding: "11px 8px", borderRadius: "14px", border: today ? `1.5px solid ${courseColor}` : "1px solid var(--border)", background: today ? "rgba(34,197,94,.07)" : "var(--bg-secondary)", display: "flex", flexDirection: "column", gap: "9px" }}>
                  <div style={{ textAlign: "center", paddingBottom: "8px", borderBottom: "1px solid var(--border)" }}><strong style={{ display: "block", fontFamily: F.heading, fontSize: ".72rem", color: today ? courseColor : "var(--text-primary)" }}>{day.toLocaleDateString("en-US", { weekday: "short" })}</strong><span style={{ fontFamily: F.body, fontSize: ".64rem", color: "var(--text-muted)" }}>{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span></div>
                  {daySessions.length ? daySessions.map(session => (
                    <button key={session.id} onClick={() => onToggleSession(session.id)} title={session.detail} style={{ width: "100%", padding: "9px 7px", borderRadius: "10px", border: `1px solid ${priorityColor(session.priority, courseColor)}35`, background: session.completed ? "rgba(34,197,94,.10)" : "var(--bg-surface)", textAlign: "left", cursor: "pointer", opacity: session.completed ? .72 : 1 }}><span style={{ width: "22px", height: "22px", borderRadius: "50%", display: "grid", placeItems: "center", marginBottom: "7px", border: `2px solid ${priorityColor(session.priority, courseColor)}`, background: session.completed ? priorityColor(session.priority, courseColor) : "transparent", color: "white" }}>{session.completed && <Check size={12}/>}</span><strong style={{ display: "block", fontFamily: F.heading, fontSize: ".68rem", color: "var(--text-primary)", lineHeight: 1.35, textDecoration: session.completed ? "line-through" : "none" }}>{session.title.replace(/^Study\s+/i, "")}</strong><span style={{ display: "block", marginTop: "4px", fontFamily: F.body, fontSize: ".58rem", color: "var(--text-muted)" }}>{new Date(session.startAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span></button>
                  )) : <div style={{ flex: 1, display: "grid", placeItems: "center", color: "var(--text-muted)", fontFamily: F.body, fontSize: ".64rem", textAlign: "center" }}>Open<br/>study time</div>}
                </div>
              );
            })}
          </div>
        </article>

        <article style={{ ...panel, padding: isMobile ? "18px" : "22px", background: "linear-gradient(145deg, var(--bg-surface), rgba(34,197,94,.08))", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "17px" }}><span style={{ width: "40px", height: "40px", borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(34,197,94,.12)", color: "#15803d" }}><Target size={20}/></span><h2 style={{ margin: 0, fontFamily: F.heading, fontSize: "1.05rem", color: "var(--text-primary)", fontWeight: 900 }}>Upcoming Focus</h2></div>
          {nextSession ? <div style={{ flex: 1, padding: "20px", borderRadius: "17px", background: "color-mix(in srgb, var(--bg-surface) 92%, #dcfce7 8%)", border: "1px solid var(--border)", display: "flex", flexDirection: "column" }}><span style={{ fontFamily: F.body, color: courseColor, fontSize: ".67rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: ".08em" }}>{nextSession.priority} priority</span><h3 style={{ margin: "8px 0 5px", fontFamily: F.heading, fontSize: "1.22rem", color: "#11652c", lineHeight: 1.2 }}>{nextSession.title}</h3><div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--text-muted)", fontFamily: F.body, fontSize: ".72rem" }}><Clock3 size={13}/>{formatStudySessionRange(nextSession)}</div><p style={{ margin: "20px 0", fontFamily: F.body, fontSize: ".78rem", color: "var(--text-secondary)", lineHeight: 1.65 }}>{nextSession.detail}</p>{nextSession.due && <div style={{ padding: "10px", borderRadius: "10px", background: "rgba(250,204,21,.10)", color: "#8a6400", fontFamily: F.body, fontSize: ".7rem", marginBottom: "16px" }}>Due reference: {formatDueForDisplay(nextSession.due)}</div>}<button onClick={() => onToggleSession(nextSession.id)} style={{ ...actionButton(true), marginTop: "auto", width: "100%" }}><CheckCircle2 size={15}/>{nextSession.completed ? "Mark incomplete" : "Complete this session"}<ChevronRight size={14}/></button></div> : <p style={{ fontFamily: F.body, color: "var(--text-muted)" }}>Your current plan is complete.</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "12px" }}><div style={{ padding: "10px", borderRadius: "11px", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}><span style={{ display: "block", fontFamily: F.body, fontSize: ".59rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Focus time</span><strong style={{ fontFamily: F.heading, color: "var(--text-primary)", fontSize: ".8rem" }}>{studyPlan.activity.focusMinutes} min</strong></div><div style={{ padding: "10px", borderRadius: "11px", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}><span style={{ display: "block", fontFamily: F.body, fontSize: ".59rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Quiz average</span><strong style={{ fontFamily: F.heading, color: "var(--text-primary)", fontSize: ".8rem" }}>{quizPercentage === null ? "No attempts" : `${Math.round(quizPercentage)}%`}</strong></div></div>
        </article>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", padding: "0 4px", color: "var(--text-muted)", fontFamily: F.body, fontSize: ".68rem" }}><span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><ShieldCheck size={13} color={courseColor}/> Grounded in your saved course records and learning activity</span><span>Updated {new Date(studyPlan.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>

      <style>{`
        @keyframes plannerSpin { to { transform: rotate(360deg); } }
        .planner-spin { animation: plannerSpin .9s linear infinite; }
        @media (max-width: 1180px) and (min-width: 701px) {
          .planner-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .planner-lower-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 700px) {
          .planner-shell { width: 100%; }
          .planner-calendar { scrollbar-width: thin; }
        }
      `}</style>
    </section>
  );
}
