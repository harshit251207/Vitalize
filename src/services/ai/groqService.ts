import { GROQ_MODEL, AI_ENDPOINTS, AI_REQUEST_TIMEOUT_MS, getGroqApiKey } from '@/config/ai';
import { fetchWithTimeout } from './http';

export class GroqError extends Error {
  statusCode?: number;
  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'GroqError';
    this.statusCode = statusCode;
  }
}

export type GroqCallOptions = {
  jsonMode?: boolean;
};

export async function callGroq(
  userPrompt: string,
  systemInstruction?: string,
  options?: GroqCallOptions
): Promise<string> {
  const apiKey = getGroqApiKey();

  if (!apiKey) {
    throw new GroqError('Groq API key is not configured.', 401);
  }

  const messages: { role: 'system' | 'user'; content: string }[] = [];

  if (systemInstruction) {
    messages.push({
      role: 'system',
      content: systemInstruction,
    });
  }

  messages.push({
    role: 'user',
    content: userPrompt,
  });

  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: 1200,
  };

  if (options?.jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  let response: Response;
  try {
    response = await fetchWithTimeout(
      AI_ENDPOINTS.groqChat,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      },
      AI_REQUEST_TIMEOUT_MS
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Network error calling Groq.';
    throw new GroqError(message);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      (data as { error?: { message?: string } })?.error?.message ||
      `HTTP ${response.status} from Groq`;
    throw new GroqError(errorMsg, response.status);
  }

  const replyText = (data as {
    choices?: { message?: { content?: string } }[];
  })?.choices?.[0]?.message?.content?.trim();

  if (!replyText) {
    throw new GroqError('Empty response content returned by Groq.');
  }

  return replyText;
}
