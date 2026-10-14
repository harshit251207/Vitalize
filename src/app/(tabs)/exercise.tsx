import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExerciseCard } from '@/components/plan/ExerciseCard';
import { CATEGORY_LABELS } from '@/lib/categoryStorage';
import { useTheme } from '@/hooks/use-theme';
import { useCategory } from '@/store/AuthContext';
import { useWorkoutProgress } from '@/hooks/use-workout-progress';

export default function ExerciseScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { category } = useCategory();
  const {
    plan,
    completedIds,
    completedCount,
    totalCount,
    progressPercent,
    isLoading,
    streak,
    toggleExercise,
  } = useWorkoutProgress();

  if (!category) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.empty}>
          <Ionicons name="barbell-outline" size={44} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Exercise plan</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Set your category to see movements adapted to your plan.
          </Text>
          <TouchableOpacity style={[styles.button, { backgroundColor: colors.primary }]} onPress={() => router.push('/report-upload')}>
            <Text style={styles.buttonText}>Set category</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR DAILY MOVEMENT</Text>
            <Text style={[styles.title, { color: colors.text }]}>Exercise</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{CATEGORY_LABELS[category]} program</Text>
          </View>
          <View style={styles.streak}>
            <Text style={styles.streakText}>🔥 {streak}</Text>
            <Text style={styles.streakCaption}>day streak</Text>
          </View>
        </View>

        {plan ? (
          <>
            <View style={[styles.progressCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <View style={styles.progressHeader}>
                <Text style={[styles.progressTitle, { color: colors.text }]}>Today&apos;s progress</Text>
                <Text style={[styles.progressPercent, { color: colors.primary }]}>{progressPercent}%</Text>
              </View>
              <View style={[styles.track, { backgroundColor: colors.border }]}>
                <View style={[styles.fill, { backgroundColor: colors.primary, width: `${progressPercent}%` }]} />
              </View>
              <Text style={[styles.progressCaption, { color: colors.textSecondary }]}>
                {completedCount} of {totalCount} exercises completed
              </Text>
            </View>

            {(plan.confidence === 'moderate' || plan.confidence === 'low') && (
              <View style={[styles.notice, { backgroundColor: colors.warning + '14', borderColor: colors.warning + '40' }]}>
                <Ionicons name="alert-circle" size={19} color={colors.warning} />
                <Text style={[styles.noticeText, { color: colors.textSecondary }]}>
                  General adaptation — consult a physiotherapist to tailor these movements to your needs.
                </Text>
              </View>
            )}

            {plan.exercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                isCompleted={completedIds.includes(exercise.id)}
                onToggle={() => void toggleExercise(exercise.id)}
              />
            ))}
            <TouchableOpacity style={styles.changeCategory} onPress={() => router.push('/report-upload?change=1')}>
              <Ionicons name="swap-horizontal" size={17} color={colors.primary} />
              <Text style={[styles.changeText, { color: colors.primary }]}>Change category</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            No exercise plan is available for this category yet.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { justifyContent: 'center', alignItems: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  eyebrow: { fontSize: 11, letterSpacing: 1, fontWeight: '800' },
  title: { fontSize: 30, fontWeight: '900', marginTop: 4 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 4 },
  streak: { backgroundColor: '#FF9500', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 8, alignItems: 'center' },
  streakText: { color: '#FFF', fontSize: 15, fontWeight: '900' },
  streakCaption: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  progressCard: { borderWidth: 1, borderRadius: 18, padding: 16, marginBottom: 15 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressTitle: { fontSize: 15, fontWeight: '800' },
  progressPercent: { fontSize: 20, fontWeight: '900' },
  track: { height: 9, borderRadius: 5, overflow: 'hidden', marginTop: 12 },
  fill: { height: '100%', borderRadius: 5 },
  progressCaption: { fontSize: 12, fontWeight: '600', marginTop: 8 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 13, flexDirection: 'row', gap: 9, marginBottom: 14 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  changeCategory: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 10 },
  changeText: { fontSize: 14, fontWeight: '700' },
  empty: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center' },
  button: { minHeight: 50, borderRadius: 14, paddingHorizontal: 22, justifyContent: 'center', marginTop: 18 },
  buttonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
