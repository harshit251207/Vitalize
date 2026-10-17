import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CATEGORY_LABELS } from '@/lib/categoryStorage';
import { useCategory } from '@/store/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useWorkoutProgress } from '@/hooks/use-workout-progress';
import { WellnessBanner } from '@/components/WellnessBanner';

export default function PlansScreen() {
  const router = useRouter();
  const colors = useTheme();
  const { category } = useCategory();
  const { completedCount, totalCount, progressPercent } = useWorkoutProgress();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>YOUR PERSONALIZED CARE</Text>
        <Text style={[styles.title, { color: colors.text }]}>Plans</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {category
            ? `Tailored for ${CATEGORY_LABELS[category]}`
            : 'Choose a category to unlock your personalized exercise and diet plans.'}
        </Text>

        <WellnessBanner
          variant="plans"
          title="Progress at your pace"
          subtitle="Small, steady steps make a difference."
        />

        {category ? (
          <View style={[styles.progressCard, { backgroundColor: colors.backgroundSelected, borderColor: colors.border }]}>
            <View style={styles.progressRow}>
              <View style={[styles.progressIcon, { backgroundColor: colors.primary + '18' }]}>
                <Ionicons name="fitness" size={22} color={colors.primary} />
              </View>
              <View style={styles.progressLabels}>
                <Text style={[styles.progressTitle, { color: colors.text }]}>Today&apos;s exercise progress</Text>
                <Text style={[styles.progressSubtitle, { color: colors.textSecondary }]}>
                  {completedCount} of {totalCount} completed
                </Text>
              </View>
              <Text style={[styles.percent, { color: colors.primary }]}>{progressPercent}%</Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.border }]}>
              <View style={[styles.fill, { width: `${progressPercent}%`, backgroundColor: colors.primary }]} />
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.setupButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/report-upload')}
            accessibilityRole="button"
          >
            <Text style={styles.setupText}>Set my category</Text>
            <Ionicons name="arrow-forward" size={19} color="#FFF" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.sectionCard, { backgroundColor: colors.backgroundSelected, borderColor: colors.border }]}
          onPress={() => router.push(category ? '/exercise' : '/report-upload')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Open exercise plan"
        >
          <View style={[styles.cardIcon, { backgroundColor: colors.success + '18' }]}>
            <Ionicons name="barbell-outline" size={27} color={colors.success} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Exercise</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              Daily workout, progress, and adapted movements
            </Text>
            {category && (
              <Text style={[styles.cardMeta, { color: colors.success }]}>
                {completedCount}/{totalCount} done · {progressPercent}%
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={21} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.sectionCard, { backgroundColor: colors.backgroundSelected, borderColor: colors.border }]}
          onPress={() => router.push(category ? '/diet' : '/report-upload')}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Open diet plan"
        >
          <View style={[styles.cardIcon, { backgroundColor: colors.warning + '1E' }]}>
            <Ionicons name="nutrition-outline" size={27} color={colors.warning} />
          </View>
          <View style={styles.cardContent}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Diet</Text>
            <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
              Nutrition guidance, calorie tracking, and macro targets
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={21} color={colors.textSecondary} />
        </TouchableOpacity>

        {category && (
          <TouchableOpacity
            style={styles.changeCategory}
            onPress={() => router.push('/report-upload?change=1')}
            accessibilityRole="button"
          >
            <Ionicons name="swap-horizontal" size={17} color={colors.primary} />
            <Text style={[styles.changeCategoryText, { color: colors.primary }]}>Change category</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  eyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: 32, fontWeight: '900', marginTop: 5 },
  subtitle: { fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 22 },
  progressCard: { padding: 16, borderRadius: 22, borderWidth: 0, marginBottom: 14 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  progressIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  progressLabels: { flex: 1 },
  progressTitle: { fontSize: 14, fontWeight: '800' },
  progressSubtitle: { fontSize: 12, marginTop: 2 },
  percent: { fontSize: 19, fontWeight: '900' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 14 },
  fill: { height: '100%', borderRadius: 4 },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0,
    borderRadius: 22,
    padding: 17,
    marginBottom: 12,
    gap: 13,
  },
  cardIcon: { width: 50, height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  cardSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  cardMeta: { fontSize: 12, fontWeight: '800', marginTop: 7 },
  setupButton: {
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
    flexDirection: 'row',
    marginBottom: 14,
  },
  setupText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  changeCategory: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'center', marginTop: 5 },
  changeCategoryText: { fontSize: 14, fontWeight: '700' },
});
