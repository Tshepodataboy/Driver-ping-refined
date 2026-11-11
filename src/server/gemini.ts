import { GoogleGenAI, Type } from '@google/genai';

export { Type };

let cachedClient: GoogleGenAI | null = null;
let lastApiKey: string | undefined = undefined;

/**
 * Server-side Gemini API client initialization following official @google/genai guidelines.
 * Uses process.env.GEMINI_API_KEY and injects 'aistudio-build' User-Agent header.
 */
export function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    return null;
  }

  if (!cachedClient || lastApiKey !== apiKey) {
    cachedClient = new GoogleGenAI({
      apiKey: apiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    lastApiKey = apiKey;
  }

  return cachedClient;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}

/**
 * Resilient content generation with automatic model fallback.
 * Prioritizes 'gemini-3.5-flash', then 'gemini-3.8-flash' and 'gemini-flash-latest' if any model experiences temporary demand spikes (503/404).
 */
export async function generateGeminiContentWithFallback(
  contents: any,
  options?: {
    systemInstruction?: string;
    responseMimeType?: string;
    responseSchema?: any;
  }
): Promise<{ text: string; modelUsed: string }> {
  const client = getGeminiClient();
  if (!client) {
    throw new Error('Gemini API key is not configured.');
  }

  // List of active multimodal models in order of stability
  const candidateModels = [
    'gemini-3.5-flash',
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ];

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const config: any = {};
      if (options?.systemInstruction) {
        config.systemInstruction = options.systemInstruction;
      }
      if (options?.responseMimeType) {
        config.responseMimeType = options.responseMimeType;
      }
      if (options?.responseSchema) {
        config.responseSchema = options.responseSchema;
      }

      const response = await client.models.generateContent({
        model,
        contents,
        config: Object.keys(config).length ? config : undefined,
      });

      const text = response.text || '';
      return { text, modelUsed: model };
    } catch (err: any) {
      console.warn(`[Gemini Engine] Model ${model} returned error (${err?.status || err?.code || err?.message}), trying fallback...`);
      lastError = err;
      // If error is 503 (high demand) or 404 (model unavailable), continue to next model
      const status = err?.status || err?.code;
      if (status === 503 || status === 404 || status === 429) {
        continue;
      }
      // For other errors (e.g. malformed payload), throw immediately
      throw err;
    }
  }

  throw lastError || new Error('All Gemini model candidates are temporarily unavailable.');
}
