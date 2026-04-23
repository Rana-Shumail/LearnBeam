export type CourseDocType = "syllabus" | "notes" | "reading" | "past-exam" | "other";

export type StoredCourseDoc = {
  id: string;
  name: string;
  type: CourseDocType;
  size: string;
  uploadedAt: string;
  used: boolean;
  storagePath: string | null;
  textContent: string | null;
};

export type StoredCourseAssignment = {
  id: string;
  label: string;
  type: string;
  due: string;
  weight: number;
  grade: number | null;
  status: "upcoming" | "completed" | "overdue";
};

export type StoredCourseReminder = {
  id: string;
  text: string;
  due: string;
  done: boolean;
};

export type SyllabusGradingItem = {
  label: string;
  weight: number | null;
  notes: string | null;
};

export type StoredCourseInsights = {
  courseCode: string | null;
  courseName: string | null;
  instructor: string | null;
  term: string | null;
  meetingSchedule: string | null;
  location: string | null;
  summary: string | null;
  gradingPolicy: SyllabusGradingItem[];
  warnings: string[];
  sourceFileName: string;
  analyzedAt: string;
};

export type StoredSparkCitation = {
  docName: string;
  excerpt: string;
  url?: string | null;
  kind?: "document" | "web";
};

export type StoredSparkProvider = "gemini" | "cerebras" | "groq";
export type StoredSparkMode = "course" | "global";

export type StoredSparkMessage = {
  id: string;
  role: "user" | "ai" | "system";
  text: string;
  citations: StoredSparkCitation[];
  flagged: boolean;
  flagNote: string | null;
  provider: StoredSparkProvider | null;
  mode: StoredSparkMode | null;
  createdAt: string;
};

export type StoredSparkSuggestion = {
  id: string;
  title: string;
  detail: string;
  courseCode: string | null;
  sourceDoc: string | null;
  generatedAt: string;
};

export type StoredSuggestionState = {
  sourceSignature: string;
  generatedAt: string;
  suggestions: StoredSparkSuggestion[];
};

export type StoredQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  sourceDoc: string | null;
};

export type StoredQuizSession = {
  id: string;
  title: string;
  topic: string;
  createdAt: string;
  questionCount: number;
  sourceDocs: string[];
  sourceSignature: string;
  questions: StoredQuizQuestion[];
};

export type StoredCourseData = {
  docs: StoredCourseDoc[];
  assignments: StoredCourseAssignment[];
  reminders: StoredCourseReminder[];
  insights: StoredCourseInsights | null;
  chatHistory: StoredSparkMessage[];
  suggestions: StoredSuggestionState | null;
  quizSessions: StoredQuizSession[];
  activeQuizId: string | null;
};

export type StoredDashboardAiState = {
  sourceSignature: string;
  generatedAt: string;
  suggestions: StoredSparkSuggestion[];
};

export type CourseReminderItem = {
  id: string;
  text: string;
  due: string;
  done: boolean;
  source: "reminder" | "assignment";
};

type CachedCourse = {
  id: string;
  code: string;
  name: string;
  grade: string;
  progress: number;
  nextDue: string;
  color: string;
};

const COURSE_DATA_KEY = "lb-course-data-v1";
const COURSES_KEY = "lb-courses";
const DASHBOARD_AI_KEY = "lb-dashboard-ai-v1";

function createEmptyCourseData(): StoredCourseData {
  return {
    docs: [],
    assignments: [],
    reminders: [],
    insights: null,
    chatHistory: [],
    suggestions: null,
    quizSessions: [],
    activeQuizId: null,
  };
}

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readCourseDataMap(): Record<string, StoredCourseData> {
  if (typeof localStorage === "undefined") return {};
  return safeParse<Record<string, StoredCourseData>>(localStorage.getItem(COURSE_DATA_KEY), {});
}

function writeCourseDataMap(map: Record<string, StoredCourseData>) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(COURSE_DATA_KEY, JSON.stringify(map));
}

function normalizeSuggestions(items: unknown): StoredSparkSuggestion[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.title !== "string" || typeof record.detail !== "string") {
      return [];
    }
    return [{
      id: record.id,
      title: record.title,
      detail: record.detail,
      courseCode: typeof record.courseCode === "string" ? record.courseCode : null,
      sourceDoc: typeof record.sourceDoc === "string" ? record.sourceDoc : null,
      generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : new Date().toISOString(),
    }];
  });
}

