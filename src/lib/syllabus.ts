import { chatWithSparkAI, type SparkAIImage, type SparkAIMessage } from "./sparkAI";
import {
  compressDocumentText,
  compareDueStrings,
  inferAssignmentStatus,
  type StoredCourseAssignment,
  type StoredCourseInsights,
  type StoredCourseReminder,
  type SyllabusGradingItem,
} from "./courseData";

type RawAnalysis = {
  courseCode?: unknown;
  courseName?: unknown;
  instructor?: unknown;
  term?: unknown;
  meetingSchedule?: unknown;
  location?: unknown;
  summary?: unknown;
  gradingPolicy?: unknown;
  assignments?: unknown;
  reminders?: unknown;
  warnings?: unknown;
};

type AnalyzeContext = {
  courseCode: string;
  courseName: string;
  sourceFileName: string;
};

export type SyllabusAnalysisResult = {
  insights: StoredCourseInsights;
  assignments: StoredCourseAssignment[];
  reminders: StoredCourseReminder[];
  extractedText: string;
};

type AnalyzeSyllabusOptions = {
  onExtractedText?: () => void;
};

type AnalyzeSyllabusTextOptions = {
  images?: SparkAIImage[];
  extractionWarnings?: string[];
};

type SyllabusExtractedContent = {
  text: string;
  images: SparkAIImage[];
  warnings: string[];
};

const TEXT_FILE_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "json",
  "html",
  "htm",
  "xml",
  "rtf",
]);

const IMAGE_FILE_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "heic",
  "heif",
]);

