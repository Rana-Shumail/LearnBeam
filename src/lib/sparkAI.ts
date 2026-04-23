import { SUPABASE_CONFIGURED, supabase } from "./supabase";

export type SparkAIImage = {
  data: string;
  mimeType: string;
};

export type SparkAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  images?: SparkAIImage[];
};

export type SparkAICitation = {
  title: string;
  url: string;
};

export type SparkAIOptions = {
  useSearch?: boolean;
  task?: "course-chat" | "general-chat" | "quiz" | "course-suggestions" | "dashboard-suggestions" | "fact-check" | "syllabus-analysis" | "generic";
};

export type SparkAIResult = {
  content: string;
  citations: SparkAICitation[];
  grounded: boolean;
  model: string | null;
  provider: "gemini" | "cerebras" | "groq" | null;
};

type SparkAIInvokeResponse = {
  content?: string;
  error?: string;
  message?: string;
  citations?: Array<{
    title?: string;
    url?: string;
  }>;
  grounded?: boolean;
  model?: string;
  provider?: string;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: {
          uri?: string;
          title?: string;
        };
      }>;
    };
  }>;
  error?: { message?: string };
};

/* ── Config ──────────────────────────────────────────── */
const rawFunctionName   = (import.meta.env.VITE_SPARK_FUNCTION_NAME as string | undefined)?.trim();
const rawSupabaseUrl    = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const rawSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();
const rawSparkBaseUrl   = (import.meta.env.VITE_SPARK_BASE_URL as string | undefined)?.trim();

// Direct Gemini key — only used when Supabase/Edge Function routing is unavailable.
// Keeping this as a true last-resort path avoids local-only behavior diverging from production.
const rawGeminiKey = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim();

export const SPARK_FUNCTION_NAME     = rawFunctionName || "spark-ai";
export const SPARK_BASE_URL          = (rawSparkBaseUrl || (rawSupabaseUrl ? `${rawSupabaseUrl}/functions/v1` : "")).replace(/\/+$/, "");
export const GEMINI_DIRECT_AVAILABLE = Boolean(rawGeminiKey);
const DIRECT_GEMINI_ALLOWED          = !SUPABASE_CONFIGURED && GEMINI_DIRECT_AVAILABLE;

const GEMINI_DIRECT_MODEL = "gemini-2.5-flash-lite";

// Max ms we'll sleep waiting for a Gemini quota cooldown before giving up.
const MAX_QUOTA_WAIT_MS = 25_000;

/* ── Edge Function path ──────────────────────────────── */
function buildSparkUrl() {
  if (!SPARK_BASE_URL) return "";
  return `${SPARK_BASE_URL}/${encodeURIComponent(SPARK_FUNCTION_NAME)}`;
}

