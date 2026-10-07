import { isGeminiConfigured, isGroqConfigured } from '@/config/ai';
import { callGemini, GeminiError, VITALIZE_CHAT_RESPONSE_SCHEMA } from './geminiService';
import { callGroq } from './groqService';

export type AIProviderName = 'groq' | 'gemini';

export type AIProviderResult = {
  text: string;
  provider: AIProviderName;
};

let geminiSkippedThisSession = false;

export function isGeminiUsable(): boolean {
  return isGeminiConfigured() && !geminiSkippedThisSession;
}

function shouldSkipGeminiPermanently(error: unknown): boolean {
  if (error instanceof GeminiError) {
    return !!error.permanent;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /denied access|permission_denied/i.test(message);
}

/**
 * One user turn = at most one Groq attempt, then one Gemini attempt if Groq failed
 * and Gemini is still usable. Never loops and never retries the same provider.
 */
export async function generateChatCompletion(
  userPrompt: string,
  systemInstruction: string
): Promise<AIProviderResult> {
  const jsonOptions = {
    jsonSchema: VITALIZE_CHAT_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    maxOutputTokens: 2048,
  };

  let groqError: unknown;

  if (isGroqConfigured()) {
    try {
      const text = await callGroq(userPrompt, systemInstruction, { jsonMode: true });
      return { text, provider: 'groq' };
    } catch (error) {
      groqError = error;
      const status = (error as { statusCode?: number })?.statusCode;
      const statusLabel = status ? ` (HTTP ${status})` : '';
      console.warn(
        `[AIProvider] Groq failed${statusLabel}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  if (isGeminiUsable()) {
    try {
      const text = await callGemini(userPrompt, systemInstruction, jsonOptions);
      return { text, provider: 'gemini' };
    } catch (error) {
      if (shouldSkipGeminiPermanently(error)) {
        geminiSkippedThisSession = true;
        console.warn(
          '[AIProvider] Gemini is unavailable for this session (project/API access denied). Skipping further Gemini calls.'
        );
      } else {
        const status = (error as { statusCode?: number })?.statusCode;
        const statusLabel = status ? ` (HTTP ${status})` : '';
        console.warn(
          `[AIProvider] Gemini fallback failed${statusLabel}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  if (groqError) {
    throw groqError;
  }

  throw new Error('No AI provider is configured. Add a Groq API key to enable chat.');
}
