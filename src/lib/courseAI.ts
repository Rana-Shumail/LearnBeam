import { compressDocumentText } from "./courseData";
import type { StoredStudyTopic } from "./courseData";
import { chatWithSparkAI } from "./sparkAI";

export type GeneratedQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  sourceDoc: string | null;
};

export type GeneratedQuizSession = {
  topic: string;
  questions: GeneratedQuizQuestion[];
  sourceDocs: string[];
};

export type SparkSuggestion = {
  id: string;
  title: string;
  detail: string;
  courseCode: string | null;
  sourceDoc: string | null;
};

type QuizDocInput = {
  name: string;
  textContent: string;
};

type QuizGenerationInput = {
  courseCode: string;
  documents: QuizDocInput[];
  previousTopics?: string[];
  previousQuestionTexts?: string[];
};

type CourseSuggestionInput = {
  courseCode: string;
  courseName?: string | null;
  assignments?: Array<{ label: string; due: string; status: string }>;
  documents: QuizDocInput[];
};

type DashboardSuggestionInput = {
  courseCode: string;
  courseName?: string | null;
  nextDue?: string | null;
  assignments?: Array<{ label: string; due: string; status: string }>;
  documents: QuizDocInput[];
};

type StudyPlannerInsightInput = {
  courseCode: string;
  courseName?: string | null;
  assignments: Array<{ label: string; status: string; grade: number | null }>;
  documents: QuizDocInput[];
  quizAttempts: Array<{ topic: string; correct: number; total: number }>;
};

function extractJsonPayload(response: string) {
  const fenced = response.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = response.indexOf("{");
  const lastBrace = response.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return response.slice(firstBrace, lastBrace + 1);
  }

  throw new Error("Spark AI did not return JSON.");
}

function buildDocumentContext(documents: QuizDocInput[], perDocLimit = 7000) {
  return documents
    .filter((document) => document.textContent.trim().length > 0)
    .map((document) => `Document: ${document.name}\n${compressDocumentText(document.textContent, perDocLimit)}`)
    .join("\n\n---\n\n");
}

function normalizeSuggestions(
  payload: unknown,
  fallbackCourseCode: string | null,
): SparkSuggestion[] {
  const suggestions = Array.isArray((payload as { suggestions?: unknown })?.suggestions)
    ? (payload as { suggestions: unknown[] }).suggestions
    : [];

  const normalized = suggestions.flatMap((suggestion, index) => {
    if (!suggestion || typeof suggestion !== "object") return [];
    const record = suggestion as Record<string, unknown>;
    if (typeof record.title !== "string" || typeof record.detail !== "string") return [];
    const title = record.title.trim();
    const detail = record.detail.trim();
    if (!title || !detail) return [];

    return [{
      id: crypto.randomUUID(),
      title,
      detail,
      courseCode: typeof record.courseCode === "string" && record.courseCode.trim()
        ? record.courseCode.trim()
        : fallbackCourseCode,
      sourceDoc: typeof record.sourceDoc === "string" && record.sourceDoc.trim()
        ? record.sourceDoc.trim()
        : null,
      order: index,
    }];
  });

  if (normalized.length === 0) {
    throw new Error("Spark AI did not return usable suggestions.");
  }

  return normalized
    .sort((left, right) => left.order - right.order)
    .map(({ order: _order, ...suggestion }) => suggestion);
}

function normalizeStudyTopics(payload: unknown, allowedSources: Set<string>): StoredStudyTopic[] {
  const topics = Array.isArray((payload as { topics?: unknown })?.topics)
    ? (payload as { topics: unknown[] }).topics
    : [];
  const seen = new Set<string>();

  return topics.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    if (typeof record.label !== "string" || typeof record.sourceLabel !== "string") return [];
    const label = record.label.replace(/\s+/g, " ").trim();
    const sourceLabel = record.sourceLabel.trim();
    const status = record.status === "covered" || record.status === "uncovered" || record.status === "priority"
      ? record.status
      : null;
    const key = label.toLowerCase();
    if (!label || !status || !allowedSources.has(sourceLabel) || seen.has(key)) return [];
    seen.add(key);
    return [{ label, status, sourceLabel }] as StoredStudyTopic[];
  }).slice(0, 12);
}

