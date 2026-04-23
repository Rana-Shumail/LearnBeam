/**
 * LearnBeam – database helpers
 * All functions are thin wrappers around Supabase queries with
 * RLS enforcing user-level data isolation server-side.
 */
import { supabase } from "./supabase";
import type { StoredCourseInsights } from "./courseData";

/* ── Types ────────────────────────────────────────── */
export type DbCourse = {
  id: string;
  user_id: string;
  code: string;
  name: string | null;
  color: string;
  created_at: string;
};

export type DbAssignment = {
  id: string;
  course_id: string;
  user_id: string;
  label: string;
  type: string;
  due: string | null;
  weight: number;
  grade: number | null;
  status: "upcoming" | "completed" | "overdue";
  created_at: string;
};

export type DbDocument = {
  id: string;
  course_id: string;
  user_id: string;
  name: string;
  type: "syllabus" | "notes" | "reading" | "past-exam" | "other";
  size: string | null;
  storage_path: string | null;
  uploaded_at: string;
  text_content?: string | null;
};

/* ── Fact-check report shape (mirrors FactCheckReport in factCheck.ts) ── */
export type DbFactCheckClaim = {
  claim: string;
  verdict: string;
  explanation: string;
  citation?: string;
};

export type DbFactCheckReportData = {
  docName: string;
  summary: string;
  claims: DbFactCheckClaim[];
};

export type DbReminder = {
  id: string;
  course_id: string;
  user_id: string;
  text: string;
  due: string | null;
  done: boolean;
  created_at: string;
};

/* ── Courses ──────────────────────────────────────── */
export async function fetchCourses(): Promise<DbCourse[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) { console.error("fetchCourses:", error.message); return []; }
  return data ?? [];
}

export async function insertCourse(
  code: string, name: string | null, color: string
): Promise<DbCourse | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("courses")
    .insert({ user_id: user.id, code, name, color })
    .select()
    .single();
  if (error) { console.error("insertCourse:", error.message); return null; }
  return data;
}

export async function deleteCourse(id: string): Promise<boolean> {
  const docs = await fetchDocuments(id);
  const storagePaths = docs
    .map((doc) => doc.storage_path)
    .filter((path): path is string => Boolean(path));

  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove(storagePaths);
    if (storageError) {
      console.error("deleteCourse storage:", storageError.message);
      return false;
    }
  }

  const { error } = await supabase.from("courses").delete().eq("id", id);
  if (error) { console.error("deleteCourse:", error.message); return false; }
  return true;
}

export async function updateCourse(
  id: string,
  fields: Partial<Pick<DbCourse, "code" | "name" | "color">>,
): Promise<DbCourse | null> {
  const { data, error } = await supabase
    .from("courses")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) { console.error("updateCourse:", error.message); return null; }
  return data;
}

/* ── Assignments ──────────────────────────────────── */
export async function fetchAssignments(courseId: string): Promise<DbAssignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });
  if (error) { console.error("fetchAssignments:", error.message); return []; }
  return data ?? [];
}

export async function upsertAssignment(
  a: Omit<DbAssignment, "user_id" | "created_at">
): Promise<DbAssignment | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("assignments")
    .upsert({ ...a, user_id: user.id })
    .select()
    .single();
  if (error) { console.error("upsertAssignment:", error.message); return null; }
  return data;
}

export async function deleteAssignment(id: string): Promise<boolean> {
  const { error } = await supabase.from("assignments").delete().eq("id", id);
  if (error) { console.error("deleteAssignment:", error.message); return false; }
  return true;
}

/* ── Documents ────────────────────────────────────── */
export async function fetchDocuments(courseId: string): Promise<DbDocument[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("course_id", courseId)
    .order("uploaded_at", { ascending: false });
  if (error) { console.error("fetchDocuments:", error.message); return []; }
  return data ?? [];
}

/**
 * Upload a file to Supabase Storage and record its metadata.
 * Files are stored at: documents/{user_id}/{course_id}/{filename}
 */
export async function uploadDocument(
  file: File,
  courseId: string,
  docType: DbDocument["type"] = "other"
): Promise<DbDocument | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const ext   = file.name.split(".").pop() ?? "bin";
  const path  = `${user.id}/${courseId}/${Date.now()}.${ext}`;
  const sizeKB = (file.size / 1024).toFixed(0);
  const size   = file.size > 1024 * 1024
    ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
    : `${sizeKB} KB`;

  // Upload to storage
  const { error: storageErr } = await supabase.storage
    .from("documents")
    .upload(path, file, { cacheControl: "3600", upsert: false });

  if (storageErr) {
    console.error("uploadDocument storage:", storageErr.message);
    return null;
  }

  // Insert metadata row
  const { data, error } = await supabase
    .from("documents")
    .insert({
      course_id: courseId,
      user_id: user.id,
      name: file.name,
      type: docType,
      size,
      storage_path: path,
    })
    .select()
    .single();

  if (error) { console.error("uploadDocument metadata:", error.message); return null; }
  return data;
}

