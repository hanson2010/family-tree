import { ApiError, GoogleGenAI, type Part } from '@google/genai';
import { secrets } from '@/lib/secrets';
import type { GeminiIssue } from '@/types';

/** The kind of failure behind an error thrown by a Gemini call */
export function geminiIssue(error: unknown): GeminiIssue {
  if (error instanceof ApiError) {
    const text = error.message;
    if (error.status === 402 || /prepayment|billing|credits/i.test(text)) return 'billing';
    if (error.status === 429 || /quota|RESOURCE_EXHAUSTED/.test(text)) return 'quota';
    if (error.status === 401 || error.status === 403 || /API_KEY|API key/i.test(text)) return 'key';
    if (error.status >= 500) return 'unavailable';
    return 'failed';
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/API key/i.test(message)) return 'key';
  // fetch() failing before any reply: DNS, proxy, firewall or timeout
  if (error instanceof TypeError || /fetch failed|ECONN|ETIMEDOUT|UND_ERR/i.test(message)) return 'unreachable';
  return 'failed';
}

const DEFAULT_GOOGLE_AI_MODEL = 'gemini-3.5-flash-lite';

let client: GoogleGenAI | null = null;

function gemini(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: secrets.googleAiApiKey });
  return client;
}

export function imagePart(data: Buffer, mimeType: string): Part {
  return { inlineData: { data: data.toString('base64'), mimeType } };
}

/** A Gemini call that failed, with the kind of failure */
export class GeminiCallError extends Error {
  constructor(
    readonly issue: GeminiIssue,
    readonly cause: unknown
  ) {
    super(`Gemini call failed (${issue}): ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'GeminiCallError';
  }
}

/**
 * Ask Gemini for a JSON answer shaped by `schema` (a JSON Schema). Throws a GeminiCallError
 * when the call fails or the reply is not JSON; callers validate the shape themselves.
 */
export async function generateJson(
  parts: Part[],
  schema: object,
  systemInstruction?: string,
  /** Overrides GOOGLE_AI_MODEL for this call */
  model?: string
): Promise<unknown> {
  try {
    const response = await gemini().models.generateContent({
      model: model || process.env.GOOGLE_AI_MODEL || DEFAULT_GOOGLE_AI_MODEL,
      contents: [{ role: 'user', parts }],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
      },
    });
    const text = response.text;
    if (!text) throw new Error('Gemini returned no text');
    return JSON.parse(text);
  } catch (error) {
    throw new GeminiCallError(geminiIssue(error), error);
  }
}
