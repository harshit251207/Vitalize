import { computeBPAnalytics, summarizeBPAnalytics } from '@/services/bpAnalyticsService';
import { getVitalHistoryForPeriod, VitalsService } from '@/services/vitalsService';
import { PlanService } from '@/services/planService';
import { Vitals } from '@/types';
import { generateChatCompletion, type AIProviderName } from './aiProvider';

export type AgentIntent =
  | 'GENERAL_HEALTH_QUERY'
  | 'EXPLAIN_VITAL_READING'
  | 'ANALYZE_BP'
  | 'BP_ANALYTICS_7D'
  | 'BP_ANALYTICS_30D'
  | 'ANALYZE_HEART_RATE'
  | 'ANALYZE_BLOOD_SUGAR'
  | 'VIEW_RECENT_VITALS'
  | 'PERSONALIZED_GUIDANCE'
  | 'EXERCISE_GUIDANCE'
  | 'NUTRITION_GUIDANCE'
  | 'DISABILITY_GUIDANCE'
  | 'PROGRESS_CHECK'
  | 'GET_LATEST_BP'
  | 'GET_TODAY_WORKOUT'
  | 'START_WORKOUT'
  | 'GET_WORKOUT_PROGRESS'
  | 'EMERGENCY';

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
  provider: AIProviderName | 'fallback';
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

const CRISIS_BP_SYS = 180;
const CRISIS_BP_DIA = 120;
const CRISIS_HR_HIGH = 130;
const CRISIS_HR_LOW = 40;
const CRISIS_SUGAR_HIGH = 400;
const CRISIS_SUGAR_LOW = 54;

export function emptyBotReply(intro: string): BotReply {
  return {
    ...EMPTY_REPLY,
    intro: stripMarkdownSymbols(intro).trim(),
  };
}

export function classifyIntent(text: string): AgentIntent {
  const lower = text.toLowerCase().trim();

  if (
    /chest pain|seene mein dard|can't breathe|cant breathe|saans nahi|shortness of breath|faint|unconscious|stroke|suicidal|ambulance|emergency|112\b|102\b|hypertensive crisis/.test(
      lower
    )
  ) {
    return 'EMERGENCY';
  }

  if (
    lower.includes('30 din') ||
    lower.includes('30 days') ||
    lower.includes('30-day') ||
    lower.includes('mahina') ||
    /\bmonth\b/.test(lower)
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
    /\bweek\b/.test(lower) ||
    lower.includes('changed') ||
    lower.includes('change')
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
    /\bhr\b/.test(lower) ||
    lower.includes('heart rate') ||
    lower.includes('pulse') ||
    lower.includes('dil ki dhadkan')
  ) {
    return 'ANALYZE_HEART_RATE';
  }

  if (
    lower.includes('blood sugar') ||
    lower.includes('sugar') ||
    lower.includes('glucose') ||
    lower.includes('shakkar')
  ) {
    return 'ANALYZE_BLOOD_SUGAR';
  }

  if (
    lower.includes('bp') ||
    lower.includes('blood pressure') ||
    lower.includes('bloodpressure')
  ) {
    if (
      lower.includes('normal') ||
      lower.includes('check') ||
      lower.includes('analysis') ||
      lower.includes('trend') ||
      lower.includes('batao') ||
      lower.includes('dekho') ||
      lower.includes('report') ||
      lower.includes('kaisa') ||
      lower.includes('explain') ||
      lower.includes('schedule')
    ) {
      return 'ANALYZE_BP';
    }
    return 'ANALYZE_BP';
  }

  if (
    lower.includes('vitals') ||
    lower.includes('reading') ||
    lower.includes('readings') ||
    lower.includes('latest')
  ) {
    return 'VIEW_RECENT_VITALS';
  }

  if (
    (lower.includes('kal') ||
      lower.includes('yesterday') ||
      lower.includes('progress') ||
      lower.includes('streak')) &&
    (lower.includes('exercise') ||
      lower.includes('workout') ||
      lower.includes('complete') ||
      lower.includes('kitni'))
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
    return 'EXERCISE_GUIDANCE';
  }

  if (
    lower.includes('diet') ||
    lower.includes('nutrition') ||
    lower.includes('food') ||
    lower.includes('khaana') ||
    lower.includes('khana') ||
    lower.includes('calorie')
  ) {
    return 'NUTRITION_GUIDANCE';
  }

  if (
    lower.includes('disability') ||
    lower.includes('wheelchair') ||
    lower.includes('condition') ||
    lower.includes('paraplegia') ||
    lower.includes('hemiplegia') ||
    lower.includes('quadriplegia') ||
    lower.includes('diplegia') ||
    lower.includes('monoplegia')
  ) {
    return 'DISABILITY_GUIDANCE';
  }

  if (lower.includes('progress') || lower.includes('streak') || lower.includes('kaise ho raha')) {
    return 'PROGRESS_CHECK';
  }

  if (
    lower.includes('guidance') ||
    lower.includes('advice') ||
    lower.includes('personalized') ||
    lower.includes('mere liye')
  ) {
    return 'PERSONALIZED_GUIDANCE';
  }

  if (lower.includes('explain') && (lower.includes('vital') || lower.includes('reading'))) {
    return 'EXPLAIN_VITAL_READING';
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
    return 'No vitals logged yet. Do not invent numbers.';
  }

  const newestFirst = [...vitals].reverse();
  let bp: string | null = null;
  let weight: string | null = null;
  let sugar: string | null = null;
  let hr: string | null = null;

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
    if (!hr && typeof v.heartRate === 'number') {
      hr = `${v.heartRate} bpm (logged ${new Date(v.date).toLocaleDateString()})`;
    }
    if (bp && weight && sugar && hr) break;
  }

  return [
    `BP: ${bp ?? 'not recorded'}`,
    `Heart rate: ${hr ?? 'not recorded'}`,
    `Weight: ${weight ?? 'not recorded'}`,
    `Blood sugar: ${sugar ?? 'not recorded'}`,
  ].join('\n');
}

