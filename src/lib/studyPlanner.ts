import {
  parseDueString,
  type StoredCourseAssignment,
  type StoredCourseInsights,
  type StoredCourseReminder,
  type StoredLearningActivity,
  type StoredStudyPlan,
  type StoredStudySession,
  type StoredStudyTopic,
  type StudySessionPriority,
} from "./courseData";

type GenerateStudyPlanInput = {
  courseCode: string;
  courseName?: string | null;
  assignments: StoredCourseAssignment[];
  reminders: StoredCourseReminder[];
  insights?: StoredCourseInsights | null;
  documents?: Array<{ id: string; name: string; textContent: string | null; used: boolean }>;
  activity?: StoredLearningActivity;
  now?: Date;
};

export const EMPTY_LEARNING_ACTIVITY: StoredLearningActivity = {
  focusSessions: 0,
  focusMinutes: 0,
  quizAttempts: [],
  lastActivityAt: null,
};

const SLOT_TEMPLATES = [
  { hour: 17, minute: 30 },
  { hour: 19, minute: 15 },
  { hour: 20, minute: 45 },
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function createSlotDate(day: Date, hour: number, minute: number) {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, minute, 0, 0);
}

function looksLikeMajorAssessment(assignment: StoredCourseAssignment) {
  const combined = `${assignment.label} ${assignment.type}`.toLowerCase();
  return /exam|midterm|final|project|presentation|paper/.test(combined) || assignment.weight >= 20;
}

function getPriority(assignment: StoredCourseAssignment, daysUntilDue: number): StudySessionPriority {
  if (daysUntilDue <= 2 || looksLikeMajorAssessment(assignment)) return "high";
  if (daysUntilDue <= 7) return "medium";
  return "light";
}

function durationForPriority(priority: StudySessionPriority) {
  if (priority === "high") return 90;
  if (priority === "medium") return 60;
  return 45;
}

function sessionOffsets(daysUntilDue: number, sessionCount: number) {
  if (sessionCount <= 1) {
    return [daysUntilDue > 6 ? -3 : -1];
  }

  if (daysUntilDue <= 2) return [-1, 0];
  if (daysUntilDue <= 5) return [-2, -1];
  if (daysUntilDue <= 10) return [-4, -1];
  return [-7, -2];
}

function chooseSlot(
  preferredDay: Date,
  durationMinutes: number,
  usedStarts: Set<string>,
  now: Date,
) {
  const earliest = new Date(now.getTime() + 15 * 60 * 1000);
  let day = startOfDay(preferredDay);
  if (day.getTime() < startOfDay(now).getTime()) {
    day = startOfDay(now);
  }

  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const candidateDay = addDays(day, dayOffset);
    for (const slot of SLOT_TEMPLATES) {
      const start = createSlotDate(candidateDay, slot.hour, slot.minute);
      if (start.getTime() < earliest.getTime()) continue;
      const key = start.toISOString();
      if (usedStarts.has(key)) continue;
      usedStarts.add(key);
      return {
        startAt: start.toISOString(),
        endAt: new Date(start.getTime() + durationMinutes * 60 * 1000).toISOString(),
      };
    }
  }

  const fallback = new Date(earliest);
  fallback.setMinutes(fallback.getMinutes() + (30 - (fallback.getMinutes() % 30 || 30)));
  const key = fallback.toISOString();
  usedStarts.add(key);
  return {
    startAt: fallback.toISOString(),
    endAt: new Date(fallback.getTime() + durationMinutes * 60 * 1000).toISOString(),
  };
}

function actionableAssignments(assignments: StoredCourseAssignment[]) {
  return assignments
    .filter((assignment) => assignment.status !== "completed" && parseDueString(assignment.due))
    .sort((left, right) => {
      const leftDue = parseDueString(left.due)?.getTime() ?? 0;
      const rightDue = parseDueString(right.due)?.getTime() ?? 0;
      return leftDue - rightDue;
    })
    .slice(0, 8);
}

