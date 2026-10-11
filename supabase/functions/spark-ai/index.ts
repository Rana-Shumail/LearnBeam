import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

type IncomingImage = {
  data?: unknown;
  mimeType?: unknown;
};

type IncomingMessage = {
  role?: unknown;
  content?: unknown;
  images?: unknown;
};

type IncomingBody = {
  messages?: unknown;
  useSearch?: unknown;
  task?: unknown;
};

type SparkProvider = "gemini" | "cerebras" | "groq" | "nvidia";
type SparkSearchProvider = "tinyfish" | "gemini" | "groq";

type SparkTask =
  | "course-chat"
  | "general-chat"
  | "quiz"
  | "course-suggestions"
  | "dashboard-suggestions"
  | "study-planner"
  | "fact-check"
  | "syllabus-analysis"
  | "generic";

type SparkAIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  images: Array<{ data: string; mimeType: string }>;
};

type SparkResult = {
  content: string;
  citations: Array<{ title: string; url: string }>;
  grounded: boolean;
  model: string;
  provider: SparkProvider;
  searchProvider?: SparkSearchProvider | null;
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: {
          uri?: string;
          title?: string;
        };
      }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
    blockReasonMessage?: string;
  };
  error?: {
    message?: string;
  };
};

type OpenAICompatibleResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
      executed_tools?: unknown;
    };
  }>;
  citations?: unknown;
  search_results?: unknown;
  references?: unknown;
  error?: {
    message?: string;
  };
};

type ProviderAttempt = {
  label: string;
  provider: SparkProvider;
  configured: boolean;
  run: (messages: SparkAIMessage[]) => Promise<SparkResult>;
};

function parseApiKeys(...envVarNames: string[]): string[] {
  const keys: string[] = [];
  for (const name of envVarNames) {
    const raw = Deno.env.get(name)?.trim();
    if (!raw) continue;
    for (const part of raw.split(/[\s,]+/)) {
      const clean = part.trim();
      if (clean && !keys.includes(clean)) {
        keys.push(clean);
      }
    }
  }
  return keys;
}

function getGeminiApiKeys(): string[] {
  return parseApiKeys("GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_FALLBACK_API_KEY");
}

function getGroqApiKeys(): string[] {
  return parseApiKeys("GROQ_API_KEY", "GROQ_API_KEY_2", "GROQ_FALLBACK_API_KEY");
}

function getCerebrasApiKeys(): string[] {
  return parseApiKeys("CEREBRAS_API_KEY", "CEREBRAS_API_KEY_2", "CEREBRAS_FALLBACK_API_KEY");
}

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-3.8-flash";
// Fallback must be a genuinely different model so quota/model errors on primary have a real escape path.
const GEMINI_FALLBACK_MODEL = Deno.env.get("GEMINI_FALLBACK_MODEL")?.trim() || "gemini-2.5-flash-lite";

const CEREBRAS_API_KEY = Deno.env.get("CEREBRAS_API_KEY")?.trim();
const configuredCerebrasModel = Deno.env.get("CEREBRAS_MODEL")?.trim();
// Migrate the previous model name without requiring an immediate hosted-secret update.
const CEREBRAS_MODEL = configuredCerebrasModel === "llama-3.3-70b"
  ? "gpt-oss-120b"
  : configuredCerebrasModel || "gpt-oss-120b";
const CEREBRAS_FALLBACK_MODEL = Deno.env.get("CEREBRAS_FALLBACK_MODEL")?.trim() || "llama3.1-8b";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")?.trim();
const GROQ_MODEL = Deno.env.get("GROQ_MODEL")?.trim() || "openai/gpt-oss-20b";
const GROQ_FALLBACK_MODEL = Deno.env.get("GROQ_FALLBACK_MODEL")?.trim() || "openai/gpt-oss-120b";
const configuredGroqSearchModel = Deno.env.get("GROQ_SEARCH_MODEL")?.trim();
// Compound and Compound Mini were retired. Transparently migrate an old hosted
// secret to Groq's supported GPT-OSS browser-search flow.
const GROQ_SEARCH_MODEL = configuredGroqSearchModel?.startsWith("groq/compound")
  ? GROQ_MODEL
  : configuredGroqSearchModel || GROQ_MODEL;
const GROQ_VISION_MODEL = Deno.env.get("GROQ_VISION_MODEL")?.trim() || "meta-llama/llama-4-scout-17b-16e-instruct";

