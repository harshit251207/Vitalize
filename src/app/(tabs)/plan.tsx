import React, { useCallback, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { useFocusEffect, useRouter } from 'expo-router';
import { VitalsService } from '@/services/vitalsService';
import { PlanService, Plan } from '@/services/planService';
import { ExerciseCard } from '@/components/plan/ExerciseCard';
import { DailyCalorieTracker } from '@/components/calorie-tracker/DailyCalorieTracker';
import { UserProfile } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityLevel,
  calculateCalories,
  DisabilityCategory,
  Gender,
  MacroResult,
} from '@/services/calorieCalculator';

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light activity' },
  { value: 'moderate', label: 'Moderate activity' },
];

function toCalculatorCategory(category?: string): DisabilityCategory | null {
  if (category === 'Quadriplegia/Tetraplegia') return 'Quadriplegia';
  if (
    category === 'Hemiplegia' ||
    category === 'Paraplegia' ||
    category === 'Quadriplegia' ||
    category === 'Monoplegia' ||
    category === 'Diplegia'
  ) {
    return category;
  }
  return null;
}

export default function PlanScreen() {
  const { user } = useAuth();
  const colors = useTheme();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [streak, setStreak] = useState(0);
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('sedentary');
  const [macroResult, setMacroResult] = useState<MacroResult | null>(null);
  const [activityPickerVisible, setActivityPickerVisible] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    if (!user) return;

    const p = await VitalsService.getUserProfile(user);
    setProfile(p);

    const savedCalculator = p.calorieCalculator;
    const calculatorCategory = toCalculatorCategory(p.disabilityCategory);
    if (savedCalculator) {
      setWeightKg(String(savedCalculator.weightKg));
      setHeightCm(String(savedCalculator.heightCm));
      setAge(String(savedCalculator.age));
      setGender(savedCalculator.gender);
      setActivityLevel(savedCalculator.activityLevel);

      if (calculatorCategory) {
        setMacroResult(calculateCalories({ ...savedCalculator, category: calculatorCategory }));
      }
    } else {
      setMacroResult(null);
    }

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

  const calculateDailyNeeds = async () => {
    if (!user) return;

    const category = toCalculatorCategory(profile?.disabilityCategory);
    const input = {
      weightKg: Number(weightKg),
      heightCm: Number(heightCm),
      age: Number(age),
      gender,
      activityLevel,
    };

    if (
      !category ||
      !input.weightKg ||
      !input.heightCm ||
      !input.age ||
      input.weightKg <= 0 ||
      input.heightCm <= 0 ||
      input.age <= 0
    ) {
      Alert.alert(
        'Enter valid details',
        'Please enter a positive weight, height, and age to calculate your daily needs.'
      );
      return;
    }

    const result = calculateCalories({ ...input, category });
    setMacroResult(result);
    await VitalsService.updateUserProfile(user, { calorieCalculator: input });
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
            Please upload a medical report or select your disability category to unlock personalized exercises and diet recommendations.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/report-upload')}
            activeOpacity={0.85}
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
  const isModerateOrLow = plan.confidence === 'moderate' || plan.confidence === 'low';

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

        {/* Low/Moderate Confidence Badge Note */}
        {isModerateOrLow && (
          <View
            style={[
              styles.adaptationNotice,
              { backgroundColor: colors.warning + '14', borderColor: colors.warning + '40' },
            ]}
          >
            <Ionicons name="alert-circle" size={18} color={colors.warning} style={{ marginRight: 8, marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.adaptationNoticeTitle, { color: colors.warning }]}>
                General adaptation — consult a physiotherapist
              </Text>
              <Text style={[styles.adaptationNoticeBody, { color: colors.textSecondary }]}>
                Exercises and energy estimates for {profile.disabilityCategory} are clinically adapted. Work with your physical therapist to tailor individual ranges.
              </Text>
            </View>
          </View>
        )}

        {/* Daily Completion Progress Bar */}
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.progressTitle, { color: colors.text }]}>Today's Workout Completion</Text>
            <Text style={[styles.progressPercent, { color: colors.primary }]}>{progressPercent}%</Text>
          </View>

          <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progressPercent}%`, backgroundColor: colors.success },
              ]}
            />
          </View>

          <Text style={[styles.progressSubtext, { color: colors.textSecondary }]}>
            {completedCount} of {totalExercises} exercises completed today
          </Text>
        </View>

        {/* Diet Guidelines Card */}
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.warning + '1E' }]}>
              <Ionicons name="nutrition" size={20} color={colors.warning} />
            </View>
            <Text style={[styles.cardHeaderTitle, { color: colors.text }]}>Diet Guidelines</Text>
          </View>
          <Text style={[styles.bodyText, { color: colors.textSecondary }]}>{plan.diet}</Text>
        </View>

        {/* Daily Calorie & Macro Calculator Card */}
        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '1E' }]}>
              <Ionicons name="calculator" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardHeaderTitle, { color: colors.text }]}>Daily Calorie & Macro Target</Text>
              <Text style={[styles.cardHeaderSubtitle, { color: colors.textSecondary }]}>
                Evidence-based formula for {profile.disabilityCategory}
              </Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Weight (kg)</Text>
              <TextInput
                value={weightKg}
                onChangeText={setWeightKg}
                keyboardType="decimal-pad"
                placeholder="e.g. 65"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Height (cm)</Text>
              <TextInput
                value={heightCm}
                onChangeText={setHeightCm}
                keyboardType="decimal-pad"
                placeholder="e.g. 170"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Age</Text>
              <TextInput
                value={age}
                onChangeText={setAge}
                keyboardType="number-pad"
                placeholder="e.g. 30"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Activity level</Text>
              <TouchableOpacity
                onPress={() => setActivityPickerVisible(true)}
                style={[styles.selectInput, { borderColor: colors.border, backgroundColor: colors.background }]}
              >
                <Text style={[styles.selectInputText, { color: colors.text }]}>
                  {ACTIVITY_OPTIONS.find((option) => option.value === activityLevel)?.label}
                </Text>
                <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Gender</Text>
          <View style={styles.genderRow}>
            {(['male', 'female'] as Gender[]).map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setGender(option)}
                style={[
                  styles.genderOption,
                  {
                    borderColor: gender === option ? colors.primary : colors.border,
                    backgroundColor: gender === option ? colors.primary + '18' : colors.background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.genderOptionText,
                    { color: gender === option ? colors.primary : colors.textSecondary },
                  ]}
                >
                  {option === 'male' ? 'Male' : 'Female'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={calculateDailyNeeds}
            style={[styles.calculateButton, { backgroundColor: colors.primary }]}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh-outline" size={18} color="#FFF" style={{ marginRight: 8 }} />
            <Text style={styles.calculateButtonText}>
              {macroResult ? 'Update & Recalculate Needs' : 'Calculate Daily Needs'}
            </Text>
          </TouchableOpacity>

          {macroResult && (
            <View style={[styles.resultsSection, { borderTopColor: colors.border }]}>
              <Text style={[styles.calorieValue, { color: colors.primary }]}>
                {macroResult.calories.toLocaleString()} kcal
              </Text>
              <Text style={[styles.calorieCaption, { color: colors.textSecondary }]}>
                Recommended daily energy intake
              </Text>

              <View style={styles.macroRow}>
                <View style={[styles.macroItem, { backgroundColor: colors.primary + '14' }]}>
                  <Text style={[styles.macroValue, { color: colors.text }]}>{macroResult.proteinGrams}g</Text>
                  <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Protein</Text>
                </View>
                <View style={[styles.macroItem, { backgroundColor: colors.warning + '14' }]}>
                  <Text style={[styles.macroValue, { color: colors.text }]}>{macroResult.carbGrams}g</Text>
                  <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Carbs</Text>
                </View>
                <View style={[styles.macroItem, { backgroundColor: colors.success + '14' }]}>
                  <Text style={[styles.macroValue, { color: colors.text }]}>{macroResult.fatGrams}g</Text>
                  <Text style={[styles.macroLabel, { color: colors.textSecondary }]}>Fat</Text>
                </View>
              </View>

              <Text style={[styles.formulaText, { color: colors.textSecondary }]}>{macroResult.formulaUsed}</Text>
            </View>
          )}
        </View>

        {/* Daily Calorie Tracker Section */}
        <DailyCalorieTracker macroResult={macroResult} />

        {/* Target Exercises Section Header */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>
            Target Exercises ({plan.exercises.length})
          </Text>
          {plan.confidence && (
            <View
              style={[
                styles.confidencePill,
                {
                  backgroundColor:
                    plan.confidence === 'high' ? colors.success + '18' : colors.warning + '18',
                },
              ]}
            >
              <Text
                style={[
                  styles.confidencePillText,
                  {
                    color: plan.confidence === 'high' ? colors.success : colors.warning,
                  },
                ]}
              >
                {plan.confidence.toUpperCase()} CONFIDENCE
              </Text>
            </View>
          )}
        </View>

        {isAllCompleted && (
          <View style={[styles.successBanner, { backgroundColor: colors.success + '1A', borderColor: colors.success }]}>
            <Ionicons name="trophy" size={22} color={colors.success} style={{ marginRight: 8 }} />
            <Text style={[styles.successText, { color: colors.success }]}>
              Awesome! All exercises completed for today.
            </Text>
          </View>
        )}

        {/* 6 Category Exercises List */}
        {plan.exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            isCompleted={completedIds.includes(exercise.id)}
            onToggle={() => toggleExercise(exercise.id)}
          />
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Activity Level Modal */}
      <Modal
        transparent
        visible={activityPickerVisible}
        animationType="fade"
        onRequestClose={() => setActivityPickerVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setActivityPickerVisible(false)}>
          <Pressable style={[styles.activitySheet, { backgroundColor: colors.backgroundElement }]} onPress={() => undefined}>
            <Text style={[styles.activitySheetTitle, { color: colors.text }]}>Activity level</Text>
            {ACTIVITY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  setActivityLevel(option.value);
                  setActivityPickerVisible(false);
                }}
                style={styles.activityOption}
              >
                <Text style={[styles.activityOptionText, { color: colors.text }]}>{option.label}</Text>
                {activityLevel === option.value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
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
    marginBottom: 16,
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
  adaptationNotice: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  adaptationNoticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  adaptationNoticeBody: {
    fontSize: 12,
    lineHeight: 17,
  },
  card: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  cardHeaderSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
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
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  inputGroup: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  input: {
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  selectInput: {
    height: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectInputText: {
    fontSize: 14,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  genderOption: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderOptionText: {
    fontSize: 14,
    fontWeight: '700',
  },
  calculateButton: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calculateButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  resultsSection: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  calorieValue: {
    fontSize: 28,
    fontWeight: '800',
  },
  calorieCaption: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 14,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    marginBottom: 12,
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  macroValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  macroLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  formulaText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
  },
  confidencePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  confidencePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  successText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  activitySheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 34,
  },
  activitySheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  activityOption: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activityOptionText: {
    fontSize: 16,
  },
});
