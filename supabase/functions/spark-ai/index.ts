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

type SparkProvider = "gemini" | "cerebras" | "groq";

type SparkTask =
  | "course-chat"
  | "general-chat"
  | "quiz"
  | "course-suggestions"
  | "dashboard-suggestions"
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

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL")?.trim() || "gemini-2.5-flash-lite";
// Fallback must be a genuinely different model so quota/model errors on primary have a real escape path.
const GEMINI_FALLBACK_MODEL = Deno.env.get("GEMINI_FALLBACK_MODEL")?.trim() || "gemini-2.0-flash";

const CEREBRAS_API_KEY = Deno.env.get("CEREBRAS_API_KEY")?.trim();
// "gpt-oss-120b" is a Groq model name — the correct Cerebras model names use the llama naming scheme.
const CEREBRAS_MODEL = Deno.env.get("CEREBRAS_MODEL")?.trim() || "llama-3.3-70b";
const CEREBRAS_FALLBACK_MODEL = Deno.env.get("CEREBRAS_FALLBACK_MODEL")?.trim() || "llama3.1-8b";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")?.trim();
const GROQ_MODEL = Deno.env.get("GROQ_MODEL")?.trim() || "openai/gpt-oss-20b";
const GROQ_FALLBACK_MODEL = Deno.env.get("GROQ_FALLBACK_MODEL")?.trim() || "openai/gpt-oss-120b";
const GROQ_SEARCH_MODEL = Deno.env.get("GROQ_SEARCH_MODEL")?.trim() || "groq/compound-mini";
const GROQ_VISION_MODEL = Deno.env.get("GROQ_VISION_MODEL")?.trim() || "meta-llama/llama-4-scout-17b-16e-instruct";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")?.trim();
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")?.trim();

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  return /quota|rate limit|too many requests|retry in/i.test(message);
}

function isRecoverableModelError(message: string) {
  return /status 404|model .*not found|not found|unsupported model|does not exist/i.test(message);
}

function describeProviderError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function prependHandoffInstruction(messages: SparkAIMessage[], attemptedProviders: string[]) {
  if (attemptedProviders.length === 0) return messages;

  return [
    {
      role: "system" as const,
      content: `You are taking over an existing Spark response after another provider became unavailable (${attemptedProviders.join(", ")}). Continue the same conversation naturally. Do not restart the answer, do not repeat a greeting, and do not mention provider switching unless the user explicitly asks.`,
      images: [],
    },
    ...messages,
  ];
}

async function callGeminiOnce(model: string, messages: SparkAIMessage[], useSearch = false): Promise<SparkResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set for the spark-ai Edge Function.");
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-goog-api-key": GEMINI_API_KEY,
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
  try {
    return await callGeminiOnce(GEMINI_MODEL, messages, useSearch);
  } catch (error) {
    const message = describeProviderError(error);
    if (!isQuotaError(message) && !isRecoverableModelError(message)) throw error;
    if (!GEMINI_FALLBACK_MODEL || GEMINI_FALLBACK_MODEL === GEMINI_MODEL) throw error;
    return callGeminiOnce(GEMINI_FALLBACK_MODEL, messages, useSearch);
  }
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

