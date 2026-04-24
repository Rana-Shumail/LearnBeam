import { SUPABASE_CONFIGURED } from "./supabase";
import {
  updateCourse,
  uploadDocument,
  upsertAssignment,
  upsertReminder,
  upsertCourseInsights,
  updateDocumentTextContent,
} from "./db";
import {
  patchStoredCourseData,
  syncCachedCourseMetrics,
  updateCachedCourse,
  type StoredCourseAssignment,
  type StoredCourseDoc,
  type StoredCourseReminder,
} from "./courseData";
import {
  analyzeSyllabusFile,
  analyzeSyllabusText,
  mergeImportedAssignments,
  mergeImportedReminders,
} from "./syllabus";
import { hydrateStoredDocumentFile, hydrateStoredDocumentText } from "./documentText";

type ImportProgress = {
  title: string;
  detail: string;
};

type ImportOptions = {
  courseId: string;
  courseCode: string;
  courseName: string;
  file: File;
  existingAssignments: StoredCourseAssignment[];
  existingReminders: StoredCourseReminder[];
  existingDocs: StoredCourseDoc[];
  onProgress?: (progress: ImportProgress) => void;
};

export type ImportResult = {
  docs: StoredCourseDoc[];
  assignments: StoredCourseAssignment[];
  reminders: StoredCourseReminder[];
  insights: NonNullable<ReturnType<typeof analyzeSyllabusFile> extends Promise<infer T> ? T["insights"] : never>;
  resolvedCourseName: string;
};

function asStoredDoc(file: File, overrides?: Partial<StoredCourseDoc>): StoredCourseDoc {
  return {
    id: overrides?.id ?? `temp-${Date.now()}`,
    name: overrides?.name ?? file.name,
    type: overrides?.type ?? "syllabus",
    size: overrides?.size ?? `${(file.size / 1024).toFixed(0)} KB`,
    uploadedAt: overrides?.uploadedAt ?? new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    used: overrides?.used ?? true,
    storagePath: overrides?.storagePath ?? null,
    textContent: overrides?.textContent ?? null,
  };
}

function mergeDocs(existing: StoredCourseDoc[], nextDoc: StoredCourseDoc) {
  return [...existing.filter((doc) => doc.id !== nextDoc.id), nextDoc];
}

