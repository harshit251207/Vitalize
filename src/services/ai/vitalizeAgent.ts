import { computeBPAnalytics, summarizeBPAnalytics } from '@/services/bpAnalyticsService';
import { getVitalHistoryForPeriod, VitalsService } from '@/services/vitalsService';
import { PlanService } from '@/services/planService';
import { Vitals } from '@/types';
import { callGemini, VITALIZE_CHAT_RESPONSE_SCHEMA } from './geminiService';
import { callGroq } from './groqService';

export type AgentIntent =
  | 'BP_ANALYTICS_7D'
  | 'BP_ANALYTICS_30D'
  | 'BP_ANALYSIS'
  | 'GET_LATEST_BP'
  | 'GET_TODAY_WORKOUT'
  | 'START_WORKOUT'
  | 'GET_WORKOUT_PROGRESS'
  | 'GENERAL_HEALTH_QUERY';

export interface AgentWorkoutItem {
  name: string;
  reps_or_duration: string;
}

export interface BotReply {
  intro: string;
  workout: AgentWorkoutItem[];
  vitals_note: string;
  diet_tip: string;
  motivation: string;
}

export type AgentMessagePayload = BotReply;

export interface AgentResponse {
  payload: BotReply;
  provider: 'gemini' | 'groq' | 'fallback';
  intent: AgentIntent;
  dataRetrieved?: boolean;
}

const EMPTY_REPLY: BotReply = {
  intro: '',
  workout: [],
  vitals_note: '',
  diet_tip: '',
  motivation: '',
};

export function emptyBotReply(intro: string): BotReply {
  return {
    ...EMPTY_REPLY,
    intro: stripMarkdownSymbols(intro).trim(),
  };
}

/**
 * Classifies the user's natural language input so extra vitals/plan
 * context can be attached. Does NOT choose a different reply format.
 */
export function classifyIntent(text: string): AgentIntent {
  const lower = text.toLowerCase().trim();

  if (
    lower.includes('30 din') ||
    lower.includes('30 days') ||
    lower.includes('30-day') ||
    lower.includes('mahina') ||
    lower.includes('month')
  ) {
    if (lower.includes('bp') || lower.includes('blood pressure') || lower.includes('trend')) {
      return 'BP_ANALYTICS_30D';
    }
  }

  if (
    lower.includes('7 din') ||
    lower.includes('7 days') ||
    lower.includes('7-day') ||
    lower.includes('hafta') ||
    lower.includes('week')
  ) {
    if (lower.includes('bp') || lower.includes('blood pressure') || lower.includes('trend')) {
      return 'BP_ANALYTICS_7D';
    }
  }

  if (
    (lower.includes('latest') || lower.includes('aakhri') || lower.includes('last') || lower.includes('recent')) &&
    (lower.includes('bp') || lower.includes('reading') || lower.includes('blood pressure'))
  ) {
    return 'GET_LATEST_BP';
  }

  if (
    lower.includes('bp') ||
    lower.includes('blood pressure') ||
    lower.includes('bloodpressure') ||
    lower.includes('schedule')
  ) {
    if (
      lower.includes('check') ||
      lower.includes('analysis') ||
      lower.includes('trend') ||
      lower.includes('batao') ||
      lower.includes('dekho') ||
      lower.includes('report') ||
      lower.includes('kaisa') ||
      lower.includes('yesterday') ||
      lower.includes('kal') ||
      lower.includes('schedule')
    ) {
      return 'BP_ANALYSIS';
    }
  }

  if (
    (lower.includes('kal') || lower.includes('yesterday') || lower.includes('progress') || lower.includes('streak')) &&
    (lower.includes('exercise') || lower.includes('workout') || lower.includes('complete') || lower.includes('kitni'))
  ) {
    return 'GET_WORKOUT_PROGRESS';
  }

  if (
    (lower.includes('start') || lower.includes('shuru') || lower.includes('begin')) &&
    (lower.includes('workout') || lower.includes('exercise') || lower.includes('kasrat'))
  ) {
    return 'START_WORKOUT';
  }

  if (
    lower.includes('workout') ||
    lower.includes('exercise') ||
    lower.includes('exercises') ||
    lower.includes('kasrat')
  ) {
    if (
      lower.includes('aaj') ||
      lower.includes('today') ||
      lower.includes('plan') ||
      lower.includes('kya hai') ||
      lower.includes('what')
    ) {
      return 'GET_TODAY_WORKOUT';
    }
  }

  return 'GENERAL_HEALTH_QUERY';
}

function todayDateStr(): string {
  return new Date().toISOString().split('T')[0];
}

function yesterdayDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function formatLatestVitals(vitals: Vitals[]): string {
  if (vitals.length === 0) {
    return 'No vitals logged yet.';
  }

  const newestFirst = [...vitals].reverse();
  let bp: string | null = null;
  let weight: string | null = null;
  let sugar: string | null = null;

  for (const v of newestFirst) {
    if (
      !bp &&
      typeof v.bloodPressureSys === 'number' &&
      typeof v.bloodPressureDia === 'number'
    ) {
      bp = `${v.bloodPressureSys}/${v.bloodPressureDia} mmHg (logged ${new Date(v.date).toLocaleDateString()})`;
    }
    if (!weight && typeof v.weight === 'number') {
      weight = `${v.weight} kg (logged ${new Date(v.date).toLocaleDateString()})`;
    }
    if (!sugar && typeof v.bloodSugar === 'number') {
      sugar = `${v.bloodSugar} (logged ${new Date(v.date).toLocaleDateString()})`;
    }
    if (bp && weight && sugar) break;
  }

  return [
    `BP: ${bp ?? 'not recorded'}`,
    `Weight: ${weight ?? 'not recorded'}`,
    `Blood sugar: ${sugar ?? 'not recorded'}`,
  ].join('\n');
}

function formatVitalsLog(vitals: Vitals[]): string {
  if (vitals.length === 0) {
    return 'No readings in this period.';
  }

  return vitals
    .map((v) => {
      const when = new Date(v.date).toLocaleString();
      const bits: string[] = [];
      if (typeof v.bloodPressureSys === 'number' && typeof v.bloodPressureDia === 'number') {
        bits.push(`BP ${v.bloodPressureSys}/${v.bloodPressureDia}`);
      }
      if (typeof v.weight === 'number') bits.push(`weight ${v.weight} kg`);
      if (typeof v.bloodSugar === 'number') bits.push(`sugar ${v.bloodSugar}`);
      if (typeof v.heartRate === 'number') bits.push(`HR ${v.heartRate}`);
      return `${when}: ${bits.length ? bits.join(', ') : 'logged, no numeric fields'}`;
    })
    .join('\n');
}

function vitalsOnLocalDate(vitals: Vitals[], ymd: string): Vitals[] {
  return vitals.filter((v) => v.date.slice(0, 10) === ymd || new Date(v.date).toISOString().slice(0, 10) === ymd);
}

/**
 * Always-on grounding for every chat turn.
 */
async function retrieveGroundingContext(userUid?: string | null): Promise<{
  text: string;
  hasPlan: boolean;
}> {
  if (!userUid) {
    return {
      text: 'User is not currently signed in. No personal plan or vitals available.',
      hasPlan: false,
    };
  }

  const sections: string[] = [];
  let hasPlan = false;
  const todayStr = todayDateStr();
  const yesterdayStr = yesterdayDateStr();

  try {
    const profile = await VitalsService.getUserProfile(userUid);
    const category = profile.disabilityCategory || 'not set';
    sections.push(`Detected disability category: ${category}`);
    sections.push('The user is a wheelchair user.');

    if (profile.disabilityCategory) {
      const plan = PlanService.getPlanForCategory(profile.disabilityCategory);
      if (plan && plan.exercises.length > 0) {
        hasPlan = true;
        const exerciseList = plan.exercises
          .map((e, i) => `${i + 1}. ${e.name} — ${e.reps}`)
          .join('\n');
        sections.push(`PROVIDED WORKOUT PLAN (the only allowed exercises):\n${exerciseList}`);
        sections.push(`PROVIDED DIET PLAN:\n${plan.diet}`);
      } else {
        sections.push('No labeled workout/diet plan is configured for this category yet.');
      }

      const completedToday = await PlanService.getCompletedExercises(userUid, todayStr);
      const completedYesterday = await PlanService.getCompletedExercises(userUid, yesterdayStr);
      const nameById = new Map((plan?.exercises ?? []).map((e) => [e.id, e.name]));
      const names = (ids: string[]) => ids.map((id) => nameById.get(id) || id);
      const total = plan?.exercises.length ?? 0;
      sections.push(
        `Today's exercise completion (${todayStr}): ${completedToday.length}/${total}` +
          (completedToday.length ? ` — ${names(completedToday).join(', ')}` : '')
      );
      sections.push(
        `Yesterday's exercise completion (${yesterdayStr}): ${completedYesterday.length}/${total}` +
          (completedYesterday.length ? ` — ${names(completedYesterday).join(', ')}` : '')
      );
    }
  } catch (error) {
    console.warn('[VitalizeAgent] Error fetching plan/profile grounding:', error);
    sections.push('Unable to load disability category or plan right now.');
  }

  try {
    const weekVitals = await getVitalHistoryForPeriod(7);
    sections.push(`Latest vitals:\n${formatLatestVitals(weekVitals)}`);
    sections.push(`Last 7 days vitals / BP schedule:\n${formatVitalsLog(weekVitals)}`);
    const yesterdayVitals = vitalsOnLocalDate(weekVitals, yesterdayStr);
    sections.push(
      `Yesterday's vitals (${yesterdayStr}):\n${
        yesterdayVitals.length ? formatVitalsLog(yesterdayVitals) : 'No readings logged yesterday.'
      }`
    );
  } catch (error) {
    console.warn('[VitalizeAgent] Error fetching vitals grounding:', error);
    sections.push('Latest vitals: unavailable.');
  }

  return { text: sections.join('\n\n'), hasPlan };
}