export async function generateStudyPlannerTopics(input: StudyPlannerInsightInput): Promise<StoredStudyTopic[]> {
  const readableDocs = input.documents
    .filter(document => document.textContent.trim().length >= 80)
    .slice(0, 4);
  if (readableDocs.length === 0) return [];

  const allowedSources = new Set([
    ...readableDocs.map(document => document.name),
    ...input.assignments.map(assignment => assignment.label),
    ...input.quizAttempts.map(attempt => `Quiz: ${attempt.topic}`),
  ]);
  const assignmentContext = input.assignments.slice(0, 10).map(assignment => (
    `${assignment.label} | status=${assignment.status} | grade=${assignment.grade ?? "not graded"}`
  )).join("\n");
  const quizContext = input.quizAttempts.slice(-8).map(attempt => (
    `Quiz: ${attempt.topic} | score=${attempt.correct}/${attempt.total}`
  )).join("\n");

  const response = await chatWithSparkAI([
    {
      role: "system",
      content: [
        "You identify study topics for LearnBeam's Smart Study Planner.",
        "Use only explicit terminology found in the supplied course documents, assignment labels, and quiz results.",
        "Never invent a topic, definition, deadline, or completion status.",
        "Mark a topic covered only when a related assignment is completed/graded or its quiz score is at least 80 percent.",
        "Mark a topic priority when its related quiz is below 80 percent or an upcoming assignment clearly targets it.",
        "Otherwise mark it uncovered.",
        "sourceLabel must exactly match one supplied document filename, assignment label, or Quiz: topic label.",
        "Return JSON only in this shape: {\"topics\":[{\"label\":string,\"status\":\"covered\"|\"uncovered\"|\"priority\",\"sourceLabel\":string}]}",
        "Return at most 12 concise topics.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Course: ${input.courseCode}${input.courseName ? ` — ${input.courseName}` : ""}`,
        assignmentContext ? `Assignments:\n${assignmentContext}` : null,
        quizContext ? `Quiz results:\n${quizContext}` : null,
        "Course document excerpts:",
        buildDocumentContext(readableDocs, 3500),
      ].filter(Boolean).join("\n\n"),
    },
  ], { task: "study-planner" });

  const topics = normalizeStudyTopics(JSON.parse(extractJsonPayload(response)), allowedSources);
  if (topics.length === 0) throw new Error("Spark did not return source-grounded planner topics.");
  return topics;
}

function normalizeQuizQuestions(payload: unknown): GeneratedQuizQuestion[] {
  const questions = Array.isArray((payload as { questions?: unknown })?.questions)
    ? (payload as { questions: unknown[] }).questions
    : [];

  const normalized = questions.flatMap((question, index) => {
    if (!question || typeof question !== "object") return [];
    const record = question as Record<string, unknown>;
    if (typeof record.question !== "string" || !Array.isArray(record.options) || typeof record.correctIndex !== "number") {
      return [];
    }

    const options = record.options.filter((option): option is string => typeof option === "string");
    if (options.length !== 4) return [];
    if (record.correctIndex < 0 || record.correctIndex > 3) return [];

    return [{
      id: crypto.randomUUID(),
      question: record.question.trim(),
      options,
      correctIndex: record.correctIndex,
      explanation: typeof record.explanation === "string" ? record.explanation.trim() || null : null,
      sourceDoc: typeof record.sourceDoc === "string" ? record.sourceDoc.trim() || null : null,
      order: index,
    }];
  });

  if (normalized.length < 10) {
    throw new Error("Spark AI did not return enough quiz questions.");
  }

  return normalized
    .sort((left, right) => left.order - right.order)
    .map(({ order: _order, ...question }) => question);
}

