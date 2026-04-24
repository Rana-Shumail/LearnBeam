import { useState, useEffect } from "react";
import {
  AlertCircle, Brain, ChevronLeft, Pause, Play,
  RotateCcw, StickyNote, Timer, Trash2, X, Zap,
} from "lucide-react";
import {
  loadStoredCourseData, patchStoredCourseData,
  type StoredQuizSession,
} from "../../../lib/courseData";
import {
  generateQuizFromDocuments,
  type GeneratedQuizSession,
  type GeneratedQuizQuestion,
} from "../../../lib/courseAI";
import { hasReadableDocumentText } from "../../../lib/documentText";
import { F, card, sHead, EmptyState, type Doc } from "./types.tsx";

/* ── Focus Mode Overlay ──────────────────────────────── */
export function FocusMode({
  courseCode, courseName, onExit,
}: {
  courseCode: string;
  courseName: string;
  onExit: () => void;
}) {
  const [phase, setPhase]       = useState<"study" | "break">("study");
  const [running, setRunning]   = useState(false);
  const [sessions, setSessions] = useState(0);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [quoteIdx]              = useState(Math.floor(Math.random() * 3));

  const quotes = [
    '"Deep work is the ability to focus without distraction on a cognitively demanding task." — Cal Newport',
    '"The successful warrior is the average person with laser-like focus." — Bruce Lee',
    '"It\'s not that I\'m so smart, it\'s just that I stay with problems longer." — Albert Einstein',
  ];

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setRunning(false);
          if (phase === "study") { setSessions(s => s + 1); setPhase("break"); return 5 * 60; }
          else { setPhase("study"); return 25 * 60; }
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, phase]);

  const reset = () => { setRunning(false); setTimeLeft(phase === "study" ? 25 * 60 : 5 * 60); };
  const mins  = Math.floor(timeLeft / 60).toString().padStart(2, "0");
  const secs  = (timeLeft % 60).toString().padStart(2, "0");
  const prog  = phase === "study" ? 1 - timeLeft / (25 * 60) : 1 - timeLeft / (5 * 60);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(5,8,4,0.96)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: F.body }}>
      <button onClick={onExit} style={{ position: "absolute", top: "24px", right: "24px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", borderRadius: "9px", padding: "8px 16px", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontFamily: F.body, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: "6px" }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.9)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.13)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.6)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}>
        <X size={13}/> Exit Focus Mode
      </button>

      {sessions > 0 && (
        <div style={{ position: "absolute", top: "24px", left: "24px", display: "flex", alignItems: "center", gap: "6px" }}>
          {Array.from({ length: sessions }).map((_, i) => (
            <div key={i} style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--accent)" }}/>
          ))}
          <span style={{ fontFamily: F.body, fontSize: "0.74rem", color: "rgba(255,255,255,0.35)", marginLeft: "4px" }}>{sessions} session{sessions !== 1 ? "s" : ""} done</span>
        </div>
      )}

      <div style={{ fontFamily: F.body, fontSize: "0.74rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: phase === "study" ? "var(--accent)" : "#f59e0b", marginBottom: "12px", padding: "4px 14px", borderRadius: "99px", background: phase === "study" ? "rgba(102,181,57,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${phase === "study" ? "rgba(102,181,57,0.25)" : "rgba(245,158,11,0.25)"}` }}>
        {phase === "study" ? "🎯 Deep Focus" : "☕ Short Break"}
      </div>

      <div style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "1.1rem", color: "rgba(255,255,255,0.5)", marginBottom: "44px" }}>
        {courseCode}{courseName ? ` · ${courseName}` : ""}
      </div>

      <div style={{ position: "relative", marginBottom: "44px" }}>
        <svg width="220" height="220" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="110" cy="110" r="96" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6"/>
          <circle cx="110" cy="110" r="96" fill="none" stroke={phase === "study" ? "#66B539" : "#f59e0b"} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 96}`} strokeDashoffset={`${2 * Math.PI * 96 * (1 - prog)}`} style={{ transition: "stroke-dashoffset 1s linear" }}/>
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: F.heading, fontSize: "5.5rem", fontWeight: 900, color: "white", lineHeight: 1, letterSpacing: "-0.04em" }}>{mins}:{secs}</div>
          <div style={{ fontFamily: F.body, fontSize: "0.7rem", color: "rgba(255,255,255,0.28)", marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.08em" }}>{phase === "study" ? "minutes remaining" : "break time"}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "13px", marginBottom: "40px" }}>
        <button onClick={reset} style={{ width: "46px", height: "46px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RotateCcw size={16}/>
        </button>
        <button onClick={() => setRunning(v => !v)} style={{ width: "72px", height: "72px", borderRadius: "50%", background: running ? "rgba(255,255,255,0.15)" : "var(--accent)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: running ? "none" : "0 8px 28px rgba(102,181,57,0.45)", transition: "all 0.2s" }}
          onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.06)"}
          onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"}>
          {running ? <Pause size={26}/> : <Play size={26} style={{ marginLeft: "3px" }}/>}
        </button>
        <button onClick={() => { setRunning(false); const np = phase === "study" ? "break" : "study"; setPhase(np as "study" | "break"); setTimeLeft(np === "study" ? 25 * 60 : 5 * 60); }} style={{ width: "46px", height: "46px", borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.14)", color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} title="Switch phase">
          <Timer size={16}/>
        </button>
      </div>

      <div style={{ display: "flex", gap: "28px", marginBottom: "32px" }}>
        {[{ label: "25 min", sub: "Focus", active: phase === "study" }, { label: "5 min", sub: "Break", active: phase === "break" }].map((item, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.88rem", color: item.active ? "white" : "rgba(255,255,255,0.25)" }}>{item.label}</div>
            <div style={{ fontFamily: F.body, fontSize: "0.7rem", color: item.active ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.18)" }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ position: "absolute", bottom: "28px", fontFamily: F.body, fontSize: "0.75rem", color: "rgba(255,255,255,0.2)", fontStyle: "italic", textAlign: "center", maxWidth: "520px", padding: "0 32px", lineHeight: 1.65 }}>
        {quotes[quoteIdx]}
      </div>
    </div>
  );
}

/* ── Activities Tab ──────────────────────────────────── */
type ActivityView = "grid" | "quiz" | "notes";

export function ActivitiesTab({
  courseCode, courseId, docs, onFocusMode, documentsSyncing,
}: {
  courseCode: string;
  courseId: string;
  docs: Doc[];
  onFocusMode: () => void;
  documentsSyncing: boolean;
}) {
  const [view, setView]         = useState<ActivityView>("grid");
  const [quizIdx, setQuizIdx]   = useState(0);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [answered, setAnswered] = useState<number | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizSessions, setQuizSessions] = useState<StoredQuizSession[]>(() => (
    courseId ? loadStoredCourseData(courseId).quizSessions : []
  ));
  const [activeQuizId, setActiveQuizId] = useState<string | null>(() => (
    courseId ? loadStoredCourseData(courseId).activeQuizId : null
  ));
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes]       = useState<{ id: string; text: string; created: string }[]>([]);

  const hasDocs = docs.length > 0;
  const quizDocs = docs.filter((doc) => doc.type !== "syllabus" && doc.used && hasReadableDocumentText(doc.textContent));
  const activeQuiz = quizSessions.find((s) => s.id === activeQuizId) ?? quizSessions[0] ?? null;
  const quizQuestions: GeneratedQuizQuestion[] = activeQuiz?.questions ?? [];
  const current = quizQuestions[quizIdx] ?? null;

  useEffect(() => {
    if (!courseId) return;
    const stored = loadStoredCourseData(courseId);
    setQuizSessions(stored.quizSessions);
    setActiveQuizId(stored.activeQuizId ?? stored.quizSessions[0]?.id ?? null);
  }, [courseId]);

  useEffect(() => {
    if (!courseId) return;
    patchStoredCourseData(courseId, { quizSessions, activeQuizId });
  }, [courseId, quizSessions, activeQuizId]);

  // Auto-generate the first quiz in background once readable docs are ready
  useEffect(() => {
    if (quizLoading || quizSessions.length > 0 || quizDocs.length === 0 || documentsSyncing) return;
    let cancelled = false;
    setQuizLoading(true);
    setQuizError(null);
    const run = async () => {
      try {
        const sourceSignature = quizDocs.map((doc) => `${doc.id}|${doc.name}|${doc.textContent?.length ?? 0}`).join("####");
        const generated: GeneratedQuizSession = await generateQuizFromDocuments({
          courseCode,
          documents: quizDocs.map((doc) => ({ name: doc.name, textContent: doc.textContent ?? "" })),
          previousTopics: [],
          previousQuestionTexts: [],
        });
        if (cancelled) return;
        const createdAt = new Date().toISOString();
        const nextSession: StoredQuizSession = {
          id: crypto.randomUUID(), title: "Quiz 1", topic: generated.topic,
          createdAt, questionCount: generated.questions.length,
          sourceDocs: generated.sourceDocs, sourceSignature, questions: generated.questions,
        };
        setQuizSessions([nextSession]);
        setActiveQuizId(nextSession.id);
      } catch (error) {
        if (!cancelled) setQuizError(error instanceof Error ? error.message : "Spark couldn't generate a quiz yet.");
      } finally {
        if (!cancelled) setQuizLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizDocs.length, documentsSyncing]);

  const loadQuiz = async () => {
    // ── Pre-flight content check ──────────────────────────────
    // Give a clear, friendly message before hitting the AI — avoids raw errors.
    if (quizDocs.length === 0) {
      setQuizError(
        documentsSyncing
          ? "Your documents are still being read — give it a moment, then try again."
          : "No readable documents found. Upload a text-based PDF, DOCX, or TXT file. Image-only or scanned PDFs can't be used for quizzes.",
      );
      return;
    }
    const totalChars = quizDocs.reduce((sum, d) => sum + (d.textContent?.trim().length ?? 0), 0);
    if (totalChars < 600) {
      setQuizError(
        "Your documents don't have enough text content yet to generate a quiz. Make sure you've uploaded text-based files — word counts of at least a few paragraphs are needed.",
      );
      return;
    }
    // ─────────────────────────────────────────────────────────
    setQuizLoading(true);
    setQuizError(null);
    try {
      const sourceSignature = quizDocs.map((doc) => `${doc.id}|${doc.name}|${doc.textContent?.length ?? 0}`).join("####");
      const generated: GeneratedQuizSession = await generateQuizFromDocuments({
        courseCode,
        documents: quizDocs.map((doc) => ({ name: doc.name, textContent: doc.textContent ?? "" })),
        previousTopics: quizSessions.map((s) => s.topic),
        previousQuestionTexts: quizSessions.flatMap((s) => s.questions.map((q) => q.question)),
      });
      const nextSession: StoredQuizSession = {
        id: crypto.randomUUID(),
        title: `Quiz ${quizSessions.length + 1}`,
        topic: generated.topic,
        createdAt: new Date().toISOString(),
        questionCount: generated.questions.length,
        sourceDocs: generated.sourceDocs,
        sourceSignature,
        questions: generated.questions,
      };
      setQuizSessions((prev) => [nextSession, ...prev]);
      setActiveQuizId(nextSession.id);
      setView("quiz");
      setAnswered(null);
      setQuizIdx(0);
      setQuizScore({ correct: 0, total: 0 });
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : "Quiz generation failed.");
    } finally {
      setQuizLoading(false);
    }
  };

  const openStoredQuiz = (quizId: string) => {
    setActiveQuizId(quizId);
    setView("quiz");
    setAnswered(null);
    setQuizIdx(0);
    setQuizScore({ correct: 0, total: 0 });
    setQuizError(null);
  };

  const handleAnswer = (idx: number) => {
    if (answered !== null || !current) return;
    setAnswered(idx);
    setQuizScore(s => ({ correct: s.correct + (idx === current.correctIndex ? 1 : 0), total: s.total + 1 }));
  };

  const nextQuestion = () => {
    if (!activeQuiz) return;
    setAnswered(null);
    setQuizIdx((ci) => (ci >= activeQuiz.questions.length - 1 ? 0 : ci + 1));
  };

  const activities = [
    { id: "quiz" as const, icon: <Zap size={30}/>, color: "#f59e0b", title: "Quiz Me", desc: "AI-generated questions from your uploaded notes, readings, and study files. Syllabi are excluded.", badge: "Knowledge Check", badgeSub: "Not graded — for self-evaluation only", requiresDocs: true },
    { id: "notes" as const, icon: <StickyNote size={30}/>, color: "#3b82f6", title: "Smart Notes", desc: "Write and organize your own notes for this course. Ask Spark to summarize any document into notes.", badge: "Your Notes", badgeSub: "Personal — not submitted anywhere", requiresDocs: false },
    { id: "focus" as const, icon: <Brain size={30}/>, color: "#66B539", title: "Focus Mode", desc: "Enter deep work with a Pomodoro timer. Block distractions and maximize your study efficiency.", badge: "Productivity", badgeSub: "Pomodoro · 25 min focus / 5 min break", requiresDocs: false },
  ];

  /* ── Quiz view ── */
  if (view === "quiz") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <button onClick={() => setView("grid")} style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontFamily: F.body, fontSize: "0.82rem", padding: "4px 8px", borderRadius: "7px" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-secondary)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}>
            <ChevronLeft size={14}/> Activities
          </button>
          <span style={{ fontFamily: F.body, fontSize: "0.74rem", padding: "2px 8px", borderRadius: "99px", background: "rgba(245,158,11,0.12)", color: "#f59e0b", fontWeight: 600 }}>Not graded</span>
          <span style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.82rem", color: "var(--text-muted)", marginLeft: "auto" }}>{quizScore.correct}/{quizScore.total} correct</span>
        </div>

        {!hasDocs && quizSessions.length === 0 ? (
          <EmptyState icon={<Zap size={24}/>} title="Upload study documents first" body={`Upload notes, readings, or past exams for ${courseCode} and Spark will generate personalized quiz questions from that material.`}/>
        ) : quizDocs.length === 0 && quizSessions.length === 0 ? (
          <EmptyState
            icon={<Zap size={24}/>}
            title={documentsSyncing ? "Reading your uploaded files" : "No readable document text yet"}
            body={documentsSyncing
              ? "Spark is examining the documents already attached to this course. Give it a moment, then generate the quiz again."
              : "Quiz Me uses non-syllabus documents with extractable text. Upload a text-based PDF, DOCX, or TXT file to generate a quiz."}
          />
        ) : quizLoading && !activeQuiz ? (
          <div style={{ ...card, padding: "26px 24px" }}>
            <div style={{ width: "54px", height: "54px", borderRadius: "16px", background: "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f59e0b", marginBottom: "16px" }}>
              <Zap size={24}/>
            </div>
            <div style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "5px" }}>Building your quiz</div>
            <p style={{ fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 14px", lineHeight: 1.7 }}>Spark is generating questions from your uploaded non-syllabus study files only.</p>
            <div style={{ height: "7px", borderRadius: "99px", background: "var(--bg-secondary)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: "70%", borderRadius: "99px", background: "linear-gradient(90deg, #f59e0b, #fbbf24)", animation: "quizBuild 1.15s ease-in-out infinite" }}/>
            </div>
            <style>{`@keyframes quizBuild{0%{transform:translateX(-40%)}50%{transform:translateX(16%)}100%{transform:translateX(75%)}}`}</style>
          </div>
        ) : quizError && !activeQuiz ? (
          <div style={{ ...card, padding: "24px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
              <AlertCircle size={18} style={{ color: "#ef4444" }}/>
              <span style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "0.94rem", color: "var(--text-primary)" }}>Quiz generation failed</span>
            </div>
            <p style={{ fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 14px", lineHeight: 1.7 }}>{quizError}</p>
            <button onClick={() => void loadQuiz()} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontFamily: F.heading, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>Try Again</button>
          </div>
        ) : !activeQuiz ? (
          <div style={{ ...card, padding: "24px 22px" }}>
            <div style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "0.94rem", color: "var(--text-primary)", marginBottom: "8px" }}>Quiz Me is ready</div>
            <p style={{ fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 14px", lineHeight: 1.7 }}>Generate and save a new 10-question quiz from the active non-syllabus documents in Spark.</p>
            <button onClick={() => void loadQuiz()} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontFamily: F.heading, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>Generate Quiz</button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {quizError && (
              <div style={{ padding: "12px 14px", borderRadius: "11px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)" }}>
                <p style={{ fontFamily: F.body, fontSize: "0.8rem", color: "#b91c1c", margin: 0, lineHeight: 1.6 }}>{quizError}</p>
              </div>
            )}
            {quizLoading && (
              <div style={{ padding: "12px 14px", borderRadius: "11px", background: "rgba(245,158,11,0.09)", border: "1px solid rgba(245,158,11,0.18)" }}>
                <p style={{ fontFamily: F.body, fontSize: "0.8rem", color: "#b45309", margin: 0, lineHeight: 1.6 }}>
                  Spark is generating {`Quiz ${quizSessions.length + 1}`} in the background. Your current saved quiz will stay here until the new one is ready.
                </p>
              </div>
            )}
            <div style={{ ...card, padding: "26px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "10px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "0.96rem", color: "var(--text-primary)" }}>{activeQuiz.title}</div>
                  <div style={{ fontFamily: F.body, fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    Topic: {activeQuiz.topic} · {new Date(activeQuiz.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {activeQuiz.questionCount} questions
                  </div>
                </div>
                <button onClick={() => void loadQuiz()} disabled={quizLoading || quizDocs.length === 0} style={{ background: "#f59e0b", color: "#fff", border: "none", borderRadius: "999px", padding: "6px 12px", fontFamily: F.body, fontSize: "0.72rem", fontWeight: 700, cursor: quizLoading || quizDocs.length === 0 ? "not-allowed" : "pointer", opacity: quizLoading || quizDocs.length === 0 ? 0.6 : 1 }}>
                  {quizLoading ? "Generating…" : "New Quiz"}
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", marginBottom: "14px" }}>
                <div style={{ fontFamily: F.body, fontSize: "0.72rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "#f59e0b" }}>Question {quizIdx + 1} of {quizQuestions.length}</div>
                <span style={{ fontFamily: F.body, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  Sources: {activeQuiz.sourceDocs.slice(0, 2).join(", ")}{activeQuiz.sourceDocs.length > 2 ? ` +${activeQuiz.sourceDocs.length - 2} more` : ""}
                </span>
              </div>
              <p style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)", margin: "0 0 22px", lineHeight: 1.5 }}>{current?.question}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginBottom: "20px" }}>
                {current?.options.map((opt, i) => {
                  let bg = "var(--bg-secondary)", border = "var(--border)", color = "var(--text-secondary)";
                  if (answered !== null) {
                    if (i === current!.correctIndex) { bg = "rgba(102,181,57,0.15)"; border = "#66B539"; color = "#66B539"; }
                    else if (i === answered && answered !== current!.correctIndex) { bg = "rgba(239,68,68,0.1)"; border = "#ef4444"; color = "#ef4444"; }
                  }
                  return (
                    <button key={i} onClick={() => handleAnswer(i)}
                      style={{ padding: "12px 16px", borderRadius: "10px", border: `1.5px solid ${border}`, background: bg, color, fontFamily: F.body, fontSize: "0.86rem", textAlign: "left", cursor: answered !== null ? "default" : "pointer", fontWeight: 500, transition: "all 0.15s" }}
                      disabled={answered !== null}>{opt}</button>
                  );
                })}
              </div>
              {answered !== null && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ fontFamily: F.body, fontSize: "0.82rem", color: answered === current!.correctIndex ? "#66B539" : "#ef4444", fontWeight: 600 }}>
                    {answered === current!.correctIndex ? "✓ Correct!" : "✗ Incorrect"}
                  </div>
                  {current!.explanation && (
                    <div style={{ padding: "12px 14px", borderRadius: "10px", background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                      <p style={{ fontFamily: F.body, fontSize: "0.8rem", color: "var(--text-secondary)", margin: "0 0 4px", lineHeight: 1.7 }}>{current!.explanation}</p>
                      {current!.sourceDoc && <span style={{ fontFamily: F.body, fontSize: "0.7rem", color: "var(--text-muted)" }}>Source: {current!.sourceDoc}</span>}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: F.body, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {current!.sourceDoc ? `Generated from ${current!.sourceDoc}` : "Generated from uploaded non-syllabus documents only"}
                    </span>
                    <button onClick={nextQuestion} style={{ background: "var(--accent)", color: "var(--primary-foreground)", border: "none", borderRadius: "8px", padding: "8px 18px", fontFamily: F.heading, fontWeight: 700, fontSize: "0.84rem", cursor: "pointer" }}>Next →</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {quizSessions.length > 1 && (
          <div style={{ ...card, padding: "18px 20px" }}>
            <div style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "0.88rem", color: "var(--text-primary)", marginBottom: "12px" }}>Saved Quizzes</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {quizSessions.map((session) => (
                <button key={session.id} onClick={() => openStoredQuiz(session.id)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", textAlign: "left", padding: "12px 15px", borderRadius: "11px", border: `1.5px solid ${session.id === activeQuizId ? "#f59e0b" : "var(--border)"}`, background: session.id === activeQuizId ? "rgba(245,158,11,0.08)" : "var(--bg-secondary)", cursor: "pointer", transition: "all 0.15s" }}>
                  <div>
                    <div style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "0.86rem", color: "var(--text-primary)", marginBottom: "2px" }}>{session.title}</div>
                    <div style={{ fontFamily: F.body, fontSize: "0.74rem", color: "var(--text-secondary)" }}>{session.topic}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontFamily: F.body, fontSize: "0.7rem", color: "var(--text-muted)" }}>{session.questionCount}Q</div>
                    <div style={{ fontFamily: F.body, fontSize: "0.68rem", color: "var(--text-muted)" }}>{new Date(session.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Notes view ── */
  if (view === "notes") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <button onClick={() => setView("grid")} style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontFamily: F.body, fontSize: "0.82rem", padding: "4px 8px", borderRadius: "7px" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-secondary)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "none"; }}>
            <ChevronLeft size={14}/> Activities
          </button>
          <span style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "1rem", color: "var(--text-primary)" }}>Smart Notes</span>
        </div>
        <div style={{ ...card, padding: "0", overflow: "hidden" }}>
          <div style={sHead}>
            <span style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.86rem", color: "var(--text-primary)" }}>{notes.length} note{notes.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ padding: "16px" }}>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder="Write your notes here… (Shift+Enter for new line, Enter to save)"
              rows={4}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (noteText.trim()) { setNotes(p => [...p, { id: Date.now().toString(), text: noteText.trim(), created: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) }]); setNoteText(""); } } }}
              style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid var(--border)", background: "var(--input)", fontFamily: F.body, fontSize: "0.86rem", color: "var(--text-primary)", outline: "none", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }}
            />
            <button onClick={() => { if (noteText.trim()) { setNotes(p => [...p, { id: Date.now().toString(), text: noteText.trim(), created: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) }]); setNoteText(""); } }}
              disabled={!noteText.trim()} style={{ marginTop: "8px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 18px", fontFamily: F.heading, fontWeight: 700, fontSize: "0.82rem", cursor: noteText.trim() ? "pointer" : "not-allowed", opacity: noteText.trim() ? 1 : 0.5 }}>
              Save Note
            </button>
          </div>
          {notes.length > 0 && (
            <div style={{ borderTop: "1px solid var(--border)" }}>
              {notes.map((n, i) => (
                <div key={n.id} style={{ display: "flex", gap: "12px", padding: "13px 18px", borderTop: i !== 0 ? "1px solid var(--border)" : undefined }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: F.body, fontSize: "0.85rem", color: "var(--text-primary)", margin: "0 0 4px", whiteSpace: "pre-wrap", lineHeight: 1.65 }}>{n.text}</p>
                    <span style={{ fontFamily: F.body, fontSize: "0.69rem", color: "var(--text-muted)" }}>{n.created}</span>
                  </div>
                  <button onClick={() => setNotes(p => p.filter(x => x.id !== n.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex", alignItems: "flex-start" }}><Trash2 size={12}/></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Grid view ── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div>
        <h3 style={{ fontFamily: F.heading, fontWeight: 900, fontSize: "1.25rem", color: "var(--text-primary)", margin: "0 0 5px", letterSpacing: "-0.02em" }}>LearnBeam Activities</h3>
        <p style={{ fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>
          AI-powered tools built from your course documents. These are for your own learning — none of them affect your grade.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: "14px" }}>
        {activities.map(act => (
          <div key={act.id} style={{ ...card, padding: "24px 22px", display: "flex", flexDirection: "column", gap: "14px", transition: "box-shadow 0.2s, transform 0.15s", cursor: "pointer", borderTop: `3px solid ${act.color}` }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)"; el.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = "none"; el.style.transform = "translateY(0)"; }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: `${act.color}18`, display: "flex", alignItems: "center", justifyContent: "center", color: act.color }}>
              {act.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: F.heading, fontWeight: 800, fontSize: "1rem", color: "var(--text-primary)", marginBottom: "5px" }}>{act.title}</div>
              <p style={{ fontFamily: F.body, fontSize: "0.8rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.6 }}>{act.desc}</p>
            </div>
            <div>
              <div style={{ fontFamily: F.body, fontSize: "0.67rem", fontWeight: 700, color: act.color, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>{act.badge}</div>
              <div style={{ fontFamily: F.body, fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "12px" }}>{act.badgeSub}</div>
              {act.id === "quiz" ? (
                !hasDocs && quizSessions.length === 0 ? (
                  <div style={{ fontFamily: F.body, fontSize: "0.75rem", color: "var(--text-muted)", padding: "7px 12px", borderRadius: "8px", background: "var(--bg-secondary)", border: "1px solid var(--border)", textAlign: "center" }}>Upload documents first</div>
                ) : quizLoading && quizSessions.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "9px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#f59e0b", animation: "pulse 1s ease-in-out infinite" }}/>
                    <span style={{ fontFamily: F.body, fontSize: "0.74rem", color: "#b45309", fontWeight: 600 }}>Generating your first quiz…</span>
                    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}`}</style>
                  </div>
                ) : quizSessions.length > 0 ? (
                  <button onClick={() => { setQuizError(null); setAnswered(null); setQuizIdx(0); setView("quiz"); }}
                    style={{ width: "100%", padding: "9px", borderRadius: "9px", background: "#f59e0b", color: "#fff", border: "none", fontFamily: F.heading, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", boxShadow: "0 4px 14px rgba(245,158,11,0.35)", transition: "opacity 0.15s" }}
                    onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"}
                    onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}>
                    {quizSessions.length === 1 ? "Start Quiz →" : `Start Quiz · ${quizSessions.length} saved`}
                  </button>
                ) : (
                  <div style={{ fontFamily: F.body, fontSize: "0.75rem", color: "var(--text-muted)", padding: "7px 12px", borderRadius: "8px", background: "var(--bg-secondary)", border: "1px solid var(--border)", textAlign: "center" }}>
                    {quizError ? "Quiz unavailable right now" : "Upload readable documents first"}
                  </div>
                )
              ) : act.requiresDocs && !hasDocs ? (
                <div style={{ fontFamily: F.body, fontSize: "0.75rem", color: "var(--text-muted)", padding: "7px 12px", borderRadius: "8px", background: "var(--bg-secondary)", border: "1px solid var(--border)", textAlign: "center" }}>Upload documents first</div>
              ) : (
                <button
                  onClick={() => { if (act.id === "focus") { onFocusMode(); return; } setView(act.id as ActivityView); }}
                  style={{ width: "100%", padding: "9px", borderRadius: "9px", background: act.color, color: "#fff", border: "none", fontFamily: F.heading, fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", boxShadow: `0 4px 14px ${act.color}44`, transition: "opacity 0.15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = "1"}>
                  {act.id === "focus" ? "Enter Focus Mode" : "Open Notes"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
