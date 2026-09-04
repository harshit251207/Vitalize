import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/AuthContext';
import {
  CalorieTrackerService,
  MealEntry,
  getTodayDateString,
} from '@/services/calorieTrackerService';
import {
  calculateCalories,
  DisabilityCategory,
  DISCLAIMER,
  MacroResult,
} from '@/services/calorieCalculator';
import { VitalsService } from '@/services/vitalsService';
import { useRouter } from 'expo-router';

interface DailyCalorieTrackerProps {
  macroResult?: MacroResult | null;
  onOpenCalculator?: () => void;
  compact?: boolean;
}

function toCalculatorCategory(category?: string): DisabilityCategory | null {
  if (!category) return null;
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

export function DailyCalorieTracker({
  macroResult: propMacroResult,
  onOpenCalculator,
  compact = false,
}: DailyCalorieTrackerProps) {
  const colors = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mealName, setMealName] = useState('');
  const [mealCalories, setMealCalories] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [computedTarget, setComputedTarget] = useState<MacroResult | null>(propMacroResult || null);
  const [showAddForm, setShowAddForm] = useState(false);

  const todayStr = getTodayDateString();

  const loadData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Load today's meals
      const todayMeals = await CalorieTrackerService.getMealsForDate(user, todayStr);
      setMeals(todayMeals);

      // If macroResult prop was not provided, load from user profile
      if (!propMacroResult) {
        const profile = await VitalsService.getUserProfile(user);
        const calcCategory = toCalculatorCategory(profile.disabilityCategory);
        if (profile.calorieCalculator && calcCategory) {
          const result = calculateCalories({
            ...profile.calorieCalculator,
            category: calcCategory,
          });
          setComputedTarget(result);
        } else {
          setComputedTarget(null);
        }
      } else {
        setComputedTarget(propMacroResult);
      }
    } catch (err) {
      console.error('Error loading calorie tracker data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, todayStr, propMacroResult]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep computedTarget in sync if prop changes
  useEffect(() => {
    if (propMacroResult) {
      setComputedTarget(propMacroResult);
    }
  }, [propMacroResult]);

  const handleAddMeal = async () => {
    if (!user) return;

    if (!mealName.trim()) {
      Alert.alert('Missing Name', 'Please enter a meal or food name.');
      return;
    }

    const cals = parseInt(mealCalories.trim(), 10);
    if (isNaN(cals) || cals <= 0) {
      Alert.alert('Invalid Calories', 'Please enter a valid positive number for calories.');
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await CalorieTrackerService.addMeal(user, mealName.trim(), cals, todayStr);
      setMeals(updated);
      setMealName('');
      setMealCalories('');
      setShowAddForm(false);
    } catch {
      Alert.alert('Error', 'Failed to save meal entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMeal = async (id: string, name: string) => {
    if (!user) return;

    Alert.alert('Delete Entry', `Remove "${name}" from today's log?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = await CalorieTrackerService.deleteMeal(user, id, todayStr);
            setMeals(updated);
          } catch {
            Alert.alert('Error', 'Could not delete entry.');
          }
        },
      },
    ]);
  };

  const totalConsumed = CalorieTrackerService.calculateTotalCalories(meals);
  const targetCalories = computedTarget?.calories || 2000;
  const hasTarget = Boolean(computedTarget);
  const progressRatio = targetCalories > 0 ? Math.min(totalConsumed / targetCalories, 1) : 0;
  const progressPercent = Math.round(progressRatio * 100);
  const remaining = targetCalories - totalConsumed;

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="nutrition" size={20} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily Calorie Tracker</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
          </View>
        </View>

        {onOpenCalculator ? (
          <TouchableOpacity
            onPress={onOpenCalculator}
            style={[styles.actionChip, { backgroundColor: colors.primary + '14' }]}
            activeOpacity={0.8}
          >
            <Ionicons name="calculator-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.actionChipText, { color: colors.primary }]}>
              {hasTarget ? 'Edit Goal' : 'Set Goal'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => router.push('/plan')}
            style={[styles.actionChip, { backgroundColor: colors.primary + '14' }]}
            activeOpacity={0.8}
          >
            <Ionicons name="calculator-outline" size={14} color={colors.primary} style={{ marginRight: 4 }} />
            <Text style={[styles.actionChipText, { color: colors.primary }]}>
              {hasTarget ? 'Edit Goal' : 'Set Goal'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Target & Macros Display */}
      {hasTarget && computedTarget ? (
        <View style={[styles.targetCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.targetHeader}>
            <View>
              <Text style={[styles.targetCaption, { color: colors.textSecondary }]}>Daily Goal</Text>
              <Text style={[styles.targetValue, { color: colors.primary }]}>
                {computedTarget.calories.toLocaleString()} <Text style={styles.kcalUnit}>kcal</Text>
              </Text>
            </View>
            <View style={[styles.confidenceBadge, { backgroundColor: computedTarget.confidence === 'high' ? colors.success + '1A' : colors.warning + '1A' }]}>
              <Text style={[styles.confidenceBadgeText, { color: computedTarget.confidence === 'high' ? colors.success : colors.warning }]}>
                {computedTarget.confidence === 'high' ? 'High Confidence' : 'General Estimate'}
              </Text>
            </View>
          </View>

          {/* Macro breakdown pills */}
          <View style={styles.macroPillsRow}>
            <View style={[styles.macroPill, { backgroundColor: colors.primary + '14' }]}>
              <Text style={[styles.macroGramText, { color: colors.text }]}>{computedTarget.proteinGrams}g</Text>
              <Text style={[styles.macroNameText, { color: colors.textSecondary }]}>Protein</Text>
            </View>
            <View style={[styles.macroPill, { backgroundColor: colors.warning + '14' }]}>
              <Text style={[styles.macroGramText, { color: colors.text }]}>{computedTarget.carbGrams}g</Text>
              <Text style={[styles.macroNameText, { color: colors.textSecondary }]}>Carbs</Text>
            </View>
            <View style={[styles.macroPill, { backgroundColor: colors.success + '14' }]}>
              <Text style={[styles.macroGramText, { color: colors.text }]}>{computedTarget.fatGrams}g</Text>
              <Text style={[styles.macroNameText, { color: colors.textSecondary }]}>Fat</Text>
            </View>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          onPress={onOpenCalculator ? onOpenCalculator : () => router.push('/plan')}
          style={[styles.noTargetBanner, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles" size={18} color={colors.primary} style={{ marginRight: 8 }} />
          <Text style={[styles.noTargetText, { color: colors.primary }]}>
            Calculate your clinical calorie & macro target in My Plan →
          </Text>
        </TouchableOpacity>
      )}

      {/* Running Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressMetricsRow}>
          <View>
            <Text style={[styles.consumedLabel, { color: colors.textSecondary }]}>Consumed Today</Text>
            <Text style={[styles.consumedBigText, { color: colors.text }]}>
              {totalConsumed.toLocaleString()}{' '}
              <Text style={[styles.targetSubText, { color: colors.textSecondary }]}>
                / {hasTarget ? targetCalories.toLocaleString() : '2,000'} kcal
              </Text>
            </Text>
          </View>
          <View style={styles.percentageBadge}>
            <Text style={[styles.percentageText, { color: remaining < 0 ? colors.danger : colors.primary }]}>
              {progressPercent}%
            </Text>
            <Text style={[styles.remainingText, { color: colors.textSecondary }]}>
              {remaining >= 0 ? `${remaining.toLocaleString()} left` : `${Math.abs(remaining).toLocaleString()} over`}
            </Text>
          </View>
        </View>

        <View style={[styles.progressBarTrack, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(progressPercent, 100)}%`,
                backgroundColor: remaining < 0 ? colors.danger : colors.primary,
              },
            ]}
          />
        </View>
      </View>

      {/* Manual Meal Logging Form */}
      {showAddForm ? (
        <View style={[styles.addFormCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <View style={styles.addFormHeader}>
            <Text style={[styles.addFormTitle, { color: colors.text }]}>Log Meal / Food</Text>
            <TouchableOpacity onPress={() => setShowAddForm(false)}>
              <Ionicons name="close-circle-outline" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.inputStack}>
            <TextInput
              style={[styles.textInput, { backgroundColor: colors.backgroundElement, borderColor: colors.border, color: colors.text }]}
              placeholder="e.g. Oatmeal & Blueberries, Grilled Chicken"
              placeholderTextColor={colors.textSecondary}
              value={mealName}
              onChangeText={setMealName}
              autoFocus
            />

            <View style={styles.calorieInputRow}>
              <TextInput
                style={[styles.textInput, styles.numberInput, { backgroundColor: colors.backgroundElement, borderColor: colors.border, color: colors.text }]}
                placeholder="Calories (e.g. 350)"
                placeholderTextColor={colors.textSecondary}
                value={mealCalories}
                onChangeText={setMealCalories}
                keyboardType="number-pad"
              />
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary }]}
                onPress={handleAddMeal}
                disabled={isSubmitting}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="add" size={18} color="#FFF" style={{ marginRight: 4 }} />
                    <Text style={styles.submitButtonText}>Add</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.addMealButton, { borderColor: colors.primary, backgroundColor: colors.primary + '0D' }]}
          onPress={() => setShowAddForm(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={18} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.addMealButtonText, { color: colors.primary }]}>+ Log Meal / Food</Text>
        </TouchableOpacity>
      )}

      {/* Logged Meals List */}
      <View style={styles.mealsListContainer}>
        <Text style={[styles.mealsListHeading, { color: colors.textSecondary }]}>
          Today's Entries ({meals.length})
        </Text>

        {meals.length === 0 ? (
          <View style={styles.emptyMealsState}>
            <Ionicons name="cafe-outline" size={24} color={colors.textSecondary} style={{ marginBottom: 4 }} />
            <Text style={[styles.emptyMealsText, { color: colors.textSecondary }]}>
              No meals logged today yet. Track your breakfast, lunch, or snacks above!
            </Text>
          </View>
        ) : (
          meals.map((item) => (
            <View
              key={item.id}
              style={[styles.mealRow, { borderBottomColor: colors.border }]}
            >
              <View style={styles.mealInfo}>
                <Text style={[styles.mealNameText, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.mealTimeText, { color: colors.textSecondary }]}>{item.time}</Text>
              </View>

              <View style={styles.mealActions}>
                <Text style={[styles.mealCalText, { color: colors.primary }]}>
                  {item.calories} <Text style={{ fontSize: 11, fontWeight: '500', color: colors.textSecondary }}>kcal</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => handleDeleteMeal(item.id, item.name)}
                  style={styles.deleteButton}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Mandatory Clinical Disclaimer (Visible at all times, non-collapsible) */}
      <View style={[styles.disclaimerBox, { backgroundColor: colors.warning + '12', borderColor: colors.warning + '30' }]}>
        <Ionicons name="information-circle" size={18} color={colors.warning} style={styles.disclaimerIcon} />
        <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
          {DISCLAIMER}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  targetCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  targetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  targetCaption: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  targetValue: {
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  kcalUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  macroPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  macroPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  macroGramText: {
    fontSize: 15,
    fontWeight: '800',
  },
  macroNameText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  noTargetBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  noTargetText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  consumedLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  consumedBigText: {
    fontSize: 22,
    fontWeight: '800',
  },
  targetSubText: {
    fontSize: 14,
    fontWeight: '600',
  },
  percentageBadge: {
    alignItems: 'flex-end',
  },
  percentageText: {
    fontSize: 20,
    fontWeight: '800',
  },
  remainingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressBarTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  addMealButton: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  addMealButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  addFormCard: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  addFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addFormTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputStack: {
    gap: 10,
  },
  textInput: {
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  calorieInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  numberInput: {
    flex: 1,
  },
  submitButton: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  mealsListContainer: {
    marginBottom: 16,
  },
  mealsListHeading: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  emptyMealsState: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  emptyMealsText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  mealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  mealInfo: {
    flex: 1,
    paddingRight: 10,
  },
  mealNameText: {
    fontSize: 14,
    fontWeight: '600',
  },
  mealTimeText: {
    fontSize: 11,
    marginTop: 2,
  },
  mealActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mealCalText: {
    fontSize: 15,
    fontWeight: '700',
  },
  deleteButton: {
    padding: 4,
  },
  disclaimerBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  disclaimerIcon: {
    marginRight: 8,
    marginTop: 1,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
});
