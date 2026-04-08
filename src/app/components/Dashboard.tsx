import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Bell,
  Plus,
  X,
  Send,
  Lightbulb,
  BookOpen,
  Clock,
  Upload,
  CheckSquare,
  CircleAlert,
  BarChart2,
  BookMarked,
  CalendarClock,
} from "lucide-react";
import { SparkLogo } from "./SparkLogo";
import learnBeamLogo from "../../assets/861bd4bcf410ca26cefb8d6a2c416c8933fab508.png";
import { BackgroundFX } from "./BackgroundFX";

type Course = {
  id: string;
  code: string;
  name: string;
  grade: string;
  progress: number;
  nextDue: string;
};

type Suggestion = {
  id: string;
  icon: string;
  text: string;
};

type Reminder = {
  id: string;
  type: ReminderType;
  label: string;
  detail: string;
};

type ReminderType = "deadline" | "study" | "studytime" | "upload";

type Message = {
  role: "user" | "ai";
  text: string;
};

const COURSES: Course[] = [
  {
    id: "1",
    code: "CSCE3600",
    name: "Systems Programming",
    grade: "B+",
    progress: 62,
    nextDue: "Mar 7",
  },
];

const SUGGESTIONS: Suggestion[] = [
  {
    id: "s1",
    icon: "quiz",
    text: "Take a quick quiz to assess your understanding of System Calls in CSCE3600.",
  },
  {
    id: "s2",
    icon: "topic",
    text: "You haven't reviewed Memory Management — it appears in 2 upcoming exams.",
  },
  {
    id: "s3",
    icon: "progress",
    text: "Your CSCE3600 progress is at 62%. Spend 30 min/day to stay on track.",
  },
  {
    id: "s4",
    icon: "resource",
    text: "3 new lecture notes uploaded for CSCE3600. Review before Thursday.",
  },
];

const REMINDERS: Reminder[] = [
  {
    id: "r1",
    type: "deadline",
    label: "Assignment 3 Due",
    detail: "CSCE3600 · Mar 7, 11:59 PM",
  },
  {
    id: "r2",
    type: "study",
    label: "Review Chapter 5",
    detail: "CSCE3600 · Tonight",
  },
  {
    id: "r3",
    type: "studytime",
    label: "Study Session Block",
    detail: "Tomorrow 3–5 PM · 2 hrs",
  },
  {
    id: "r4",
    type: "upload",
    label: "Upload Lab Report",
    detail: "CSCE3600 · Due Mar 9",
  },
];

const AI_STARTERS: string[] = [
  "What grade do I need on the final?",
  "Which topic should I study next?",
  "When is my next deadline?",
  "What does CSCE3600 cover?",
];

function ReminderIcon({ type }: { type: ReminderType }) {
  const cls = "shrink-0 text-slate-600";
  if (type === "deadline") return <CalendarClock size={14} className={cls} />;
  if (type === "study") return <BookOpen size={14} className={cls} />;
  if (type === "studytime") return <Clock size={14} className={cls} />;
  return <Upload size={14} className={cls} />;
}

function SuggestionIcon({ icon }: { icon: string }) {
  const cls = "shrink-0 text-slate-600";
  if (icon === "quiz") return <CheckSquare size={14} className={cls} />;
  if (icon === "topic") return <CircleAlert size={14} className={cls} />;
  if (icon === "progress") return <BarChart2 size={14} className={cls} />;
  return <BookMarked size={14} className={cls} />;
}

function GlassPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[26px] border border-slate-200/70 bg-white/55 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-[28px] ${className}`}
    >
      {children}
    </div>
  );
}

function SectionCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-slate-200/70 bg-white/45 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur-[22px] ${className}`}
    >
      {children}
    </div>
  );
}

