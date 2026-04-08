import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  ChevronLeft,
  Bell,
  Menu,
  X,
  Send,
  Paperclip,
  FileText,
  Maximize2,
  Minimize2,
  BarChart2,
  BellRing,
  Calendar,
  Zap,
  BookOpenCheck,
  Timer,
  TimerOff,
  Plus,
  Search,
  Upload,
  ChevronRight,
} from "lucide-react";
import { SparkLogo } from "./SparkLogo";
import learnBeamLogo from "../../assets/861bd4bcf410ca26cefb8d6a2c416c8933fab508.png";
import { BackgroundFX } from "./BackgroundFX";

type AIChatState = "mini" | "compact" | "maximized";
type ChatMsg = { role: "user" | "ai"; text: string };

const COURSE_MAP: Record<string, { code: string; name: string }> = {
  "1": { code: "CSCE3600", name: "Systems Programming" },
};

const MENU_ITEMS = [
  { id: "grades", Icon: BarChart2, label: "Grade" },
  { id: "docs", Icon: FileText, label: "Uploaded Documents" },
  { id: "reminders", Icon: BellRing, label: "Reminders" },
  { id: "calendar", Icon: Calendar, label: "Calendar" },
  { id: "quiz", Icon: Zap, label: "Quiz Me" },
  { id: "notes", Icon: BookOpenCheck, label: "Smart Note" },
];

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[26px] border border-slate-200/70 bg-white/55 p-4 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-[28px] ${className}`}
    >
      {children}
    </div>
  );
}

function GlassInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-slate-200/80 bg-white/75 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-[20px] ${props.className ?? ""}`}
    />
  );
}

function GlassTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea
      {...props}
      className={`w-full resize-none rounded-xl border border-slate-200/80 bg-white/75 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-[20px] ${props.className ?? ""}`}
    />
  );
}

function GhostButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      {...props}
      className={`rounded-xl border border-slate-200/80 bg-white/75 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-white hover:text-slate-900 ${className}`}
    >
      {children}
    </button>
  );
}

function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <span className="text-xs uppercase tracking-[0.24em] text-slate-500">
        {title}
      </span>
      {action}
    </div>
  );
}

function GradeView() {
  const grades = [
    { item: "Midterm Exam", score: 82, max: 100, weight: "30%" },
    { item: "Assignment 1", score: 95, max: 100, weight: "10%" },
    { item: "Assignment 2", score: 88, max: 100, weight: "10%" },
    { item: "Lab 1", score: 90, max: 100, weight: "5%" },
    { item: "Lab 2", score: 87, max: 100, weight: "5%" },
    { item: "Quizzes (avg)", score: 79, max: 100, weight: "10%" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          ["Current Grade", "B+"],
          ["Percentage", "87.5%"],
          ["Credits", "3"],
        ].map(([label, val]) => (
          <Panel key={label} className="text-center">
            <p className="mb-1 text-xs text-slate-500">{label}</p>
            <p className="text-2xl font-semibold text-slate-900">{val}</p>
          </Panel>
        ))}
      </div>

      <Panel>
        <div className="mb-2 flex justify-between">
          <span className="text-xs text-slate-500">Course Completion</span>
          <span className="text-xs text-slate-500">62%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-200/70">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500"
            style={{ width: "62%" }}
          />
        </div>
      </Panel>

      <Panel className="overflow-hidden p-0">
        <div className="flex justify-between border-b border-slate-200/70 bg-slate-50/80 px-4 py-3">
          <span className="text-xs text-slate-600">Grade Breakdown</span>
          <span className="text-xs text-slate-500">Weight · Score</span>
        </div>
        {grades.map((g, i) => (
          <div
            key={g.item}
            className={`px-4 py-3 ${i !== 0 ? "border-t border-slate-200/70" : ""}`}
          >
            <div className="mb-1.5 flex justify-between">
              <span className="text-sm text-slate-900">{g.item}</span>
              <span className="text-xs text-slate-500">
                {g.weight} · {g.score}/{g.max}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500"
                style={{ width: `${g.score}%` }}
              />
            </div>
          </div>
        ))}
        <div className="flex justify-between border-t border-slate-200/70 bg-slate-50/80 px-4 py-3">
          <span className="text-xs text-slate-600">Projected Final Grade</span>
          <span className="text-xs font-medium text-slate-900">
            B+ · 87.5%
          </span>
        </div>
      </Panel>

      <Panel>
        <p className="mb-3 text-xs text-slate-600">Grade Calculator</p>
        <div className="flex flex-wrap gap-2">
          <GlassInput placeholder="Score" className="min-w-[90px] flex-1" />
          <GlassInput placeholder="Max" className="w-20" />
          <GlassInput placeholder="Weight %" className="w-24" />
          <GhostButton>Calculate</GhostButton>
        </div>
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3 text-center text-xs text-slate-500">
          Result will appear here
        </div>
      </Panel>
    </div>
  );
}

