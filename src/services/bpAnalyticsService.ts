import { Vitals } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TimePeriod = '7d' | '30d';

export type TrendDirection =
  | 'increasing'
  | 'decreasing'
  | 'stable'
  | 'insufficient_data';

/** A single BP reading with its date, used internally. */
export interface BPReading {
  systolic: number;
  diastolic: number;
  recordedAt: Date;
}

/** Describes why an individual reading was flagged as unusual. */
export interface UnusualReading extends BPReading {
  reason: string;
}

/** Reference-range classification counts. */
export interface ReferenceRangeFlags {
  aboveReference: number;
  belowReference: number;
  withinReference: number;
}

/**
 * Structured BP analytics result.
 *
 * Designed for deterministic reuse by a future AI chatbot:
 *   Firestore → vitalsService → bpAnalyticsService → BPAnalyticsResult → chatbot
 */
export interface BPAnalyticsResult {
  /** The time window these analytics cover. */
  period: TimePeriod;

  /** Total number of valid BP readings in the period. */
  readingCount: number;

  /** The most recent reading, or null if none. */
  latestReading: BPReading | null;

  /** Overall systolic trend over the period. */
  systolicTrend: TrendDirection;

  /** Overall diastolic trend over the period. */
  diastolicTrend: TrendDirection;

  /** Arithmetic mean of systolic values, or null when no readings. */
  averageSystolic: number | null;

  /** Arithmetic mean of diastolic values, or null when no readings. */
  averageDiastolic: number | null;

  /** Moving average of the last `MOVING_AVG_WINDOW` readings. */
  movingAverage: {
    systolic: number | null;
    diastolic: number | null;
  };

  /** Readings that deviate significantly from the user's own baseline. */
  unusualReadings: UnusualReading[];