export function Dashboard() {
  const [courses, setCourses] = useState(COURSES);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "ai",
      text: "Hi! Ask me anything about your courses, grades, deadlines, or study topics.",
    },
  ]);

  const navigate = useNavigate();

  const handleAddCourse = () => {
    const code = prompt("Enter course code (e.g. CSCE3700):");
    if (!code) return;

    const name = prompt("Enter course name:");
    if (!name) return;

    setCourses((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        code: code.trim(),
        name: name.trim(),
        grade: "N/A",
        progress: 0,
        nextDue: "—",
      },
    ]);
  };

  const sendAI = (text?: string) => {
    const msg = text ?? aiInput.trim();
    if (!msg) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", text: msg },
      { role: "ai", text: `[ AI response for: "${msg}" ]` },
    ]);

    setAiInput("");
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-900">
      <BackgroundFX brand="TEACH" />

      <div className="relative z-10 flex min-h-screen flex-col px-4 py-4 md:px-6">
        <header className="mx-auto flex h-16 w-full max-w-6xl shrink-0 items-center justify-between rounded-2xl border border-slate-200/70 bg-white/50 px-6 shadow-[0_14px_40px_rgba(15,23,42,0.14)] backdrop-blur-[28px]">
          <div className="flex items-center gap-3">
            <img
              src={learnBeamLogo}
              alt="LearnBeam"
              className="h-12 w-12 object-contain"
            />
            <div>
              <p className="text-lg font-semibold tracking-tight text-slate-900">
                LearnBeam
              </p>
              <p className="text-xs text-slate-500">Academic workspace</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative rounded-full border border-slate-200/70 bg-white/55 p-2 text-slate-700 transition hover:bg-white/80">
              <Bell size={16} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-500" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 bg-gradient-to-br from-slate-800 to-slate-600 text-xs font-medium text-white">
              P
            </div>
          </div>
        </header>

        <div className="mx-auto mt-5 flex w-full max-w-6xl flex-1 overflow-y-auto pb-24">
          <GlassPanel className="w-full p-6 md:p-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-3xl font-semibold text-slate-900">
                  Course Dashboard
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Track courses, review suggestions, and stay ahead of deadlines.
                </p>
              </div>

              <button
                onClick={handleAddCourse}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-[0_10px_24px_rgba(79,70,229,0.28)] transition hover:translate-y-[-1px] hover:shadow-[0_14px_28px_rgba(79,70,229,0.32)]"
              >
                <Plus size={14} />
                Add Course
              </button>
            </div>

            <section className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.24em] text-slate-500">
                  Courses
                </span>
                <span className="text-xs text-slate-500">
                  {courses.length} active
                </span>
              </div>

              <SectionCard>
                {courses.map((course, i) => (
                  <div
                    key={course.id}
                    onClick={() => navigate(`/course/${course.id}`)}
                    className={`flex cursor-pointer items-center justify-between px-4 py-4 transition hover:bg-slate-50/80 ${
                      i !== 0 ? "border-t border-slate-200/70" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-sky-500" />
                      <div className="min-w-0">
                        <span className="text-sm font-medium text-slate-900">
                          {course.code}
                        </span>
                        <span className="ml-2 hidden text-xs text-slate-500 sm:inline">
                          {course.name}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 text-xs">
                      <span className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1 text-slate-700">
                        {course.grade}
                      </span>
                      <span className="rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1 text-slate-700">
                        {course.progress}%
                      </span>
                      <span className="hidden rounded-lg border border-slate-200 bg-white/70 px-2.5 py-1 text-slate-700 sm:inline">
                        Due {course.nextDue}
                      </span>
                    </div>
                  </div>
                ))}

                {courses.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-slate-400">
                    No courses yet — click “Add Course” to get started.
                  </div>
                )}
              </SectionCard>
            </section>

            <section className="mb-6">
              <SectionCard>
                <div className="flex items-center justify-between border-b border-slate-200/70 bg-gradient-to-r from-indigo-50/80 to-sky-50/80 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-indigo-100 p-1.5 text-indigo-700">
                      <Lightbulb size={14} />
                    </div>
                    <span className="text-sm font-medium text-slate-900">
                      Suggestions
                    </span>
                  </div>

                  <button className="rounded-full border border-indigo-200 bg-white/75 px-3 py-1 text-xs font-medium text-indigo-700 transition hover:bg-white">
                    Take Quiz →
                  </button>
                </div>

                {SUGGESTIONS.map((s, i) => (
                  <div
                    key={s.id}
                    className={`flex items-start gap-3 px-4 py-3 transition hover:bg-slate-50/80 ${
                      i !== 0 ? "border-t border-slate-200/70" : ""
                    }`}
                  >
                    <div className="mt-0.5 rounded-lg bg-slate-100 p-1.5">
                      <SuggestionIcon icon={s.icon} />
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700">
                      {s.text}
                    </p>
                  </div>
                ))}
              </SectionCard>
            </section>

            <section>
              <SectionCard>
                <div className="flex items-center justify-between border-b border-slate-200/70 bg-gradient-to-r from-amber-50/80 to-orange-50/70 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="rounded-lg bg-amber-100 p-1.5 text-amber-700">
                      <Bell size={14} />
                    </div>
                    <span className="text-sm font-medium text-slate-900">
                      Reminders
                    </span>
                  </div>

                  <button className="rounded-full border border-amber-200 bg-white/75 px-3 py-1 text-xs font-medium text-amber-800 transition hover:bg-white">
                    + Add
                  </button>
                </div>

                {REMINDERS.map((r, i) => (
                  <div
                    key={r.id}
                    className={`flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50/80 ${
                      i !== 0 ? "border-t border-slate-200/70" : ""
                    }`}
                  >
                    <div className="h-4 w-4 shrink-0 rounded border border-slate-300 bg-white" />

                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-slate-900">
                        {r.label}
                      </span>
                      <span className="ml-2 text-xs text-slate-500">
                        {r.detail}
                      </span>
                    </div>

                    <div className="rounded-lg bg-slate-100 p-1.5">
                      <ReminderIcon type={r.type as ReminderType} />
                    </div>
                  </div>
                ))}
              </SectionCard>
            </section>
          </GlassPanel>
        </div>

        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
          {aiOpen && (
            <div className="flex w-80 flex-col overflow-hidden rounded-[26px] border border-slate-200/70 bg-white/70 shadow-[0_28px_70px_rgba(15,23,42,0.18)] backdrop-blur-[30px]">
              <div className="flex items-center justify-between border-b border-slate-200/70 bg-gradient-to-r from-slate-50/90 to-indigo-50/80 px-4 py-3">
                <div className="flex items-center gap-2">
                  <SparkLogo size={24} />
                  <div>
                    <span className="block text-sm font-medium text-slate-900">
                      Spark
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      Study assistant
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => setAiOpen(false)}
                  className="text-slate-500 transition hover:text-slate-900"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="max-h-56 space-y-2 overflow-y-auto px-3 py-3">
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        m.role === "user"
                          ? "rounded-br-sm bg-gradient-to-r from-indigo-600 to-blue-600 text-white"
                          : "rounded-bl-sm border border-slate-200 bg-white/85 text-slate-700"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 border-t border-slate-200/70 px-3 pb-1 pt-2">
                {AI_STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendAI(s)}
                    className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-0.5 text-xs text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 border-t border-slate-200/70 px-3 py-2.5">
                <input
                  type="text"
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendAI()}
                  placeholder="Ask about your courses…"
                  className="flex-1 rounded-lg border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none"
                />

                <button
                  onClick={() => sendAI()}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white transition hover:brightness-110"
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => setAiOpen(!aiOpen)}
            className="cursor-pointer transition-transform hover:scale-110"
          >
            <SparkLogo size={160} />
          </button>
        </div>
      </div>
    </div>
  );
}