function actionableReminders(reminders: StoredCourseReminder[]) {
  return reminders
    .filter((reminder) => !reminder.done && parseDueString(reminder.due))
    .sort((left, right) => {
      const leftDue = parseDueString(left.due)?.getTime() ?? 0;
      const rightDue = parseDueString(right.due)?.getTime() ?? 0;
      return leftDue - rightDue;
    })
    .slice(0, 6);
}

function sanitizeSummary(summary: string | null | undefined) {
  if (!summary) return "";
  return summary.replace(/\s+/g, " ").trim();
}

export function buildStudyPlanSourceSignature({
  courseCode,
  courseName,
  assignments,
  reminders,
  insights,
  documents = [],
  activity = EMPTY_LEARNING_ACTIVITY,
}: Omit<GenerateStudyPlanInput, "now">) {
  const assignmentSig = actionableAssignments(assignments)
    .map((assignment) => [assignment.id, assignment.label, assignment.type, assignment.due, assignment.weight, assignment.status].join("|"))
    .join("~");
  const reminderSig = actionableReminders(reminders)
    .map((reminder) => [reminder.id, reminder.text, reminder.due, reminder.done ? "1" : "0"].join("|"))
    .join("~");
  const insightSig = [
    insights?.term ?? "",
    insights?.meetingSchedule ?? "",
    insights?.summary ?? "",
    insights?.gradingPolicy.map((item) => `${item.label}:${item.weight ?? ""}`).join(",") ?? "",
  ].join("|");

  const documentSig = documents
    .filter((document) => document.used && Boolean(document.textContent?.trim()))
    .slice(0, 8)
    .map((document) => `${document.id}|${document.name}|${document.textContent?.length ?? 0}`)
    .join("~");
  const activitySig = [
    activity.focusSessions,
    activity.focusMinutes,
    activity.quizAttempts.slice(-8).map((attempt) => `${attempt.quizId}|${attempt.topic}|${attempt.correct}|${attempt.total}`).join("~"),
  ].join("|");

  return [courseCode, courseName ?? "", assignmentSig, reminderSig, insightSig, documentSig, activitySig].join("####");
}

function normalizeTopicLabel(value: string) {
  return value.replace(/\s+/g, " ").replace(/^study\s+/i, "").trim();
}

function fallbackTopics(input: GenerateStudyPlanInput): StoredStudyTopic[] {
  const seen = new Set<string>();
  const topics: StoredStudyTopic[] = [];
  const add = (label: string, status: StoredStudyTopic["status"], sourceLabel: string) => {
    const clean = normalizeTopicLabel(label);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    topics.push({ label: clean, status, sourceLabel });
  };

  for (const assignment of input.assignments) {
    add(
      assignment.label,
      assignment.status === "completed" || assignment.grade !== null ? "covered" : "priority",
      assignment.label,
    );
  }
  for (const reminder of input.reminders) {
    add(reminder.text, reminder.done ? "covered" : "uncovered", reminder.text);
  }
  for (const attempt of input.activity?.quizAttempts ?? []) {
    const percentage = attempt.total > 0 ? attempt.correct / attempt.total : 0;
    add(attempt.topic, percentage >= 0.8 ? "covered" : "priority", `Quiz score ${attempt.correct}/${attempt.total}`);
  }
  for (const document of input.documents ?? []) {
    if (!document.used || !document.textContent?.trim()) continue;
    add(document.name.replace(/\.[^.]+$/, ""), "uncovered", document.name);
  }
  if (topics.length === 0 && input.insights?.courseName) {
    add(`${input.insights.courseName} syllabus review`, "uncovered", input.insights.sourceFileName);
  }
  return topics.slice(0, 12);
}