export async function deleteDocument(doc: DbDocument): Promise<boolean> {
  if (doc.storage_path) {
    await supabase.storage.from("documents").remove([doc.storage_path]);
  }
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) { console.error("deleteDocument:", error.message); return false; }
  return true;
}

/** Get a temporary public URL (1 hour) for a stored file. */
export async function getDocumentUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from("documents")
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}

/* ── Reminders ────────────────────────────────────── */
export async function fetchReminders(courseId: string): Promise<DbReminder[]> {
  const { data, error } = await supabase
    .from("reminders")
    .select("*")
    .eq("course_id", courseId)
    .order("due", { ascending: true });
  if (error) { console.error("fetchReminders:", error.message); return []; }
  return data ?? [];
}

export async function upsertReminder(
  r: Omit<DbReminder, "user_id" | "created_at">
): Promise<DbReminder | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("reminders")
    .upsert({ ...r, user_id: user.id })
    .select()
    .single();
  if (error) { console.error("upsertReminder:", error.message); return null; }
  return data;
}

export async function deleteReminder(id: string): Promise<boolean> {
  const { error } = await supabase.from("reminders").delete().eq("id", id);
  if (error) { console.error("deleteReminder:", error.message); return false; }
  return true;
}

/* ── Course insights ──────────────────────────────── */
export async function fetchCourseInsights(courseId: string): Promise<StoredCourseInsights | null> {
  const { data, error } = await supabase
    .from("course_insights")
    .select("*")
    .eq("course_id", courseId)
    .single();
  if (error || !data) return null;
  return {
    courseCode:      data.course_code      ?? null,
    courseName:      data.course_name      ?? null,
    instructor:      data.instructor       ?? null,
    term:            data.term             ?? null,
    meetingSchedule: data.meeting_schedule ?? null,
    location:        data.location         ?? null,
    summary:         data.summary          ?? null,
    gradingPolicy:   Array.isArray(data.grading_policy) ? data.grading_policy : [],
    warnings:        Array.isArray(data.warnings)       ? data.warnings       : [],
    sourceFileName:  data.source_file_name ?? "",
    analyzedAt:      data.analyzed_at      ?? new Date().toISOString(),
  };
}

export async function upsertCourseInsights(courseId: string, insights: StoredCourseInsights): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("course_insights")
    .upsert({
      course_id:        courseId,
      user_id:          user.id,
      course_code:      insights.courseCode,
      course_name:      insights.courseName,
      instructor:       insights.instructor,
      term:             insights.term,
      meeting_schedule: insights.meetingSchedule,
      location:         insights.location,
      summary:          insights.summary,
      grading_policy:   insights.gradingPolicy,
      warnings:         insights.warnings,
      source_file_name: insights.sourceFileName,
      analyzed_at:      insights.analyzedAt,
      updated_at:       new Date().toISOString(),
    }, { onConflict: "course_id" });
  if (error) console.error("upsertCourseInsights:", error.message);
}

/* ── Document text content ────────────────────────── */
export async function updateDocumentTextContent(documentId: string, textContent: string): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .update({ text_content: textContent })
    .eq("id", documentId);
  if (error) console.error("updateDocumentTextContent:", error.message);
}

/* ── Fact-check reports ───────────────────────────── */
export async function fetchFactCheckReport(documentId: string): Promise<DbFactCheckReportData | null> {
  const { data, error } = await supabase
    .from("fact_check_reports")
    .select("doc_name, summary, claims")
    .eq("document_id", documentId)
    .single();
  if (error || !data) return null;
  return {
    docName: data.doc_name,
    summary: typeof data.summary === "string" ? data.summary : "",
    claims:  Array.isArray(data.claims) ? data.claims as DbFactCheckClaim[] : [],
  };
}

export async function fetchFactCheckReports(documentIds: string[]): Promise<Array<{
  documentId: string;
  report: DbFactCheckReportData;
}>> {
  if (documentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("fact_check_reports")
    .select("document_id, doc_name, summary, claims")
    .in("document_id", documentIds);
  if (error || !data) return [];
  return data.flatMap((row) => {
    if (typeof row.document_id !== "string") return [];
    return [{
      documentId: row.document_id,
      report: {
        docName: typeof row.doc_name === "string" ? row.doc_name : "",
        summary: typeof row.summary === "string" ? row.summary : "",
        claims: Array.isArray(row.claims) ? row.claims as DbFactCheckClaim[] : [],
      },
    }];
  });
}

export async function upsertFactCheckReport(
  documentId: string,
  report: DbFactCheckReportData,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("fact_check_reports")
    .upsert({
      document_id:  documentId,
      user_id:      user.id,
      doc_name:     report.docName,
      summary:      report.summary,
      claims:       report.claims,
      generated_at: new Date().toISOString(),
    }, { onConflict: "document_id" });
  if (error) console.error("upsertFactCheckReport:", error.message);
}