  /** How many readings fall above / below / within the reference range. */
  referenceRangeFlags: ReferenceRangeFlags;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * General-population reference ranges (AHA guidelines).
 * NOT a medical diagnosis – interpretation depends on the individual.
 */
export const BP_REFERENCE = {
  systolic: { low: 90, high: 120 },
  diastolic: { low: 60, high: 80 },
} as const;

/** Number of readings used for the moving average. */
const MOVING_AVG_WINDOW = 5;

/** Minimum readings required for trend calculation. */
const MIN_READINGS_FOR_TREND = 3;

/**
 * Z-score threshold to flag a reading as "unusual".
 * Values beyond ±UNUSUAL_ZSCORE_THRESHOLD standard deviations
 * from the user's own mean are flagged.
 */
const UNUSUAL_ZSCORE_THRESHOLD = 2.0;

// ---------------------------------------------------------------------------
// Helper: extract valid BP readings from Vitals[]
// ---------------------------------------------------------------------------

/**
 * Filters a `Vitals[]` down to readings that have both valid systolic and
 * diastolic values, sorted chronologically (oldest → newest).
 */
export function extractBPReadings(vitals: Vitals[]): BPReading[] {
  return vitals
    .filter(
      (v): v is Vitals & { bloodPressureSys: number; bloodPressureDia: number } =>
        typeof v.bloodPressureSys === 'number' &&
        Number.isFinite(v.bloodPressureSys) &&
        typeof v.bloodPressureDia === 'number' &&
        Number.isFinite(v.bloodPressureDia) &&
        typeof v.date === 'string' &&
        v.date.length > 0,
    )
    .map((v) => ({
      systolic: v.bloodPressureSys,
      diastolic: v.bloodPressureDia,
      recordedAt: new Date(v.date),
    }))
    .filter((r) => !isNaN(r.recordedAt.getTime()))
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
}

// ---------------------------------------------------------------------------
// Statistical helpers
// ---------------------------------------------------------------------------

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance =
    values.reduce((s, v) => s + (v - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Simple linear regression slope.
 * x = 0, 1, 2, … (reading index)
 * Returns the slope of the best-fit line.
 */
function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const xMean = (n - 1) / 2;
  const yMean = values.reduce((s, v) => s + v, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Determines trend direction from slope.
 * A slope whose absolute value is less than a fraction of the mean
 * is considered "stable".
 */
function trendFromSlope(values: number[]): TrendDirection {
  if (values.length < MIN_READINGS_FOR_TREND) return 'insufficient_data';

  const slope = linearSlope(values);
  const avg = mean(values)!;

  // Threshold: slope per reading < 0.5 % of the mean → stable
  const threshold = Math.abs(avg) * 0.005;

  if (slope > threshold) return 'increasing';
  if (slope < -threshold) return 'decreasing';
  return 'stable';
}

/**
 * Computes a simple moving average over the last `windowSize` readings.
 */
function movingAverage(
  values: number[],
  windowSize: number,
): number | null {
  if (values.length === 0) return null;
  const window = values.slice(-windowSize);
  return mean(window);
}

// ---------------------------------------------------------------------------
// Unusual-reading detection
// ---------------------------------------------------------------------------

function detectUnusualReadings(readings: BPReading[]): UnusualReading[] {
  if (readings.length < MIN_READINGS_FOR_TREND) return [];

  const sysList = readings.map((r) => r.systolic);
  const diaList = readings.map((r) => r.diastolic);

  const sysMean = mean(sysList)!;
  const diaMean = mean(diaList)!;
  const sysSd = stddev(sysList, sysMean);
  const diaSd = stddev(diaList, diaMean);

  // If standard deviation is near zero, no meaningful outlier detection
  if (sysSd < 1 && diaSd < 1) return [];

  const unusual: UnusualReading[] = [];

  for (const r of readings) {
    const reasons: string[] = [];

    if (sysSd > 0) {
      const sysZ = Math.abs((r.systolic - sysMean) / sysSd);
      if (sysZ >= UNUSUAL_ZSCORE_THRESHOLD) {
        reasons.push(
          `Systolic ${r.systolic} mmHg is ${r.systolic > sysMean ? 'above' : 'below'} your recent average (${Math.round(sysMean)} mmHg)`,
        );
      }
    }

    if (diaSd > 0) {
      const diaZ = Math.abs((r.diastolic - diaMean) / diaSd);
      if (diaZ >= UNUSUAL_ZSCORE_THRESHOLD) {
        reasons.push(
          `Diastolic ${r.diastolic} mmHg is ${r.diastolic > diaMean ? 'above' : 'below'} your recent average (${Math.round(diaMean)} mmHg)`,
        );
      }
    }

    if (reasons.length > 0) {
      unusual.push({ ...r, reason: reasons.join('; ') });
    }
  }

  return unusual;
}

// ---------------------------------------------------------------------------
// Reference-range classification
// ---------------------------------------------------------------------------

function classifyReferenceRange(readings: BPReading[]): ReferenceRangeFlags {
  let aboveReference = 0;
  let belowReference = 0;
  let withinReference = 0;

  for (const r of readings) {
    if (
      r.systolic > BP_REFERENCE.systolic.high ||
      r.diastolic > BP_REFERENCE.diastolic.high
    ) {
      aboveReference++;
    } else if (
      r.systolic < BP_REFERENCE.systolic.low ||
      r.diastolic < BP_REFERENCE.diastolic.low
    ) {
      belowReference++;
    } else {
      withinReference++;
    }
  }

  return { aboveReference, belowReference, withinReference };
}

// ---------------------------------------------------------------------------
// Main analytics function
// ---------------------------------------------------------------------------

/**
 * Computes a complete BP analytics result from an array of `Vitals`.
 *
 * The input should already be filtered to the desired time period
 * (via `getVitalHistoryForPeriod` in vitalsService).
 *
 * @param vitals - Vitals array for the chosen period (oldest → newest).
 * @param period - Which period these vitals represent.
 * @returns Structured analytics suitable for UI display and future chatbot use.
 */
export function computeBPAnalytics(
  vitals: Vitals[],
  period: TimePeriod,
): BPAnalyticsResult {
  const readings = extractBPReadings(vitals);

  const sysList = readings.map((r) => r.systolic);
  const diaList = readings.map((r) => r.diastolic);

  return {
    period,
    readingCount: readings.length,

    latestReading: readings.length > 0 ? readings[readings.length - 1] : null,

    systolicTrend: trendFromSlope(sysList),
    diastolicTrend: trendFromSlope(diaList),

    averageSystolic: mean(sysList),
    averageDiastolic: mean(diaList),

    movingAverage: {
      systolic: movingAverage(sysList, MOVING_AVG_WINDOW),
      diastolic: movingAverage(diaList, MOVING_AVG_WINDOW),
    },

    unusualReadings: detectUnusualReadings(readings),

    referenceRangeFlags: classifyReferenceRange(readings),
  };
}

// ---------------------------------------------------------------------------
// Convenience: human-readable summary (for future chatbot prompt)
// ---------------------------------------------------------------------------

/**
 * Produces a concise, chatbot-friendly text summary of the analytics.
 * The future AI chatbot can feed this to a Gemini/Groq prompt to generate
 * a personalised explanation.
 *
 * This function does NOT call any AI API.
 */
export function summarizeBPAnalytics(result: BPAnalyticsResult): string {
  if (result.readingCount === 0) {
    return `No blood pressure readings in the last ${result.period === '7d' ? '7 days' : '30 days'}.`;
  }

  const lines: string[] = [];

  lines.push(
    `Period: ${result.period === '7d' ? '7 days' : '30 days'} (${result.readingCount} reading${result.readingCount !== 1 ? 's' : ''})`,
  );

  if (result.latestReading) {
    lines.push(
      `Latest reading: ${result.latestReading.systolic}/${result.latestReading.diastolic} mmHg`,
    );
  }

  if (result.averageSystolic != null && result.averageDiastolic != null) {
    lines.push(
      `Average: ${Math.round(result.averageSystolic)}/${Math.round(result.averageDiastolic)} mmHg`,
    );
  }

  if (result.movingAverage.systolic != null && result.movingAverage.diastolic != null) {
    lines.push(
      `Moving average (last 5): ${Math.round(result.movingAverage.systolic)}/${Math.round(result.movingAverage.diastolic)} mmHg`,
    );
  }

  lines.push(`Systolic trend: ${result.systolicTrend}`);
  lines.push(`Diastolic trend: ${result.diastolicTrend}`);

  const { aboveReference, belowReference, withinReference } =
    result.referenceRangeFlags;
  lines.push(
    `Reference range: ${withinReference} within, ${aboveReference} above, ${belowReference} below`,
  );

  if (result.unusualReadings.length > 0) {
    lines.push(`Unusual readings: ${result.unusualReadings.length}`);
  }

  return lines.join('\n');
}
