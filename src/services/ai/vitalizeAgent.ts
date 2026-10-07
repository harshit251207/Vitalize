import { computeBPAnalytics, summarizeBPAnalytics } from '@/services/bpAnalyticsService';
import { getVitalHistory, getVitalHistoryForPeriod, VitalsService } from '@/services/vitalsService';
import { PlanService } from '@/services/planService';
import { callGemini } from './geminiService';
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

export interface AgentResponse {
  reply: string;
  provider: 'gemini' | 'groq' | 'fallback';
  intent: AgentIntent;
  dataRetrieved?: boolean;
}

/**
 * Classifies the user's natural language input into a specific intent/tool.
 * Works seamlessly across English, Hindi, and Hinglish.
 */
export function classifyIntent(text: string): AgentIntent {
  const lower = text.toLowerCase().trim();

  // 30-day BP check
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

  // 7-day BP check
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

  // Latest BP reading
  if (
    (lower.includes('latest') || lower.includes('aakhri') || lower.includes('last') || lower.includes('recent')) &&
    (lower.includes('bp') || lower.includes('reading') || lower.includes('blood pressure'))
  ) {
    return 'GET_LATEST_BP';
  }

  // General BP analysis
  if (
    lower.includes('bp') ||
    lower.includes('blood pressure') ||
    lower.includes('bloodpressure')
  ) {
    if (
      lower.includes('check') ||
      lower.includes('analysis') ||
      lower.includes('trend') ||
      lower.includes('batao') ||
      lower.includes('dekho') ||
      lower.includes('report')
    ) {
      return 'BP_ANALYSIS';
    }
  }

  // Workout progress / yesterday's exercises
  if (
    (lower.includes('kal') || lower.includes('yesterday') || lower.includes('progress') || lower.includes('streak')) &&
    (lower.includes('exercise') || lower.includes('workout') || lower.includes('complete') || lower.includes('kitni'))
  ) {
    return 'GET_WORKOUT_PROGRESS';
  }

  // Start workout
  if (
    (lower.includes('start') || lower.includes('shuru') || lower.includes('begin')) &&
    (lower.includes('workout') || lower.includes('exercise') || lower.includes('kasrat'))
  ) {
    return 'START_WORKOUT';
  }

  // Today's workout
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

/**
 * Health Data Minimization Helper:
 * Fetches only the strictly required, structured data based on the detected intent.
 * NEVER exposes Firebase UIDs, auth tokens, emails, full database dumps, or raw OCR files.
 */
async function retrieveMinimalContext(
  intent: AgentIntent,
  userUid?: string | null
): Promise<{ contextSummary: string; hasData: boolean }> {
  if (!userUid) {
    return {
      contextSummary: 'User is not currently signed in or viewing as guest.',
      hasData: false,
    };
  }

  try {
    switch (intent) {
      case 'BP_ANALYTICS_7D': {
        const vitals = await getVitalHistoryForPeriod(7);
        const analytics = computeBPAnalytics(vitals, '7d');
        const summary = summarizeBPAnalytics(analytics);
        return {
          contextSummary: `User's 7-Day BP Analytics Summary:\n${summary}`,
          hasData: analytics.readingCount > 0,
        };
      }

      case 'BP_ANALYTICS_30D': {
        const vitals = await getVitalHistoryForPeriod(30);
        const analytics = computeBPAnalytics(vitals, '30d');
        const summary = summarizeBPAnalytics(analytics);
        return {
          contextSummary: `User's 30-Day BP Analytics Summary:\n${summary}`,
          hasData: analytics.readingCount > 0,
        };
      }

      case 'BP_ANALYSIS': {
        const vitals = await getVitalHistoryForPeriod(7);
        const analytics = computeBPAnalytics(vitals, '7d');
        const summary = summarizeBPAnalytics(analytics);
        return {
          contextSummary: `User's Recent BP Overview:\n${summary}`,
          hasData: analytics.readingCount > 0,
        };
      }

      case 'GET_LATEST_BP': {
        const vitals = await getVitalHistory();
        const bpVitals = vitals.filter(
          (v) => typeof v.bloodPressureSys === 'number' && typeof v.bloodPressureDia === 'number'
        );
        if (bpVitals.length === 0) {
          return {
            contextSummary: 'No blood pressure readings have been logged yet.',
            hasData: false,
          };
        }
        const latest = bpVitals[bpVitals.length - 1];
        return {
          contextSummary: `Latest recorded BP reading: ${latest.bloodPressureSys}/${latest.bloodPressureDia} mmHg (Logged on ${new Date(latest.date).toLocaleDateString()}).`,
          hasData: true,
        };
      }

      case 'GET_TODAY_WORKOUT':
      case 'START_WORKOUT': {
        const profile = await VitalsService.getUserProfile(userUid);
        const category = profile.disabilityCategory;
        if (!category) {
          return {
            contextSummary: 'The user has not yet set their mobility/disability category.',
            hasData: false,
          };
        }
        const plan = PlanService.getPlanForCategory(category);
        if (!plan || plan.exercises.length === 0) {
          return {
            contextSummary: `Plan category is "${category}", but no specific exercises are configured.`,
            hasData: false,
          };
        }
        const exerciseList = plan.exercises.map((e, i) => `${i + 1}. ${e.name} (${e.reps})`).join('\n');
        return {
          contextSummary: `Today's customized workout routine for ${category}:\n${exerciseList}\nDiet focus: ${plan.diet}`,
          hasData: true,
        };
      }

      case 'GET_WORKOUT_PROGRESS': {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const completedYesterday = await PlanService.getCompletedExercises(userUid, yesterdayStr);
        const streak = await PlanService.getStreak(userUid);

        return {
          contextSummary: `Workout progress:
- Exercises completed yesterday (${yesterdayStr}): ${completedYesterday.length}
- Current daily workout streak: ${streak} day(s)`,
          hasData: true,
        };
      }

      case 'GENERAL_HEALTH_QUERY':
      default:
        return { contextSummary: '', hasData: false };
    }
  } catch (error) {
    console.warn('[VitalizeAgent] Error fetching minimal context:', error);
    return {
      contextSummary: 'Unable to access local health records right now.',
      hasData: false,
    };
  }
}

const SYSTEM_INSTRUCTION = `You are Vitalize AI, an empathetic, supportive, and knowledgeable personal health assistant designed specifically for Vitalize users, including individuals with mobility challenges and disabilities.

CRITICAL INSTRUCTIONS:
1. Language Fluency:
   - Understand English, Hindi, and Hinglish naturally.
   - Match the user's language style: If they speak Hindi or Hinglish (e.g. "Mera BP trend batao"), respond warmly in natural Hindi/Hinglish (e.g. "Aapka 7 din ka average BP 124/82 mmHg raha hai...").
   - If they speak English, respond in clear, empathetic English.

2. Health Context Usage:
   - When structured health/BP/workout data is provided below, base your answer directly on that real data.
   - If no readings are logged, politely explain that no readings exist yet and invite the user to log their readings in Vitalize.
   - Do NOT invent or hallucinate fake numbers.

3. Health & Safety:
   - Always keep responses positive, encouraging, and clear.
   - Remind the user gently when discussing blood pressure that Vitalize provides health insights for informational guidance, not a medical diagnosis, and to consult their doctor or healthcare provider for clinical medical advice.
   - Keep answers concise, readable, and structured with bullet points where appropriate.`;

/**
 * The Central AI Agent Entrypoint.
 *
 * ARCHITECTURAL RULE:
 * Voice and Typed messages BOTH call this SAME function.
 *
 * Flow:
 * Intent / Tool Resolution
 *    ↓
 * Minimal Structured Data Retrieval (Health Data Minimization)
 *    ↓
 * Call Gemini (Primary)
 *    ↓
 * If Gemini fails → Groq Fallback (1 attempt)
 *    ↓
 * Return unified response to Chat UI
 */
export async function processAgentMessage(
  userText: string,
  userUid?: string | null
): Promise<AgentResponse> {
  const trimmed = userText.trim();
  if (!trimmed) {
    return {
      reply: 'Please provide a message or voice recording.',
      provider: 'fallback',
      intent: 'GENERAL_HEALTH_QUERY',
      dataRetrieved: false,
    };
  }

  // 1. Intent / Tool identification
  const intent = classifyIntent(trimmed);

  // 2. Health Data Minimization (only fetch strictly necessary data)
  const { contextSummary, hasData } = await retrieveMinimalContext(intent, userUid);

  // 3. Assemble prompt with minimized context
  let finalPrompt = trimmed;
  if (contextSummary) {
    finalPrompt = `${trimmed}\n\n[CONFIDENTIAL MINIMIZED HEALTH CONTEXT]:\n${contextSummary}`;
  }

  // 4. Primary Provider: Gemini
  try {
    const geminiReply = await callGemini(finalPrompt, SYSTEM_INSTRUCTION);
    return {
      reply: geminiReply,
      provider: 'gemini',
      intent,
      dataRetrieved: hasData,
    };
  } catch (geminiError: any) {
    const status = geminiError?.statusCode ? ` (HTTP ${geminiError.statusCode})` : '';
    console.warn(
      `[VitalizeAgent] Gemini call failed${status}, attempting Groq fallback:`,
      geminiError?.message || geminiError
    );

    // 5. Fallback Provider: Groq (attempted exactly once)
    try {
      const groqReply = await callGroq(finalPrompt, SYSTEM_INSTRUCTION);
      return {
        reply: groqReply,
        provider: 'groq',
        intent,
        dataRetrieved: hasData,
      };
    } catch (groqError: any) {
      const groqStatus = groqError?.statusCode ? ` (HTTP ${groqError.statusCode})` : '';
      console.error(
        `[VitalizeAgent] Groq fallback also failed${groqStatus}:`,
        groqError?.message || groqError
      );

      // 6. Graceful failure when both providers fail
      return {
        reply: "I'm having trouble connecting right now. Please try again.",
        provider: 'fallback',
        intent,
        dataRetrieved: hasData,
      };
    }
  }
}