/* ── PPTX / ODP (ZIP + XML presentation formats) ─────── */
async function extractPptxText(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const isPptx = file.name.toLowerCase().endsWith(".pptx");
  const isOdp  = file.name.toLowerCase().endsWith(".odp");

  const slideTexts: string[] = [];

  if (isPptx) {
    // OOXML: slides are in ppt/slides/slide*.xml
    // Text runs are in <a:t> elements
    const slideEntries = Object.keys(zip.files)
      .filter(name => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort();

    for (const name of slideEntries) {
      const xml = await zip.files[name].async("string");
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      // Collect <a:t> text run nodes (OOXML DrawingML)
      const nodes = doc.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/main", "t");
      const parts: string[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const t = nodes[i].textContent?.trim();
        if (t) parts.push(t);
      }
      if (parts.length) slideTexts.push(parts.join(" "));
    }

    // Also grab slide notes
    const noteEntries = Object.keys(zip.files)
      .filter(name => /^ppt\/notesSlides\/notesSlide\d+\.xml$/i.test(name))
      .sort();
    for (const name of noteEntries) {
      const xml = await zip.files[name].async("string");
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const nodes = doc.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/main", "t");
      const parts: string[] = [];
      for (let i = 0; i < nodes.length; i++) {
        const t = nodes[i].textContent?.trim();
        if (t) parts.push(t);
      }
      if (parts.length) slideTexts.push(`[Notes] ${parts.join(" ")}`);
    }
  } else if (isOdp) {
    // OpenDocument Presentation: all content in content.xml
    const entry = zip.files["content.xml"];
    if (entry) {
      const xml = await entry.async("string");
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      // Text paragraphs: <text:p> elements
      const paras = doc.getElementsByTagNameNS("urn:oasis:names:tc:opendocument:xmlns:text:1.0", "p");
      for (let i = 0; i < paras.length; i++) {
        const t = paras[i].textContent?.trim();
        if (t) slideTexts.push(t);
      }
    }
  }

  return combineStructuredSegments(slideTexts, "Slide", 60000);
}

/* ── XLSX / ODS (ZIP + XML spreadsheet formats) ────────── */
async function extractXlsxText(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const isOds = file.name.toLowerCase().endsWith(".ods");
  const sheetTexts: string[] = [];

  if (isOds) {
    // OpenDocument Spreadsheet: content.xml
    const entry = zip.files["content.xml"];
    if (entry) {
      const xml = await entry.async("string");
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const tables = doc.getElementsByTagNameNS("urn:oasis:names:tc:opendocument:xmlns:table:1.0", "table");
      for (let ti = 0; ti < tables.length; ti++) {
        const rows = tables[ti].getElementsByTagNameNS("urn:oasis:names:tc:opendocument:xmlns:table:1.0", "table-row");
        const rowTexts: string[] = [];
        for (let ri = 0; ri < rows.length; ri++) {
          const cells = rows[ri].getElementsByTagNameNS("urn:oasis:names:tc:opendocument:xmlns:table:1.0", "table-cell");
          const cellVals: string[] = [];
          for (let ci = 0; ci < cells.length; ci++) {
            const t = cells[ci].textContent?.trim();
            if (t) cellVals.push(t);
          }
          if (cellVals.length) rowTexts.push(cellVals.join("\t"));
        }
        if (rowTexts.length) sheetTexts.push(rowTexts.join("\n"));
      }
    }
  } else {
    // OOXML xlsx: sharedStrings.xml + xl/worksheets/sheet*.xml
    const sharedStrings: string[] = [];
    const ssEntry = zip.files["xl/sharedStrings.xml"];
    if (ssEntry) {
      const xml = await ssEntry.async("string");
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const tNodes = doc.getElementsByTagName("t");
      for (let i = 0; i < tNodes.length; i++) {
        sharedStrings.push(tNodes[i].textContent ?? "");
      }
    }

    const sheetEntries = Object.keys(zip.files)
      .filter(name => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
      .sort();

    for (const name of sheetEntries) {
      const xml = await zip.files[name].async("string");
      const doc = new DOMParser().parseFromString(xml, "application/xml");
      const rows = doc.getElementsByTagName("row");
      const rowTexts: string[] = [];

      for (let ri = 0; ri < rows.length; ri++) {
        const cells = rows[ri].getElementsByTagName("c");
        const cellVals: string[] = [];
        for (let ci = 0; ci < cells.length; ci++) {
          const cell = cells[ci];
          const t = cell.getAttribute("t"); // type: "s" = shared string
          const vNode = cell.getElementsByTagName("v")[0];
          const inlineNode = cell.getElementsByTagName("is")[0];
          let val = "";
          if (t === "s" && vNode) {
            val = sharedStrings[parseInt(vNode.textContent ?? "0", 10)] ?? "";
          } else if (t === "inlineStr" && inlineNode) {
            val = inlineNode.textContent ?? "";
          } else if (vNode) {
            val = vNode.textContent ?? "";
          }
          if (val.trim()) cellVals.push(val.trim());
        }
        if (cellVals.length) rowTexts.push(cellVals.join("\t"));
      }
      if (rowTexts.length) sheetTexts.push(rowTexts.join("\n"));
    }
  }

  return combineStructuredSegments(sheetTexts, "Sheet", 60000);
}

/* ── ODT (OpenDocument Text via ZIP + XML) ────────────── */
async function extractOdtText(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entry = zip.files["content.xml"];
  if (!entry) return "";
  const xml = await entry.async("string");
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const paras = doc.getElementsByTagNameNS("urn:oasis:names:tc:opendocument:xmlns:text:1.0", "p");
  const parts: string[] = [];
  for (let i = 0; i < paras.length; i++) {
    const t = paras[i].textContent?.trim();
    if (t) parts.push(t);
  }
  return parts.join("\n");
}

/* ── PPT / XLS (legacy binary formats) — best-effort ───── */
function extractBinaryTextFallback(buffer: ArrayBuffer): string {
  // Decode as UTF-16LE (common in Office binary formats) and UTF-8, then
  // stitch together readable ASCII runs of length ≥ 4.
  const bytes = new Uint8Array(buffer);
  const readable: string[] = [];
  let run = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 0x20 && b < 0x7f) {
      run += String.fromCharCode(b);
    } else {
      if (run.length >= 4) readable.push(run.trim());
      run = "";
    }
  }
  if (run.length >= 4) readable.push(run.trim());
  // Deduplicate and filter noise
  const seen = new Set<string>();
  return readable
    .filter(s => {
      const key = s.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      // Filter out garbage patterns (too many special chars)
      const special = (s.match(/[^a-zA-Z0-9 .,;:!?()\-'"]/g) ?? []).length;
      return special / s.length < 0.4;
    })
    .join("\n");
}

function uniqueStrings(items: (string | null | undefined)[]) {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const cleaned = cleanString(item);
    if (!cleaned) return [];
    const key = cleaned.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);
    return [cleaned];
  });
}

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function cleanWeight(value: unknown): number | null {
  const numeric = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number.parseFloat(value.replace(/%/g, "").trim())
      : Number.NaN;
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, numeric));
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractJsonPayload(response: string) {
  const fenced = response.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = response.indexOf("{");
  const lastBrace = response.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return response.slice(firstBrace, lastBrace + 1);
  }

  throw new Error("Spark AI did not return JSON we could parse.");
}