function DocsView() {
  const files = [
    { name: "Lecture_01_Intro.pdf", size: "2.3 MB", date: "Mar 1" },
    { name: "Lab_Manual_Ch3.pdf", size: "1.1 MB", date: "Feb 28" },
    { name: "Syllabus_CSCE3600.pdf", size: "0.5 MB", date: "Jan 15" },
    { name: "Assignment_2_Guidelines.pdf", size: "0.8 MB", date: "Feb 20" },
    { name: "Lecture_04_MemoryMgmt.pdf", size: "3.1 MB", date: "Feb 18" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200/80 bg-white/75 px-3 py-2.5">
          <Search size={13} className="shrink-0 text-slate-400" />
          <input
            placeholder="Search documents…"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-dashed border-slate-200/80 bg-white/75 px-3 py-2.5 text-xs font-medium text-slate-700 transition hover:bg-white">
          <Upload size={12} /> Upload
          <input type="file" className="hidden" />
        </label>
      </div>

      <Panel className="overflow-hidden p-0">
        <div className="grid grid-cols-12 border-b border-slate-200/70 bg-slate-50/80 px-4 py-3 text-xs text-slate-500">
          <span className="col-span-7">Name</span>
          <span className="col-span-2">Size</span>
          <span className="col-span-3">Uploaded</span>
        </div>
        {files.map((f, i) => (
          <div
            key={f.name}
            className={`grid cursor-pointer grid-cols-12 items-center px-4 py-3 transition hover:bg-slate-50/80 ${
              i !== 0 ? "border-t border-slate-200/70" : ""
            }`}
          >
            <div className="col-span-7 flex min-w-0 items-center gap-2">
              <FileText size={13} className="shrink-0 text-slate-400" />
              <span className="truncate text-sm text-slate-900">{f.name}</span>
            </div>
            <span className="col-span-2 text-xs text-slate-500">{f.size}</span>
            <span className="col-span-3 text-xs text-slate-500">{f.date}</span>
          </div>
        ))}
      </Panel>

      <Panel className="border-2 border-dashed border-slate-200 bg-slate-50/80 py-10 text-center">
        <Upload size={22} className="mx-auto mb-2 text-slate-400" />
        <p className="text-sm text-slate-700">Drag & drop files here</p>
        <p className="mt-1 text-xs text-slate-500">PDF, DOCX, PNG supported</p>
      </Panel>
    </div>
  );
}

function RemindersView() {
  const [reminders, setReminders] = useState([
    {
      id: "1",
      label: "Assignment 3 Due",
      date: "Mar 7 · 11:59 PM",
      done: false,
      urgent: true,
    },
    {
      id: "2",
      label: "Upload Lab Report",
      date: "Mar 9",
      done: false,
      urgent: true,
    },
    {
      id: "3",
      label: "Study Chapter 5",
      date: "Tonight",
      done: false,
      urgent: false,
    },
    {
      id: "4",
      label: "Exam Review Session",
      date: "Mar 12",
      done: false,
      urgent: false,
    },
    {
      id: "5",
      label: "Read Chapter 6",
      date: "Mar 14",
      done: true,
      urgent: false,
    },
  ]);

  const [filter, setFilter] = useState<"all" | "upcoming" | "done">("all");
  const [newLabel, setNewLabel] = useState("");
  const [newDate, setNewDate] = useState("");

  const toggle = (id: string) =>
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, done: !r.done } : r)),
    );

  const addReminder = () => {
    if (!newLabel.trim()) return;
    setReminders((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        label: newLabel.trim(),
        date: newDate || "—",
        done: false,
        urgent: false,
      },
    ]);
    setNewLabel("");
    setNewDate("");
  };

  const filtered = reminders.filter((r) => {
    if (filter === "upcoming") return !r.done;
    if (filter === "done") return r.done;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {(["all", "upcoming", "done"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                filter === f
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white/75 text-slate-600 hover:bg-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500">
          {reminders.filter((r) => !r.done).length} pending
        </span>
      </div>

      <Panel className="overflow-hidden p-0">
        {filtered.map((r, i) => (
          <div
            key={r.id}
            className={`flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50/80 ${
              i !== 0 ? "border-t border-slate-200/70" : ""
            }`}
          >
            <button
              onClick={() => toggle(r.id)}
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                r.done
                  ? "border-slate-300 bg-slate-100"
                  : "border-slate-300 bg-white"
              }`}
            >
              {r.done && <span className="text-[9px] text-slate-700">✓</span>}
            </button>

            <div className="min-w-0 flex-1">
              <span
                className={`text-sm ${
                  r.done ? "text-slate-400 line-through" : "text-slate-900"
                }`}
              >
                {r.label}
              </span>
              <span className="ml-2 text-xs text-slate-500">{r.date}</span>
            </div>

            {r.urgent && !r.done && (
              <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                Urgent
              </span>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-slate-400">
            No reminders here
          </div>
        )}
      </Panel>

      <Panel>
        <p className="mb-3 text-xs text-slate-600">Add a Reminder</p>
        <div className="flex flex-wrap gap-2">
          <GlassInput
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addReminder()}
            placeholder="Reminder label…"
            className="min-w-[160px] flex-1"
          />
          <GlassInput
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-[150px]"
          />
          <GhostButton
            onClick={addReminder}
            className="flex items-center gap-1"
          >
            <Plus size={12} /> Add
          </GhostButton>
        </div>
      </Panel>
    </div>
  );
}

function CalendarView() {
  const events: Record<number, string> = {
    7: "Assignment 3 Due",
    9: "Lab Report Due",
    12: "Exam Review",
    15: "Spring Break",
    20: "Assignment 4 Due",
    28: "Final Exam",
  };

  return (
    <div className="space-y-4">
      <Panel className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-slate-200/70 bg-slate-50/80 px-4 py-3">
          <span className="text-sm font-medium text-slate-900">March 2026</span>
          <div className="flex gap-2">
            <GhostButton className="px-2 py-1">◀ Feb</GhostButton>
            <GhostButton className="px-2 py-1">Apr ▶</GhostButton>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200/70">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-2 text-center text-xs text-slate-500">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
            <div
              key={d}
              className={`min-h-[58px] cursor-pointer border-b border-r border-slate-200/70 p-1.5 transition hover:bg-slate-50/80 ${
                d === 3 ? "bg-indigo-50/70" : ""
              }`}
            >
              <span
                className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  d === 3
                    ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white"
                    : "text-slate-700"
                }`}
              >
                {d}
              </span>
              {events[d] && (
                <div className="rounded border border-slate-200 bg-white/75 px-1 py-0.5 text-[9px] leading-tight text-slate-700">
                  <span className="block truncate">{events[d]}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="overflow-hidden p-0">
        <div className="border-b border-slate-200/70 bg-slate-50/80 px-4 py-3">
          <span className="text-xs text-slate-600">Upcoming Events</span>
        </div>
        {Object.entries(events).map(([day, label], i) => (
          <div
            key={day}
            className={`flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50/80 ${
              i !== 0 ? "border-t border-slate-200/70" : ""
            }`}
          >
            <div className="w-10 shrink-0 rounded-lg border border-slate-200 bg-white/75 py-1 text-center">
              <p className="text-[9px] text-slate-500">Mar</p>
              <p className="text-xs font-medium text-slate-900">{day}</p>
            </div>
            <span className="text-sm text-slate-800">{label}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function QuizView() {
  const [selected, setSelected] = useState<string | null>(null);
  const [difficulty, setDifficulty] =
    useState<"easy" | "medium" | "hard">("medium");

  const topics = [
    "System Calls",
    "Memory Management",
    "Process Scheduling",
    "File Systems",
    "Threads & Concurrency",
    "I/O Management",
  ];

  const scores = [
    { topic: "System Calls", score: "8/10", date: "Mar 1", pct: 80 },
    { topic: "Memory Management", score: "6/10", date: "Feb 28", pct: 60 },
    { topic: "Process Scheduling", score: "9/10", date: "Feb 25", pct: 90 },
  ];

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs text-slate-500">Select a topic</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {topics.map((t) => (
            <button
              key={t}
              onClick={() => setSelected(t === selected ? null : t)}
              className={`flex items-center justify-between rounded-xl border px-3 py-3 text-left text-sm transition ${
                selected === t
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 bg-white/75 text-slate-700 hover:bg-white"
              }`}
            >
              <span>{t}</span>
              <ChevronRight size={12} className="shrink-0 text-slate-400" />
            </button>
          ))}
        </div>
      </div>

      <Panel className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-xs text-slate-500">Difficulty</p>
          <div className="flex gap-1.5">
            {(["easy", "medium", "hard"] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDifficulty(d)}
                className={`rounded-full border px-3 py-1 text-xs capitalize transition ${
                  difficulty === d
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white/75 text-slate-600 hover:bg-white"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="text-center">
          {selected && (
            <p className="mb-2 text-xs text-slate-500">
              Topic: <span className="text-slate-900">{selected}</span>
            </p>
          )}
          <button
            disabled={!selected}
            className={`rounded-xl px-5 py-2.5 text-xs font-medium transition ${
              selected
                ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-[0_10px_24px_rgba(79,70,229,0.28)] hover:brightness-110"
                : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400"
            }`}
          >
            Start Quiz →
          </button>
        </div>
      </Panel>

      <Panel className="overflow-hidden p-0">
        <div className="border-b border-slate-200/70 bg-slate-50/80 px-4 py-3">
          <span className="text-xs text-slate-600">Recent Scores</span>
        </div>
        {scores.map((s, i) => (
          <div
            key={s.topic}
            className={`flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50/80 ${
              i !== 0 ? "border-t border-slate-200/70" : ""
            }`}
          >
            <div className="min-w-0 flex-1">
              <p className="mb-1.5 text-sm text-slate-900">{s.topic}</p>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-200/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500"
                  style={{ width: `${s.pct}%` }}
                />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium text-slate-900">{s.score}</p>
              <p className="text-xs text-slate-500">{s.date}</p>
            </div>
          </div>
        ))}
      </Panel>
    </div>
  );
}

function NotesView() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const saved = [
    { title: "Chapter 3 — System Calls", date: "Mar 1" },
    { title: "Memory Management Notes", date: "Feb 28" },
    { title: "Process Scheduling Summary", date: "Feb 25" },
  ];

  return (
    <div className="space-y-4">
      <GlassInput
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title…"
      />

      <GlassTextarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Start typing your notes here… Spark can summarize and organize them."
        rows={9}
      />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {["Summarize with AI", "Organize", "Save Note", "Clear"].map((a) => (
          <GhostButton key={a}>{a}</GhostButton>
        ))}
      </div>

      <Panel className="overflow-hidden p-0">
        <div className="flex justify-between border-b border-slate-200/70 bg-slate-50/80 px-4 py-3">
          <span className="text-xs text-slate-600">Saved Notes</span>
          <span className="text-xs text-slate-500">{saved.length} notes</span>
        </div>
        {saved.map((n, i) => (
          <div
            key={n.title}
            className={`flex cursor-pointer items-center justify-between px-4 py-3 transition hover:bg-slate-50/80 ${
              i !== 0 ? "border-t border-slate-200/70" : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <FileText size={12} className="shrink-0 text-slate-400" />
              <span className="truncate text-sm text-slate-800">{n.title}</span>
            </div>
            <span className="ml-3 shrink-0 text-xs text-slate-500">
              {n.date}
            </span>
          </div>
        ))}
      </Panel>
    </div>
  );
}

interface OverviewProps {
  course: { code: string; name: string };
  focusActive: boolean;
  elapsed: number;
  fmt: (s: number) => string;
  startFocus: () => void;
  stopFocus: () => void;
}

function CourseOverview({
  course,
  focusActive,
  elapsed,
  fmt,
  startFocus,
  stopFocus,
}: OverviewProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-3xl font-semibold text-slate-900">{course.code}</h2>
        <p className="mt-1 text-sm text-slate-600">{course.name}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Current Grade", "B+"],
          ["Progress", "62%"],
          ["Next Due", "Mar 7"],
          ["Credits", "3"],
        ].map(([label, val]) => (
          <Panel key={label} className="text-center">
            <p className="mb-1 text-xs text-slate-500">{label}</p>
            <p className="text-xl font-semibold text-slate-900">{val}</p>
          </Panel>
        ))}
      </div>

      <Panel className="overflow-hidden p-0">
        <div className="border-b border-slate-200/70 bg-slate-50/80 px-4 py-3">
          <span className="text-xs text-slate-600">About This Course</span>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm leading-relaxed text-slate-700">
            This course is about the design and implementation of system-level
            software. Topics include processes, threads, memory management, file
            systems, system calls, I/O handling, and inter-process
            communication. Students will write low-level programs in C that
            interact directly with the operating system, gaining hands-on
            experience with how modern OS abstractions are built and used.
          </p>
        </div>
      </Panel>

      <Panel className="p-5">
        <p className="mb-4 text-xs uppercase tracking-[0.28em] text-slate-500">
          Focus Mode
        </p>
        <div className="flex items-center gap-5">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 transition ${
              focusActive
                ? "border-indigo-300 bg-indigo-50"
                : "border-slate-200 bg-white/70"
            }`}
          >
            {focusActive ? (
              <TimerOff size={22} className="text-indigo-700" />
            ) : (
              <Timer size={22} className="text-slate-500" />
            )}
          </div>

          <div className="flex-1">
            {focusActive ? (
              <>
                <div className="mb-1 font-mono text-[26px] text-slate-900 tabular-nums">
                  {fmt(elapsed)}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
                  <span className="text-xs text-slate-600">
                    Focus session active
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="mb-0.5 text-sm text-slate-900">Ready to focus?</p>
                <p className="text-xs text-slate-500">
                  Start a distraction-free study session and track your time.
                </p>
              </>
            )}
          </div>

          <button
            onClick={focusActive ? stopFocus : startFocus}
            className={`shrink-0 rounded-xl px-4 py-2 text-xs font-medium transition ${
              focusActive
                ? "border border-slate-200 bg-white/80 text-slate-700 hover:bg-white"
                : "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-[0_10px_24px_rgba(79,70,229,0.28)] hover:brightness-110"
            }`}
          >
            {focusActive ? "End Session" : "Start Focus"}
          </button>
        </div>
      </Panel>
    </div>
  );
}

interface AIChatPanelProps {
  maximized?: boolean;
  onClose: () => void;
  onMaximize?: () => void;
  msgs: ChatMsg[];
  aiInput: string;
  setAiInput: (v: string) => void;
  send: (text?: string) => void;
  course: { code: string; name: string };
  contextFiles: string[];
  onRemoveFile: (f: string) => void;
}

function AIChatPanel({
  maximized,
  onClose,
  onMaximize,
  msgs,
  aiInput,
  setAiInput,
  send,
  course,
  contextFiles,
  onRemoveFile,
}: AIChatPanelProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const QUICK = [
    "Summarize last lecture",
    "What's on the exam?",
    "Explain system calls",
    "Quiz me on Ch 3",
  ];

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/70 shadow-[0_28px_70px_rgba(15,23,42,0.18)] backdrop-blur-[30px] ${
        maximized ? "h-full" : "max-h-[560px] w-[400px]"
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-200/70 bg-gradient-to-r from-slate-50/90 to-indigo-50/80 px-4 py-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <SparkLogo size={32} />
          <div>
            <p className="text-sm font-medium text-slate-900">Spark</p>
            <p className="text-xs text-slate-500">
              AI study assistant · {course.code}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!maximized && onMaximize && (
            <button
              onClick={onMaximize}
              title="Expand to half screen"
              className="text-slate-500 transition hover:text-slate-900"
            >
              <Maximize2 size={14} />
            </button>
          )}
          {maximized && (
            <button
              onClick={onClose}
              title="Minimize"
              className="text-slate-500 transition hover:text-slate-900"
            >
              <Minimize2 size={14} />
            </button>
          )}
          {!maximized && (
            <button
              onClick={onClose}
              className="text-slate-500 transition hover:text-slate-900"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-b border-slate-200/70 bg-white/65 px-4 py-2 shrink-0">
        <span className="text-xs text-slate-500">Context files</span>
        <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-white">
          <Paperclip size={11} /> Upload PDF
          <input type="file" accept=".pdf" className="hidden" />
        </label>
      </div>

      {contextFiles.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200/70 px-4 py-2 shrink-0">
          {contextFiles.map((f) => (
            <div
              key={f}
              className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2.5 py-0.5"
            >
              <FileText size={10} className="text-slate-400" />
              <span className="text-xs text-slate-700">{f}</span>
              <button
                onClick={() => onRemoveFile(f)}
                className="ml-0.5 text-slate-400 transition hover:text-slate-700"
              >
                <X size={9} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "ai" && (
              <div className="mr-2 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white/80">
                <span className="text-[8px] text-slate-600">B</span>
              </div>
            )}

            <div
              className={`max-w-[82%] rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
                m.role === "user"
                  ? "rounded-br-sm bg-gradient-to-r from-indigo-600 to-blue-600 text-white"
                  : "rounded-bl-sm border border-slate-200 bg-white/85 text-slate-700"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-slate-200/70 px-4 py-2 shrink-0">
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            className="rounded-full border border-slate-200 bg-white/80 px-2.5 py-0.5 text-xs text-slate-600 transition hover:bg-white hover:text-slate-900"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-200/70 px-4 py-3 shrink-0">
        <label className="shrink-0 cursor-pointer text-slate-400 transition hover:text-slate-700">
          <Paperclip size={14} />
          <input type="file" accept=".pdf" className="hidden" />
        </label>

        <input
          type="text"
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={`Ask Spark about ${course.code}…`}
          className="flex-1 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-900 placeholder-slate-400 outline-none"
        />

        <button
          onClick={() => send()}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white transition hover:brightness-110"
        >
          <Send size={12} />
        </button>
      </div>
    </div>
  );
}

export function CoursePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const course = COURSE_MAP[id ?? "1"] ?? COURSE_MAP["1"];

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const [focusActive, setFocusActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startFocus = () => {
    setFocusActive(true);
    setElapsed(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
  };

  const stopFocus = () => {
    setFocusActive(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setElapsed(0);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(
      2,
      "0",
    )}`;

  const [aiChatState, setAIChatState] = useState<AIChatState>("mini");
  const [aiInput, setAiInput] = useState("");
  const [contextFiles, setContextFiles] = useState([
    "Lecture_01.pdf",
    "Syllabus.pdf",
  ]);

  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      role: "ai",
      text: `Hi! I'm your AI study assistant for ${course.code}. Upload a PDF, ask me questions, or let me help you study.`,
    },
  ]);

  const send = (text?: string) => {
    const msg = (text ?? aiInput).trim();
    if (!msg) return;

    setMsgs((prev) => [
      ...prev,
      { role: "user", text: msg },
      {
        role: "ai",
        text: `[ AI Chat response for: "${msg}" — connect to AI backend ]`,
      },
    ]);

    setAiInput("");
  };

  const aiChatProps = {
    msgs,
    aiInput,
    setAiInput,
    send,
    course,
    contextFiles,
    onRemoveFile: (f: string) =>
      setContextFiles((prev) => prev.filter((x) => x !== f)),
  };

  const renderContent = () => {
    switch (activeMenu) {
      case "grades":
        return <GradeView />;
      case "docs":
        return <DocsView />;
      case "reminders":
        return <RemindersView />;
      case "calendar":
        return <CalendarView />;
      case "quiz":
        return <QuizView />;
      case "notes":
        return <NotesView />;
      default:
        return (
          <CourseOverview
            course={course}
            focusActive={focusActive}
            elapsed={elapsed}
            fmt={fmt}
            startFocus={startFocus}
            stopFocus={stopFocus}
          />
        );
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-900">
      <BackgroundFX brand="TEACH" />

      <div className="relative z-10 flex h-screen flex-col overflow-hidden px-4 py-4 md:px-6">
        <header className="mx-auto flex h-16 w-full max-w-7xl shrink-0 items-center justify-between rounded-2xl border border-slate-200/70 bg-white/50 px-6 shadow-[0_14px_40px_rgba(15,23,42,0.14)] backdrop-blur-[28px]">
          <div className="flex items-center gap-3">
            <img
              src={learnBeamLogo}
              alt="LearnBeam"
              className="h-12 w-12 object-contain"
            />
            <div>
              <span className="block text-lg font-semibold tracking-tight text-slate-900">
                LearnBeam
              </span>
              <span className="block text-xs text-slate-500">
                Course workspace
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="relative rounded-full border border-slate-200/70 bg-white/60 p-2 text-slate-700 transition hover:bg-white">
              <Bell size={16} />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-indigo-500" />
            </button>
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 bg-gradient-to-br from-slate-800 to-slate-600 text-xs font-medium text-white">
              P
            </div>
          </div>
        </header>

        <div className="mx-auto mt-5 flex w-full max-w-7xl flex-1 gap-4 overflow-hidden">
          <div
            className={`flex overflow-hidden ${
              aiChatState === "maximized" ? "w-1/2" : "flex-1"
            }`}
          >
            {menuOpen && (
              <div className="w-60 shrink-0 overflow-y-auto rounded-[24px] border border-slate-200/70 bg-white/55 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-[28px]">
                <div className="flex items-center justify-between border-b border-slate-200/70 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {course.code}
                    </p>
                    <p className="text-xs text-slate-500">{course.name}</p>
                  </div>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="text-slate-400 transition hover:text-slate-800"
                  >
                    <X size={14} />
                  </button>
                </div>

                <button
                  onClick={() => setActiveMenu(null)}
                  className={`flex w-full items-center gap-2.5 border-b border-slate-200/70 px-4 py-3 text-left transition hover:bg-slate-50/80 ${
                    !activeMenu
                      ? "border-l-2 border-l-indigo-600 bg-indigo-50/80"
                      : ""
                  }`}
                >
                  <span className="text-sm font-medium text-slate-800">
                    Overview
                  </span>
                </button>

                {MENU_ITEMS.map(({ id: sid, Icon, label }) => (
                  <button
                    key={sid}
                    onClick={() => setActiveMenu(sid)}
                    className={`flex w-full items-center gap-2.5 border-b border-slate-200/70 px-4 py-3 text-left transition hover:bg-slate-50/80 last:border-0 ${
                      activeMenu === sid
                        ? "border-l-2 border-l-indigo-600 bg-indigo-50/80"
                        : ""
                    }`}
                  >
                    <Icon size={13} className="shrink-0 text-slate-500" />
                    <span className="text-sm text-slate-700">{label}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-1 flex-col overflow-hidden rounded-[24px] border border-slate-200/70 bg-white/55 shadow-[0_18px_50px_rgba(15,23,42,0.16)] backdrop-blur-[28px]">
              <div className="flex items-center gap-3 border-b border-slate-200/70 bg-white/45 px-5 py-4 shrink-0">
                <button
                  onClick={() => navigate("/dashboard")}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white/80 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-white hover:text-slate-900"
                >
                  <ChevronLeft size={13} />
                  Dashboard
                </button>

                <span className="text-xs text-slate-300">|</span>

                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="text-slate-600 transition hover:text-slate-900"
                  title="Toggle menu"
                >
                  <Menu size={17} />
                </button>

                <span className="text-xs text-slate-300">/</span>

                <span className="text-xs text-slate-500">
                  {activeMenu
                    ? MENU_ITEMS.find((m) => m.id === activeMenu)?.label
                    : "Overview"}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 pb-24 md:px-8">
                {renderContent()}
              </div>
            </div>
          </div>

          {aiChatState === "maximized" && (
            <div className="flex w-1/2 shrink-0 flex-col overflow-hidden">
              <AIChatPanel
                maximized
                onClose={() => setAIChatState("compact")}
                {...aiChatProps}
              />
            </div>
          )}
        </div>

        {aiChatState !== "maximized" && (
          <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-3">
            {aiChatState === "compact" && (
              <AIChatPanel
                onClose={() => setAIChatState("mini")}
                onMaximize={() => setAIChatState("maximized")}
                {...aiChatProps}
              />
            )}

            <button
              onClick={() =>
                setAIChatState(aiChatState === "mini" ? "compact" : "mini")
              }
              className="cursor-pointer transition-transform hover:scale-110"
            >
              <SparkLogo size={160} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}