export async function importSyllabusIntoCourse(options: ImportOptions): Promise<ImportResult> {
  const {
    courseId,
    courseCode,
    courseName,
    file,
    existingAssignments,
    existingReminders,
    existingDocs,
    onProgress,
  } = options;

  onProgress?.({
    title: "Uploading syllabus",
    detail: "Saving the file before Spark starts reading it.",
  });

  let storedDoc = asStoredDoc(file);
  if (SUPABASE_CONFIGURED) {
    const uploaded = await uploadDocument(file, courseId, "syllabus");
    if (!uploaded) {
      throw new Error("The syllabus uploaded failed before analysis could start.");
    }

    storedDoc = asStoredDoc(file, {
      id: uploaded.id,
      name: uploaded.name,
      type: uploaded.type,
      size: uploaded.size ?? `${(file.size / 1024).toFixed(0)} KB`,
      uploadedAt: new Date(uploaded.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      storagePath: uploaded.storage_path,
    });
  }

  const docs = mergeDocs(existingDocs, storedDoc);
  patchStoredCourseData(courseId, { docs });

  onProgress?.({
    title: "Reading syllabus",
    detail: "Extracting readable text from the uploaded file.",
  });

  const analysis = await analyzeSyllabusFile(file, {
    courseCode,
    courseName,
    sourceFileName: file.name,
  }, {
    onExtractedText: () => {
      onProgress?.({
        title: "Examining with Spark",
        detail: "Spark finished reading the file and is now extracting course details and deadlines.",
      });
    },
  });

  storedDoc = {
    ...storedDoc,
    textContent: analysis.extractedText,
  };

  const assignments = mergeImportedAssignments(existingAssignments, analysis.assignments);
  const reminders = mergeImportedReminders(existingReminders, analysis.reminders);
  const resolvedCourseName = analysis.insights.courseName || courseName;
  const docsWithText = mergeDocs(existingDocs, storedDoc);

  patchStoredCourseData(courseId, {
    docs: docsWithText,
    assignments,
    reminders,
    insights: analysis.insights,
  });

  if (SUPABASE_CONFIGURED) {
    onProgress?.({
      title: "Filling the course",
      detail: "Writing the extracted assignments and reminders into LearnBeam.",
    });

    if (resolvedCourseName && resolvedCourseName !== courseName) {
      await updateCourse(courseId, { name: resolvedCourseName });
    }

    await Promise.all([
      ...assignments.map((assignment) => upsertAssignment({
        id: assignment.id,
        course_id: courseId,
        label: assignment.label,
        type: assignment.type,
        due: assignment.due || null,
        weight: assignment.weight,
        grade: assignment.grade,
        status: assignment.status,
      })),
      ...reminders.map((reminder) => upsertReminder({
        id: reminder.id,
        course_id: courseId,
        text: reminder.text,
        due: reminder.due || null,
        done: reminder.done,
      })),
      // Persist syllabus insights so they never need re-scanning across sessions/devices.
      upsertCourseInsights(courseId, analysis.insights),
      // Persist extracted text so the file never needs to be re-downloaded from Storage.
      ...(analysis.extractedText && storedDoc.id && !storedDoc.id.startsWith("temp-")
        ? [updateDocumentTextContent(storedDoc.id, analysis.extractedText)]
        : []),
    ]);
  }

  syncCachedCourseMetrics(courseId, assignments);
  if (resolvedCourseName) {
    updateCachedCourse(courseId, { name: resolvedCourseName });
  }

  onProgress?.({
    title: "Done",
    detail: "The syllabus has been processed and the course is filled in.",
  });

  return {
    docs: docsWithText,
    assignments,
    reminders,
    insights: analysis.insights,
    resolvedCourseName,
  };
}

/* ──────────────────────────────────────────────────────────
   Re-scan an already-uploaded syllabus doc from stored text
─────────────────────────────────────────────────────────── */
type RescanOptions = {
  courseId: string;
  courseCode: string;
  courseName: string;
  doc: StoredCourseDoc;
  existingAssignments: StoredCourseAssignment[];
  existingReminders: StoredCourseReminder[];
  existingDocs: StoredCourseDoc[];
  onProgress?: (progress: ImportProgress) => void;
};

export async function rescanSyllabusDoc(options: RescanOptions): Promise<ImportResult> {
  const {
    courseId, courseCode, courseName, doc,
    existingAssignments, existingReminders, existingDocs,
    onProgress,
  } = options;

  onProgress?.({ title: "Reading syllabus", detail: "Fetching document text for re-analysis." });

  let text = doc.textContent ?? "";
  let analysis: Awaited<ReturnType<typeof analyzeSyllabusFile>> | null = null;

  if (doc.storagePath) {
    onProgress?.({ title: "Fetching document", detail: "Downloading the original syllabus for a full re-scan." });
    const file = await hydrateStoredDocumentFile(doc);
    if (file) {
      onProgress?.({
        title: "Examining with Spark",
        detail: "Spark is re-reading the stored syllabus, including visual tables and scanned sections.",
      });
      analysis = await analyzeSyllabusFile(file, {
        courseCode,
        courseName,
        sourceFileName: doc.name,
      }, {
        onExtractedText: () => {
          onProgress?.({
            title: "Examining with Spark",
            detail: "Spark finished extracting the stored syllabus and is now updating your course details.",
          });
        },
      });
      text = analysis.extractedText || text;
    }
  }

  if (!analysis) {
    if (!text && doc.storagePath) {
      onProgress?.({ title: "Reading syllabus", detail: "Falling back to cached text because the original file could not be downloaded." });
      text = await hydrateStoredDocumentText(doc);
    }

    onProgress?.({
      title: "Examining with Spark",
      detail: "Spark is re-reading every table, schedule, and grading row in your syllabus.",
    });

    analysis = await analyzeSyllabusText(text, {
      courseCode,
      courseName,
      sourceFileName: doc.name,
    });
  }

  // Update the doc with fresh text
  const updatedDoc: StoredCourseDoc = { ...doc, textContent: analysis.extractedText || text };
  const docsWithText = mergeDocs(existingDocs, updatedDoc);

  const assignments = mergeImportedAssignments(existingAssignments, analysis.assignments);
  const reminders = mergeImportedReminders(existingReminders, analysis.reminders);
  const resolvedCourseName = analysis.insights.courseName || courseName;

  patchStoredCourseData(courseId, {
    docs: docsWithText,
    assignments,
    reminders,
    insights: analysis.insights,
  });

  if (SUPABASE_CONFIGURED) {
    onProgress?.({ title: "Saving to LearnBeam", detail: "Writing assignments, reminders, and course insights." });

    if (resolvedCourseName && resolvedCourseName !== courseName) {
      await updateCourse(courseId, { name: resolvedCourseName });
    }

    const freshText = analysis.extractedText || text;
    await Promise.all([
      ...assignments.map((a) => upsertAssignment({
        id: a.id, course_id: courseId, label: a.label, type: a.type,
        due: a.due || null, weight: a.weight, grade: a.grade, status: a.status,
      })),
      ...reminders.map((r) => upsertReminder({
        id: r.id, course_id: courseId, text: r.text, due: r.due || null, done: r.done,
      })),
      // Persist insights so re-scanning is never needed again.
      upsertCourseInsights(courseId, analysis.insights),
      // Persist the refreshed text content.
      ...(freshText && doc.id && !doc.id.startsWith("temp-")
        ? [updateDocumentTextContent(doc.id, freshText)]
        : []),
    ]);
  }

  syncCachedCourseMetrics(courseId, assignments);
  if (resolvedCourseName) updateCachedCourse(courseId, { name: resolvedCourseName });

  return {
    docs: docsWithText,
    assignments,
    reminders,
    insights: analysis.insights,
    resolvedCourseName,
  };
}
