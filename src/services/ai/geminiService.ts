import { GEMINI_MODEL, AI_ENDPOINTS, AI_REQUEST_TIMEOUT_MS, getGeminiApiKey } from '@/config/ai';
import { fetchWithTimeout } from './http';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class GeminiError extends Error {
  statusCode?: number;
  permanent?: boolean;
  constructor(message: string, statusCode?: number, permanent?: boolean) {
    super(message);
    this.name = 'GeminiError';
    this.statusCode = statusCode;
    this.permanent = permanent;
  }
}

/** Fixed schema for EVERY chat reply. All fields required. */
export const VITALIZE_CHAT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intro: { type: 'STRING', description: 'Short Hinglish opener / main answer.' },
    workout: {
      type: 'ARRAY',
      description: 'Exercises from the provided plan only. Empty array if not a workout question.',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          reps_or_duration: { type: 'STRING' },
        },
        required: ['name', 'reps_or_duration'],
      },
    },
    vitals_note: {
      type: 'STRING',
      description: 'BP / weight / sugar / schedule note. Empty string if not relevant.',
    },
    diet_tip: { type: 'STRING', description: 'Diet tip. Empty string if not relevant.' },
    motivation: { type: 'STRING', description: 'One short line. Empty string if not relevant.' },
  },
  required: ['intro', 'workout', 'vitals_note', 'diet_tip', 'motivation'],
} as const;

export type GeminiCallOptions = {
  jsonSchema?: Record<string, unknown>;
  maxOutputTokens?: number;
};

type GeminiCallResult = {
  text: string;
  finishReason?: string;
};

function isProjectAccessDenied(status: number, message: string): boolean {
  return status === 403 || /denied access|permission_denied|PERMISSION_DENIED/i.test(message);
}

function extractCandidateText(data: unknown): GeminiCallResult {
  const candidate = (
    data as {
      candidates?: {
        finishReason?: string;
        content?: { parts?: { text?: string; thought?: boolean }[] };
      }[];
    }
  )?.candidates?.[0];

  const finishReason = candidate?.finishReason;
  const parts = candidate?.content?.parts ?? [];
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim();

  return { text, finishReason };
}

/**
 * Single Gemini generateContent call. No model cycling and no retries.
 * 403 project-denial is marked permanent so the app can skip Gemini afterward.
 */
export async function callGemini(
  userPrompt: string,
  systemInstruction?: string,
  options?: GeminiCallOptions
): Promise<string> {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw new GeminiError('Gemini API key is not configured.', 401, true);
  }

  const endpoint = AI_ENDPOINTS.gemini(GEMINI_MODEL, apiKey);
  const maxOutputTokens = Math.max(options?.maxOutputTokens ?? 2048, 1024);

  const generationConfig: Record<string, unknown> = {
    temperature: 0.4,
    maxOutputTokens,
  };

  if (options?.jsonSchema) {
    generationConfig.responseMimeType = 'application/json';
    generationConfig.responseSchema = options.jsonSchema;
  }

  const payload: Record<string, unknown> = {
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig,
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }],
    };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      AI_REQUEST_TIMEOUT_MS
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error calling Gemini.';
    throw new GeminiError(message);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      (data as { error?: { message?: string } })?.error?.message ||
      `HTTP ${response.status} from Gemini`;
    throw new GeminiError(errorMsg, response.status, isProjectAccessDenied(response.status, errorMsg));
  }

  const result = extractCandidateText(data);
  if (!result.text) {
    throw new GeminiError('Empty response candidate returned by Gemini.');
  }

  return result.text;
}
