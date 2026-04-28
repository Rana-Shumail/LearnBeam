import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import {
  Bell, Brain, ChevronLeft, HelpCircle, Maximize2,
  Minimize2, User, X,
} from "lucide-react";
import { SparkLogo } from "./SparkLogo";
import learnBeamLogo from "../../assets/861bd4bcf410ca26cefb8d6a2c416c8933fab508.png";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useIsMobile } from "./ui/use-mobile";
import { loadCourses, type Course } from "./Dashboard";
import { SUPABASE_CONFIGURED, getAvatarCache, subscribeToAvatar } from "../../lib/supabase";
import { streamWithSparkAI, SPARK_FUNCTION_NAME } from "../../lib/sparkAI";
import {
  buildAssignmentReminder, isReminderUrgent,
  loadStoredCourseData, mergeCourseReminders, compressDocumentText,
  patchStoredCourseData, syncCachedCourseMetrics,
  type StoredCourseInsights, type StoredSuggestionState,
} from "../../lib/courseData";
import { importSyllabusIntoCourse, rescanSyllabusDoc } from "../../lib/courseImport";
import { generateCourseSuggestions, type SparkSuggestion } from "../../lib/courseAI";
import { hasReadableDocumentText, hydrateStoredDocumentText, isBinaryGarbage } from "../../lib/documentText";
import { extractDocumentText } from "../../lib/syllabus";
import { factCheckDocument } from "../../lib/factCheck";
import {
  fetchAssignments, uploadDocument,
  fetchDocuments, fetchReminders, upsertReminder,
  deleteReminder as dbDeleteReminder,
  fetchCourseInsights, updateDocumentTextContent, upsertCourseInsights,
} from "../../lib/db";

// Sub-components
import { OverviewTab }               from "./course/OverviewTab";
import { AssignmentsTab, GradesTab } from "./course/AssignmentsTab";
import { DocsTab, RemindersTab }     from "./course/DocsTab";
import { ActivitiesTab, FocusMode }  from "./course/ActivitiesTab";
import { SparkChat }                 from "./course/SparkChat";
import {
  F, TABS, HelpPanel, CourseRemindersPanel,
  createChatMessage, createDefaultSparkMessages,
  type TabId, type Doc, type Assignment, type SyllabusImportState, type ChatMsg,
} from "./course/types.tsx";

