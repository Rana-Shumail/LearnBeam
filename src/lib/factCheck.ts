import { chatWithSparkAI } from "./sparkAI";
import { SUPABASE_CONFIGURED } from "./supabase";
import { fetchFactCheckReport, fetchFactCheckReports, upsertFactCheckReport } from "./db";
import type { Doc } from "../app/components/course/types.tsx";

/* ── Quota error — propagated so UI can show a specific modal ── */
export class FactCheckQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FactCheckQuotaError";
  }
}

function isQuotaMessage(msg: string) {
  return /quota|rate.?limit|retry in|temporarily busy/i.test(msg);
}

/* ── Types ─────────────────────────────────────────── */
export type FactCheckVerdict = "accurate" | "inaccurate" | "unverifiable";

export type FactCheckClaim = {
  claim: string;
  verdict: FactCheckVerdict;
  explanation: string;
  citation?: string;
};

export type FactCheckReport = {
  docName: string;
  claims: FactCheckClaim[];
  summary: string;
};

type CachedFactCheckEntry = {
  signature: string;
  report: FactCheckReport;
  generatedAt: string;
};

const FACT_CHECK_CACHE_KEY = "lb-fact-check-cache-v1";

function buildDocCacheKey(doc: Doc) {
  if (isRealDocId(doc)) return `doc:${doc.id}`;
  if (doc.storagePath) return `path:${doc.storagePath}`;
  return `name:${doc.name}`;
}

function readFactCheckCache() {
  if (typeof localStorage === "undefined") return {} as Record<string, CachedFactCheckEntry>;
  try {
    const parsed = JSON.parse(localStorage.getItem(FACT_CHECK_CACHE_KEY) ?? "{}") as Record<string, CachedFactCheckEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeFactCheckCache(cache: Record<string, CachedFactCheckEntry>) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(FACT_CHECK_CACHE_KEY, JSON.stringify(cache));
}

function buildDocSignature(doc: Doc) {
  const text = doc.textContent ?? "";
  return [
    doc.name,
    doc.type,
    text.length,
    text.slice(0, 240),
    text.slice(-160),
  ].join("::");
}

function loadCachedFactCheck(doc: Doc): FactCheckReport | null {
  const cacheKey = buildDocCacheKey(doc);
  const cache = readFactCheckCache();
  const entry = cache[cacheKey];
  if (!entry) return null;
  if (entry.signature !== buildDocSignature(doc)) return null;
  return entry.report;
}

function saveCachedFactCheck(doc: Doc, report: FactCheckReport) {
  const cache = readFactCheckCache();
  cache[buildDocCacheKey(doc)] = {
    signature: buildDocSignature(doc),
    report,
    generatedAt: new Date().toISOString(),
  };
  writeFactCheckCache(cache);
}

export function primeCachedFactCheck(doc: Doc, report: FactCheckReport) {
  saveCachedFactCheck(doc, report);
}

/**
 * Returns the fact-check status of a document from localStorage cache.
 * Does NOT make any network requests — purely local.
 * Returns null if no cached report exists for this doc.
 */
export function getDocumentFactCheckStatus(
  doc: Doc,
): "accurate" | "inaccurate" | "mixed" | "unverifiable" | null {
  const report = loadCachedFactCheck(doc);
  if (!report) return null;
  if (report.claims.length === 0) return "unverifiable";

  const hasInaccurate  = report.claims.some(c => c.verdict === "inaccurate");
  const hasAccurate    = report.claims.some(c => c.verdict === "accurate");
  const allUnverifiable = report.claims.every(c => c.verdict === "unverifiable");

  if (allUnverifiable) return "unverifiable";
  if (hasInaccurate && hasAccurate) return "mixed";
  if (hasInaccurate) return "inaccurate";
  return "accurate";
}

/**
 * Robustly extracts a JSON object from a Gemini response.
 * Gemini with useSearch:true often adds preamble/postamble text around
 * the JSON (e.g. "Based on my research: {...} Hope that helps.").
 * Strategy: try direct parse → strip code fence → find first { … last }
 */
function parseJsonResponse(response: string): unknown {
  const raw = response.trim();

  // 1. Direct parse (ideal case — pure JSON returned)
  try { return JSON.parse(raw); } catch { /* fall through */ }

  // 2. Strip markdown code fences and try again
  const fenceStripped = raw
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try { return JSON.parse(fenceStripped); } catch { /* fall through */ }

  // 3. Find first { and last } and try to extract the JSON object
  const firstBrace = raw.indexOf("{");
  const lastBrace  = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return JSON.parse(raw.slice(firstBrace, lastBrace + 1)); } catch { /* fall through */ }
  }

  // 4. Find first [ and last ] for JSON arrays
  const firstBracket = raw.indexOf("[");
  const lastBracket  = raw.lastIndexOf("]");
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try { return JSON.parse(raw.slice(firstBracket, lastBracket + 1)); } catch { /* fall through */ }
  }

  // Nothing worked — throw so callers can use their fallback paths
  throw new SyntaxError(`Could not extract valid JSON from Gemini response. Preview: ${raw.slice(0, 120)}`);
}