async function extractPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = pdfPageToLines(content.items as unknown[]);

    if (text) pages.push(text);
  }

  return combineStructuredSegments(pages, "Page", 60000);
}

function normalizeBlockText(text: string) {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function compressSegment(segment: string, limit: number) {
  const normalized = normalizeBlockText(segment);
  if (normalized.length <= limit) return normalized;

  const head = normalized.slice(0, Math.floor(limit * 0.68)).trim();
  const tail = normalized.slice(-Math.floor(limit * 0.2)).trim();
  return `${head}\n\n[... segment truncated ...]\n\n${tail}`;
}

function combineStructuredSegments(segments: string[], prefix: string, limit: number) {
  const cleaned = segments
    .map((segment) => normalizeBlockText(segment))
    .filter(Boolean);

  if (cleaned.length === 0) return "";

  const wrapped = cleaned.map((segment, index) => `=== ${prefix} ${index + 1} ===\n${segment}`);
  const joined = wrapped.join("\n\n");
  if (joined.length <= limit) return joined;

  const budget = Math.max(800, Math.floor(limit / wrapped.length) - 32);
  return wrapped
    .map((segment) => compressSegment(segment, budget))
    .join("\n\n");
}

function pdfPageToLines(items: unknown[]) {
  type Fragment = {
    text: string;
    x: number;
    y: number;
    width: number;
  };

  const fragments = items.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as {
      str?: unknown;
      transform?: unknown;
      width?: unknown;
    };
    if (typeof record.str !== "string" || !record.str.trim()) return [];
    const transform = Array.isArray(record.transform) ? record.transform : [];
    const x = typeof transform[4] === "number" ? transform[4] : 0;
    const y = typeof transform[5] === "number" ? transform[5] : 0;
    const width = typeof record.width === "number" ? record.width : 0;
    return [{ text: record.str.trim(), x, y, width }];
  });

  if (fragments.length === 0) return "";

  const rows: { y: number; parts: Fragment[] }[] = [];
  for (const fragment of fragments) {
    const existing = rows.find((row) => Math.abs(row.y - fragment.y) <= 2.5);
    if (existing) {
      existing.parts.push(fragment);
    } else {
      rows.push({ y: fragment.y, parts: [fragment] });
    }
  }

  return rows
    .sort((left, right) => right.y - left.y)
    .map((row) => {
      const parts = row.parts.sort((left, right) => left.x - right.x);
      let line = "";
      let previous: Fragment | null = null;

      for (const part of parts) {
        if (!previous) {
          line = part.text;
          previous = part;
          continue;
        }

        const gap = part.x - (previous.x + previous.width);
        const separator = gap > 28 ? " | " : gap > 10 ? "  " : " ";
        line += `${separator}${part.text}`;
        previous = part;
      }

      return line.trim();
    })
    .filter(Boolean)
    .join("\n");
}

// Groq Vision's API enforces a hard maximum of 5 images per request.
// Keeping the default at 5 ensures we stay within that limit when Groq Vision
// is the active provider (e.g. as a fallback after Gemini Vision).
function samplePdfPages(totalPages: number, maxPages = 5) {
  if (totalPages <= maxPages) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages]);
  for (let index = 1; index < maxPages - 1; index += 1) {
    const page = Math.round(1 + (index * (totalPages - 1)) / (maxPages - 1));
    pages.add(page);
  }

  return [...pages].sort((left, right) => left - right);
}

async function blobToBase64(blob: Blob): Promise<SparkAIImage> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read the image content."));
        return;
      }

      const commaIndex = reader.result.indexOf(",");
      resolve({
        data: commaIndex >= 0 ? reader.result.slice(commaIndex + 1) : reader.result,
        mimeType: blob.type || "image/jpeg",
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read the image content."));
    reader.readAsDataURL(blob);
  });
}