function formatVitalsLog(vitals: Vitals[], fields?: Array<'bp' | 'hr' | 'sugar' | 'weight'>): string {
  if (vitals.length === 0) {
    return 'No readings in this period. Do not invent numbers.';
  }

  const wanted = new Set(fields ?? ['bp', 'hr', 'sugar', 'weight']);

  return vitals
    .map((v) => {
      const when = new Date(v.date).toLocaleString();
      const bits: string[] = [];
      if (
        wanted.has('bp') &&
        typeof v.bloodPressureSys === 'number' &&
        typeof v.bloodPressureDia === 'number'
      ) {
        bits.push(`BP ${v.bloodPressureSys}/${v.bloodPressureDia}`);
      }
      if (wanted.has('weight') && typeof v.weight === 'number') bits.push(`weight ${v.weight} kg`);
      if (wanted.has('sugar') && typeof v.bloodSugar === 'number') bits.push(`sugar ${v.bloodSugar}`);
      if (wanted.has('hr') && typeof v.heartRate === 'number') bits.push(`HR ${v.heartRate}`);
      return bits.length ? `${when}: ${bits.join(', ')}` : null;
    })
    .filter((line): line is string => !!line)
    .join('\n') || 'Logged entries exist, but the requested fields were not recorded.';
}

function detectRedFlags(vitals: Vitals[]): string[] {
  const flags: string[] = [];
  const newestFirst = [...vitals].reverse();

  for (const v of newestFirst) {
    if (
      typeof v.bloodPressureSys === 'number' &&
      typeof v.bloodPressureDia === 'number' &&
      (v.bloodPressureSys >= CRISIS_BP_SYS || v.bloodPressureDia >= CRISIS_BP_DIA)
    ) {
      flags.push(
        `RED FLAG: latest BP ${v.bloodPressureSys}/${v.bloodPressureDia} mmHg is in a potentially dangerous range. Recommend urgent medical care. Do not diagnose.`
      );
      break;
    }
  }

  for (const v of newestFirst) {
    if (typeof v.heartRate === 'number' && (v.heartRate >= CRISIS_HR_HIGH || v.heartRate <= CRISIS_HR_LOW)) {
      flags.push(
        `RED FLAG: latest heart rate ${v.heartRate} bpm may be unsafe. Recommend seeking medical care. Do not diagnose.`
      );
      break;
    }
  }

  for (const v of newestFirst) {
    if (
      typeof v.bloodSugar === 'number' &&
      (v.bloodSugar >= CRISIS_SUGAR_HIGH || v.bloodSugar <= CRISIS_SUGAR_LOW)
    ) {
      flags.push(
        `RED FLAG: latest blood sugar ${v.bloodSugar} may be unsafe. Recommend seeking medical care. Do not diagnose.`
      );
      break;
    }
  }

  return flags;
}