async function retrieveExtraIntentContext(
  intent: AgentIntent,
  userUid?: string | null
): Promise<{ contextSummary: string; hasData: boolean }> {
  if (!userUid) {
    return { contextSummary: '', hasData: false };
  }

  try {
    if (intent === 'BP_ANALYTICS_30D') {
      const vitals = await getVitalHistoryForPeriod(30);
      const analytics = computeBPAnalytics(vitals, '30d');
      return {
        contextSummary: `User's 30-Day BP Analytics Summary:\n${summarizeBPAnalytics(analytics)}`,
        hasData: analytics.readingCount > 0,
      };
    }

    if (intent === 'BP_ANALYTICS_7D' || intent === 'BP_ANALYSIS' || intent === 'GET_LATEST_BP') {
      const vitals = await getVitalHistoryForPeriod(7);
      const analytics = computeBPAnalytics(vitals, '7d');
      return {
        contextSummary: `User's Recent BP Overview:\n${summarizeBPAnalytics(analytics)}`,
        hasData: analytics.readingCount > 0,
      };
    }

    if (intent === 'GET_WORKOUT_PROGRESS') {
      const streak = await PlanService.getStreak(userUid);
      return {
        contextSummary: `Current daily workout streak: ${streak} day(s)`,
        hasData: true,
      };
    }

    return { contextSummary: '', hasData: false };
  } catch (error) {
    console.warn('[VitalizeAgent] Error fetching extra intent context:', error);
    return {
      contextSummary: 'Unable to access extra health records right now.',
      hasData: false,
    };
  }
}

function buildSystemInstruction(grounding: string): string {
  return `You are Vitalize AI, a casual Hinglish health companion.

Always fill the schema. If a field is not relevant to the question, return an empty string or empty array. Never reply outside the JSON. Short Hinglish, max ~100 words total.

OUTPUT (JSON only, every field required):
{
  "intro": string,
  "workout": [ { "name": string, "reps_or_duration": string } ],
  "vitals_note": string,
  "diet_tip": string,
  "motivation": string
}

FIELD RULES:
- intro: 1 short line answering the question.
- workout: only exercises from the PROVIDED PLAN. Empty array [] if the question is not about today's workout.
- vitals_note: BP / weight / sugar / yesterday schedule. Empty string if not asked.
- diet_tip: empty string if not about food/diet.
- motivation: one short line, or empty string.

GROUNDING / SAFETY:
- Only suggest exercises from the provided plan. Never invent new exercises.
- The user is a wheelchair user, so do not suggest standing, walking, or gait exercises unless they are in the provided plan.
- If asked something outside the plan, say to consult their doctor (in intro).
- Use latest vitals and completion data. Do not invent numbers.
- Vitalize is informational, not a diagnosis.

USER CONTEXT:
${grounding}`;
}

export function stripMarkdownSymbols(text: string): string {
  return text.replace(/\*\*/g, '').replace(/^\s*\*\s+/gm, '');
}

function stripJsonFences(raw: string): string {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fence ? fence[1].trim() : trimmed;
}

function repairTruncatedJson(raw: string): string {
  let s = raw.trim();
  const start = s.indexOf('{');
  if (start === -1) return s;
  s = s.slice(start);

  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') braces += 1;
    else if (ch === '}') braces -= 1;
    else if (ch === '[') brackets += 1;
    else if (ch === ']') brackets -= 1;
  }

  if (inString) s += '"';
  while (brackets > 0) {
    s += ']';
    brackets -= 1;
  }
  while (braces > 0) {
    s += '}';
    braces -= 1;
  }
  return s;
}

