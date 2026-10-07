import { GEMINI_MODEL, AI_ENDPOINTS, getGeminiApiKey } from '@/config/ai';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export class GeminiError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'GeminiError';
    this.statusCode = statusCode;
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

async function requestGemini(
  userPrompt: string,
  systemInstruction: string | undefined,
  options: GeminiCallOptions | undefined,
  maxOutputTokens: number
): Promise<GeminiCallResult> {
  const apiKey = getGeminiApiKey();

  if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw new GeminiError('Gemini API key is not configured.', 401);
  }

  const endpoint = AI_ENDPOINTS.gemini(GEMINI_MODEL, apiKey);

  const generationConfig: Record<string, unknown> = {
    temperature: 0.4,
    maxOutputTokens,
    thinkingConfig: {
      thinkingBudget: 0,
    },
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

  const post = async (body: Record<string, unknown>) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  };

  let { response, data } = await post(payload);

  if (!response.ok) {
    const errorMsg =
      (data as { error?: { message?: string } })?.error?.message ||
      `HTTP ${response.status} from Gemini`;
    const thinkingRejected = /thinking/i.test(errorMsg) && !!generationConfig.thinkingConfig;
    if (thinkingRejected) {
      delete generationConfig.thinkingConfig;
      payload.generationConfig = generationConfig;
      ({ response, data } = await post(payload));
    }
  }

  if (!response.ok) {
    const errorMsg =
      (data as { error?: { message?: string } })?.error?.message ||
      `HTTP ${response.status} from Gemini`;
    throw new GeminiError(errorMsg, response.status);
  }

  return extractCandidateText(data);
}

/**
 * Calls Google Gemini. JSON chat calls use a large output budget and
 * retry once on MAX_TOKENS so the object is not truncated.
 */
export async function callGemini(
  userPrompt: string,
  systemInstruction?: string,
  options?: GeminiCallOptions
): Promise<string> {
  const initialLimit = Math.max(options?.maxOutputTokens ?? 2048, 2048);
  const first = await requestGemini(userPrompt, systemInstruction, options, initialLimit);

  console.log('[Gemini] finishReason:', first.finishReason);

  if (first.finishReason === 'MAX_TOKENS') {
    const retryLimit = Math.max(initialLimit * 2, 4096);
    const retry = await requestGemini(userPrompt, systemInstruction, options, retryLimit);
    console.log('[Gemini] retry finishReason:', retry.finishReason);
    if (!retry.text) {
      throw new GeminiError('Empty response candidate returned by Gemini.');
    }
    return retry.text;
  }

  if (!first.text) {
    throw new GeminiError('Empty response candidate returned by Gemini.');
  }

  return first.text;
}
