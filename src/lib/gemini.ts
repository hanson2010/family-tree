import { GoogleGenAI, type Part } from '@google/genai';
import { secrets } from '@/lib/secrets';

const DEFAULT_GOOGLE_AI_MODEL = 'gemini-3.5-flash-lite';

let client: GoogleGenAI | null = null;

function gemini(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: secrets.googleAiApiKey });
  return client;
}

export function imagePart(data: Buffer, mimeType: string): Part {
  return { inlineData: { data: data.toString('base64'), mimeType } };
}

/**
 * Ask Gemini for a JSON answer shaped by `schema` (a JSON Schema). Throws when the call
 * fails or the reply is not JSON; callers validate the shape themselves.
 */
export async function generateJson(parts: Part[], schema: object, systemInstruction?: string): Promise<unknown> {
  const response = await gemini().models.generateContent({
    model: process.env.GOOGLE_AI_MODEL || DEFAULT_GOOGLE_AI_MODEL,
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
}