export async function generateQuizFromDocuments(
  input: QuizGenerationInput,
): Promise<GeneratedQuizSession> {
  const readableDocs = input.documents
    .filter((document) => document.textContent.trim().length > 0)
    .slice(0, 4);

  if (readableDocs.length === 0) {
    throw new Error("I don't have readable document text yet. Upload a text-based PDF, DOCX, or TXT file first.");
  }

  const previousTopics = (input.previousTopics ?? []).filter(Boolean).slice(-8);
  const previousQuestionTexts = (input.previousQuestionTexts ?? []).filter(Boolean).slice(-16);

  const response = await chatWithSparkAI([
    {
      role: "system",
      content: [
        "You create multiple-choice study quizzes for LearnBeam.",
        "CRITICAL: Every question, every answer option, and every explanation MUST be directly traceable to specific text in the provided course documents.",
        "Do NOT add any knowledge, context, definitions, examples, or elaboration that is not explicitly stated in the documents.",
        "If the documents do not cover a topic deeply enough to write 10 questions, use a different topic that IS well-covered.",
        "The correct answer must be provably correct from the document text alone — no inference or outside knowledge.",
        "The explanation field must quote or directly reference language from the source document.",
        "Return JSON only.",
        "Create exactly 10 questions with four options each.",
        "Pick one focused topic for this quiz and return it.",
        "Avoid repeating earlier quiz topics or earlier question wording when possible.",
        "The JSON shape must be: {\"topic\":string,\"questions\":[{\"question\":string,\"options\":[string,string,string,string],\"correctIndex\":number,\"explanation\":string|null,\"sourceDoc\":string|null}]}",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Create a quiz for ${input.courseCode}.`,
        previousTopics.length > 0 ? `Avoid these prior quiz topics: ${previousTopics.join("; ")}` : null,
        previousQuestionTexts.length > 0 ? `Avoid reusing these earlier question ideas: ${previousQuestionTexts.join(" || ")}` : null,
        "Use only the uploaded documents below.",
        buildDocumentContext(readableDocs),
      ].filter(Boolean).join("\n\n"),
    },
  ], { task: "quiz" });

  const payload = JSON.parse(extractJsonPayload(response)) as {
    topic?: unknown;
    questions?: unknown;
  };

  const topic = typeof payload.topic === "string" && payload.topic.trim()
    ? payload.topic.trim()
    : "Mixed Review";

  return {
    topic,
    questions: normalizeQuizQuestions(payload),
    sourceDocs: readableDocs.map((document) => document.name),
  };
}

export async function generateCourseSuggestions(
  input: CourseSuggestionInput,
): Promise<SparkSuggestion[]> {
  const readableDocs = input.documents
    .filter((document) => document.textContent.trim().length > 0)
    .slice(0, 4);

  if (readableDocs.length === 0) {
    throw new Error("I need readable document text before I can generate course suggestions.");
  }

  const assignmentSummary = (input.assignments ?? [])
    .slice(0, 8)
    .map((assignment) => `${assignment.label}${assignment.due ? ` · due ${assignment.due}` : ""} · ${assignment.status}`)
    .join("; ");

  const response = await chatWithSparkAI([
    {
      role: "system",
      content: [
        "You are Spark inside LearnBeam.",
        "Create three concise study suggestions for one course.",
        "Use only the provided course context and document text.",
        "Make each suggestion actionable and specific.",
        "Return JSON only.",
        "The JSON shape must be: {\"suggestions\":[{\"title\":string,\"detail\":string,\"courseCode\":string|null,\"sourceDoc\":string|null}]}",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        `Course code: ${input.courseCode}`,
        input.courseName ? `Course name: ${input.courseName}` : null,
        assignmentSummary ? `Upcoming work: ${assignmentSummary}` : null,
        "Document excerpts:",
        buildDocumentContext(readableDocs, 5000),
      ].filter(Boolean).join("\n\n"),
    },
  ], { task: "course-suggestions" });

  return normalizeSuggestions(
    JSON.parse(extractJsonPayload(response)),
    input.courseCode,
  );
}

export async function generateDashboardSuggestions(
  courses: DashboardSuggestionInput[],
): Promise<SparkSuggestion[]> {
  const readableCourses = courses
    .map((course) => ({
      ...course,
      documents: course.documents
        .filter((document) => document.textContent.trim().length > 0)
        .slice(0, 3),
    }))
    .filter((course) => course.documents.length > 0)
    .slice(0, 4);

  if (readableCourses.length === 0) {
    throw new Error("I need readable course documents before I can generate dashboard suggestions.");
  }

  const context = readableCourses
    .map((course) => {
      const assignmentSummary = (course.assignments ?? [])
        .slice(0, 5)
        .map((assignment) => `${assignment.label}${assignment.due ? ` · due ${assignment.due}` : ""} · ${assignment.status}`)
        .join("; ");

      return [
        `Course: ${course.courseCode}${course.courseName ? ` — ${course.courseName}` : ""}`,
        course.nextDue ? `Next due: ${course.nextDue}` : null,
        assignmentSummary ? `Assignments: ${assignmentSummary}` : null,
        "Documents:",
        buildDocumentContext(course.documents, 3200),
      ].filter(Boolean).join("\n");
    })
    .join("\n\n====\n\n");

  const response = await chatWithSparkAI([
    {
      role: "system",
      content: [
        "You are Spark inside LearnBeam.",
        "Create three concise dashboard suggestions across the user's courses.",
        "Use only the provided course context and document text.",
        "Prioritize the most useful next actions.",
        "Return JSON only.",
        "The JSON shape must be: {\"suggestions\":[{\"title\":string,\"detail\":string,\"courseCode\":string|null,\"sourceDoc\":string|null}]}",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        "Generate dashboard suggestions from these course materials.",
        context,
      ].join("\n\n"),
    },
  ], { task: "dashboard-suggestions" });

  return normalizeSuggestions(
    JSON.parse(extractJsonPayload(response)),
    null,
  );
}