const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY")?.trim();
const NVIDIA_MODEL = Deno.env.get("NVIDIA_MODEL")?.trim() || "nvidia/nemotron-3.5-lightning-30b-a3b";
const NVIDIA_FALLBACK_MODEL = Deno.env.get("NVIDIA_FALLBACK_MODEL")?.trim() || "nvidia/nemotron-3-super-120b-a12b";

const TINYFISH_API_KEY = Deno.env.get("TINYFISH_API_KEY")?.trim();
const TINYFISH_SEARCH_ENDPOINT = Deno.env.get("TINYFISH_SEARCH_ENDPOINT")?.trim() || "https://api.search.tinyfish.ai";
const TINYFISH_FETCH_ENDPOINT = Deno.env.get("TINYFISH_FETCH_ENDPOINT")?.trim() || "https://api.fetch.tinyfish.ai";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim();
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")?.trim();

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMs = 30_000,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`Provider request timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeImages(images: unknown): Array<{ data: string; mimeType: string }> {
  if (!Array.isArray(images)) return [];

  return images.flatMap((image) => {
    if (!image || typeof image !== "object") return [];
    const record = image as IncomingImage;
    if (typeof record.data !== "string" || !record.data.trim()) return [];
    const mimeType = typeof record.mimeType === "string" && record.mimeType.trim()
      ? record.mimeType.trim()
      : "image/jpeg";
    return [{ data: record.data.trim(), mimeType }];
  });
}

function normalizeMessages(messages: unknown): SparkAIMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages.flatMap((message) => {
    if (!message || typeof message !== "object") return [];
    const record = message as IncomingMessage;
    if (record.role !== "system" && record.role !== "user" && record.role !== "assistant") return [];
    const content = typeof record.content === "string" ? record.content.trim() : "";
    const images = normalizeImages(record.images);
    if (!content && images.length === 0) return [];
    return [{
      role: record.role,
      content,
      images,
    }];
  });
}

function normalizeTask(task: unknown): SparkTask {
  if (
    task === "course-chat" ||
    task === "general-chat" ||
    task === "quiz" ||
    task === "course-suggestions" ||
    task === "dashboard-suggestions" ||
    task === "study-planner" ||
    task === "fact-check" ||
    task === "syllabus-analysis" ||
    task === "generic"
  ) {
    return task;
  }
  return "generic";
}

function hasImages(messages: SparkAIMessage[]) {
  return messages.some((message) => message.images.length > 0);
}

function likelyRequestsJson(messages: SparkAIMessage[]) {
  const combined = messages
    .map((message) => message.content)
    .join("\n")
    .toLowerCase();

  return /return json|valid json|json only|json object|respond only with valid json|response as json/.test(combined);
}

function normalizeCitations(citations: unknown) {
  if (!Array.isArray(citations)) return [];
  const seen = new Set<string>();

  return citations.flatMap((citation) => {
    if (!citation || typeof citation !== "object") return [];
    const record = citation as Record<string, unknown>;
    const url = typeof record.url === "string" && record.url.trim()
      ? record.url.trim()
      : typeof record.uri === "string" && record.uri.trim()
        ? record.uri.trim()
        : null;
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{
      title: typeof record.title === "string" && record.title.trim() ? record.title.trim() : url,
      url,
    }];
  });
}

function buildGeminiPayload(messages: SparkAIMessage[], useSearch = false) {
  const systemInstruction = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .filter(Boolean)
    .join("\n\n");

  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [
        ...(message.content ? [{ text: message.content }] : []),
        ...message.images.map((image) => ({
          inline_data: {
            mime_type: image.mimeType,
            data: image.data,
          },
        })),
      ],
    }))
    .filter((message) => Array.isArray(message.parts) && message.parts.length > 0);

  if (contents.length === 0) {
    throw new Error("Spark did not receive any usable conversation content.");
  }

  return {
    ...(systemInstruction
      ? {
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
        }
      : {}),
    contents,
    ...(useSearch ? {
      tools: [{ google_search: {} }],
    } : {}),
    generationConfig: {
      temperature: 0.2,
      topP: 0.95,
      topK: 32,
      maxOutputTokens: 8192,
    },
  };
}

function buildTextOnlyMessages(messages: SparkAIMessage[]) {
  return messages
    .map((message) => ({
      role: message.role,
      content: message.content,
    }))
    .filter((message) => typeof message.content === "string" && message.content.trim().length > 0);
}

function buildOpenAICompatibleMessages(messages: SparkAIMessage[], allowImages = false) {
  return messages.flatMap((message) => {
    if (!allowImages || message.images.length === 0) {
      if (!message.content.trim()) return [];
      return [{
        role: message.role,
        content: message.content,
      }];
    }

    const contentParts = [
      ...(message.content ? [{ type: "text", text: message.content }] : []),
      ...message.images.map((image) => ({
        type: "image_url",
        image_url: {
          url: `data:${image.mimeType};base64,${image.data}`,
        },
      })),
    ];

    if (contentParts.length === 0) return [];
    return [{
      role: message.role,
      content: contentParts,
    }];
  });
}

async function requireUser(req: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase environment variables are missing in the Edge Function runtime.");
  }

  const authorization = req.headers.get("Authorization");
  if (!authorization) return null;

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: authorization },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user;
}

function extractGeminiText(payload: GeminiResponse) {
  return (payload.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim();
}

function extractGeminiCitations(payload: GeminiResponse) {
  const chunks = payload.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();

  return chunks.flatMap((chunk) => {
    const uri = chunk.web?.uri?.trim();
    if (!uri || seen.has(uri)) return [];
    seen.add(uri);
    return [{
      title: chunk.web?.title?.trim() || uri,
      url: uri,
    }];
  });
}

function extractOpenAICompatibleText(payload: OpenAICompatibleResponse | null) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";

  return content
    .flatMap((part) => {
      if (!part || typeof part !== "object") return [];
      const record = part as Record<string, unknown>;
      if (typeof record.text !== "string") return [];
      return [record.text];
    })
    .join("")
    .trim();
}

function extractOpenAICompatibleCitations(payload: OpenAICompatibleResponse | null) {
  const direct = normalizeCitations(payload?.citations ?? payload?.references ?? payload?.search_results);
  if (direct.length > 0) return direct;

  const executedTools = payload?.choices?.[0]?.message?.executed_tools;
  if (!Array.isArray(executedTools)) return [];

  for (const tool of executedTools) {
    if (!tool || typeof tool !== "object") continue;
    const record = tool as Record<string, unknown>;
    const extracted = normalizeCitations(record.search_results);
    if (extracted.length > 0) return extracted;
  }

  return [];
}

function isQuotaError(message: string) {
  return /quota|rate limit|too many requests|retry in|high demand|temporarily unavailable|overloaded|service unavailable|spikes in demand|status 503|status 500/i.test(message);
}

function isRecoverableModelError(message: string) {
  return /status 404|model .*not found|not found|unsupported model|does not exist/i.test(message);
}

function describeProviderError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function latestUserPrompt(messages: SparkAIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user" && message.content.trim()) {
      return message.content.trim();
    }
  }
  return "";
}

function shouldUseTinyFishEvidence(messages: SparkAIMessage[], task: SparkTask, useSearch = false) {
  if (!TINYFISH_API_KEY) return false;
  if (!useSearch && task !== "fact-check") return false;
  if (hasImages(messages)) return false;

  const prompt = latestUserPrompt(messages).toLowerCase();
  if (!prompt) return false;

  if (task === "fact-check") return true;
  if (/^(hi|hello|hey|thanks|thank you|bye|goodbye)[!. ]*$/.test(prompt)) return false;
  if (/\b(joke|story|poem|song|email|draft|rewrite|creative)\b/.test(prompt)) return false;
  return prompt.length >= 8;
}

type TinyFishSearchHit = {
  title: string;
  url: string;
  snippet: string;
};

type TinyFishFetchedPage = {
  title: string;
  url: string;
  text: string;
};

function normalizeTinyFishSearchHits(payload: unknown): TinyFishSearchHit[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.results)) return [];

  const seen = new Set<string>();
  return record.results.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const result = item as Record<string, unknown>;
    const url = typeof result.url === "string" && result.url.trim() ? result.url.trim() : null;
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{
      title: typeof result.title === "string" && result.title.trim() ? result.title.trim() : url,
      url,
      snippet: typeof result.snippet === "string" ? result.snippet.trim() : "",
    }];
  });
}

function normalizeTinyFishFetchedPages(payload: unknown): TinyFishFetchedPage[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (!Array.isArray(record.results)) return [];

  return record.results.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const result = item as Record<string, unknown>;
    const url = typeof result.final_url === "string" && result.final_url.trim()
      ? result.final_url.trim()
      : typeof result.url === "string" && result.url.trim()
        ? result.url.trim()
        : null;
    const text = typeof result.text === "string" && result.text.trim() ? result.text.trim() : "";
    if (!url || !text) return [];
    return [{
      title: typeof result.title === "string" && result.title.trim() ? result.title.trim() : url,
      url,
      text,
    }];
  });
}

async function callTinyFishSearch(query: string, purpose: string) {
  if (!TINYFISH_API_KEY) {
    throw new Error("TINYFISH_API_KEY is not set for the spark-ai Edge Function.");
  }

  const endpoint = new URL(TINYFISH_SEARCH_ENDPOINT);
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("purpose", purpose);
  endpoint.searchParams.set("location", "US");
  endpoint.searchParams.set("language", "en");

  const response = await fetchWithTimeout(endpoint.toString(), {
    method: "GET",
    headers: {
      "X-API-Key": TINYFISH_API_KEY,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const base = payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).message === "string"
      ? (payload as Record<string, unknown>).message as string
      : `TinyFish search failed with status ${response.status}.`;
    throw new Error(base);
  }

  const results = normalizeTinyFishSearchHits(payload).slice(0, 4);
  if (results.length === 0) {
    throw new Error("TinyFish search returned no useful web results.");
  }
  return results;
}

async function callTinyFishFetch(urls: string[], purpose: string) {
  if (!TINYFISH_API_KEY) {
    throw new Error("TINYFISH_API_KEY is not set for the spark-ai Edge Function.");
  }

  const response = await fetchWithTimeout(TINYFISH_FETCH_ENDPOINT, {
    method: "POST",
    headers: {
      "X-API-Key": TINYFISH_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      urls,
      purpose,
      format: "markdown",
      ttl: 3600,
      per_url_timeout_ms: 45000,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const base = payload && typeof payload === "object" && typeof (payload as Record<string, unknown>).message === "string"
      ? (payload as Record<string, unknown>).message as string
      : `TinyFish fetch failed with status ${response.status}.`;
    throw new Error(base);
  }

  return normalizeTinyFishFetchedPages(payload);
}

async function buildTinyFishAugmentedMessages(messages: SparkAIMessage[], task: SparkTask) {
  const query = latestUserPrompt(messages).slice(0, 500);
  const purpose = task === "fact-check"
    ? "Retrieve reliable web evidence to verify factual claims from a student document."
    : "Retrieve high-signal web evidence to answer a student's question accurately.";

  const searchResults = await callTinyFishSearch(query, purpose);
  const fetchedPages = await callTinyFishFetch(searchResults.slice(0, 3).map((result) => result.url), purpose);

  const evidenceSections = searchResults.slice(0, 3).map((result, index) => {
    const fetched = fetchedPages.find((page) => page.url === result.url);
    const body = fetched?.text ? fetched.text.slice(0, 1800) : result.snippet;
    return [
      `Web Source ${index + 1}: ${result.title}`,
      `URL: ${result.url}`,
      result.snippet ? `Snippet: ${result.snippet}` : null,
      body ? `Extracted content:\n${body}` : null,
    ].filter(Boolean).join("\n");
  });

  if (evidenceSections.length === 0) {
    throw new Error("TinyFish did not return usable evidence sections.");
  }

  return {
    citations: searchResults.map((result) => ({ title: result.title, url: result.url })),
    messages: [
      {
        role: "system" as const,
        content: [
          "You have verified web evidence gathered by TinyFish.",
          task === "fact-check"
            ? "Use the evidence below to verify claims carefully. If the evidence is mixed or incomplete, say so plainly."
            : "Use the evidence below when it helps answer accurately. If the evidence is mixed or incomplete, say so plainly.",
          "Prefer the evidence below over unsupported assumptions.",
          "",
          evidenceSections.join("\n\n---\n\n"),
        ].join("\n"),
        images: [],
      },
      ...messages,
    ],
  };
}

async function callGeminiOnce(model: string, messages: SparkAIMessage[], useSearch = false, apiKey?: string): Promise<SparkResult> {
  const key = apiKey || GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set for the spark-ai Edge Function.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildGeminiPayload(messages, useSearch)),
  });

  const payload = await response.json().catch(() => null) as GeminiResponse | null;
  if (!response.ok) {
    const base = payload?.error?.message || `Gemini request failed with status ${response.status}.`;
    throw new Error(`${base} [model=${model}]`);
  }

  if (payload?.promptFeedback?.blockReason) {
    const reason = payload.promptFeedback.blockReasonMessage || payload.promptFeedback.blockReason;
    throw new Error(`Gemini blocked this request: ${reason}.`);
  }

  const content = payload ? extractGeminiText(payload) : "";
  if (!content) {
    throw new Error("Gemini returned an empty response.");
  }

  return {
    content,
    citations: payload ? extractGeminiCitations(payload) : [],
    grounded: Boolean(payload?.candidates?.[0]?.groundingMetadata),
    model,
    provider: "gemini",
  };
}

async function callGemini(messages: SparkAIMessage[], useSearch = false) {
  const keys = getGeminiApiKeys();
  if (keys.length === 0) {
    throw new Error("GEMINI_API_KEY is not set for the spark-ai Edge Function.");
  }

  const models = [GEMINI_MODEL, GEMINI_FALLBACK_MODEL].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);
  let lastError: unknown = null;

  for (const apiKey of keys) {
    for (const model of models) {
      try {
        return await callGeminiOnce(model, messages, useSearch, apiKey);
      } catch (error) {
        lastError = error;
        const message = describeProviderError(error);
        if (!isQuotaError(message) && !isRecoverableModelError(message)) {
          break;
        }
      }
    }
  }

  throw lastError ?? new Error("All Gemini API keys and models exhausted.");
}

function buildCerebrasPayload(model: string, messages: SparkAIMessage[]) {
  return {
    model,
    messages: buildTextOnlyMessages(messages),
    temperature: 0.2,
    max_completion_tokens: 4096,
    ...(likelyRequestsJson(messages) ? { response_format: { type: "json_object" } } : {}),
  };
}

async function callCerebrasOnce(model: string, messages: SparkAIMessage[], apiKey?: string): Promise<SparkResult> {
  const key = apiKey || CEREBRAS_API_KEY;
  if (!key) {
    throw new Error("CEREBRAS_API_KEY is not set for the spark-ai Edge Function.");
  }

  const endpoint = "https://api.cerebras.ai/v1/chat/completions";
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildCerebrasPayload(model, messages)),
  });

  const payload = await response.json().catch(() => null) as OpenAICompatibleResponse | null;
  if (!response.ok) {
    const base = payload?.error?.message || `Cerebras request failed with status ${response.status}.`;
    throw new Error(`${base} [model=${model}]`);
  }

  const content = extractOpenAICompatibleText(payload);
  if (!content) {
    throw new Error("Cerebras returned an empty response.");
  }

  return {
    content,
    citations: [],
    grounded: false,
    model,
    provider: "cerebras",
  };
}

async function callCerebras(messages: SparkAIMessage[]) {
  const keys = getCerebrasApiKeys();
  if (keys.length === 0) {
    throw new Error("CEREBRAS_API_KEY is not set for the spark-ai Edge Function.");
  }

  const models = [CEREBRAS_MODEL, CEREBRAS_FALLBACK_MODEL].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);
  let lastError: unknown = null;

  for (const apiKey of keys) {
    for (const model of models) {
      try {
        return await callCerebrasOnce(model, messages, apiKey);
      } catch (error) {
        lastError = error;
        const message = describeProviderError(error);
        if (!isQuotaError(message) && !isRecoverableModelError(message)) {
          break;
        }
      }
    }
  }

  throw lastError ?? new Error("All Cerebras API keys and models exhausted.");
}

function isGroqBrowserSearchModel(model: string) {
  return model.startsWith("openai/gpt-oss-");
}

function isGroqSearchCapableModel(model: string) {
  return isGroqBrowserSearchModel(model);
}

function buildOpenAICompatiblePayload(
  model: string,
  messages: SparkAIMessage[],
  options?: { allowImages?: boolean; groundedSearch?: boolean },
) {
  if (options?.groundedSearch && !isGroqSearchCapableModel(model)) {
    throw new Error(`Groq model ${model} does not support grounded web search.`);
  }

  return {
    model,
    messages: buildOpenAICompatibleMessages(messages, options?.allowImages === true),
    temperature: 0.2,
    max_tokens: 4096,
    ...(!options?.groundedSearch && likelyRequestsJson(messages) ? { response_format: { type: "json_object" } } : {}),
    ...(options?.groundedSearch && isGroqBrowserSearchModel(model)
      ? {
          tool_choice: "auto",
          tools: [{ type: "browser_search" }],
        }
      : {}),
  };
}

function buildNvidiaPayload(model: string, messages: SparkAIMessage[]) {
  return {
    model,
    messages: buildTextOnlyMessages(messages),
    temperature: 0.2,
    max_tokens: 4096,
    ...(likelyRequestsJson(messages) ? { response_format: { type: "json_object" } } : {}),
  };
}

async function callGroqOnce(
  model: string,
  messages: SparkAIMessage[],
  options?: { allowImages?: boolean; grounded?: boolean },
  apiKey?: string,
): Promise<SparkResult> {
  const key = apiKey || GROQ_API_KEY;
  if (!key) {
    throw new Error("GROQ_API_KEY is not set for the spark-ai Edge Function.");
  }

  const endpoint = "https://api.groq.com/openai/v1/chat/completions";
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildOpenAICompatiblePayload(model, messages, {
      allowImages: options?.allowImages,
      groundedSearch: options?.grounded,
    })),
  });

  const payload = await response.json().catch(() => null) as OpenAICompatibleResponse | null;
  if (!response.ok) {
    const base = payload?.error?.message || `Groq request failed with status ${response.status}.`;
    throw new Error(`${base} [model=${model}]`);
  }

  const content = extractOpenAICompatibleText(payload);
  if (!content) {
    throw new Error("Groq returned an empty response.");
  }

  const citations = extractOpenAICompatibleCitations(payload);
  return {
    content,
    citations,
    grounded: citations.length > 0,
    model,
    provider: "groq",
  };
}

async function callGroq(
  messages: SparkAIMessage[],
  mode: "text" | "search" | "vision" = "text",
) {
  const keys = getGroqApiKeys();
  if (keys.length === 0) {
    throw new Error("GROQ_API_KEY is not set for the spark-ai Edge Function.");
  }

  const primaryModel = mode === "search"
    ? GROQ_SEARCH_MODEL
    : mode === "vision"
      ? GROQ_VISION_MODEL
      : GROQ_MODEL;

  const models = [primaryModel, GROQ_FALLBACK_MODEL].filter((m, i, arr) => Boolean(m) && arr.indexOf(m) === i);
  let lastError: unknown = null;

  for (const apiKey of keys) {
    for (const model of models) {
      if (mode === "vision" && hasImages(messages) && model === GROQ_FALLBACK_MODEL) {
        continue;
      }
      if (mode === "search" && !isGroqSearchCapableModel(model)) {
        continue;
      }

      try {
        return await callGroqOnce(model, messages, {
          allowImages: mode === "vision",
          grounded: mode === "search",
        }, apiKey);
      } catch (error) {
        lastError = error;
        const message = describeProviderError(error);
        if (!isQuotaError(message) && !isRecoverableModelError(message)) {
          break;
        }
      }
    }
  }

  throw lastError ?? new Error("All Groq API keys and models exhausted.");
}

async function callNvidiaOnce(model: string, messages: SparkAIMessage[]): Promise<SparkResult> {
  if (!NVIDIA_API_KEY) {
    throw new Error("NVIDIA_API_KEY is not set for the spark-ai Edge Function.");
  }

  const endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${NVIDIA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildNvidiaPayload(model, messages)),
  });

  const payload = await response.json().catch(() => null) as OpenAICompatibleResponse | null;
  if (!response.ok) {
    const base = payload?.error?.message || `NVIDIA request failed with status ${response.status}.`;
    throw new Error(`${base} [model=${model}]`);
  }

  const content = extractOpenAICompatibleText(payload);
  if (!content) {
    throw new Error("NVIDIA returned an empty response.");
  }

  return {
    content,
    citations: [],
    grounded: false,
    model,
    provider: "nvidia",
  };
}

async function callNvidia(messages: SparkAIMessage[]) {
  try {
    return await callNvidiaOnce(NVIDIA_MODEL, messages);
  } catch (error) {
    const message = describeProviderError(error);
    if (!isQuotaError(message) && !isRecoverableModelError(message)) throw error;
    if (!NVIDIA_FALLBACK_MODEL || NVIDIA_FALLBACK_MODEL === NVIDIA_MODEL) throw error;
    return callNvidiaOnce(NVIDIA_FALLBACK_MODEL, messages);
  }
}

async function runProviderChain(
  configuredAttempts: ProviderAttempt[],
  messages: SparkAIMessage[],
): Promise<{ result: SparkResult | null; failures: string[] }> {
  const failures: string[] = [];
  for (let i = 0; i < configuredAttempts.length; i++) {
    const attempt = configuredAttempts[i];
    try {
      const result = await attempt.run(messages);

      if (looksLikeTruncated(result.content) && i + 1 < configuredAttempts.length) {
        const nextAttempt = configuredAttempts[i + 1];
        try {
          const continuationMessages: SparkAIMessage[] = [
            ...messages,
            {
              role: "assistant",
              content: result.content,
              images: [],
            },
            {
              role: "user",
              content:
                "Your response was cut off. Continue writing from exactly where you stopped — " +
                "do NOT repeat anything you already wrote, do NOT add a heading or transition phrase, " +
                "just pick up mid-sentence if needed.",
              images: [],
            },
          ];
          const continuation = await nextAttempt.run(continuationMessages);
          return {
            result: {
              ...result,
              content: result.content.trimEnd() + " " + continuation.content.trimStart(),
            },
            failures,
          };
        } catch {
          return { result, failures };
        }
      }

      return { result, failures };
    } catch (error) {
      failures.push(`${attempt.label}: ${describeProviderError(error)}`);
    }
  }

  return { result: null, failures };
}

function buildProviderAttempts(messages: SparkAIMessage[], task: SparkTask, useSearch = false): ProviderAttempt[] {
  const imageTask = hasImages(messages);

  const textChain = [
    {
      label: "Cerebras",
      provider: "cerebras" as const,
      configured: getCerebrasApiKeys().length > 0,
      run: (currentMessages) => callCerebras(currentMessages),
    },
    {
      label: "Groq",
      provider: "groq" as const,
      configured: getGroqApiKeys().length > 0,
      run: (currentMessages) => callGroq(currentMessages, "text"),
    },
    {
      label: "NVIDIA",
      provider: "nvidia" as const,
      configured: Boolean(NVIDIA_API_KEY),
      run: (currentMessages) => callNvidia(currentMessages),
    },
    {
      label: "Gemini",
      provider: "gemini" as const,
      configured: getGeminiApiKeys().length > 0,
      run: (currentMessages) => callGemini(currentMessages, false),
    },
  ];

  const requireGroundedResult = async (promise: Promise<SparkResult>, provider: string) => {
    const result = await promise;
    if (!result.grounded || result.citations.length === 0) {
      throw new Error(`${provider} returned no verifiable web citations.`);
    }
    return result;
  };

  const searchChain = [
    {
      label: "Gemini Search",
      provider: "gemini" as const,
      configured: getGeminiApiKeys().length > 0,
      run: (currentMessages) => requireGroundedResult(callGemini(currentMessages, true), "Gemini Search"),
    },
    {
      label: "Groq Search",
      provider: "groq" as const,
      configured: getGroqApiKeys().length > 0,
      run: (currentMessages) => requireGroundedResult(callGroq(currentMessages, "search"), "Groq Search"),
    },
  ];

  const visionChain = [
    {
      label: "Gemini Vision",
      provider: "gemini" as const,
      configured: getGeminiApiKeys().length > 0,
      run: (currentMessages) => callGemini(currentMessages, false),
    },
    {
      label: "Groq Vision",
      provider: "groq" as const,
      configured: getGroqApiKeys().length > 0,
      run: (currentMessages) => callGroq(currentMessages, "vision"),
    },
  ];

  if (task === "fact-check") {
    return searchChain;
  }

  if (useSearch) {
    // Attempt grounded search first, then fall back to text providers
    // (Cerebras, Groq, NVIDIA, Gemini) so general chat never gets completely blocked.
    return [...searchChain, ...textChain];
  }

  if (task === "syllabus-analysis") {
    return imageTask
      ? [...visionChain, ...textChain]
      : [
          {
            label: "Gemini",
            provider: "gemini" as const,
            configured: getGeminiApiKeys().length > 0,
            run: (currentMessages) => callGemini(currentMessages, false),
          },
          ...textChain.filter((attempt) => attempt.provider !== "gemini"),
        ];
  }

  if (imageTask) {
    return visionChain;
  }

  return textChain;
}

function buildTinyFishModelAttempts(): ProviderAttempt[] {
  return [
    {
      label: "Cerebras",
      provider: "cerebras" as const,
      configured: getCerebrasApiKeys().length > 0,
      run: (currentMessages) => callCerebras(currentMessages),
    },
    {
      label: "Groq",
      provider: "groq" as const,
      configured: getGroqApiKeys().length > 0,
      run: (currentMessages) => callGroq(currentMessages, "text"),
    },
    {
      label: "NVIDIA",
      provider: "nvidia" as const,
      configured: Boolean(NVIDIA_API_KEY),
      run: (currentMessages) => callNvidia(currentMessages),
    },
    {
      label: "Gemini",
      provider: "gemini" as const,
      configured: getGeminiApiKeys().length > 0,
      run: (currentMessages) => callGemini(currentMessages, false),
    },
  ].filter((attempt) => attempt.configured);
}

/**
 * Detects whether a provider response was cut off mid-sentence.
 * A properly completed response ends with sentence-terminating punctuation,
 * a closing fence, a list marker, or a number (e.g. the last item of a list).
 */
function looksLikeTruncated(text: string): boolean {
  const trimmed = text.trimEnd();
  // Too short to judge, or looks like intentional brevity.
  if (trimmed.length < 80) return false;
  // Properly terminated if it ends with common sentence/block endings.
  return !/[.!?)\]}"'`\-–]\s*$/.test(trimmed)
    && !trimmed.endsWith("```")
    && !trimmed.endsWith("---")
    && !trimmed.endsWith("...")
    && !/\b(N\/A|n\/a)\s*$/.test(trimmed)
    && !/\d+\.?\s*$/.test(trimmed); // ends bare with a number (common at end of list)
}

