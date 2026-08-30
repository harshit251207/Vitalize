import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useFocusEffect, useRouter } from 'expo-router';
import { VitalsService } from '@/services/vitalsService';
import { PlanService, Plan } from '@/services/planService';
import { ExerciseCard } from '@/components/plan/ExerciseCard';
import { UserProfile } from '@/types';
import { Ionicons } from '@expo/vector-icons';

export default function PlanScreen() {
  const { user } = useAuth();
  const colors = useTheme();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    if (!user) return;
    
    const p = await VitalsService.getUserProfile(user);
    setProfile(p);

    if (p.disabilityCategory) {
      const activePlan = PlanService.getPlanForCategory(p.disabilityCategory);
      setPlan(activePlan);

      if (activePlan) {
        const completed = await PlanService.getCompletedExercises(user, todayStr);
        setCompletedIds(completed);

        await PlanService.updateStreakIfCompletedAll(user, todayStr, completed.length, activePlan.exercises.length);
        const s = await PlanService.getStreak(user);
        setStreak(s);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user])
  );

  const toggleExercise = async (exerciseId: string) => {
    if (!user) return;
    
    const updated = await PlanService.toggleExerciseCompletion(user, todayStr, exerciseId);
    setCompletedIds(updated);

    if (plan) {
      await PlanService.updateStreakIfCompletedAll(user, todayStr, updated.length, plan.exercises.length);
      const s = await PlanService.getStreak(user);
      setStreak(s);
    }
  };

  if (!profile?.disabilityCategory) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconCircle, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="fitness-outline" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Plan Selected</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Please upload a medical report or select your disability category to unlock custom exercises and diet recommendations.
          </Text>
          <TouchableOpacity 
            style={[styles.primaryButton, { backgroundColor: colors.primary }]} 
            onPress={() => router.push('/report-upload')}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles" size={20} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.primaryButtonText}>Set Category via AI</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!plan) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>My Plan</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            No custom plan found for category "{profile.disabilityCategory}".
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalExercises = plan.exercises.length;
  const completedCount = completedIds.length;
  const progressPercent = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0;
  const isAllCompleted = completedCount === totalExercises && totalExercises > 0;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header with Title and Streak */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.screenTitle, { color: colors.text }]}>My Plan</Text>
            <Text style={[styles.categorySubtitle, { color: colors.primary }]}>
              {profile.disabilityCategory} Program
            </Text>
          </View>

          <View style={styles.streakBadge}>
            <Text style={styles.streakText}>🔥 {streak} Day Streak</Text>
          </View>
        </View>

        {/* Daily Completion Progress Bar */}
        <View style={[styles.progressCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressTitle, { color: colors.text }]}>Today's Completion</Text>
            <Text style={[styles.progressPercent, { color: colors.primary }]}>{progressPercent}%</Text>
          </View>
          
          <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: colors.success }]} />
          </View>

          <Text style={[styles.progressSubtext, { color: colors.textSecondary }]}>
            {completedCount} of {totalExercises} exercises checked off today
          </Text>
        </View>

        {/* Diet Guidelines Card */}
        <View style={[styles.dietCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.dietHeaderRow}>
            <View style={[styles.dietIconCircle, { backgroundColor: colors.warning + '1E' }]}>
              <Ionicons name="nutrition" size={22} color={colors.warning} />
            </View>
            <Text style={[styles.dietTitle, { color: colors.text }]}>Diet Guidelines</Text>
          </View>
          <Text style={[styles.dietText, { color: colors.textSecondary }]}>{plan.diet}</Text>
        </View>

        {/* Exercises Section */}
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Target Exercises</Text>

        {isAllCompleted && (
          <View style={[styles.successBanner, { backgroundColor: colors.success + '1A', borderColor: colors.success }]}>
            <Ionicons name="trophy" size={22} color={colors.success} style={{ marginRight: 8 }} />
            <Text style={[styles.successText, { color: colors.success }]}>
              Awesome! All exercises completed for today.
            </Text>
          </View>
        )}

        {plan.exercises.map(exercise => (
          <ExerciseCard 
            key={exercise.id}
            exercise={exercise}
            isCompleted={completedIds.includes(exercise.id)}
            onToggle={() => toggleExercise(exercise.id)}
          />
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  primaryButton: {
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
  },
  categorySubtitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  streakBadge: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  streakText: {
    color: '#FFF',
    fontWeight: '800',
    fontSize: 14,
  },
  progressCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '800',
  },
  progressBarTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  progressSubtext: {
    fontSize: 12,
    fontWeight: '600',
  },
  dietCard: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 24,
  },
  dietHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dietIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  dietTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  dietText: {
    fontSize: 14,
    lineHeight: 22,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  successText: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
});
