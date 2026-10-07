/**
 * Centralized AI & Voice Configuration for Vitalize.
 *
 * Groq is the primary chat provider. Gemini is optional fallback only.
 * Keys are read from Expo public env vars (never hardcoded).
 */

export const GEMINI_MODEL = 'gemini-3-flash-preview';
export const GROQ_MODEL = 'qwen/qwen3.8-27b';
export const GROQ_WHISPER_MODEL = 'whisper-large-v3-turbo';
export const VOICE_LANGUAGE = 'en-IN';

/** One attempt per configured provider per user turn (Groq, then optional Gemini). */
export const MAX_PROVIDER_CALLS = 2;
export const AI_REQUEST_TIMEOUT_MS = 20000;

const PLACEHOLDER_KEYS = new Set([
  'YOUR_GEMINI_API_KEY',
  'YOUR_GROQ_API_KEY',
]);

function sanitizeKey(raw?: string): string | undefined {
  if (!raw) return undefined;
  let val = raw.trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }
  if (!val || PLACEHOLDER_KEYS.has(val)) return undefined;
  return val;
}

export function getGeminiApiKey(): string | undefined {
  return sanitizeKey(process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY);
}

export function getGroqApiKey(): string | undefined {
  return sanitizeKey(process.env.EXPO_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY);
}

export function isGroqConfigured(): boolean {
  return !!getGroqApiKey();
}

export function isGeminiConfigured(): boolean {
  return !!getGeminiApiKey();
}

export const AI_ENDPOINTS = {
  gemini: (model: string, apiKey: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
  groqChat: 'https://api.groq.com/openai/v1/chat/completions',
  groqWhisper: 'https://api.groq.com/openai/v1/audio/transcriptions',
} as const;