function normalizeSuggestionState(value: unknown): StoredSuggestionState | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (typeof record.sourceSignature !== "string") return null;
  const suggestions = normalizeSuggestions(record.suggestions);
  if (suggestions.length === 0) return null;
  return {
    sourceSignature: record.sourceSignature,
    generatedAt: typeof record.generatedAt === "string" ? record.generatedAt : new Date().toISOString(),
    suggestions,
  };
}

function normalizeChatHistory(items: unknown): StoredSparkMessage[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.id !== "string" || typeof record.role !== "string" || typeof record.text !== "string") {
      return [];
    }

    const role = record.role;
    if (role !== "user" && role !== "ai" && role !== "system") return [];

    const citations = Array.isArray(record.citations)
      ? record.citations.flatMap((citation) => {
          if (!citation || typeof citation !== "object") return [];
          const citationRecord = citation as Record<string, unknown>;
          if (typeof citationRecord.docName !== "string" || typeof citationRecord.excerpt !== "string") return [];
          return [{
            docName: citationRecord.docName,
            excerpt: citationRecord.excerpt,
            url: typeof citationRecord.url === "string" ? citationRecord.url : null,
            kind: citationRecord.kind === "web" ? "web" : "document",
          }];
        })
      : [];

    return [{
      id: record.id,
      role,
      text: record.text,
      citations,
      flagged: Boolean(record.flagged),
      flagNote: typeof record.flagNote === "string" ? record.flagNote : null,
      provider: record.provider === "cerebras" || record.provider === "gemini" || record.provider === "groq"
        ? record.provider
        : null,
      mode: record.mode === "course" || record.mode === "global" ? record.mode : null,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
    }];
  });
}

function normalizeQuizSessions(items: unknown): StoredQuizSession[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.title !== "string" ||
      typeof record.topic !== "string" ||
      !Array.isArray(record.questions)
    ) {
      return [];
    }

    const questions = record.questions.flatMap((question) => {
      if (!question || typeof question !== "object") return [];
      const questionRecord = question as Record<string, unknown>;
      if (
        typeof questionRecord.id !== "string" ||
        typeof questionRecord.question !== "string" ||
        !Array.isArray(questionRecord.options) ||
        typeof questionRecord.correctIndex !== "number"
      ) {
        return [];
      }

      const options = questionRecord.options.filter((option): option is string => typeof option === "string");
      if (options.length < 2) return [];

      return [{
        id: questionRecord.id,
        question: questionRecord.question,
        options,
        correctIndex: questionRecord.correctIndex,
        explanation: typeof questionRecord.explanation === "string" ? questionRecord.explanation : null,
        sourceDoc: typeof questionRecord.sourceDoc === "string" ? questionRecord.sourceDoc : null,
      }];
    });

    if (questions.length === 0) return [];

    return [{
      id: record.id,
      title: record.title,
      topic: record.topic,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : new Date().toISOString(),
      questionCount: typeof record.questionCount === "number" ? record.questionCount : questions.length,
      sourceDocs: Array.isArray(record.sourceDocs)
        ? record.sourceDocs.filter((source): source is string => typeof source === "string")
        : [],
      sourceSignature: typeof record.sourceSignature === "string" ? record.sourceSignature : "",
      questions,
    }];
  });
}

export function loadStoredCourseData(courseId: string): StoredCourseData {
  const map = readCourseDataMap();
  const course = map[courseId];
  if (!course) return createEmptyCourseData();

  return {
    docs: Array.isArray(course.docs)
      ? course.docs.map((doc) => ({
          ...doc,
          used: typeof doc?.used === "boolean" ? doc.used : true,
          storagePath: typeof doc?.storagePath === "string" ? doc.storagePath : null,
          textContent: typeof doc?.textContent === "string" ? doc.textContent : null,
        }))
      : [],
    assignments: Array.isArray(course.assignments) ? course.assignments : [],
    reminders: Array.isArray(course.reminders) ? course.reminders : [],
    insights: course.insights ?? null,
    chatHistory: normalizeChatHistory(course.chatHistory),
    suggestions: normalizeSuggestionState(course.suggestions),
    quizSessions: normalizeQuizSessions(course.quizSessions),
    activeQuizId: typeof course.activeQuizId === "string" ? course.activeQuizId : null,
  };
}