async function callPrimaryProvider(messages: SparkAIMessage[], task: SparkTask, useSearch = false) {
  const attempts = buildProviderAttempts(messages, task, useSearch);
  const configuredAttempts = attempts.filter((attempt) => attempt.configured);

  const failures: string[] = [];

  if (shouldUseTinyFishEvidence(messages, task, useSearch)) {
    try {
      const augmented = await buildTinyFishAugmentedMessages(messages, task);
      const tinyFishRun = await runProviderChain(buildTinyFishModelAttempts(), augmented.messages);
      if (tinyFishRun.result) {
        return {
          ...tinyFishRun.result,
          citations: augmented.citations.length > 0 ? augmented.citations : tinyFishRun.result.citations,
          grounded: true,
          searchProvider: "tinyfish",
        };
      }
      failures.push(...tinyFishRun.failures.map((failure) => `TinyFish-backed ${failure}`));
    } catch (error) {
      failures.push(`TinyFish: ${describeProviderError(error)}`);
    }
  }

  if (configuredAttempts.length === 0) {
    if (failures.length > 0) {
      throw new Error(`Spark exhausted its AI fallback chain for ${task}. ${failures.join(" | ")}`);
    }
    throw new Error("No AI provider is configured for Spark. Add at least one provider secret to the spark-ai Edge Function.");
  }

  const primaryRun = await runProviderChain(configuredAttempts, messages);
  if (primaryRun.result) {
    if ((task === "fact-check" || useSearch) && primaryRun.result.grounded) {
      return {
        ...primaryRun.result,
        searchProvider: primaryRun.result.provider === "gemini" || primaryRun.result.provider === "groq"
          ? primaryRun.result.provider
          : null,
      };
    }

    return primaryRun.result;
  }

  throw new Error(
    `Spark exhausted its AI fallback chain for ${task}. ${[...failures, ...primaryRun.failures].join(" | ")}`,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const user = await requireUser(req);
    if (!user) {
      return jsonResponse({ error: "Authentication required." }, 401);
    }

    const body = await req.json().catch(() => ({})) as IncomingBody;
    const messages = normalizeMessages(body.messages);
    const useSearch = body.useSearch === true;
    const task = normalizeTask(body.task);

    if (messages.length === 0) {
      return jsonResponse({ error: "No valid Spark messages were provided." }, 400);
    }

    const result = await callPrimaryProvider(messages, task, useSearch);
    return jsonResponse({
      content: result.content,
      citations: result.citations,
      grounded: result.grounded,
      model: result.model,
      provider: result.provider,
      searchProvider: result.searchProvider ?? null,
      task,
      userId: user.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Spark AI error.";
    const status = /Authentication required/i.test(message) ? 401
      : /No valid Spark messages/i.test(message) ? 400
      : isQuotaError(message) ? 429
      : /not set|no ai provider is configured/i.test(message) ? 500
      : 502;

    return jsonResponse({ error: message }, status);
  }
});