/** True when the doc has a real (non-temporary) Supabase UUID. */
function isRealDocId(doc: Doc) {
  return SUPABASE_CONFIGURED && Boolean(doc.id) && !doc.id.startsWith("temp-");
}

export async function primePersistedFactCheckCache(docs: Doc[]): Promise<number> {
  const uncachedDocs = docs.filter((doc) => isRealDocId(doc) && !loadCachedFactCheck(doc));
  if (uncachedDocs.length === 0) return 0;

  const byId = new Map(uncachedDocs.map((doc) => [doc.id, doc]));
  const rows = await fetchFactCheckReports(uncachedDocs.map((doc) => doc.id)).catch(() => []);

  let primed = 0;
  for (const row of rows) {
    const doc = byId.get(row.documentId);
    if (!doc) continue;
    saveCachedFactCheck(doc, {
      docName: row.report.docName,
      summary: row.report.summary,
      claims: row.report.claims as FactCheckClaim[],
    });
    primed += 1;
  }

  return primed;
}

/* ── Fact-check a single document ────────────────────
   Check DB → localStorage → generate. Saves to both
   stores so the report is never re-generated.
──────────────────────────────────────────────────── */
export async function factCheckDocument(doc: Doc): Promise<FactCheckReport> {
  if (doc.type === "syllabus") {
    return {
      docName: doc.name,
      claims: [],
      summary: "Syllabus files are excluded from fact-checking because they are used to build course structure, not to verify outside factual claims.",
    };
  }

  if (!doc.textContent || doc.textContent.trim().length < 20) {
    return {
      docName: doc.name,
      claims: [],
      summary: "This document has no readable text content to fact-check.",
    };
  }

  // 1. Check localStorage first (fastest, no network).
  const cached = loadCachedFactCheck(doc);
  if (cached) return cached;

  // 2. Check Supabase DB — report may have been generated on another device/session.
  if (isRealDocId(doc)) {
    const dbReport = await fetchFactCheckReport(doc.id).catch(() => null);
    if (dbReport) {
      const report: FactCheckReport = {
        docName: dbReport.docName,
        summary: dbReport.summary,
        claims: dbReport.claims as FactCheckClaim[],
      };
      // Backfill localStorage so subsequent checks are instant.
      saveCachedFactCheck(doc, report);
      return report;
    }
  }

  const excerpt = doc.textContent.slice(0, 6000);

  const prompt = `You are a rigorous fact-checker reviewing study materials for a university course.

Carefully read the following document excerpt and identify all factual claims — statements that assert something to be true about the world (statistics, historical events, scientific facts, definitions, processes, named concepts, etc.).

For each claim:
1. Evaluate whether it is ACCURATE, INACCURATE, or UNVERIFIABLE based on reliable knowledge.
2. Give a short explanation (1–2 sentences) citing your reasoning.
3. If the claim is wrong or misleading, state what the correct information is.
4. For each verdict, include a short citation to the strongest reliable source you can support (prefer official documentation, government, standards bodies, publishers, or reputable educational sources).

IMPORTANT RULES:
- Do NOT fact-check opinions, course-specific policies, or subjective statements.
- Be honest — if you cannot verify a claim with high confidence, mark it UNVERIFIABLE.
- Be precise — quote the claim exactly as it appears in the text.
- Prefer fewer, high-confidence claims over many weak ones.
- If a claim depends on time, version, or context, mention that clearly.

Return your response as a JSON object with this exact structure:
{
  "summary": "One-paragraph overall assessment of the document's factual accuracy.",
  "claims": [
    {
      "claim": "The exact claim from the document",
      "verdict": "accurate" | "inaccurate" | "unverifiable",
      "explanation": "Your explanation and reasoning",
      "citation": "Source or reference (optional)"
    }
  ]
}

Only return valid JSON — no markdown, no code fences, no extra text.

Document: "${doc.name}"
---
${excerpt}`;

  let response: string;
  try {
    response = await chatWithSparkAI([
      { role: "system", content: "You are a precise fact-checker. Respond only with valid JSON." },
      { role: "user", content: prompt },
    ], { useSearch: true, task: "fact-check" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Quota errors get a dedicated error class so the UI can show a specific modal.
    if (isQuotaMessage(msg)) throw new FactCheckQuotaError(msg);
    throw err;
  }

  let parsed: { summary: string; claims: FactCheckClaim[] };
  try {
    parsed = parseJsonResponse(response) as typeof parsed;
  } catch {
    // Fallback: return as a single unverifiable entry
    return {
      docName: doc.name,
      claims: [{
        claim: "Unable to parse fact-check response",
        verdict: "unverifiable",
        explanation: response.slice(0, 300),
      }],
      summary: "Fact-check could not be fully parsed. See raw response above.",
    };
  }

  const report: FactCheckReport = {
    docName: doc.name,
    claims: Array.isArray(parsed.claims) ? parsed.claims : [],
    summary: parsed.summary ?? "",
  };
  saveCachedFactCheck(doc, report);
  // Persist to DB so it is available on any device without regenerating.
  if (isRealDocId(doc)) {
    void upsertFactCheckReport(doc.id, report).catch(() => {});
  }
  return report;
}

/* ── Fact-check all eligible docs in a course ────────
   Skips syllabus docs — only checks notes, readings,
   past exams, and other uploaded documents.
──────────────────────────────────────────────────── */
export async function factCheckAllDocs(
  docs: Doc[],
  onProgress?: (current: number, total: number, docName: string) => void,
): Promise<FactCheckReport[]> {
  const eligible = docs.filter(d => d.type !== "syllabus" && Boolean(d.textContent?.trim()));
  if (eligible.length === 0) return [];

  const cachedReports = eligible.flatMap((doc) => {
    const cached = loadCachedFactCheck(doc);
    return cached ? [cached] : [];
  });
  const uncachedDocs = eligible.filter((doc) => !loadCachedFactCheck(doc));

  if (uncachedDocs.length === 0) return cachedReports;

  if (uncachedDocs.length === 1) {
    onProgress?.(1, 1, uncachedDocs[0].name);
    const single = await factCheckDocument(uncachedDocs[0]);
    return [...cachedReports, single];
  }

  onProgress?.(1, 1, "selected files");
  const packedDocs = uncachedDocs.map((doc) => ({
    id: doc.id,
    name: doc.name,
    excerpt: (doc.textContent ?? "").slice(0, 5000),
  }));

  let response: string;
  try {
    response = await chatWithSparkAI([
    {
      role: "system",
      content: "You are a precise fact-checker. Respond only with valid JSON.",
    },
    {
      role: "user",
      content: `Review the following course documents and fact-check only strong, objective factual claims.

Return valid JSON with this exact shape:
{
  "reports": [
    {
      "docName": "string",
      "summary": "string",
      "claims": [
        {
          "claim": "string",
          "verdict": "accurate" | "inaccurate" | "unverifiable",
          "explanation": "string",
          "citation": "string"
        }
      ]
    }
  ]
}

Rules:
- Skip opinions, instructor policies, grading policies, and subjective advice.
- Prefer fewer, high-confidence claims.
- Use grounded, reliable sources when possible.
- If a claim depends on time or version, say so.
- Match each report to the correct document name.

Documents:
${packedDocs.map((doc) => `Document ID: ${doc.id}\nDocument Name: ${doc.name}\n---\n${doc.excerpt}`).join("\n\n====\n\n")}`,
    },
  ], { useSearch: true, task: "fact-check" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isQuotaMessage(msg)) throw new FactCheckQuotaError(msg);
    throw err;
  }

  let parsed: { reports?: FactCheckReport[] };
  try {
    parsed = parseJsonResponse(response) as typeof parsed;
  } catch {
    // Fall back to per-document requests if the batch response is malformed.
    // Partial results are preserved — if a quota error hits mid-loop we return
    // whatever completed so far rather than losing everything.
    const fallbackReports: FactCheckReport[] = [];
    for (let i = 0; i < uncachedDocs.length; i++) {
      const doc = uncachedDocs[i];
      onProgress?.(i + 1, uncachedDocs.length, doc.name);
      try {
        fallbackReports.push(await factCheckDocument(doc));
      } catch (err) {
        // Re-throw quota errors only after returning any partial results we have.
        if (fallbackReports.length > 0) return [...cachedReports, ...fallbackReports];
        throw err;
      }
    }
    return [...cachedReports, ...fallbackReports];
  }

  const byName = new Map<string, FactCheckReport>();
  for (const report of parsed.reports ?? []) {
    if (!report || typeof report.docName !== "string") continue;
    byName.set(report.docName, {
      docName: report.docName,
      summary: typeof report.summary === "string" ? report.summary : "",
      claims: Array.isArray(report.claims) ? report.claims : [],
    });
  }

  const freshReports = uncachedDocs.map((doc) => {
    const report: FactCheckReport = byName.get(doc.name) ?? {
      docName: doc.name,
      summary: "No high-confidence factual claims were identified in this file.",
      claims: [],
    };
    saveCachedFactCheck(doc, report);
    // Persist each report to DB so batch results survive across sessions/devices.
    if (isRealDocId(doc)) {
      void upsertFactCheckReport(doc.id, report).catch(() => {});
    }
    return report;
  });

  return [...cachedReports, ...freshReports];
}