export function saveStoredCourseData(courseId: string, data: StoredCourseData) {
  const map = readCourseDataMap();
  map[courseId] = data;
  writeCourseDataMap(map);
}

export function patchStoredCourseData(courseId: string, patch: Partial<StoredCourseData>) {
  saveStoredCourseData(courseId, {
    ...loadStoredCourseData(courseId),
    ...patch,
  });
}

export function deleteStoredCourseData(courseId: string) {
  const map = readCourseDataMap();
  if (!(courseId in map)) return;
  delete map[courseId];
  writeCourseDataMap(map);
}

export function loadDashboardSuggestionState(): StoredDashboardAiState | null {
  if (typeof localStorage === "undefined") return null;
  const raw = safeParse<StoredDashboardAiState | null>(localStorage.getItem(DASHBOARD_AI_KEY), null);
  if (!raw || typeof raw !== "object" || typeof raw.sourceSignature !== "string") return null;
  const suggestions = normalizeSuggestions(raw.suggestions);
  if (suggestions.length === 0) return null;
  return {
    sourceSignature: raw.sourceSignature,
    generatedAt: typeof raw.generatedAt === "string" ? raw.generatedAt : new Date().toISOString(),
    suggestions,
  };
}

export function saveDashboardSuggestionState(state: StoredDashboardAiState | null) {
  if (typeof localStorage === "undefined") return;
  if (!state) {
    localStorage.removeItem(DASHBOARD_AI_KEY);
    return;
  }
  localStorage.setItem(DASHBOARD_AI_KEY, JSON.stringify(state));
}