export function generateStudyPlan(input: GenerateStudyPlanInput, previousPlan?: StoredStudyPlan | null): StoredStudyPlan | null {
  const now = input.now ?? new Date();
  const dueAssignments = actionableAssignments(input.assignments);
  const dueReminders = actionableReminders(input.reminders);
  const sourceSignature = buildStudyPlanSourceSignature(input);

  const readableDocuments = (input.documents ?? []).filter(document => document.used && Boolean(document.textContent?.trim()));
  const hasLearningActivity = Boolean(input.activity?.focusSessions || input.activity?.quizAttempts.length);
  if (dueAssignments.length === 0 && dueReminders.length === 0 && !input.insights && readableDocuments.length === 0 && !hasLearningActivity) {
    return null;
  }

  const usedStarts = new Set<string>();
  const sessions: StoredStudySession[] = [];

  for (const assignment of dueAssignments) {
    const dueDate = parseDueString(assignment.due);
    if (!dueDate) continue;

    const daysUntilDue = Math.max(
      0,
      Math.ceil((startOfDay(dueDate).getTime() - startOfDay(now).getTime()) / (24 * 60 * 60 * 1000)),
    );
    const priority = getPriority(assignment, daysUntilDue);
    const sessionCount = priority === "high" || daysUntilDue <= 7 ? 2 : 1;
    const durationMinutes = durationForPriority(priority);

    for (const offset of sessionOffsets(daysUntilDue, sessionCount)) {
      const preferredDay = addDays(dueDate, offset);
      const slot = chooseSlot(preferredDay, durationMinutes, usedStarts, now);
      sessions.push({
        id: crypto.randomUUID(),
        title: `Study ${assignment.label}`,
        detail: `Work toward ${assignment.label}${assignment.type ? ` (${assignment.type})` : ""} before it is due.`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        due: assignment.due,
        sourceType: "assignment",
        sourceLabel: assignment.label,
        priority,
        completed: false,
      });
      if (sessions.length >= 12) break;
    }

    if (sessions.length >= 12) break;
  }

  if (sessions.length < 12) {
    for (const reminder of dueReminders) {
      const dueDate = parseDueString(reminder.due);
      if (!dueDate) continue;
      const preferredDay = addDays(dueDate, -1);
      const slot = chooseSlot(preferredDay, 30, usedStarts, now);
      sessions.push({
        id: crypto.randomUUID(),
        title: reminder.text,
        detail: "Short reminder session generated from your saved course reminder.",
        startAt: slot.startAt,
        endAt: slot.endAt,
        due: reminder.due,
        sourceType: "reminder",
        sourceLabel: reminder.text,
        priority: "light",
        completed: false,
      });
      if (sessions.length >= 12) break;
    }
  }

  if (sessions.length === 0 && input.insights) {
    const slot = chooseSlot(addDays(now, 1), 45, usedStarts, now);
    sessions.push({
      id: crypto.randomUUID(),
      title: `Review ${input.courseCode} syllabus`,
      detail: "Go over the stored syllabus summary, grading policy, and course expectations.",
      startAt: slot.startAt,
      endAt: slot.endAt,
      due: null,
      sourceType: "quiz",
      sourceLabel: input.insights.sourceFileName || `${input.courseCode} syllabus`,
      priority: "light",
      completed: false,
    });
  }

  if (sessions.length === 0 && (input.activity?.quizAttempts.length ?? 0) > 0) {
    const weakestAttempt = [...(input.activity?.quizAttempts ?? [])]
      .sort((left, right) => (left.correct / Math.max(1, left.total)) - (right.correct / Math.max(1, right.total)))[0];
    const slot = chooseSlot(addDays(now, 1), 60, usedStarts, now);
    sessions.push({
      id: crypto.randomUUID(),
      title: `Review ${weakestAttempt.topic}`,
      detail: `Revisit this topic after the saved ${weakestAttempt.correct}/${weakestAttempt.total} quiz result.`,
      startAt: slot.startAt,
      endAt: slot.endAt,
      due: null,
      sourceType: "syllabus",
      sourceLabel: `Quiz: ${weakestAttempt.topic}`,
      priority: weakestAttempt.correct / Math.max(1, weakestAttempt.total) < 0.8 ? "high" : "medium",
      completed: false,
    });
  }

  if (sessions.length === 0 && readableDocuments.length > 0) {
    for (const [index, document] of readableDocuments.slice(0, 3).entries()) {
      const slot = chooseSlot(addDays(now, index + 1), 45, usedStarts, now);
      sessions.push({
        id: crypto.randomUUID(),
        title: `Review ${document.name.replace(/\.[^.]+$/, "")}`,
        detail: `Study the saved course material in ${document.name}.`,
        startAt: slot.startAt,
        endAt: slot.endAt,
        due: null,
        sourceType: "document",
        sourceLabel: document.name,
        priority: "light",
        completed: false,
      });
    }
  }

  const sorted = sessions.sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime());
  const priorCompletionCounts = new Map<string, number>();
  for (const session of previousPlan?.sessions ?? []) {
    if (!session.completed) continue;
    const key = `${session.sourceType}|${session.sourceLabel}`;
    priorCompletionCounts.set(key, (priorCompletionCounts.get(key) ?? 0) + 1);
  }
  const sessionsWithProgress = sorted.map((session) => {
    const key = `${session.sourceType}|${session.sourceLabel}`;
    const completedRemaining = priorCompletionCounts.get(key) ?? 0;
    if (completedRemaining <= 0) return session;
    priorCompletionCounts.set(key, completedRemaining - 1);
    return { ...session, completed: true };
  });
  const planSummaryParts = [
    dueAssignments.length > 0 ? `${dueAssignments.length} upcoming assignment${dueAssignments.length === 1 ? "" : "s"}` : null,
    dueReminders.length > 0 ? `${dueReminders.length} reminder${dueReminders.length === 1 ? "" : "s"}` : null,
    sanitizeSummary(input.insights?.summary) ? "stored syllabus guidance" : null,
  ].filter(Boolean);

  return {
    sourceSignature,
    generatedAt: new Date().toISOString(),
    summary: planSummaryParts.length > 0
      ? `Auto-built from ${planSummaryParts.join(", ")}.`
      : "Auto-built from your stored course data.",
    sessions: sessionsWithProgress,
    topics: previousPlan?.sourceSignature === sourceSignature && previousPlan.topics.length
      ? previousPlan.topics
      : fallbackTopics(input),
    activity: input.activity ?? previousPlan?.activity ?? EMPTY_LEARNING_ACTIVITY,
  };
}