async function extractPdfContent(file: File): Promise<SyllabusExtractedContent> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = pdfPageToLines(content.items as unknown[]);
    if (text) pageTexts.push(text);
  }

  const warnings: string[] = [];
  const text = combineStructuredSegments(pageTexts, "Page", 60000);
  if (!text) {
    warnings.push("Spark could not find a readable text layer in this PDF, so it is relying on visual page analysis.");
  }

  const images: SparkAIImage[] = [];
  if (typeof document !== "undefined") {
    for (const pageNumber of samplePdfPages(pdf.numPages)) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.3 });
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) continue;

      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      await page.render({ canvasContext: context, viewport }).promise;

      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      const commaIndex = dataUrl.indexOf(",");
      images.push({
        data: commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl,
        mimeType: "image/jpeg",
      });
    }
  }

  return { text, images, warnings };
}

async function extractDocxText(file: File) {
  const mammothModule = await import("mammoth");
  const mammoth = mammothModule.default ?? mammothModule;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

export async function extractDocumentText(file: File, limit = 30000): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  let text = "";
  try {
    if (extension === "pdf") {
      text = await extractPdfText(file);
    } else if (extension === "docx") {
      text = await extractDocxText(file);
    } else if (extension === "pptx" || extension === "odp") {
      text = await extractPptxText(file);
    } else if (extension === "xlsx" || extension === "ods") {
      text = await extractXlsxText(file);
    } else if (extension === "odt") {
      text = await extractOdtText(file);
    } else if (extension === "ppt" || extension === "xls") {
      // Legacy binary Office formats — extract readable ASCII runs best-effort
      text = extractBinaryTextFallback(await file.arrayBuffer());
    } else if (TEXT_FILE_EXTENSIONS.has(extension) || file.type.startsWith("text/")) {
      text = await file.text();
    } else {
      // Last-resort attempt for browser-readable text-like files.
      try { text = await file.text(); } catch { text = ""; }
    }
  } catch (err) {
    console.warn(`[extractDocumentText] Failed to parse ${file.name}:`, err);
    text = "";
  }

  const cleaned = compressDocumentText(text, limit);
  // Return what we have even if short — Spark AI will do its best.
  // A very small amount of text (< 30 chars) likely means a scanned image PDF.
  return cleaned || "";
}

export async function extractSyllabusText(file: File) {
  return extractDocumentText(file, 60000);
}

async function extractSyllabusContent(file: File): Promise<SyllabusExtractedContent> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "pdf") {
    return extractPdfContent(file);
  }

  if (IMAGE_FILE_EXTENSIONS.has(extension) || file.type.startsWith("image/")) {
    return {
      text: "",
      images: [await blobToBase64(file)],
      warnings: ["Spark is reading this syllabus visually because it is an image-based file."],
    };
  }

  const text = await extractSyllabusText(file);
  const warnings: string[] = [];
  if (!text) {
    if (extension === "ppt") {
      warnings.push("This is an old binary .ppt file. For best results, save it as .pptx and re-upload.");
    } else if (extension === "xls") {
      warnings.push("This is an old binary .xls file. For best results, save it as .xlsx and re-upload.");
    } else {
      warnings.push("Spark found very little readable text in this file. Gemini can still use page images when they are available.");
    }
  }
  return { text, images: [], warnings };
}

function normalizeGradingPolicy(items: unknown): SyllabusGradingItem[] {
  if (!Array.isArray(items)) return [];
  return uniqueBy(
    items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const label = cleanString((item as Record<string, unknown>).label);
      if (!label) return [];
      return [{
        label,
        weight: cleanWeight((item as Record<string, unknown>).weight),
        notes: cleanString((item as Record<string, unknown>).notes),
      }];
    }),
    (item) => item.label.toLowerCase(),
  );
}