export function parseDueString(value: string | null | undefined): Date | null {
  const due = value?.trim();
  if (!due) return null;

  const isoMatch = due.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?$/);
  if (isoMatch) {
    const [, datePart, timePart] = isoMatch;
    const parsed = new Date(`${datePart}T${timePart ?? "00:00"}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const fallback = new Date(due);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

export function formatDueForDisplay(value: string | null | undefined): string {
  const due = value?.trim();
  if (!due) return "";

  const isoMatch = due.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?$/);
  if (!isoMatch) return due;

  const parsed = parseDueString(due);
  if (!parsed) return due;

  const dateLabel = parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (!isoMatch[2]) return dateLabel;

  const timeLabel = parsed.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${dateLabel} · ${timeLabel}`;
}

export function compareDueStrings(a: string | null | undefined, b: string | null | undefined): number {
  const aDate = parseDueString(a);
  const bDate = parseDueString(b);
  if (aDate && bDate) return aDate.getTime() - bDate.getTime();
  if (aDate) return -1;
  if (bDate) return 1;
  return (a ?? "").localeCompare(b ?? "");
}

export function inferAssignmentStatus(
  due: string | null | undefined,
  grade: number | null,
): "upcoming" | "completed" | "overdue" {
  if (grade !== null) return "completed";
  const parsedDue = parseDueString(due);
  if (parsedDue && parsedDue.getTime() < Date.now()) return "overdue";
  return "upcoming";
}

export function computeCourseSummary(assignments: StoredCourseAssignment[]) {
  const graded = assignments.filter((assignment) => assignment.grade !== null);
  const grade = graded.length === 0
    ? "—"
    : (() => {
        const totalWeight = graded.reduce((sum, assignment) => sum + (assignment.weight || 1), 0);
        const percentage = graded.reduce(
          (sum, assignment) => sum + (assignment.grade ?? 0) * (assignment.weight || 1),
          0,
        ) / totalWeight;
        const letter = percentage >= 93 ? "A"
          : percentage >= 90 ? "A-"
          : percentage >= 87 ? "B+"
          : percentage >= 83 ? "B"
          : percentage >= 80 ? "B-"
          : percentage >= 77 ? "C+"
          : percentage >= 73 ? "C"
          : percentage >= 70 ? "C-"
          : percentage >= 67 ? "D+"
          : percentage >= 60 ? "D"
          : "F";
        return `${percentage.toFixed(0)}% ${letter}`;
      })();

  const completedCount = assignments.filter(
    (assignment) => assignment.grade !== null || assignment.status === "completed",
  ).length;
  const progress = assignments.length > 0
    ? Math.round((completedCount / assignments.length) * 100)
    : 0;

  const nextDueAssignment = [...assignments]
    .filter((assignment) => assignment.status !== "completed" && assignment.due)
    .sort((left, right) => compareDueStrings(left.due, right.due))[0];

  return {
    grade,
    progress,
    nextDue: nextDueAssignment ? formatDueForDisplay(nextDueAssignment.due) : "—",
  };
}

export function compressDocumentText(text: string, limit = 12000) {
  const normalized = text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (normalized.length <= limit) return normalized;

  const head = normalized.slice(0, Math.floor(limit * 0.72));
  const tail = normalized.slice(-Math.floor(limit * 0.18));
  return `${head}\n\n[... document truncated ...]\n\n${tail}`;
}

function assignmentReminderText(assignment: StoredCourseAssignment) {
  return `${assignment.label} due`;
}

export function buildAssignmentReminder(
  assignment: StoredCourseAssignment,
): CourseReminderItem | null {
  if (!assignment.due || assignment.status === "completed") return null;
  return {
    id: assignment.id,
    text: assignmentReminderText(assignment),
    due: assignment.due,
    done: false,
    source: "assignment",
  };
}

export function mergeCourseReminders(
  assignments: StoredCourseAssignment[],
  reminders: StoredCourseReminder[],
): CourseReminderItem[] {
  const explicit = reminders.map((reminder) => ({
    ...reminder,
    source: "reminder" as const,
  }));
  const seen = new Set(
    explicit.map((item) => `${item.text.trim().toLowerCase()}|${item.due.trim().toLowerCase()}`),
  );

  const derived = assignments.flatMap((assignment) => {
    const reminder = buildAssignmentReminder(assignment);
    if (!reminder) return [];
    const key = `${reminder.text.trim().toLowerCase()}|${reminder.due.trim().toLowerCase()}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [reminder];
  });

  return [...explicit, ...derived].sort((left, right) => compareDueStrings(left.due, right.due));
}

export function formatDueForTimeline(value: string | null | undefined): string {
  const parsed = parseDueString(value);
  if (!parsed) return value?.trim() || "No due date";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDue = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const dayDiff = Math.round((startOfDue.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));

  const timeLabel = value?.includes(":")
    ? parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : null;

  if (dayDiff === 0) return timeLabel ? `Today · ${timeLabel}` : "Today";
  if (dayDiff === 1) return timeLabel ? `Tomorrow · ${timeLabel}` : "Tomorrow";
  if (dayDiff > 1 && dayDiff <= 7) return timeLabel ? `In ${dayDiff} days · ${timeLabel}` : `In ${dayDiff} days`;
  if (dayDiff === -1) return timeLabel ? `Yesterday · ${timeLabel}` : "Yesterday";

  const dateLabel = parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return timeLabel ? `${dateLabel} · ${timeLabel}` : dateLabel;
}

export function isReminderUrgent(value: string | null | undefined) {
  const parsed = parseDueString(value);
  if (!parsed) return false;
  const diff = parsed.getTime() - Date.now();
  return diff <= 3 * 24 * 60 * 60 * 1000;
}

export function loadCachedCourses(): CachedCourse[] {
  if (typeof localStorage === "undefined") return [];
  return safeParse<CachedCourse[]>(localStorage.getItem(COURSES_KEY), []);
}

export function saveCachedCourses(courses: CachedCourse[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
}

export function updateCachedCourse(
  courseId: string,
  updates: Partial<Pick<CachedCourse, "code" | "name" | "grade" | "progress" | "nextDue">>,
) {
  const courses = loadCachedCourses();
  const nextCourses = courses.map((course) => (
    course.id === courseId
      ? { ...course, ...updates }
      : course
  ));
  saveCachedCourses(nextCourses);
}

export function syncCachedCourseMetrics(courseId: string, assignments: StoredCourseAssignment[]) {
  updateCachedCourse(courseId, computeCourseSummary(assignments));
}
