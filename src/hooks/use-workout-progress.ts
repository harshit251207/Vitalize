import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Plan, PlanService } from '@/services/planService';
import { useAuth, useCategory } from '@/store/AuthContext';
import { CATEGORY_LABELS } from '@/lib/categoryStorage';

export function useWorkoutProgress() {
  const { user } = useAuth();
  const { category } = useCategory();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadProgress = useCallback(async () => {
    if (!user || !category) {
      setPlan(null);
      setCompletedIds([]);
      setStreak(0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const activePlan = PlanService.getPlanForCategory(CATEGORY_LABELS[category]);
      setPlan(activePlan);
      if (activePlan) {
        const today = new Date().toISOString().split('T')[0];
        const completed = await PlanService.getCompletedExercises(user, today);
        setCompletedIds(completed);
        await PlanService.updateStreakIfCompletedAll(user, today, completed.length, activePlan.exercises.length);
        setStreak(await PlanService.getStreak(user));
      } else {
        setCompletedIds([]);
        setStreak(0);
      }
    } catch (error) {
      console.error("Unable to load today's workout progress:", error);
      setPlan(null);
      setCompletedIds([]);
      setStreak(0);
    } finally {
      setIsLoading(false);
    }
  }, [user, category]);

  useFocusEffect(
    useCallback(() => {
      void loadProgress();
    }, [loadProgress]),
  );

  const toggleExercise = useCallback(async (exerciseId: string) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const updated = await PlanService.toggleExerciseCompletion(user, today, exerciseId);
    setCompletedIds(updated);
    if (plan) {
      await PlanService.updateStreakIfCompletedAll(user, today, updated.length, plan.exercises.length);
      setStreak(await PlanService.getStreak(user));
    }
  }, [user, plan]);

  const totalCount = plan?.exercises.length ?? 0;
  const completedCount = completedIds.filter((id) =>
    plan?.exercises.some((exercise) => exercise.id === id),
  ).length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return {
    plan,
    completedIds,
    completedCount,
    totalCount,
    progressPercent,
    streak,
    isLoading,
    toggleExercise,
    refresh: loadProgress,
  };
}