function normalizeAssignments(items: unknown): StoredCourseAssignment[] {
  if (!Array.isArray(items)) return [];

  return uniqueBy(
    items.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const record = item as Record<string, unknown>;
      const label = cleanString(record.label);
      if (!label) return [];

      const due = cleanString(record.due) ?? "";
      const weight = cleanWeight(record.weight) ?? 1;

      return [{
        id: crypto.randomUUID(),
        label,
        type: cleanString(record.type) ?? "Assignment",
        due,
        weight,
        grade: null,
        status: inferAssignmentStatus(due, null),
      }];
    }),
    (item) => `${item.label.toLowerCase()}|${item.type.toLowerCase()}|${item.due.toLowerCase()}`,
  ).sort((left, right) => compareDueStrings(left.due, right.due));
}

function normalizeReminders(
  items: unknown,
  assignments: StoredCourseAssignment[],
): StoredCourseReminder[] {
  const extracted = Array.isArray(items)
    ? items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const record = item as Record<string, unknown>;
        const text = cleanString(record.text);
        if (!text) return [];
        return [{
          id: crypto.randomUUID(),
          text,
          due: cleanString(record.due) ?? "",
          done: false,
        }];
      })
    : [];

  const derived = assignments
    .filter((assignment) => assignment.due)
    .map((assignment) => ({
      id: assignment.id,
      text: `${assignment.label} due`,
      due: assignment.due,
      done: false,
    }));

  return uniqueBy(
    [...extracted, ...derived],
    (item) => `${item.text.toLowerCase()}|${item.due.toLowerCase()}`,
  ).sort((left, right) => compareDueStrings(left.due, right.due));
}

export function mergeImportedAssignments(
  existing: StoredCourseAssignment[],
  imported: StoredCourseAssignment[],
) {
  return uniqueBy(
    [...existing, ...imported],
    (item) => `${item.label.toLowerCase()}|${item.type.toLowerCase()}|${item.due.toLowerCase()}`,
  ).sort((left, right) => compareDueStrings(left.due, right.due));
}

export function mergeImportedReminders(
  existing: StoredCourseReminder[],
  imported: StoredCourseReminder[],
) {
  return uniqueBy(
    [...existing, ...imported],
    (item) => `${item.text.toLowerCase()}|${item.due.toLowerCase()}`,
  ).sort((left, right) => compareDueStrings(left.due, right.due));
}

// Safe text budget for the syllabus AI prompt.
// Cerebras (llama-3.3-70b) and Groq models have large contexts but we stay
// well under 128k tokens to avoid truncation errors on any provider.
// ~40 000 chars ≈ ~10 000 tokens of document text.
const SYLLABUS_AI_TEXT_LIMIT = 40_000;

const SYSTEM_PROMPT = [
  "You are a precise course-data extractor for LearnBeam.",
  "Read the syllabus carefully — including every table row, schedule entry, grading breakdown, list item, and any attached page image.",
  "Return ONLY a single valid JSON object. No markdown fences, no extra text, no explanation — pure JSON.",
  "If a field is unknown use null. If a list is empty use [].",
  "IMPORTANT — be exhaustive about assignments:",
  "  • Scan every table column and row for assignments, exams, quizzes, labs, projects, participation, or any graded item.",
  "  • Include ALL recurring items (e.g. 'Weekly Quizzes', 'Lab Reports') as separate entries.",
  "  • Include items even if the due date or weight is unknown.",
  "IMPORTANT — attached images may contain scanned text, tables, or schedules that are missing from the extracted text. Use them too.",
  "Date format: YYYY-MM-DD or YYYY-MM-DD HH:mm. Weights are plain numbers (no % sign).",
].join(" ");

const JSON_SHAPE = '{"courseCode":string|null,"courseName":string|null,"instructor":string|null,"term":string|null,"meetingSchedule":string|null,"location":string|null,"summary":string|null,"gradingPolicy":[{"label":string,"weight":number|null,"notes":string|null}],"assignments":[{"label":string,"type":string,"due":string|null,"weight":number|null,"notes":string|null}],"reminders":[{"text":string,"due":string|null}],"warnings":string[]}';