function normalizeBotReply(parsed: unknown): BotReply | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return null;
  }

  const o = parsed as Record<string, unknown>;
  const workout = Array.isArray(o.workout)
    ? o.workout
        .filter((w): w is Record<string, unknown> => !!w && typeof w === 'object')
        .map((w) => ({
          name: stripMarkdownSymbols(String(w.name ?? '')).trim(),
          reps_or_duration: stripMarkdownSymbols(String(w.reps_or_duration ?? '')).trim(),
        }))
        .filter((w) => w.name.length > 0)
    : [];

  return {
    intro: stripMarkdownSymbols(String(o.intro ?? '')).trim(),
    workout,
    vitals_note: stripMarkdownSymbols(String(o.vitals_note ?? '')).trim(),
    diet_tip: stripMarkdownSymbols(String(o.diet_tip ?? '')).trim(),
    motivation: stripMarkdownSymbols(String(o.motivation ?? '')).trim(),
  };
}

function tryParseObject(raw: string): BotReply | null {
  try {
    return normalizeBotReply(JSON.parse(raw));
  } catch {
    return null;
  }
}

/**
 * Single parser for every chat reply. Always returns the same object shape.
 */
export function parseBotReply(raw: string): BotReply {
  const fallbackIntro = stripMarkdownSymbols(raw).trim();

  const parsedDirect = tryParseObject(raw.trim());
  if (parsedDirect) return parsedDirect;

  const unfenced = stripJsonFences(raw);
  const parsedFenced = tryParseObject(unfenced);
  if (parsedFenced) return parsedFenced;

  const fromBrace = unfenced.indexOf('{') >= 0 ? unfenced.slice(unfenced.indexOf('{')) : unfenced;
  const parsedSlice = tryParseObject(fromBrace);
  if (parsedSlice) return parsedSlice;

  const repaired = tryParseObject(repairTruncatedJson(fromBrace));
  if (repaired) return repaired;

  return emptyBotReply(fallbackIntro);
}

/** @deprecated Use parseBotReply */
export function parseAgentReply(raw: string): { text: string; payload: BotReply } {
  const payload = parseBotReply(raw);
  return { text: payload.intro, payload };
}

/**
 * The Central AI Agent Entrypoint.
 * Voice and typed messages BOTH call this SAME function and the SAME Gemini JSON schema.
 */
export async function processAgentMessage(
  userText: string,
  userUid?: string | null
): Promise<AgentResponse> {
  const trimmed = userText.trim();
  if (!trimmed) {
    return {
      payload: emptyBotReply('Please provide a message or voice recording.'),
      provider: 'fallback',
      intent: 'GENERAL_HEALTH_QUERY',
      dataRetrieved: false,
    };
  }

  const intent = classifyIntent(trimmed);
  const grounding = await retrieveGroundingContext(userUid);
  const extra = await retrieveExtraIntentContext(intent, userUid);
  const systemInstruction = buildSystemInstruction(grounding.text);

  let finalPrompt = trimmed;
  if (extra.contextSummary) {
    finalPrompt = `${trimmed}\n\n[EXTRA INTENT DATA]:\n${extra.contextSummary}`;
  }

  const jsonOptions = {
    jsonSchema: VITALIZE_CHAT_RESPONSE_SCHEMA as unknown as Record<string, unknown>,
    maxOutputTokens: 2048,
  };

  try {
    const geminiReply = await callGemini(finalPrompt, systemInstruction, jsonOptions);
    return {
      payload: parseBotReply(geminiReply),
      provider: 'gemini',
      intent,
      dataRetrieved: extra.hasData || grounding.hasPlan,
    };
  } catch (geminiError: any) {
    const status = geminiError?.statusCode ? ` (HTTP ${geminiError.statusCode})` : '';
    console.warn(
      `[VitalizeAgent] Gemini call failed${status}, attempting Groq fallback:`,
      geminiError?.message || geminiError
    );

    try {
      const groqReply = await callGroq(finalPrompt, systemInstruction, { jsonMode: true });
      return {
        payload: parseBotReply(groqReply),
        provider: 'groq',
        intent,
        dataRetrieved: extra.hasData || grounding.hasPlan,
      };
    } catch (groqError: any) {
      const groqStatus = groqError?.statusCode ? ` (HTTP ${groqError.statusCode})` : '';
      console.error(
        `[VitalizeAgent] Groq fallback also failed${groqStatus}:`,
        groqError?.message || groqError
      );

      return {
        payload: emptyBotReply("I'm having trouble connecting right now. Please try again."),
        provider: 'fallback',
        intent,
        dataRetrieved: extra.hasData || grounding.hasPlan,
      };
    }
  }
}
