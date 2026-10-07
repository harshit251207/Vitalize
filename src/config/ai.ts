/**
 * Centralized AI & Voice Configuration for Vitalize.
 *
 * All model IDs, endpoints, and language locales are configured here
 * to avoid hardcoding values across components and services.
 */

// Supported Gemini Models (verified live via Google Generative Language API):
// 'gemini-3-flash-preview', 'gemini-3.8-flash'
export const GEMINI_MODEL = 'gemini-3-flash-preview';

// Supported Groq Chat Models (verified live via Groq API models list):
// 'qwen/qwen3.8-27b', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'
export const GROQ_MODEL = 'qwen/qwen3.8-27b';

// Groq Whisper Speech-to-Text Model:
export const GROQ_WHISPER_MODEL = 'whisper-large-v3-turbo';

// Default voice recognition language locale (supports English, Hindi, Hinglish)
export const VOICE_LANGUAGE = 'en-IN';

// Maximum provider calls per user turn (Gemini -> Groq fallback = 2 max)
export const MAX_PROVIDER_CALLS = 2;

function sanitizeKey(raw?: string): string | undefined {
  if (!raw) return undefined;
  let val = raw.trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1).trim();
  }
  return val.length > 0 ? val : undefined;
}

// Centralized API Key Access (never hardcoded in source files)
export function getGeminiApiKey(): string | undefined {
  return sanitizeKey(process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY);
}

export function getGroqApiKey(): string | undefined {
  return sanitizeKey(process.env.EXPO_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY);
}

export const AI_ENDPOINTS = {
  gemini: (model: string, apiKey: string) =>
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
  groqChat: 'https://api.groq.com/openai/v1/chat/completions',
  groqWhisper: 'https://api.groq.com/openai/v1/audio/transcriptions',
} as const;