type RetrievedContext = {
  text: string;
  hasData: boolean;
  hasPlan: boolean;
  redFlags: string[];
};

async function loadProfileAndPlan(
  userUid: string,
  includePlan: boolean,
  includeProgress: boolean
): Promise<{ sections: string[]; hasPlan: boolean; category?: string }> {
  const sections: string[] = [];
  let hasPlan = false;
  const todayStr = todayDateStr();
  const yesterdayStr = yesterdayDateStr();

  try {
    const profile = await VitalsService.getUserProfile(userUid);
    const category = profile.disabilityCategory || 'not set';
    sections.push(`Disability category on file: ${category}`);
    if (profile.disabilityCategory) {
      sections.push('Treat mobility limitations as wheelchair-relevant unless the plan says otherwise.');
    }

    if (includePlan && profile.disabilityCategory) {
      const plan = PlanService.getPlanForCategory(profile.disabilityCategory);
      if (plan && plan.exercises.length > 0) {
        hasPlan = true;
        const exerciseList = plan.exercises.map((e, i) => `${i + 1}. ${e.name} — ${e.reps}`).join('\n');
        sections.push(`PROVIDED WORKOUT PLAN (the only allowed exercises):\n${exerciseList}`);
        sections.push(`PROVIDED DIET PLAN:\n${plan.diet}`);
      } else {
        sections.push('No labeled workout/diet plan is configured for this category yet.');
      }

      if (includeProgress) {
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
    }

    return { sections, hasPlan, category: profile.disabilityCategory };
  } catch (error) {
    console.warn('[VitalizeAgent] Error fetching plan/profile:', error);
    sections.push('Unable to load disability category or plan right now. Say that this data is unavailable.');
    return { sections, hasPlan: false };
  }
}

async function retrieveContextForIntent(
  intent: AgentIntent,
  userUid?: string | null
): Promise<RetrievedContext> {
  if (!userUid) {
    return {
      text: 'User is not currently signed in. No personal plan or vitals are available. Do not invent them.',
      hasData: false,
      hasPlan: false,
      redFlags: [],
    };
  }

  const sections: string[] = [];
  let hasData = false;
  let hasPlan = false;
  let redFlags: string[] = [];

  const needsPlan = [
    'EXERCISE_GUIDANCE',
    'NUTRITION_GUIDANCE',
    'DISABILITY_GUIDANCE',
    'PERSONALIZED_GUIDANCE',
    'GET_TODAY_WORKOUT',
    'START_WORKOUT',
    'GET_WORKOUT_PROGRESS',
    'PROGRESS_CHECK',
    'EMERGENCY',
  ].includes(intent);
  const needsProgress = [
    'GET_WORKOUT_PROGRESS',
    'PROGRESS_CHECK',
    'GET_TODAY_WORKOUT',
    'START_WORKOUT',
    'EXERCISE_GUIDANCE',
  ].includes(intent);

  const profile = await loadProfileAndPlan(userUid, needsPlan, needsProgress);
  sections.push(...profile.sections);
  hasPlan = profile.hasPlan;

  const needsVitals = [
    'EXPLAIN_VITAL_READING',
    'ANALYZE_BP',
    'BP_ANALYTICS_7D',
    'BP_ANALYTICS_30D',
    'ANALYZE_HEART_RATE',
    'ANALYZE_BLOOD_SUGAR',
    'VIEW_RECENT_VITALS',
    'GET_LATEST_BP',
    'PROGRESS_CHECK',
    'EMERGENCY',
    'PERSONALIZED_GUIDANCE',
  ].includes(intent);

  if (needsVitals) {
    try {
      const days = intent === 'BP_ANALYTICS_30D' ? 30 : 7;
      const vitals = await getVitalHistoryForPeriod(days);
      const hasNumeric = vitals.some(
        (v) =>
          typeof v.bloodPressureSys === 'number' ||
          typeof v.heartRate === 'number' ||
          typeof v.bloodSugar === 'number' ||
          typeof v.weight === 'number'
      );
      hasData = hasNumeric;
      redFlags = detectRedFlags(vitals);

      if (intent === 'ANALYZE_HEART_RATE') {
        sections.push(`Heart-rate history (${days} days):\n${formatVitalsLog(vitals, ['hr'])}`);
      } else if (intent === 'ANALYZE_BLOOD_SUGAR') {
        sections.push(`Blood-sugar history (${days} days):\n${formatVitalsLog(vitals, ['sugar'])}`);
      } else if (intent === 'GET_LATEST_BP' || intent === 'ANALYZE_BP' || intent === 'EXPLAIN_VITAL_READING') {
        sections.push(`Latest vitals:\n${formatLatestVitals(vitals)}`);
        const analytics = computeBPAnalytics(vitals, '7d');
        sections.push(`Recent BP overview:\n${summarizeBPAnalytics(analytics)}`);
        hasData = analytics.readingCount > 0 || hasNumeric;
      } else if (intent === 'BP_ANALYTICS_7D' || intent === 'BP_ANALYTICS_30D') {
        const period = intent === 'BP_ANALYTICS_30D' ? '30d' : '7d';
        const analytics = computeBPAnalytics(vitals, period);
        sections.push(`BP analytics (${period}):\n${summarizeBPAnalytics(analytics)}`);
        sections.push(`Raw BP log:\n${formatVitalsLog(vitals, ['bp'])}`);
        hasData = analytics.readingCount > 0;
      } else {
        sections.push(`Latest vitals:\n${formatLatestVitals(vitals)}`);
        sections.push(`Recent vitals log:\n${formatVitalsLog(vitals)}`);
      }

      if (redFlags.length) {
        sections.push(redFlags.join('\n'));
      }
    } catch (error) {
      console.warn('[VitalizeAgent] Error fetching vitals:', error);
      sections.push('Vitals data is unavailable right now. Say that it is unavailable. Do not invent readings.');
    }
  }

  if (intent === 'GET_WORKOUT_PROGRESS' || intent === 'PROGRESS_CHECK') {
    try {
      const streak = await PlanService.getStreak(userUid);
      sections.push(`Current daily workout streak: ${streak} day(s)`);
      hasData = true;
    } catch (error) {
      console.warn('[VitalizeAgent] Error fetching streak:', error);
    }
  }

  return {
    text: sections.join('\n\n'),
    hasData,
    hasPlan,
    redFlags,
  };
}

function buildSystemInstruction(grounding: string, intent: AgentIntent): string {
  return `You are Vitalize AI, a casual Hinglish health companion for a rehabilitation/vitals app.

Always fill the schema. If a field is not relevant, return an empty string or empty array. Never reply outside JSON. Keep the total under ~120 words.

OUTPUT (JSON only, every field required):
{
  "intro": string,
  "workout": [ { "name": string, "reps_or_duration": string } ],
  "vitals_note": string,
  "diet_tip": string,
  "motivation": string
}

FIELD RULES:
- intro: 1-3 short lines answering the question.
- workout: only exercises from the PROVIDED PLAN. Empty array [] if the question is not about workout/exercise.
- vitals_note: only if the user asked about vitals/BP/HR/sugar or a red flag exists.
- diet_tip: empty string if not about food/diet.
- motivation: one short line, or empty string.

SAFETY (mandatory):
- You are informational only. Do NOT diagnose diseases or replace a doctor.
- Do NOT invent vitals, dates, exercise completions, or plan items.
- If a requested reading is missing, say it is unavailable and suggest logging it in Vitalize.
- For RED FLAG / emergency symptoms or crisis-range readings, clearly tell the user to seek appropriate medical care now. Vitalize is not emergency services.
- Only suggest exercises from the provided plan. Never invent new exercises.
- Do not suggest standing, walking, or gait work unless it is in the provided plan.
- Intent for this turn: ${intent}

USER CONTEXT (use only this; if a field is absent it is unavailable):
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

function applySafetyOverlay(reply: BotReply, intent: AgentIntent, redFlags: string[]): BotReply {
  const next = { ...reply, workout: [...reply.workout] };
  if (intent === 'EMERGENCY' || redFlags.length > 0) {
    const care =
      'This may need urgent medical care. Vitalize cannot diagnose or replace emergency services — contact a doctor or local emergency number if symptoms are severe.';
    if (!/emergency|doctor|urgent|medical care/i.test(`${next.intro} ${next.vitals_note}`)) {
      next.intro = next.intro ? `${next.intro}\n\n${care}` : care;
    }
  }
  if (!next.intro.trim()) {
    next.intro = "I couldn't format that answer cleanly. Please try asking again in a short sentence.";
  }
  return next;
}

function localFallbackReply(intent: AgentIntent, retrieved: RetrievedContext): BotReply {
  if (intent === 'EMERGENCY' || retrieved.redFlags.length > 0) {
    return emptyBotReply(
      "I couldn't reach the AI just now. If you have severe symptoms (chest pain, trouble breathing, fainting), seek emergency medical care immediately. Vitalize cannot diagnose or replace a doctor."
    );
  }

  if (
    [
      'ANALYZE_BP',
      'BP_ANALYTICS_7D',
      'BP_ANALYTICS_30D',
      'GET_LATEST_BP',
      'ANALYZE_HEART_RATE',
      'ANALYZE_BLOOD_SUGAR',
      'VIEW_RECENT_VITALS',
      'EXPLAIN_VITAL_READING',
    ].includes(intent)
  ) {
    if (!retrieved.hasData) {
      return emptyBotReply(
        "I don't have that vital reading in your Vitalize logs yet, and I won't guess a number. Log it in Vitals, then ask again."
      );
    }
    const note = retrieved.text.slice(0, 700);
    return {
      ...EMPTY_REPLY,
      intro:
        "AI is temporarily unavailable, so here is a plain summary from your logged data only. This is not a diagnosis — follow up with your clinician if you're concerned.",
      vitals_note: note,
    };
  }

  if (retrieved.hasPlan && ['GET_TODAY_WORKOUT', 'START_WORKOUT', 'EXERCISE_GUIDANCE'].includes(intent)) {
    return emptyBotReply(
      "AI is temporarily unavailable. Open today's Plan tab for your assigned exercises. I can only recommend moves from your Vitalize plan."
    );
  }

  return emptyBotReply(
    "I'm having trouble connecting to the health assistant right now. Your vitals and plan data are still in the app — please try again in a moment."
  );
}

/**
 * Voice and typed messages both call this function once per user turn.
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
  const retrieved = await retrieveContextForIntent(intent, userUid);
  const systemInstruction = buildSystemInstruction(retrieved.text, intent);

  try {
    const ai = await generateChatCompletion(trimmed, systemInstruction);
    return {
      payload: applySafetyOverlay(parseBotReply(ai.text), intent, retrieved.redFlags),
      provider: ai.provider,
      intent,
      dataRetrieved: retrieved.hasData || retrieved.hasPlan,
    };
  } catch (error: unknown) {
    console.error(
      '[VitalizeAgent] All AI providers failed:',
      error instanceof Error ? error.message : error
    );
    return {
      payload: applySafetyOverlay(localFallbackReply(intent, retrieved), intent, retrieved.redFlags),
      provider: 'fallback',
      intent,
      dataRetrieved: retrieved.hasData || retrieved.hasPlan,
    };
  }
}