async function callSparkAIForSyllabus(
  extractedText: string,
  context: AnalyzeContext,
  options?: AnalyzeSyllabusTextOptions,
): Promise<RawAnalysis> {
  // Truncate to a size that is safe for all providers (Cerebras, Groq, Gemini).
  // Head-heavy: keep more of the beginning (course info, grading) and a tail
  // (final schedule rows) since assignments are often at the end too.
  const safeText = extractedText.length > SYLLABUS_AI_TEXT_LIMIT
    ? extractedText.slice(0, Math.floor(SYLLABUS_AI_TEXT_LIMIT * 0.78)).trimEnd() +
      "\n\n[... syllabus text truncated for AI token limits ...]\n\n" +
      extractedText.slice(-Math.floor(SYLLABUS_AI_TEXT_LIMIT * 0.18)).trimStart()
    : extractedText;

  const userContent = [
    `Extract ALL course data from the syllabus below into this exact JSON shape:`,
    JSON_SHAPE,
    "",
    `Course code hint: ${context.courseCode || "unknown"}`,
    `Course name hint: ${context.courseName || "unknown"}`,
    `File: ${context.sourceFileName}`,
    options?.images?.length
      ? `Attached page images: ${options.images.length}. Inspect them for scanned tables, grading charts, and schedule text that may not appear in the extracted text.`
      : "No page images were attached.",
    "",
    "=== SYLLABUS TEXT START ===",
    safeText || "(No text could be extracted — the file may be a scanned image. Extract whatever you can infer from the filename.)",
    "=== SYLLABUS TEXT END ===",
  ].join("\n");

  const messages: SparkAIMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: userContent,
      images: options?.images?.length ? options.images : undefined,
    },
  ];

  let response: string;
  try {
    response = await chatWithSparkAI(messages, { task: "syllabus-analysis" });
  } catch (err) {
    throw new Error(`Gemini-powered Spark could not be reached: ${err instanceof Error ? err.message : String(err)}`);
  }

  // First parse attempt
  try {
    return JSON.parse(extractJsonPayload(response)) as RawAnalysis;
  } catch {
    // Retry with an even stricter prompt asking Spark AI to fix the JSON
    let retryResponse: string;
    try {
      retryResponse = await chatWithSparkAI([
        { role: "system", content: "Return ONLY valid JSON. No explanation, no markdown, no extra text whatsoever." },
        { role: "user", content: `The previous response could not be parsed as JSON. Re-output ONLY the JSON object in this shape:\n${JSON_SHAPE}\n\nSyllabus context:\n${safeText.slice(0, 8000)}` },
      ], { task: "syllabus-analysis" });
      return JSON.parse(extractJsonPayload(retryResponse)) as RawAnalysis;
    } catch {
      // Return a minimal fallback so at least partial data is saved
      return {
        courseCode: context.courseCode || null,
        courseName: context.courseName || null,
        warnings: ["Spark could not fully parse the syllabus. Try a text-based PDF or DOCX file."],
      };
    }
  }
}

/** Analyse already-extracted text — useful for re-scanning stored documents */
export async function analyzeSyllabusText(
  extractedText: string,
  context: AnalyzeContext,
  options?: AnalyzeSyllabusTextOptions,
): Promise<SyllabusAnalysisResult> {
  const payload = await callSparkAIForSyllabus(extractedText, context, options);
  const assignments = normalizeAssignments(payload.assignments);
  const gradingPolicy = normalizeGradingPolicy(payload.gradingPolicy);
  const reminders = normalizeReminders(payload.reminders, assignments);

  return {
    insights: {
      courseCode: cleanString(payload.courseCode) ?? (context.courseCode || null),
      courseName: cleanString(payload.courseName) ?? (context.courseName || null),
      instructor: cleanString(payload.instructor),
      term: cleanString(payload.term),
      meetingSchedule: cleanString(payload.meetingSchedule),
      location: cleanString(payload.location),
      summary: cleanString(payload.summary),
      gradingPolicy,
      warnings: uniqueStrings([
        ...(Array.isArray(payload.warnings) ? payload.warnings : []),
        ...(options?.extractionWarnings ?? []),
      ]),
      sourceFileName: context.sourceFileName,
      analyzedAt: new Date().toISOString(),
    },
    assignments,
    reminders,
    extractedText,
  };
}

export async function analyzeSyllabusFile(
  file: File,
  context: AnalyzeContext,
  options?: AnalyzeSyllabusOptions,
): Promise<SyllabusAnalysisResult> {
  const extracted = await extractSyllabusContent(file);
  options?.onExtractedText?.();
  return analyzeSyllabusText(extracted.text, context, {
    images: extracted.images,
    extractionWarnings: extracted.warnings,
  });
}