async function buildSparkHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (rawSupabaseAnonKey) headers.apikey = rawSupabaseAnonKey;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function extractErrorMessage(payload: SparkAIInvokeResponse | null, fallback: string) {
  const value = payload?.error || payload?.message || "";
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function describeRetryDelay(message: string) {
  const match = message.match(/retry in\s+([0-9.]+)s/i);
  if (!match) return null;
  const seconds = Math.max(1, Math.ceil(Number(match[1])));
  if (!Number.isFinite(seconds)) return null;
  return seconds;
}

async function describeSparkFailure(response: Response) {
  const fallback = `Spark function "${SPARK_FUNCTION_NAME}" failed with status ${response.status}.`;
  const text = await response.text().catch(() => "");
  let payload: SparkAIInvokeResponse | null = null;
  if (text) { try { payload = JSON.parse(text) as SparkAIInvokeResponse; } catch { payload = null; } }
  const base = extractErrorMessage(payload, text.trim() || fallback);
  if (response.status === 401) return `${base} Sign in again so Spark can forward your Supabase session.`;
  if (response.status === 429) {
    const retrySeconds = describeRetryDelay(base);
    return retrySeconds
      ? `Spark is temporarily at capacity. Wait about ${retrySeconds} seconds, then try again. ${base}`
      : `Spark is temporarily at capacity. Please wait a bit, then try again. ${base}`;
  }
  if (response.status === 404) return `${base} The "${SPARK_FUNCTION_NAME}" Edge Function is not deployed yet.`;
  if (response.status >= 500) return `${base} Check that Spark's provider secrets are set in the Edge Function runtime.`;
  return base;
}

function isQuotaError(message: string) {
  return /quota|rate limit|too many requests|retry in/i.test(message);
}

function shouldFallbackToDirectGemini(message: string) {
  return /could not reach the spark-ai edge function|edge function is not deployed yet|missing its function url/i.test(message.toLowerCase());
}

function normalizeCitations(citations: unknown): SparkAICitation[] {
  if (!Array.isArray(citations)) return [];
  const seen = new Set<string>();

  return citations.flatMap((citation) => {
    if (!citation || typeof citation !== "object") return [];
    const record = citation as { title?: unknown; url?: unknown };
    if (typeof record.url !== "string" || !record.url.trim()) return [];
    const url = record.url.trim();
    if (seen.has(url)) return [];
    seen.add(url);
    return [{
      title: typeof record.title === "string" && record.title.trim() ? record.title.trim() : url,
      url,
    }];
  });
}

function extractGroundedCitations(payload: GeminiResponse | null): SparkAICitation[] {
  const chunks = payload?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  return normalizeCitations(chunks.map((chunk) => ({
    title: chunk.web?.title,
    url: chunk.web?.uri,
  })));
}

async function invokeEdgeFunction(messages: SparkAIMessage[], options?: SparkAIOptions): Promise<SparkAIResult> {
  const url = buildSparkUrl();
  if (!url) throw new Error("Spark AI is missing its function URL. Set VITE_SUPABASE_URL or VITE_SPARK_BASE_URL.");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: await buildSparkHeaders(),
      body: JSON.stringify({
        messages,
        useSearch: Boolean(options?.useSearch),
        task: options?.task ?? "generic",
      }),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message.trim() : "Network request failed.";
    throw new Error(`${reason} Could not reach the spark-ai Edge Function at ${url}.`);
  }

  if (!response.ok) throw new Error(await describeSparkFailure(response));

  const payload = await response.json().catch(() => null) as SparkAIInvokeResponse | null;
  const content = payload?.content?.trim();
  if (!content) throw new Error(payload?.error || "Spark AI returned an empty response.");
  return {
    content,
    citations: normalizeCitations(payload?.citations),
    grounded: Boolean(payload?.grounded),
    model: typeof payload?.model === "string" ? payload.model : null,
    provider: payload?.provider === "cerebras" || payload?.provider === "gemini" || payload?.provider === "groq"
      ? payload.provider
      : null,
  };
}

/* ── Direct Gemini path (fallback) ───────────────────── */
function buildGeminiPayload(messages: SparkAIMessage[], options?: SparkAIOptions) {
  const systemInstruction = messages
    .filter(m => m.role === "system")
    .map(m => m.content)
    .filter(Boolean)
    .join("\n\n");

  const contents = messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [
        ...(m.content ? [{ text: m.content }] : []),
        ...(m.images ?? []).map(img => ({
          inline_data: { mime_type: img.mimeType, data: img.data },
        })),
      ],
    }))
    .filter(m => m.parts.length > 0);

  if (contents.length === 0) throw new Error("No conversation content to send to Gemini.");

  return {
    ...(systemInstruction ? { system_instruction: { parts: [{ text: systemInstruction }] } } : {}),
    contents,
    ...(options?.useSearch ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: { temperature: 0.2, topP: 0.95, topK: 32, maxOutputTokens: 8192 },
  };
}