/* ─────────────────────────────────────────────────────
   MAIN COURSE PAGE
───────────────────────────────────────────────────── */
export function CoursePage() {
  const isMobile = useIsMobile();
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();

  const storedCourseData = id ? loadStoredCourseData(id) : {
    docs: [], assignments: [], reminders: [], insights: null,
    chatHistory: [], suggestions: null, quizSessions: [], activeQuizId: null,
  };
  const allCourses: Course[] = loadCourses();
  const course               = allCourses.find(c => c.id === id);
  const courseColor          = course?.color ?? "#66B539";
  const courseCode           = course?.code  ?? `Course ${id}`;
  const initialCourseName    = course?.name  ?? storedCourseData.insights?.courseName ?? "";

  // ── State ──
  const [avatarUrl, setAvatarUrl]         = useState<string | null>(() => getAvatarCache());
  const [activeTab, setActiveTab]         = useState<TabId>("overview");
  const [helpOpen, setHelpOpen]           = useState(false);
  const [chatOpen, setChatOpen]           = useState(false);
  const [chatMaximized, setChatMaximized] = useState(false);
  const [sparkAnim, setSparkAnim]         = useState<"idle" | "activating" | "active" | "deactivating">("idle");
  const [expandingToMax, setExpandingToMax] = useState(false);
  const [aiInput, setAiInput]             = useState("");
  const [docs, setDocs]                   = useState<Doc[]>([]);
  const [assignments, setAssignments]     = useState<Assignment[]>([]);
  const [reminders, setReminders]         = useState<{ id: string; text: string; due: string; done: boolean }[]>([]);
  const [dataLoading, setDataLoading]     = useState(true);
  const [documentTextSyncing, setDocumentTextSyncing] = useState(false);
  const [aiLoading, setAiLoading]         = useState(false);
  const [sparkSuggestions, setSparkSuggestions]       = useState<SparkSuggestion[]>(storedCourseData.suggestions?.suggestions ?? []);
  const [courseSuggestionCache, setCourseSuggestionCache] = useState<StoredSuggestionState | null>(storedCourseData.suggestions);
  const [suggestionsLoading, setSuggestionsLoading]   = useState(false);
  const [suggestionsError, setSuggestionsError]       = useState<string | null>(null);
  const [courseReady, setCourseReady]     = useState(false);
  const [syllabusInsights, setSyllabusInsights]       = useState<StoredCourseInsights | null>(storedCourseData.insights);
  const [syllabusImportState, setSyllabusImportState] = useState<SyllabusImportState>({
    active: false, title: "Examining syllabus", detail: "", error: null, success: null,
  });
  const [focusMode, setFocusMode]         = useState(false);
  const [bellOpen, setBellOpen]           = useState(false);
  const [sparkMode, setSparkMode]         = useState<"course" | "global">("course");
  const bellRef                           = useRef<HTMLDivElement>(null);
  const [messages, setMessages]           = useState<ChatMsg[]>(
    storedCourseData.chatHistory.length > 0 ? storedCourseData.chatHistory : createDefaultSparkMessages(),
  );

  const courseName = syllabusInsights?.courseName ?? initialCourseName;

  // ── Load data from Supabase or localStorage ──
  useEffect(() => {
    if (!id) return;
    setCourseReady(false);
    setSuggestionsError(null);
    const stored = loadStoredCourseData(id);
    setSyllabusInsights(stored.insights);
    setMessages(stored.chatHistory.length > 0 ? stored.chatHistory : createDefaultSparkMessages());
    setSparkSuggestions(stored.suggestions?.suggestions ?? []);
    setCourseSuggestionCache(stored.suggestions);

    if (!SUPABASE_CONFIGURED) {
      setAssignments(stored.assignments);
      setDocs(stored.docs);
      setReminders(stored.reminders);
      setDataLoading(false);
      setCourseReady(true);
      return;
    }

    let cancelled = false;
    async function load() {
      setDataLoading(true);
      const [dbAssignments, dbDocs, dbReminders, dbInsights] = await Promise.all([
        fetchAssignments(id!), fetchDocuments(id!), fetchReminders(id!),
        fetchCourseInsights(id!),
      ]);
      if (cancelled) return;
      const byId   = new Map(stored.docs.map(d => [d.id, d]));
      const byPath = new Map(stored.docs.map(d => [d.storagePath ?? `name:${d.name}`, d]));
      setAssignments(dbAssignments.map(a => ({ id: a.id, label: a.label, type: a.type, due: a.due ?? "", weight: a.weight, grade: a.grade, status: a.status })));
      setDocs(dbDocs.map(d => ({
        id: d.id, name: d.name, type: d.type, size: d.size ?? "",
        uploadedAt: new Date(d.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        used: byId.get(d.id)?.used ?? byPath.get(d.storage_path ?? `name:${d.name}`)?.used ?? true,
        storagePath: d.storage_path,
        // Prefer DB text_content (persisted), then fall back to localStorage cache.
        textContent: d.text_content
          ?? byId.get(d.id)?.textContent
          ?? byPath.get(d.storage_path ?? `name:${d.name}`)?.textContent
          ?? null,
      })));
      setReminders(dbReminders.map(r => ({ id: r.id, text: r.text, due: r.due ?? "", done: r.done })));
      // DB insights take precedence; fall back to localStorage if not yet persisted.
      if (dbInsights) setSyllabusInsights(dbInsights);
      if (!dbInsights && stored.insights) {
        void upsertCourseInsights(id!, stored.insights).catch(() => {});
      }
      for (const dbDoc of dbDocs) {
        if (dbDoc.text_content) continue;
        const cachedText = byId.get(dbDoc.id)?.textContent ?? byPath.get(dbDoc.storage_path ?? `name:${dbDoc.name}`)?.textContent ?? null;
        if (cachedText) {
          void updateDocumentTextContent(dbDoc.id, cachedText).catch(() => {});
        }
      }
      setDataLoading(false);
      setCourseReady(true);
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  // ── Persist to localStorage ──
  useEffect(() => {
    if (!id || !courseReady || dataLoading) return;
    patchStoredCourseData(id, { docs, assignments, reminders, insights: syllabusInsights, chatHistory: messages, suggestions: courseSuggestionCache });
    syncCachedCourseMetrics(id, assignments);
  }, [id, docs, assignments, reminders, syllabusInsights, messages, courseSuggestionCache, courseReady, dataLoading]);

  // ── Hydrate document text from Supabase Storage ──
  useEffect(() => {
    if (!id || !SUPABASE_CONFIGURED || !courseReady || dataLoading) return;
    // Also re-hydrate docs whose textContent was cached as raw binary garbage
    // (e.g. PPTX/XLSX files uploaded before proper parsers were wired in).
    const pending = docs.filter(d => (d.textContent === null || isBinaryGarbage(d.textContent ?? "")) && d.storagePath);
    if (pending.length === 0) { setDocumentTextSyncing(false); return; }
    let cancelled = false;
    setDocumentTextSyncing(true);
    async function hydrate() {
      for (const doc of pending) {
        const textContent = await hydrateStoredDocumentText(doc);
        if (cancelled) return;
        setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, textContent } : d));
        if (textContent && !doc.id.startsWith("temp-")) {
          void updateDocumentTextContent(doc.id, textContent).catch(() => {});
        }
      }
      if (!cancelled) setDocumentTextSyncing(false);
    }
    void hydrate();
    return () => { cancelled = true; };
  }, [id, courseReady, dataLoading, docs]);

  // ── Generate Spark suggestions ──
  useEffect(() => {
    if (!courseReady || dataLoading) return;
    if (courseSuggestionCache?.suggestions.length) setSparkSuggestions(courseSuggestionCache.suggestions);
    const readableDocs = docs
      .filter(d => d.used && hasReadableDocumentText(d.textContent))
      .slice(0, 4)
      .map(d => ({ name: d.name, textContent: d.textContent ?? "" }));
    if (docs.length === 0 || readableDocs.length === 0) {
      if (!courseSuggestionCache?.suggestions.length) setSparkSuggestions([]);
      setSuggestionsError(null); setSuggestionsLoading(false); return;
    }
    const sig = [
      courseCode, courseName,
      assignments.filter(a => a.status !== "completed").slice(0, 8).map(a => `${a.id}|${a.label}|${a.due}|${a.status}`).join("~"),
      readableDocs.map(d => `${d.name}|${d.textContent.length}|${d.textContent.slice(0, 120)}`).join("~"),
    ].join("####");
    if (courseSuggestionCache?.sourceSignature === sig && courseSuggestionCache.suggestions.length > 0) { setSuggestionsLoading(false); return; }
    let cancelled = false;
    setSuggestionsLoading(true); setSuggestionsError(null);
    async function loadSuggestions() {
      try {
        const next = await generateCourseSuggestions({
          courseCode, courseName,
          assignments: assignments.filter(a => a.status !== "completed").slice(0, 6).map(a => ({ label: a.label, due: a.due, status: a.status })),
          documents: readableDocs,
        });
        const generatedAt = new Date().toISOString();
        const cache: StoredSuggestionState = { sourceSignature: sig, generatedAt, suggestions: next.map(s => ({ ...s, generatedAt })) };
        if (!cancelled) { setCourseSuggestionCache(cache); setSparkSuggestions(cache.suggestions); }
      } catch (e) {
        if (!cancelled) setSuggestionsError(e instanceof Error ? e.message : "Spark could not generate course suggestions.");
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    }
    void loadSuggestions();
    return () => { cancelled = true; };
  }, [courseCode, courseName, docs, assignments, courseReady, dataLoading, courseSuggestionCache]);

  // ── Avatar live sync ──
  useEffect(() => subscribeToAvatar(setAvatarUrl), []);

  // ── Bell outside-click ──
  useEffect(() => {
    function handle(e: MouseEvent) { if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false); }
    if (bellOpen) document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [bellOpen]);

  // ── Spark toggle animation ──
  const toggleSpark = () => {
    if (!chatOpen) {
      setSparkAnim("activating");
      setTimeout(() => setSparkAnim("active"), 420);
      setChatOpen(true);
      if (chatMaximized) setChatMaximized(false);
    } else {
      setSparkAnim("deactivating");
      setTimeout(() => setSparkAnim("idle"), 300);
      setChatOpen(false); setChatMaximized(false);
    }
  };

  const handleExpand = () => {
    setExpandingToMax(true);
    setTimeout(() => { setExpandingToMax(false); setChatMaximized(true); }, 240);
  };

  const tokenizeForSourceMatch = (value: string) => (
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 3 && ![
        "what", "when", "where", "which", "with", "from", "this", "that", "have", "about",
        "your", "will", "into", "than", "then", "them", "they", "does", "just", "make",
        "show", "give", "tell", "need", "want", "could", "would", "should", "answer",
      ].includes(token))
  );

  const isCourseOverviewQuestion = (value: string) => (
    /\b(syllabus|course|class)\b/.test(value.toLowerCase()) && /\b(about|overview|summary|cover|focus|focused|topic|topics)\b/.test(value.toLowerCase())
  ) || /\bwhat is (this )?(course|class|syllabus) about\b/i.test(value);

  const buildCourseCourtesyReply = (value: string) => {
    const trimmed = value.trim().toLowerCase();

    if (/^(hi|hello|hey|heyy|yo|hiya|good morning|good afternoon|good evening)([!. ]*)?$/.test(trimmed)) {
      return "Hi! I'm Spark. Ask me anything from your uploaded course sources, or switch to Spark Open for broader help.";
    }

    if (/^(thanks|thank you|thx|tysm|ty)([!. ]*)?$/.test(trimmed)) {
      return "Anytime. I’m here whenever you want help from your course sources.";
    }

    if (/^(ok|okay|cool|nice|got it|sounds good|alright|great)([!. ]*)?$/.test(trimmed)) {
      return "Sounds good. Ask another course question whenever you're ready.";
    }

    if (/^(bye|goodbye|see you|cya|talk later)([!. ]*)?$/.test(trimmed)) {
      return "See you later. I’ll be here when you need help with your course documents.";
    }

    return null;
  };

  const buildLocalCourseOverviewAnswer = () => {
    const summary = syllabusInsights?.summary?.trim();
    const grading = syllabusInsights?.gradingPolicy?.slice(0, 4).map((item) => (
      `${item.label}${item.weight !== null ? ` (${item.weight}%)` : ""}`
    )) ?? [];
    const upcoming = assignments
      .filter((assignment) => assignment.due || assignment.type)
      .slice(0, 4)
      .map((assignment) => `${assignment.label}${assignment.type ? ` (${assignment.type})` : ""}${assignment.due ? ` due ${assignment.due}` : ""}`);

    const parts = [
      courseName ? `${courseCode} ${courseName}` : courseCode,
      summary ? `This course appears to focus on ${summary.charAt(0).toLowerCase()}${summary.slice(1)}` : null,
      grading.length > 0 ? `The syllabus highlights grading components such as ${grading.join(", ")}.` : null,
      upcoming.length > 0 ? `Key items mentioned in the course setup include ${upcoming.join(", ")}.` : null,
    ].filter(Boolean);

    if (parts.length === 0) return null;

    return {
      text: parts.join(" "),
      citations: [{
        docName: syllabusInsights?.sourceFileName || `${courseCode} syllabus`,
        excerpt: summary || `Course overview for ${courseCode}`,
        kind: "document" as const,
      }],
    };
  };

  const buildCourseEvidence = (question: string, activeDocs: Doc[]) => {
    const readableDocs = activeDocs.filter((doc) => hasReadableDocumentText(doc.textContent));
    if (readableDocs.length === 0) {
      return { hasReadableDocs: false, context: "", citations: [] as Array<{ docName: string; excerpt: string; kind: "document" }> };
    }

    const queryTerms = tokenizeForSourceMatch(question);
    const lowerQuestion = question.toLowerCase();
    const scoredDocs = readableDocs.map((doc, index) => {
      const rawText = (doc.textContent ?? "").replace(/\r/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      const lowered = rawText.toLowerCase();
      const meta = `${doc.name} ${doc.type}`.toLowerCase();
      const queryScore = queryTerms.reduce((sum, term) => (
        sum + (lowered.includes(term) ? 1 : 0) + (meta.includes(term) ? 2 : 0)
      ), 0);
      const syllabusBoost = doc.type === "syllabus" && (
        lowerQuestion.includes("syllabus") ||
        lowerQuestion.includes("course") ||
        lowerQuestion.includes("class") ||
        lowerQuestion.includes("overview") ||
        lowerQuestion.includes("about")
      ) ? 4 : 0;
      return {
        docName: doc.name,
        docType: doc.type,
        fullText: rawText,
        score: queryScore + syllabusBoost,
        index,
      };
    });

    const sorted = [...scoredDocs].sort((left, right) => (
      right.score - left.score || left.index - right.index
    ));
    const matchedDocs = sorted.filter((doc) => doc.score > 0);
    const selected = matchedDocs.slice(0, 4);

    return {
      hasReadableDocs: true,
      context: selected.map((doc, index) => `Course Source ${index + 1} — ${doc.docName}\n${compressDocumentText(doc.fullText, 3200)}`).join("\n\n---\n\n"),
      citations: selected.map((doc) => ({
        docName: doc.docName,
        excerpt: compressDocumentText(doc.fullText, 220),
        kind: "document" as const,
      })),
    };
  };

  const isClearChatCommand = (value: string) => (
    /^\s*(?:\/clear|\/reset|clear(?: the)? chat|empty chat|clear conversation|delete chat|wipe chat|reset chat|new chat|start over)\s*$/i.test(value)
  );

  const buildSparkFailureMessage = (errorMessage: string) => {
    if (/quota|rate limit|retry in/i.test(errorMessage)) {
      return {
        text: "Spark is temporarily busy right now.",
        note: "Please try again in a few seconds. Spark retried across its available providers, but they were still cooling down.",
      };
    }

    return {
      text: "I couldn't reach Spark AI yet.",
      note: `The "${SPARK_FUNCTION_NAME}" Supabase Edge Function is not responding. ${errorMessage} Make sure Supabase is configured and its provider secrets are set correctly.`,
    };
  };

  // ── Send AI message (streaming) ──
  const sendAI = async (text?: string) => {
    const msg = (text ?? aiInput).trim();
    if (!msg || aiLoading) return;
    if (isClearChatCommand(msg)) {
      setAiInput("");
      setMessages(createDefaultSparkMessages());
      return;
    }
    const courtesyReply = sparkMode === "course" ? buildCourseCourtesyReply(msg) : null;
    if (courtesyReply) {
      setAiInput("");
      setMessages(prev => [
        ...prev,
        createChatMessage({ role: "user", text: msg, mode: sparkMode }),
        createChatMessage({ role: "ai", text: courtesyReply, mode: sparkMode }),
      ]);
      return;
    }
    const activeDocs = docs.filter(d => d.used);
    const courseEvidence = buildCourseEvidence(msg, activeDocs);
    const history = messages
      .filter((m) => (
        (m.role === "user" || m.role === "ai")
        && m.mode === sparkMode
        && !m.flagged
        && Boolean(m.text.trim())
      ))
      .slice(-6)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text })) as { role: "user" | "assistant"; content: string }[];

    const courseSummary = [
      `Course code: ${courseCode}`,
      courseName ? `Course name: ${courseName}` : null,
      syllabusInsights?.instructor ? `Instructor: ${syllabusInsights.instructor}` : null,
      syllabusInsights?.term ? `Term: ${syllabusInsights.term}` : null,
      syllabusInsights?.summary ? `Syllabus summary: ${syllabusInsights.summary}` : null,
      syllabusInsights?.gradingPolicy.length ? `Grading policy: ${syllabusInsights.gradingPolicy.map(i => `${i.label}${i.weight !== null ? ` ${i.weight}%` : ""}`).join("; ")}` : null,
      assignments.length > 0 ? `Assignments: ${assignments.map(a => `${a.label} (${a.type}${a.due ? `, due ${a.due}` : ""}${a.grade !== null ? `, grade ${a.grade}%` : ""})`).join("; ")}` : "Assignments: none.",
      activeDocs.length > 0 ? `Documents: ${activeDocs.map(d => `${d.name} [${d.type}]`).join("; ")}` : "Documents: none yet.",
      activeDocs.some(d => hasReadableDocumentText(d.textContent))
        ? `Document excerpts:\n${activeDocs.filter(d => hasReadableDocumentText(d.textContent)).slice(0, 3).map(d => `${d.name}: ${(d.textContent ?? "").slice(0, 1400)}`).join("\n---\n")}`
        : "Document excerpts: unavailable.",
    ].filter(Boolean).join("\n");

    const systemPrompt = sparkMode === "global"
      ? [
          "You are Spark, the AI study companion inside LearnBeam.",
          "You are operating in General Answer mode.",
          "Answer using your broader general knowledge and reasoning rather than the user's uploaded course documents.",
          "Be clear, modern, and genuinely helpful to a student.",
          "For simple questions, answer simply.",
          "For study questions, explain step by step when it helps.",
          "Prioritize practical explanations over textbook-style writing.",
          "Do not sound overly corporate, robotic, or dramatic.",
          "Citations are optional. Provide them only when they are genuinely helpful, explicitly requested, or especially important for the claim.",
          "If the user asks about a concept, prefer this shape when useful: short definition, key idea in plain language, then one short next-step suggestion for studying.",
          "If you are unsure, say so plainly instead of pretending to know.",
          `Course context (for reference): ${courseCode}${courseName ? ` — ${courseName}` : ""}`,
        ].join("\n")
      : [
          "You are Spark, the AI study companion inside LearnBeam.",
          "You are in Course Sources mode.",
          "If the user is only greeting you, thanking you, or making a short conversational remark, respond naturally in one brief sentence and invite them to ask about their course documents.",
          "",
          "YOUR ONLY JOB: present what is written in the course-source excerpts below in a clear, student-friendly way.",
          "You may fix grammar, improve flow, and organize the answer so it reads naturally. Do not add facts of your own.",
          "",
          "STRICT RULES:",
          "- Every sentence in your answer must come directly from the course-source excerpts below.",
          "- Keep exact terminology, definitions, formulas, and technical names exactly as they appear — do NOT substitute synonyms or rephrase technical language.",
          "- Start with the direct answer in plain language.",
          "- If the excerpts support it, you may add one short clarifying sentence that only restates what is already present more clearly.",
          "- You may fix grammar and format the retrieved text into clean, readable prose — nothing more.",
          "- Do NOT add context, background knowledge, examples, analogies, or any elaboration from outside the excerpts.",
          "- Do NOT reference document names, slide numbers, or section headings in your answer.",
          "- If the excerpts conflict, say that the uploaded sources conflict instead of choosing one silently.",
          "- If the excerpts do not contain an answer, reply with exactly: 'I couldn't find that in your uploaded course sources.'",
          "",
          "STYLE:",
          "- Sound like a smart study assistant, not a search engine or policy bot.",
          "- Be concise, calm, and helpful.",
          "- Most of the answer should stay very close to the original document wording.",
          "",
          "SOURCE LINE:",
          "- End every answer with exactly one line: Source: <filename(s)>",
          "",
          "Course-source excerpts (these are the ONLY facts you may use):",
          courseEvidence.context || "No readable course-source excerpts are available.",
        ].join("\n");

    setAiInput("");
    const streamId = crypto.randomUUID();
    setMessages(prev => [...prev,
      createChatMessage({ role: "user", text: msg, mode: sparkMode }),
      { id: streamId, role: "ai", text: "", citations: [], flagged: false, flagNote: null, provider: null, mode: sparkMode, createdAt: new Date().toISOString() },
    ]);
    setAiLoading(true);
    try {
      if (sparkMode === "course" && !courseEvidence.hasReadableDocs) {
        const localOverview = isCourseOverviewQuestion(msg) ? buildLocalCourseOverviewAnswer() : null;
        if (localOverview) {
          setMessages(prev => prev.map(m => m.id === streamId ? {
            ...m,
            text: localOverview.text,
            citations: localOverview.citations,
            provider: null,
          } : m));
          return;
        }

        setMessages(prev => prev.map(m => m.id === streamId ? {
          ...m,
          text: "I couldn't find readable text in your uploaded course sources yet.",
          flagged: true,
          flagNote: "Upload a readable PDF, DOCX, or TXT file, or wait for Spark to finish extracting text from your documents.",
        } : m));
        return;
      }

      if (sparkMode === "course" && (!courseEvidence.context || courseEvidence.citations.length === 0)) {
        const localOverview = isCourseOverviewQuestion(msg) ? buildLocalCourseOverviewAnswer() : null;
        if (localOverview) {
          setMessages(prev => prev.map(m => m.id === streamId ? {
            ...m,
            text: localOverview.text,
            citations: localOverview.citations,
            provider: null,
          } : m));
          return;
        }

        setMessages(prev => prev.map(m => m.id === streamId ? {
          ...m,
          text: "I couldn't find that in your uploaded course sources.",
          citations: [],
          flagged: true,
          flagNote: "Spark stayed inside your stored course documents and could not find supporting text for that question.",
        } : m));
        return;
      }

      const result = await streamWithSparkAI(
        [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: msg }],
        (partial) => { setMessages(prev => prev.map(m => m.id === streamId ? { ...m, text: partial } : m)); },
        { useSearch: false, task: sparkMode === "global" ? "general-chat" : "course-chat" },
      );
      setMessages(prev => prev.map(m => m.id === streamId ? {
        ...m,
        provider: result.provider === "cerebras" || result.provider === "gemini" || result.provider === "groq"
          ? result.provider
          : null,
        citations: sparkMode === "course"
          ? courseEvidence.citations
          : result.citations.length > 0
          ? result.citations.map((citation) => ({
              docName: citation.title,
              excerpt: citation.url,
              url: citation.url,
              kind: "web" as const,
            }))
          : m.citations,
      } : m));
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Unknown Spark error.";
      const failure = buildSparkFailureMessage(errMsg);
      setMessages(prev => prev.map(m => m.id === streamId ? {
        ...m,
        text: failure.text,
        flagged: true,
        flagNote: failure.note,
        provider: null,
      } : m));
    } finally {
      setAiLoading(false);
    }
  };

  // ── File upload ──
  const handleFileUpload = async (file: File, forceSyllabus = false) => {
    if (!id) return;
    const lower = file.name.toLowerCase();
    const docType: Doc["type"] = forceSyllabus || lower.includes("syllabus") ? "syllabus" : lower.includes("exam") ? "past-exam" : lower.includes("read") ? "reading" : "notes";

    if (docType === "syllabus") {
      setSyllabusImportState({ active: true, title: "Preparing syllabus", detail: "Setting up the import before Spark starts reading the file.", error: null, success: null });
      try {
        const imported = await importSyllabusIntoCourse({
          courseId: id, courseCode, courseName, file,
          existingAssignments: assignments, existingReminders: reminders, existingDocs: docs,
          onProgress: (p) => setSyllabusImportState({ active: true, title: p.title, detail: p.detail, error: null, success: null }),
        });
        setDocs(imported.docs); setAssignments(imported.assignments);
        setReminders(imported.reminders); setSyllabusInsights(imported.insights);
        setSyllabusImportState({ active: false, title: "Syllabus imported", detail: "", error: null, success: `Added ${imported.assignments.length} assignments and ${imported.reminders.length} reminders from ${file.name}.` });
        setMessages(prev => [...prev, createChatMessage({ role: "ai", text: `I examined your syllabus and filled in ${imported.assignments.length} assignments and ${imported.reminders.length} reminders.` })]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The syllabus could not be processed.";
        setSyllabusImportState({ active: false, title: "Syllabus import hit a snag", detail: "", error: message, success: null });
        setMessages(prev => [...prev, createChatMessage({ role: "ai", text: "I couldn't finish examining that syllabus.", flagged: true, flagNote: message })]);
      }
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const tempDoc: Doc = { id: tempId, name: file.name, type: docType, size: `${(file.size / 1024).toFixed(0)} KB`, uploadedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }), used: true, storagePath: null, textContent: null };
    setDocs(prev => [...prev, tempDoc]);
    let extractedText: string | null = null;
    try { extractedText = await extractDocumentText(file); } catch { extractedText = ""; }
    setDocs(prev => prev.map(d => d.id === tempId ? { ...d, textContent: extractedText } : d));
    if (!SUPABASE_CONFIGURED) {
      // No Supabase — kick off background fact-check using the fully-typed temp doc.
      if (extractedText) {
        const docForCheck: Doc = { ...tempDoc, textContent: extractedText };
        void factCheckDocument(docForCheck).catch(() => {});
      }
      return;
    }
    const dbDoc = await uploadDocument(file, id, docType);
    if (dbDoc) {
      const uploadedDoc: Doc = { id: dbDoc.id, name: dbDoc.name, type: dbDoc.type, size: dbDoc.size ?? tempDoc.size, uploadedAt: new Date(dbDoc.uploaded_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }), used: true, storagePath: dbDoc.storage_path, textContent: extractedText };
      setDocs(prev => prev.map(d => d.id === tempId ? uploadedDoc : d));
      // Persist extracted text to DB so it never needs to be re-extracted from Storage.
      if (extractedText) {
        void updateDocumentTextContent(dbDoc.id, extractedText).catch(() => {});
      }
      // Background fact-check — runs silently after upload, caches result for instant report view.
      if (extractedText && docType !== "syllabus") {
        void factCheckDocument(uploadedDoc).catch(() => {});
      }
    } else {
      setDocs(prev => prev.filter(d => d.id !== tempId));
    }
  };

  // Dedicated handler for Overview's "Upload Syllabus" button — always forces syllabus processing
  const handleSyllabusUpload = async (file: File) => handleFileUpload(file, true);

  // Re-scan an already-uploaded syllabus doc (from Docs tab)
  const handleRescanSyllabus = async (doc: Doc) => {
    if (!id) return;
    setSyllabusImportState({ active: true, title: "Re-reading syllabus", detail: "Spark is re-examining the document from scratch.", error: null, success: null });
    setActiveTab("overview");
    try {
      const imported = await rescanSyllabusDoc({
        courseId: id, courseCode, courseName, doc,
        existingAssignments: assignments,
        existingReminders: reminders,
        existingDocs: docs,
        onProgress: (p) => setSyllabusImportState({ active: true, title: p.title, detail: p.detail, error: null, success: null }),
      });
      setDocs(imported.docs);
      setAssignments(imported.assignments);
      setReminders(imported.reminders);
      setSyllabusInsights(imported.insights);
      setSyllabusImportState({ active: false, title: "Syllabus re-scanned", detail: "", error: null, success: `Updated with ${imported.assignments.length} assignments and ${imported.reminders.length} reminders.` });
      setMessages(prev => [...prev, createChatMessage({ role: "ai", text: `I re-examined your syllabus and found ${imported.assignments.length} assignments, ${imported.reminders.length} reminders, and filled in the course details.` })]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "The re-scan could not be completed.";
      setSyllabusImportState({ active: false, title: "Re-scan hit a snag", detail: "", error: message, success: null });
    }
  };

  // ── Assignment reminder helpers ──
  const handleAssignmentReminderUpsert = async (assignment: Assignment) => {
    const reminder = buildAssignmentReminder(assignment);
    setReminders(prev => { const base = prev.filter(r => r.id !== assignment.id); return reminder ? [...base, reminder] : base; });
    if (!SUPABASE_CONFIGURED) return;
    if (!reminder) { await dbDeleteReminder(assignment.id); return; }
    await upsertReminder({ id: reminder.id, course_id: id ?? "", text: reminder.text, due: reminder.due || null, done: false });
  };

  const handleAssignmentReminderDelete = async (assignmentId: string) => {
    setReminders(prev => prev.filter(r => r.id !== assignmentId));
    if (!SUPABASE_CONFIGURED) return;
    await dbDeleteReminder(assignmentId);
  };

  // ── Spark button style ──
  const sparkButtonStyle = (): React.CSSProperties => {
    if (sparkAnim === "activating")   return { animation: "sparkActivate 0.42s cubic-bezier(0.34,1.56,0.64,1) forwards" };
    if (sparkAnim === "active")       return { filter: "drop-shadow(0 0 16px rgba(246,212,0,0.7))" };
    if (sparkAnim === "deactivating") return { animation: "sparkDeactivate 0.28s ease-out forwards" };
    return { animation: "sparkIdle 3.5s ease-in-out infinite" };
  };

  const courseBellItems = mergeCourseReminders(assignments, reminders).slice(0, 6).map(r => ({
    id: r.id, label: r.text, due: r.due, urgent: isReminderUrgent(r.due),
  }));

  const cid = id ?? "";

  const renderTab = () => {
    if (dataLoading) return (
      <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "13px", overflow: "hidden", padding: "28px 22px" }}>
        <p style={{ fontFamily: F.heading, fontWeight: 700, fontSize: "0.95rem", color: "var(--text-primary)", margin: "0 0 6px" }}>Loading course data</p>
        <p style={{ fontFamily: F.body, fontSize: "0.82rem", color: "var(--text-muted)", margin: 0 }}>Pulling your assignments and documents from LearnBeam.</p>
      </div>
    );
    switch (activeTab) {
      case "overview":    return <OverviewTab courseCode={courseCode} courseColor={courseColor} docs={docs} assignments={assignments} onUploadSyllabus={handleSyllabusUpload} insights={syllabusInsights} importState={syllabusImportState} suggestions={sparkSuggestions} suggestionsLoading={suggestionsLoading} suggestionsError={suggestionsError} documentsSyncing={documentTextSyncing}/>;
      case "assignments": return <AssignmentsTab assignments={assignments} setAssignments={setAssignments} courseColor={courseColor} courseId={cid} onAutoReminderUpsert={handleAssignmentReminderUpsert} onAutoReminderDelete={handleAssignmentReminderDelete}/>;
      case "grades":      return <GradesTab assignments={assignments} courseColor={courseColor} insights={syllabusInsights}/>;
      case "docs":        return <DocsTab docs={docs} onDocsChange={setDocs} courseId={cid} onFileUpload={handleFileUpload} onRescanSyllabus={handleRescanSyllabus}/>;
      case "reminders":   return <RemindersTab courseCode={courseCode} courseId={cid} assignments={assignments} reminders={reminders} setReminders={setReminders}/>;
      case "activities":  return <ActivitiesTab courseCode={courseCode} courseId={cid} docs={docs} onFocusMode={() => setFocusMode(true)} documentsSyncing={documentTextSyncing}/>;
    }
  };

  // ── Render ──
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", height: isMobile ? "auto" : "100vh", width: "100%", background: "var(--bg-primary)", color: "var(--foreground)", fontFamily: F.body, overflow: isMobile ? "visible" : "hidden" }}>

      {/* ══ TOP NAV ══ */}
      <header style={{ minHeight: isMobile ? "74px" : "82px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "10px 28px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", flexShrink: 0, boxShadow: "0 1px 14px rgba(0,0,0,0.06)", zIndex: 20, gap: isMobile ? "12px" : "14px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: isMobile ? "10px" : "14px", minWidth: 0, flex: isMobile ? "1 1 100%" : "1 1 420px" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", flexShrink: 0, cursor: "pointer" }} onClick={() => navigate("/dashboard")}>
            <img src={learnBeamLogo} alt="LearnBeam" style={{ height: isMobile ? "42px" : "52px", width: isMobile ? "42px" : "52px", objectFit: "contain", filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.15))" }}/>
            <span style={{ fontFamily: F.heading, fontWeight: 900, fontSize: "0.62rem", color: "var(--text-muted)", letterSpacing: "0.04em", textTransform: "uppercase" }}>LearnBeam</span>
          </div>
          {!isMobile && <div style={{ width: "1px", height: "44px", background: "var(--border)", flexShrink: 0 }}/>}
          <div style={{ minWidth: 0 }}>
            <button onClick={() => navigate("/dashboard")} style={{ display: "flex", alignItems: "center", gap: "4px", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontFamily: F.body, fontSize: "0.73rem", padding: "0 0 4px 0", marginBottom: "2px", transition: "color 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)"; }}>
              <ChevronLeft size={11}/> Dashboard
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: courseColor, flexShrink: 0, boxShadow: `0 0 0 3px ${courseColor}28` }}/>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontFamily: F.heading, fontWeight: 900, fontSize: isMobile ? "0.98rem" : "1.08rem", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>{courseCode}</span>
                {courseName && <span style={{ fontFamily: F.body, fontSize: isMobile ? "0.78rem" : "0.82rem", color: "var(--text-secondary)", fontWeight: 500, lineHeight: 1.45 }}>{courseName}</span>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "8px" : "10px", marginLeft: "auto", flexWrap: "wrap", justifyContent: isMobile ? "space-between" : "flex-end", width: isMobile ? "100%" : "auto" }}>
          <button onClick={() => setFocusMode(true)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", background: "transparent", border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 13px", fontFamily: F.body, fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", color: "var(--text-secondary)", transition: "all 0.15s", flex: isMobile ? 1 : "initial", minWidth: isMobile ? "0" : undefined }}
            onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "var(--accent)"; b.style.color = "var(--accent)"; b.style.background = "var(--accent-soft)"; }}
            onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "var(--border)"; b.style.color = "var(--text-secondary)"; b.style.background = "transparent"; }}>
            <Brain size={13}/> Focus Mode
          </button>
          <ThemeSwitcher/>
          <div style={{ position: "relative" }} ref={bellRef}>
            <button onClick={() => setBellOpen(v => !v)} style={{ background: bellOpen ? "var(--accent-soft)" : "var(--bg-secondary)", border: `1px solid ${bellOpen ? "var(--accent)" : "var(--border)"}`, borderRadius: "50%", width: "38px", height: "38px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: bellOpen ? "var(--accent)" : "var(--text-secondary)", transition: "all 0.2s", position: "relative" }}>
              <Bell size={15}/>
              {courseBellItems.length > 0 && <span style={{ position: "absolute", top: "8px", right: "8px", width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444", border: "2px solid var(--bg-surface)" }}/>}
            </button>
            {bellOpen && <CourseRemindersPanel courseCode={courseCode} courseColor={courseColor} items={courseBellItems} onClose={() => setBellOpen(false)}/>}
          </div>
          <button onClick={() => navigate("/profile")} style={{ width: "36px", height: "36px", borderRadius: "50%", background: avatarUrl ? "transparent" : "var(--accent)", color: "var(--primary-foreground)", display: "flex", alignItems: "center", justifyContent: "center", border: avatarUrl ? "2px solid var(--border)" : "none", cursor: "pointer", boxShadow: "0 2px 8px var(--accent-glow)", transition: "transform 0.15s", overflow: "hidden", padding: 0 }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)"}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"}>
            {avatarUrl ? <img src={avatarUrl} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}/> : <User size={14}/>}
          </button>
        </div>
      </header>

      {/* ══ TAB BAR ══ */}
      <div style={{ display: "flex", alignItems: "stretch", padding: isMobile ? "0 10px" : "0 28px", background: "var(--bg-surface)", borderBottom: "1px solid var(--border)", overflowX: "auto", flexShrink: 0, zIndex: 10 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: isMobile ? "11px 10px" : "12px 14px", background: "none", border: "none", borderBottom: activeTab === tab.id ? `2.5px solid ${courseColor}` : "2.5px solid transparent", color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-muted)", fontFamily: F.heading, fontWeight: activeTab === tab.id ? 700 : 500, fontSize: isMobile ? "0.76rem" : "0.81rem", cursor: "pointer", whiteSpace: "nowrap", transition: "color 0.15s", marginBottom: "-1px" }}>
            <span style={{ color: activeTab === tab.id ? courseColor : "var(--text-muted)", display: "flex", alignItems: "center" }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══ BODY ══ */}
      <div style={{ display: "flex", flex: 1, overflow: isMobile ? "visible" : "hidden", minHeight: 0 }}>
        <main style={{ flex: 1, overflowY: isMobile ? "visible" : "auto", padding: isMobile ? "20px 14px 160px" : "26px 30px 200px", minWidth: 0 }}>
          <div style={{ maxWidth: "860px", margin: "0 auto" }}>{renderTab()}</div>
        </main>

        {chatOpen && chatMaximized && (
          <aside style={{ position: isMobile ? "fixed" : "relative", inset: isMobile ? "0" : "auto", width: isMobile ? "100vw" : "50%", flexShrink: 0, borderLeft: isMobile ? "none" : "1px solid var(--border)", display: "flex", flexDirection: "column", background: "var(--bg-surface)", animation: "maxPanelIn 0.3s cubic-bezier(0.22,1,0.36,1)", overflow: "hidden", zIndex: isMobile ? 240 : "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 14px" : "14px 20px", borderBottom: "1px solid var(--border)", background: "var(--section-bg)", flexShrink: 0, gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <SparkLogo size={isMobile ? 44 : 54}/>
                <div>
                  <div style={{ fontFamily: F.heading, fontSize: "1rem", fontWeight: 800, color: "var(--text-primary)" }}>Spark</div>
                  <div style={{ fontFamily: F.body, fontSize: "0.7rem", color: "var(--text-muted)" }}>
                    {sparkMode === "global" ? "Spark Open for broader answers beyond your course files" : `Answers from your ${courseCode} documents`}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button onClick={() => setChatMaximized(false)} style={{ display: "flex", alignItems: "center", gap: "5px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "8px", padding: "5px 10px", cursor: "pointer", color: "var(--text-muted)", fontFamily: F.body, fontSize: "0.76rem" }}>
                  <Minimize2 size={13}/> Minimise
                </button>
                <button onClick={() => { setChatOpen(false); setChatMaximized(false); setSparkAnim("idle"); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}><X size={16}/></button>
              </div>
            </div>
            <SparkChat courseCode={courseCode} docs={docs} messages={messages} aiInput={aiInput} onInputChange={setAiInput} onSend={sendAI} onFileUpload={handleFileUpload} isSending={aiLoading} mode={sparkMode} onModeChange={setSparkMode}/>
          </aside>
        )}
      </div>

      {/* ══ MINI CHAT ══ */}
      {chatOpen && !chatMaximized && (
        <div style={{ position: "fixed", bottom: isMobile ? "104px" : "166px", left: "50%", transform: "translateX(-50%)", zIndex: 100, width: isMobile ? "calc(100vw - 20px)" : "390px", maxWidth: isMobile ? "420px" : "390px", background: "color-mix(in srgb, var(--bg-surface) 92%, white 8%)", border: "1px solid color-mix(in srgb, var(--border) 75%, var(--accent) 25%)", borderRadius: "22px", boxShadow: "0 24px 70px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: isMobile ? "68vh" : "460px", animation: expandingToMax ? "miniToMax 0.24s ease-in forwards" : "miniChatIn 0.28s cubic-bezier(0.34,1.56,0.64,1)", backdropFilter: "blur(18px)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "10px 12px" : "11px 15px", borderBottom: "1px solid var(--border)", background: "var(--section-bg)", flexShrink: 0, gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SparkLogo size={isMobile ? 38 : 44}/>
              <div>
                <div style={{ fontFamily: F.heading, fontSize: "0.86rem", fontWeight: 800, color: "var(--text-primary)" }}>Spark</div>
                <div style={{ fontFamily: F.body, fontSize: "0.63rem", color: "var(--text-muted)" }}>
                  {sparkMode === "global" ? "Spark Open" : `Course sources · ${courseCode}`}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button onClick={handleExpand} style={{ display: "flex", alignItems: "center", gap: "4px", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: "7px", padding: "4px 9px", cursor: "pointer", color: "var(--text-muted)", fontFamily: F.body, fontSize: "0.71rem", transition: "all 0.15s" }}
                onMouseEnter={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "var(--accent)"; b.style.color = "var(--accent)"; }}
                onMouseLeave={e => { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "var(--border)"; b.style.color = "var(--text-muted)"; }}>
                <Maximize2 size={12}/> Expand
              </button>
              <button onClick={() => { setChatOpen(false); setSparkAnim("deactivating"); setTimeout(() => setSparkAnim("idle"), 300); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 0, display: "flex" }}><X size={13}/></button>
            </div>
          </div>
          <SparkChat courseCode={courseCode} docs={docs} messages={messages} aiInput={aiInput} onInputChange={setAiInput} onSend={sendAI} compact onFileUpload={handleFileUpload} isSending={aiLoading} mode={sparkMode} onModeChange={setSparkMode}/>
        </div>
      )}

      {/* ══ SPARK BUTTON ══ */}
      <div style={{ position: "fixed", bottom: isMobile ? "14px" : "18px", left: "50%", transform: "translateX(-50%)", zIndex: 100 }}>
        <button onClick={toggleSpark} title="Ask Spark"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", ...sparkButtonStyle() }}
          onMouseEnter={e => { if (sparkAnim === "idle" || sparkAnim === "active") (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.07)"; }}
          onMouseLeave={e => { if (sparkAnim !== "activating" && sparkAnim !== "deactivating") (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)"; }}>
          <SparkLogo size={84}/>
        </button>
      </div>

      {/* ══ HELP ══ */}
      {!chatMaximized && (
        <div style={{ position: "fixed", bottom: isMobile ? "18px" : "22px", right: isMobile ? "14px" : "22px", zIndex: 110, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px" }}>
          {helpOpen && <HelpPanel tab={activeTab} onClose={() => setHelpOpen(false)}/>}
          <button onClick={() => setHelpOpen(v => !v)} style={{ width: "44px", height: "44px", borderRadius: "50%", background: helpOpen ? "var(--accent)" : "var(--bg-surface)", border: `1.5px solid ${helpOpen ? "var(--accent)" : "var(--border)"}`, boxShadow: "0 4px 18px rgba(0,0,0,0.12)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s", color: helpOpen ? "var(--primary-foreground)" : "var(--text-secondary)" }}
            onMouseEnter={e => { if (!helpOpen) { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "var(--accent)"; b.style.color = "var(--accent)"; } }}
            onMouseLeave={e => { if (!helpOpen) { const b = e.currentTarget as HTMLButtonElement; b.style.borderColor = "var(--border)"; b.style.color = "var(--text-secondary)"; } }}>
            <HelpCircle size={19}/>
          </button>
        </div>
      )}

      {/* ══ FOCUS MODE ══ */}
      {focusMode && <FocusMode courseCode={courseCode} courseName={courseName} onExit={() => setFocusMode(false)}/>}

      <style>{`
        @keyframes sparkIdle {
          0%,100% { filter:drop-shadow(0 4px 14px rgba(0,0,0,0.18)) drop-shadow(0 0 0px rgba(246,212,0,0)); transform:translateY(0) scale(1); }
          50%      { filter:drop-shadow(0 6px 20px rgba(0,0,0,0.14)) drop-shadow(0 0 18px rgba(246,212,0,0.22)); transform:translateY(-5px) scale(1.02); }
        }
        @keyframes sparkActivate {
          0%   { transform:scale(1); filter:drop-shadow(0 4px 14px rgba(0,0,0,0.2)); }
          28%  { transform:scale(1.22) translateY(-4px); filter:drop-shadow(0 0 34px rgba(246,212,0,0.95)) drop-shadow(0 0 12px rgba(246,212,0,0.6)); }
          58%  { transform:scale(0.94); filter:drop-shadow(0 0 18px rgba(246,212,0,0.55)); }
          80%  { transform:scale(1.06); filter:drop-shadow(0 0 20px rgba(246,212,0,0.65)); }
          100% { transform:scale(1); filter:drop-shadow(0 0 16px rgba(246,212,0,0.65)); }
        }
        @keyframes sparkDeactivate {
          0%   { transform:scale(1); filter:drop-shadow(0 0 16px rgba(246,212,0,0.65)); }
          35%  { transform:scale(0.87); filter:drop-shadow(0 0 6px rgba(246,212,0,0.2)); }
          70%  { transform:scale(1.04); filter:drop-shadow(0 4px 14px rgba(0,0,0,0.18)); }
          100% { transform:scale(1); filter:drop-shadow(0 4px 14px rgba(0,0,0,0.18)); }
        }
        @keyframes miniChatIn  { from{opacity:0;transform:translateX(-50%) translateY(18px) scale(0.95)} to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)} }
        @keyframes miniToMax   { 0%{opacity:1;transform:translateX(-50%) scale(1) translateY(0)} 50%{opacity:0.5;transform:translateX(20%) scale(1.06) translateY(-12px)} 100%{opacity:0;transform:translateX(80%) scale(0.7) translateY(-24px)} }
        @keyframes maxPanelIn  { from{opacity:0;transform:translateX(50px)} to{opacity:1;transform:translateX(0)} }
        @keyframes panelIn     { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>
    </div>
  );
}