async function callCerebrasOnce(model: string, messages: SparkAIMessage[]): Promise<SparkResult> {
  if (!CEREBRAS_API_KEY) {
    throw new Error("CEREBRAS_API_KEY is not set for the spark-ai Edge Function.");
  }

  const endpoint = "https://api.cerebras.ai/v1/chat/completions";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CEREBRAS_API_KEY}`,
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
  try {
    return await callCerebrasOnce(CEREBRAS_MODEL, messages);
  } catch (error) {
    const message = describeProviderError(error);
    if (!isQuotaError(message) && !isRecoverableModelError(message)) throw error;
    if (!CEREBRAS_FALLBACK_MODEL || CEREBRAS_FALLBACK_MODEL === CEREBRAS_MODEL) throw error;
    return callCerebrasOnce(CEREBRAS_FALLBACK_MODEL, messages);
  }
}

function isGroqCompoundModel(model: string) {
  return model.startsWith("groq/compound");
}

function isGroqBrowserSearchModel(model: string) {
  return model.startsWith("openai/gpt-oss-");
}

function isGroqSearchCapableModel(model: string) {
  return isGroqCompoundModel(model) || isGroqBrowserSearchModel(model);
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
    ...(likelyRequestsJson(messages) ? { response_format: { type: "json_object" } } : {}),
    ...(options?.groundedSearch && isGroqCompoundModel(model)
      ? {
          compound_custom: {
            tools: {
              enabled_tools: ["web_search"],
            },
          },
        }
      : {}),
    ...(options?.groundedSearch && isGroqBrowserSearchModel(model)
      ? {
          tool_choice: "required",
          tools: [{ type: "browser_search" }],
        }
      : {}),
  };
}

async function callGroqOnce(
  model: string,
  messages: SparkAIMessage[],
  options?: { allowImages?: boolean; grounded?: boolean },
): Promise<SparkResult> {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set for the spark-ai Edge Function.");
  }

  const endpoint = "https://api.groq.com/openai/v1/chat/completions";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
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
    grounded: Boolean(options?.grounded) || citations.length > 0,
    model,
    provider: "groq",
  };
}

async function callGroq(
  messages: SparkAIMessage[],
  mode: "text" | "search" | "vision" = "text",
) {
  const primaryModel = mode === "search"
    ? GROQ_SEARCH_MODEL
    : mode === "vision"
      ? GROQ_VISION_MODEL
      : GROQ_MODEL;

  try {
    return await callGroqOnce(primaryModel, messages, {
      allowImages: mode === "vision",
      grounded: mode === "search",
    });
  } catch (error) {
    const message = describeProviderError(error);
    if (!isQuotaError(message) && !isRecoverableModelError(message)) throw error;
    if (!GROQ_FALLBACK_MODEL || GROQ_FALLBACK_MODEL === primaryModel) throw error;

    // Vision fallback: the text fallback model cannot process images.
    // Throwing here lets the outer provider chain escalate to Gemini Vision
    // instead of silently returning a response that ignored the images entirely.
    if (mode === "vision" && hasImages(messages)) {
      throw new Error(
        `Groq Vision model (${primaryModel}) is unavailable and the text-only fallback cannot process images. ` +
        `Escalating to the next vision-capable provider.`,
      );
    }

    if (mode === "search" && !isGroqSearchCapableModel(GROQ_FALLBACK_MODEL)) {
      throw new Error(
        `Groq search model (${primaryModel}) is unavailable and fallback model (${GROQ_FALLBACK_MODEL}) ` +
        `cannot perform grounded web search. Escalating to the next grounded provider.`,
      );
    }

    return callGroqOnce(GROQ_FALLBACK_MODEL, messages, {
      allowImages: false,
      grounded: mode === "search",
    });
  }
}

function buildProviderAttempts(messages: SparkAIMessage[], task: SparkTask, useSearch = false): ProviderAttempt[] {
  const imageTask = hasImages(messages);

  const textChain = [
    {
      label: "Cerebras",
      provider: "cerebras" as const,
      configured: Boolean(CEREBRAS_API_KEY),
      run: (currentMessages) => callCerebras(currentMessages),
    },
    {
      label: "Groq",
      provider: "groq" as const,
      configured: Boolean(GROQ_API_KEY),
      run: (currentMessages) => callGroq(currentMessages, "text"),
    },
    {
      label: "Gemini",
      provider: "gemini" as const,
      configured: Boolean(GEMINI_API_KEY),
      run: (currentMessages) => callGemini(currentMessages, false),
    },
  ];

  const searchChain = [
    {
      label: "Gemini Search",
      provider: "gemini" as const,
      configured: Boolean(GEMINI_API_KEY),
      run: (currentMessages) => callGemini(currentMessages, true),
    },
    {
      label: "Groq Search",
      provider: "groq" as const,
      configured: Boolean(GROQ_API_KEY),
      run: (currentMessages) => callGroq(currentMessages, "search"),
    },
  ];

  const visionChain = [
    {
      label: "Gemini Vision",
      provider: "gemini" as const,
      configured: Boolean(GEMINI_API_KEY),
      run: (currentMessages) => callGemini(currentMessages, false),
    },
    {
      label: "Groq Vision",
      provider: "groq" as const,
      configured: Boolean(GROQ_API_KEY),
      run: (currentMessages) => callGroq(currentMessages, "vision"),
    },
  ];

  if (task === "fact-check" || useSearch) {
    return searchChain;
  }

  if (task === "syllabus-analysis") {
    return imageTask
      ? [...visionChain, ...textChain]
      : [
          {
            label: "Gemini",
            provider: "gemini" as const,
            configured: Boolean(GEMINI_API_KEY),
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

  if (configuredAttempts.length === 0) {
    throw new Error("No AI provider is configured for Spark. Add at least one provider secret to the spark-ai Edge Function.");
  }

  const failures: string[] = [];
  const attemptedProviders: string[] = [];

  for (let i = 0; i < configuredAttempts.length; i++) {
    const attempt = configuredAttempts[i];
    try {
      const handoffMessages = prependHandoffInstruction(messages, attemptedProviders);
      const result = await attempt.run(handoffMessages);

      // ── Truncation continuation ──────────────────────────────────────────
      // If this provider returned a response that looks like it was cut off
      // mid-sentence (e.g. hit max_tokens), ask the NEXT available provider
      // to continue from exactly where it stopped rather than start over.
      if (looksLikeTruncated(result.content) && i + 1 < configuredAttempts.length) {
        const nextAttempt = configuredAttempts[i + 1];
        try {
          const continuationMessages: SparkAIMessage[] = [
            ...handoffMessages,
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
          // Stitch the two halves together seamlessly.
          return {
            ...result,
            content: result.content.trimEnd() + " " + continuation.content.trimStart(),
          };
        } catch {
          // Continuation failed — return the partial result as-is rather than
          // losing it entirely. The user gets a slightly truncated answer which
          // is better than an error.
          return result;
        }
      }

      return result;
    } catch (error) {
      attemptedProviders.push(attempt.label);
      failures.push(`${attempt.label}: ${describeProviderError(error)}`);
    }
  }

  throw new Error(
    `Spark exhausted its AI fallback chain for ${task}. ${failures.join(" | ")}`,
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
      task,
      userId: user.id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Spark AI error.";
    const status = /Authentication required/i.test(message) ? 401
      : /No valid Spark messages/i.test(message) ? 400
      : /quota|rate limit|too many requests|retry in/i.test(message) ? 429
      : /not set|no ai provider is configured/i.test(message) ? 500
      : 502;

    return jsonResponse({ error: message }, status);
  }
});