async function callGeminiDirectOnce(
  model: string,
  messages: SparkAIMessage[],
  options?: SparkAIOptions,
): Promise<SparkAIResult> {
  if (!rawGeminiKey) throw new Error("VITE_GEMINI_API_KEY is not set in .env.local.");
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${rawGeminiKey}`;

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildGeminiPayload(messages, options)),
    });
  } catch (error) {
    throw new Error(`Could not reach Gemini API: ${error instanceof Error ? error.message : String(error)}`);
  }

  const payload = await response.json().catch(() => null) as GeminiResponse | null;
  if (!response.ok) {
    const base = payload?.error?.message || `Gemini API error ${response.status}.`;
    throw new Error(`${base} [model=${model}]`);
  }

  const text = (payload?.candidates ?? [])
    .flatMap(c => c.content?.parts ?? [])
    .map(p => (typeof p.text === "string" ? p.text : ""))
    .join("")
    .trim();

  if (!text) throw new Error("Gemini returned an empty response.");
  return {
    content: text,
    citations: extractGroundedCitations(payload),
    grounded: Boolean(payload?.candidates?.[0]?.groundingMetadata),
    model,
    provider: "gemini",
  };
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function callGeminiDirect(messages: SparkAIMessage[], options?: SparkAIOptions): Promise<SparkAIResult> {
  try {
    return await callGeminiDirectOnce(GEMINI_DIRECT_MODEL, messages, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!isQuotaError(message)) throw error;

    // Quota hit — wait the suggested cooldown then retry once.
    const retrySeconds = describeRetryDelay(message);
    const waitMs = retrySeconds ? retrySeconds * 1000 + 800 : 0;
    if (waitMs > 0 && waitMs <= MAX_QUOTA_WAIT_MS) {
      await sleep(waitMs);
      return callGeminiDirectOnce(GEMINI_DIRECT_MODEL, messages, options);
    }
    throw error;
  }
}

/* ── Unified caller — Edge Function first, direct Gemini fallback ── */
async function callSparkAI(messages: SparkAIMessage[], options?: SparkAIOptions): Promise<SparkAIResult> {
  // 1. Try Supabase Edge Function (secure path — Cerebras key stays on the server).
  if (SUPABASE_CONFIGURED) {
    try {
      return await invokeEdgeFunction(messages, options);
    } catch (edgeError) {
      const message = edgeError instanceof Error ? edgeError.message : String(edgeError);

      if (isQuotaError(message)) {
        // The Edge Function now owns provider fallback. For quota/rate-limit issues,
        // keep the same task/search mode and retry once after the suggested cooldown.
        const retrySeconds = describeRetryDelay(message);
        const waitMs = retrySeconds ? retrySeconds * 1000 + 800 : 0;
        if (waitMs > 0 && waitMs <= MAX_QUOTA_WAIT_MS) {
          await sleep(waitMs);
          return await invokeEdgeFunction(messages, options);
        }
        throw edgeError;
      }

      // Non-quota Edge Function failure — only fall back to direct Gemini when
      // the function is genuinely not deployed (not a transient error).
      if (!DIRECT_GEMINI_ALLOWED || !shouldFallbackToDirectGemini(message)) throw edgeError;
    }
  }

  // 2. Direct Gemini API call (development / Edge Function not deployed).
  //    Cerebras is server-side only, so this path is Gemini-only.
  if (DIRECT_GEMINI_ALLOWED) {
    return await callGeminiDirect(messages, options);
  }

  throw new Error(
    "Spark AI is not configured. Either deploy the spark-ai Supabase Edge Function " +
    "or add VITE_GEMINI_API_KEY to your .env.local file.",
  );
}

/* ── Public API ─────────────────────────────────────── */
export async function chatWithSparkAI(
  messages: SparkAIMessage[],
  options?: SparkAIOptions,
): Promise<string> {
  const result = await callSparkAI(messages, options);
  return result.content;
}

export async function chatWithSparkAIResult(
  messages: SparkAIMessage[],
  options?: SparkAIOptions,
): Promise<SparkAIResult> {
  return callSparkAI(messages, options);
}

/**
 * Streaming-style wrapper — Edge Function is non-streaming so we deliver
 * the full response in one shot, but keep the same callback interface.
 */
export async function streamWithSparkAI(
  messages: SparkAIMessage[],
  onChunk: (partial: string) => void,
  options?: SparkAIOptions,
): Promise<SparkAIResult> {
  const result = await callSparkAI(messages, options);
  onChunk(result.content);
  return result;
}
