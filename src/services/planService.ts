import AsyncStorage from '@react-native-async-storage/async-storage';
import plansData from '@/data/plans.json';
import { DisabilityCategory } from '@/services/aiService';
import { getExercisesForCategory, ExerciseConfidence } from '@/data/exercises';

export interface Exercise {
  id: string;
  name: string;
  description: string;
  reps: string;
  gifUrl: string;
}

export interface Plan {
  diet: string;
  exercises: Exercise[];
  confidence?: ExerciseConfidence;
  notes?: string;
}

export const PlanService = {
  getPlanForCategory(category: DisabilityCategory | string): Plan | null {
    if (!category || category === 'unclear') return null;

    const group = getExercisesForCategory(category);
    const existingPlan = category in plansData ? (plansData as any)[category] : null;
    const diet = existingPlan?.diet || 'Focus on nutrient-dense foods, balanced protein, and optimal hydration to support daily recovery and energy.';

    if (group && group.exercises.length > 0) {
      return {
        diet,
        exercises: group.exercises.map(e => ({
          id: e.id,
          name: e.name,
          description: e.description,
          reps: e.reps || '3 sets',
          gifUrl: e.gifUrl,
        })),
        confidence: group.confidence,
        notes: group.notes,
      };
    }

    if (existingPlan) {
      return existingPlan as Plan;
    }

    return null;
  },

  async getCompletedExercises(username: string, dateStr: string): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(`@completed_${username}_${dateStr}`);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async toggleExerciseCompletion(username: string, dateStr: string, exerciseId: string): Promise<string[]> {
    try {
      const completed = await this.getCompletedExercises(username, dateStr);
      const isCompleted = completed.includes(exerciseId);
      
      const updated = isCompleted 
        ? completed.filter(id => id !== exerciseId)
        : [...completed, exerciseId];
        
      await AsyncStorage.setItem(`@completed_${username}_${dateStr}`, JSON.stringify(updated));
      return updated;
    } catch {
      return [];
    }
  },

  async getStreak(username: string): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(`@streak_${username}`);
      return data ? parseInt(data, 10) : 0;
    } catch {
      return 0;
    }
  },

  async updateStreakIfCompletedAll(username: string, dateStr: string, completedCount: number, totalCount: number) {
    if (completedCount === totalCount && totalCount > 0) {
      const lastRecordedStr = await AsyncStorage.getItem(`@last_streak_date_${username}`);
      if (lastRecordedStr !== dateStr) {
        let currentStreak = await this.getStreak(username);
        
        if (lastRecordedStr) {
          const lastDate = new Date(lastRecordedStr);
          const today = new Date(dateStr);
          const diffTime = Math.abs(today.getTime() - lastDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            currentStreak += 1;
          } else if (diffDays > 1) {
            currentStreak = 1;
          }
        } else {
          currentStreak = 1;
        }

        await AsyncStorage.setItem(`@streak_${username}`, currentStreak.toString());
        await AsyncStorage.setItem(`@last_streak_date_${username}`, dateStr);
      }
    }
  }
};