export function formatStudySessionRange(session: StoredStudySession) {
  const start = new Date(session.startAt);
  const end = new Date(session.endAt);
  const dayLabel = start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeLabel = `${start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} - ${end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  return `${dayLabel} · ${timeLabel}`;
}

export function groupStudySessionsByDay(sessions: StoredStudySession[]) {
  const groups = new Map<string, StoredStudySession[]>();
  for (const session of sessions) {
    const key = dateKey(new Date(session.startAt));
    const next = groups.get(key) ?? [];
    next.push(session);
    groups.set(key, next);
  }

  return [...groups.entries()].map(([key, groupedSessions]) => ({
    key,
    label: new Date(groupedSessions[0].startAt).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }),
    sessions: groupedSessions.sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime()),
  }));
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function toFloatingIcsDate(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function buildStudyPlanCalendar(plan: StoredStudyPlan, courseCode: string, courseName?: string | null) {
  const stamp = toFloatingIcsDate(new Date().toISOString());
  const events = plan.sessions.map((session) => [
    "BEGIN:VEVENT",
    `UID:${session.id}@learnbeam`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toFloatingIcsDate(session.startAt)}`,
    `DTEND:${toFloatingIcsDate(session.endAt)}`,
    `SUMMARY:${escapeIcsText(session.title)}`,
    `DESCRIPTION:${escapeIcsText(`${session.detail}${session.due ? ` Due: ${session.due}.` : ""}`)}`,
    `CATEGORIES:${escapeIcsText(`${courseCode}${courseName ? ` ${courseName}` : ""}`)}`,
    "END:VEVENT",
  ].join("\r\n"));

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LearnBeam//Study Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadStudyPlanCalendar(plan: StoredStudyPlan, courseCode: string, courseName?: string | null) {
  const contents = buildStudyPlanCalendar(plan, courseCode, courseName);
  const blob = new Blob([contents], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${courseCode.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "learnbeam"}-study-plan.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
