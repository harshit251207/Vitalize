import AsyncStorage from '@react-native-async-storage/async-storage';

import { EXERCISES } from '@/exercise/config';
import type { ExerciseId, Level } from '@/exercise/config';

export interface RepCounterSession {
  id: string;
  exerciseId: ExerciseId;
  exerciseName: string;
  level: Level;
  reps: number;
  cleanReps: number;
  formAccuracy: number | null;
  durationMs: number;
  timestamp: string;
}

function sessionsKey(uid: string): string {
  return `@rep_counter_sessions_${uid}`;
}

export async function saveRepCounterSession(
  uid: string,
  session: Omit<RepCounterSession, 'id' | 'exerciseName'>,
): Promise<RepCounterSession> {
  const key = sessionsKey(uid);
  const stored = await AsyncStorage.getItem(key);
  const parsed: unknown = stored ? JSON.parse(stored) : [];
  if (!Array.isArray(parsed)) {
    throw new Error('Saved rep-counter sessions are invalid.');
  }

  const savedSession: RepCounterSession = {
    ...session,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    exerciseName: EXERCISES[session.exerciseId].label,
  };

  await AsyncStorage.setItem(key, JSON.stringify([...parsed, savedSession]));
  return savedSession;
}
