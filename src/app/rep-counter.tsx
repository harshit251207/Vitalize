import { useLocalSearchParams } from 'expo-router';

import { RepCounterScreen } from '@/screens/RepCounterScreen';
import type { ExerciseId, Level } from '@/exercise/config';

const EXERCISE_IDS: ExerciseId[] = ['bicepCurl', 'shoulderPress'];
const LEVELS: Level[] = ['beginner', 'intermediate', 'advanced'];

function getExercise(value: string | undefined): ExerciseId {
  return EXERCISE_IDS.find((id) => id === value) ?? 'bicepCurl';
}

function getLevel(value: string | undefined): Level {
  return LEVELS.find((level) => level === value) ?? 'intermediate';
}

export default function RepCounterRoute() {
  const params = useLocalSearchParams<{
    exercise?: string;
    level?: string;
    planExerciseId?: string;
  }>();

  return (
    <RepCounterScreen
      exercise={getExercise(params.exercise)}
      level={getLevel(params.level)}
      planExerciseId={params.planExerciseId}
    />
  );
}
