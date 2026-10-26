import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DailyCalorieTracker } from '@/components/calorie-tracker/DailyCalorieTracker';
import { CATEGORY_LABELS } from '@/lib/categoryStorage';
import { useTheme } from '@/hooks/use-theme';
import { useAuth, useCategory } from '@/store/AuthContext';
import {
  calculateCalories,
  type DisabilityCategory,
  type MacroResult,
  PUBMED_STUDY_URL,
} from '@/services/calorieCalculator';
import { fetchNutritionProfile } from '@/services/nutritionProfileService';
import { PlanService } from '@/services/planService';

const SAMPLE_MEALS = [
  {
    name: 'Breakfast',
    foods: [
      { name: 'Oats cooked with milk', serving: '40 g oats', calories: 250 },
      { name: 'Eggs', serving: '2 large', calories: 144 },
    ],
  },
  {
    name: 'Lunch',
    foods: [
      { name: 'Chapati', serving: '2 medium', calories: 240 },
      { name: 'Dal', serving: '1 cup', calories: 230 },
      { name: 'Mixed vegetables', serving: '1 cup', calories: 120 },
    ],
  },
  {
    name: 'Snack',
    foods: [
      { name: 'Protein shake with water', serving: '1 scoop', calories: 130 },
      { name: 'Banana', serving: '1 medium', calories: 105 },
    ],
  },
  {
    name: 'Dinner',
    foods: [
      { name: 'Chapati', serving: '2 medium', calories: 240 },
      { name: 'Egg', serving: '1 large', calories: 72 },
      { name: 'Mixed vegetables', serving: '1 cup', calories: 120 },
    ],
  },
] as const;

const SAMPLE_TOTAL = SAMPLE_MEALS.reduce(
  (total, meal) => total + meal.foods.reduce((mealTotal, food) => mealTotal + food.calories, 0),
  0,
);

function toCalculatorCategory(category: string | undefined): DisabilityCategory | null {
  switch (category) {
    case 'Hemiplegia':
      return 'Hemiplegia';
    case 'Paraplegia':
      return 'Paraplegia';
    case 'Quadriplegia':
    case 'Quadriplegia/Tetraplegia':
      return 'Quadriplegia';
    case 'Monoplegia':
      return 'Monoplegia';
    case 'Diplegia':
      return 'Diplegia';
    default:
      return null;
  }
}

export default function DietScreen() {
  const { user } = useAuth();
  const { category } = useCategory();
  const colors = useTheme();
  const router = useRouter();
  const [macroResult, setMacroResult] = useState<MacroResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [nutritionLoadError, setNutritionLoadError] = useState('');
  const categoryLabel = category ? CATEGORY_LABELS[category] : undefined;
  const calculatorCategory = toCalculatorCategory(categoryLabel);
  const dietGuidance = categoryLabel ? PlanService.getPlanForCategory(categoryLabel)?.diet : null;
  const portionMultiplier = macroResult ? macroResult.calories / SAMPLE_TOTAL : 1;
  const adjustedSampleTotal = useMemo(
    () => SAMPLE_MEALS.reduce(
      (total, meal) => total + meal.foods.reduce(
        (mealTotal, food) => mealTotal + Math.round(food.calories * portionMultiplier),
        0,
      ),
      0,
    ),
    [portionMultiplier],
  );

  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setMacroResult(null);
        setNutritionLoadError('');
        setLoading(false);
        return;
      }

      let active = true;
      setLoading(true);
      setNutritionLoadError('');
      void fetchNutritionProfile(user).then((saved) => {
        if (!active) return;
        setMacroResult(
          saved.details && calculatorCategory
            ? calculateCalories({ ...saved.details, category: calculatorCategory })
            : null,
        );
      }).catch((error: unknown) => {
        console.error('[Diet] Could not load nutrition details:', error);
        if (active) {
          setMacroResult(null);
          setNutritionLoadError('Could not load your saved profile details. Check your connection and reopen Diet to retry.');
        }
      }).finally(() => {
        if (active) setLoading(false);
      });

      return () => {
        active = false;
      };
    }, [user, calculatorCategory]),
  );

  const openFormulaSource = async () => {
    try {
      await Linking.openURL(PUBMED_STUDY_URL);
    } catch (error) {
      console.error('[Diet] Could not open PubMed source:', error);
      Alert.alert('Unable to open source', 'Please try opening the PubMed link again.');
    }
  };

  if (!category) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.empty}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="nutrition" size={30} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Your nutrition plan</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Set your category to see nutrition guidance and a calorie estimate tailored to you.
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/report-upload')}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>Set category</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>PERSONALIZED NUTRITION</Text>
        <Text style={[styles.title, { color: colors.text }]}>Your diet plan</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          An estimated daily target and a practical sample menu for {categoryLabel}.
        </Text>

        <View style={[styles.targetCard, { backgroundColor: colors.primary }]}>
          <View style={styles.targetHeader}>
            <View style={styles.targetIcon}>
              <Ionicons name="flame" size={22} color={colors.primary} />
            </View>
            <View style={styles.targetTitleGroup}>
              <Text style={styles.targetLabel}>Estimated daily calories</Text>
              <Text style={styles.targetValue}>
                {loading ? '…' : macroResult ? macroResult.calories.toLocaleString() : 'Set up profile'}
                {macroResult ? <Text style={styles.targetUnit}> kcal</Text> : null}
              </Text>
            </View>
          </View>
          {macroResult ? (
            <View style={styles.macroRow}>
              <Text style={styles.macroText}>Protein {macroResult.proteinGrams} g</Text>
              <Text style={styles.macroDot}>•</Text>
              <Text style={styles.macroText}>Carbs {macroResult.carbGrams} g</Text>
              <Text style={styles.macroDot}>•</Text>
              <Text style={styles.macroText}>Fat {macroResult.fatGrams} g</Text>
            </View>
          ) : !loading ? (
            <Text style={styles.targetHint}>
              {nutritionLoadError || 'Add weight, height, age and activity in Profile to calculate this estimate.'}
            </Text>
          ) : null}
          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push('/(tabs)/profile')}
            accessibilityRole="button"
            accessibilityLabel="Edit nutrition details in profile"
          >
            <Ionicons name="create-outline" size={17} color={colors.primary} />
            <Text style={[styles.profileButtonText, { color: colors.primary }]}>Edit profile details</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.formulaCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.sectionHeading}>
            <View style={[styles.sectionIcon, { backgroundColor: colors.warning + '1E' }]}>
              <Ionicons name="flask-outline" size={20} color={colors.warning} />
            </View>
            <View style={styles.sectionHeadingCopy}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>How we estimate calories</Text>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{categoryLabel}</Text>
            </View>
          </View>
          {macroResult ? (
            <>
              <Text style={[styles.formulaText, { color: colors.text }]}>{macroResult.formulaUsed}</Text>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>
                {calculatorCategory === 'Paraplegia' || calculatorCategory === 'Quadriplegia'
                  ? 'Source: U.S. National Library of Medicine (PubMed). Study results apply to stable rehabilitation patients; they are not a personal prescription.'
                  : 'This category uses a general Mifflin–St Jeor estimate. The linked PubMed study reports spinal-cord-injury energy expenditure and does not validate this general estimate.'}
              </Text>
              <TouchableOpacity
                style={[styles.verifyButton, { borderColor: colors.primary }]}
                onPress={() => void openFormulaSource()}
                accessibilityRole="link"
                accessibilityLabel="Verify the formula source on PubMed"
              >
                <Ionicons name="open-outline" size={17} color={colors.primary} />
                <Text style={[styles.verifyText, { color: colors.primary }]}>Verify</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={[styles.caption, { color: colors.textSecondary }]}>
              {loading ? 'Loading your saved profile details…' : 'Save your nutrition details in Profile to see the calculation and source notes.'}
            </Text>
          )}
          {macroResult && (
            <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>{macroResult.disclaimer}</Text>
          )}
        </View>

        {!!dietGuidance && (
          <View style={[styles.guidanceCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <View style={styles.sectionHeading}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.success + '1A' }]}>
                <Ionicons name="leaf-outline" size={20} color={colors.success} />
              </View>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Guidance for your category</Text>
            </View>
            <Text style={[styles.guidanceText, { color: colors.textSecondary }]}>{dietGuidance}</Text>
          </View>
        )}

        <View style={styles.mealHeading}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Sample day of meals</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
              {macroResult
                ? `Portions scaled to your ${macroResult.calories.toLocaleString()} kcal estimate`
                : 'Example portions; update your profile for adjusted portions'}
            </Text>
          </View>
          <View style={[styles.totalBadge, { backgroundColor: colors.primary + '14' }]}>
            <Text style={[styles.totalValue, { color: colors.primary }]}>
              {adjustedSampleTotal.toLocaleString()}
            </Text>
            <Text style={[styles.totalUnit, { color: colors.textSecondary }]}>kcal</Text>
          </View>
        </View>

        {SAMPLE_MEALS.map((meal, index) => {
          const mealCalories = meal.foods.reduce(
            (total, food) => total + Math.round(food.calories * portionMultiplier),
            0,
          );
          return (
            <View
              key={meal.name}
              style={[styles.mealCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
            >
              <View style={styles.mealCardHeader}>
                <View style={[styles.mealNumber, { backgroundColor: colors.primary + '18' }]}>
                  <Text style={[styles.mealNumberText, { color: colors.primary }]}>{index + 1}</Text>
                </View>
                <Text style={[styles.mealName, { color: colors.text }]}>{meal.name}</Text>
                <Text style={[styles.mealCalories, { color: colors.primary }]}>{mealCalories} kcal</Text>
              </View>
              {meal.foods.map((food) => (
                <View key={food.name} style={styles.foodRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.foodName, { color: colors.text }]}>{food.name}</Text>
                    <Text style={[styles.foodServing, { color: colors.textSecondary }]}>
                      {macroResult
                        ? `${food.serving} × ${portionMultiplier.toFixed(2)} portion factor`
                        : food.serving}
                    </Text>
                  </View>
                  <Text style={[styles.foodCalories, { color: colors.text }]}>
                    {Math.round(food.calories * portionMultiplier)} kcal
                  </Text>
                </View>
              ))}
            </View>
          );
        })}
        <Text style={[styles.caption, styles.menuNote, { color: colors.textSecondary }]}>
          Food calories are approximate and vary by recipe, brand, and serving size. This example menu is not a medical diet; discuss your needs with a qualified clinician or dietitian.
        </Text>

        <DailyCalorieTracker
          macroResult={macroResult}
          onOpenCalculator={() => router.push('/(tabs)/profile')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 42, gap: 14 },
  eyebrow: { fontSize: 11, letterSpacing: 1, fontWeight: '800' },
  title: { fontSize: 30, lineHeight: 36, fontWeight: '900', marginTop: -10 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: -10 },
  targetCard: { borderRadius: 22, padding: 18, gap: 14 },
  targetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  targetTitleGroup: { flex: 1 },
  targetLabel: { color: '#E8FFF7', fontSize: 13, fontWeight: '700' },
  targetValue: { color: '#FFFFFF', fontSize: 28, lineHeight: 34, fontWeight: '900', marginTop: 2 },
  targetUnit: { fontSize: 15, fontWeight: '700' },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  macroText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  macroDot: { color: '#CDEDE1' },
  targetHint: { color: '#E8FFF7', fontSize: 13, lineHeight: 19 },
  profileButton: { minHeight: 42, alignSelf: 'flex-start', borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7 },
  profileButtonText: { fontSize: 13, fontWeight: '800' },
  formulaCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sectionHeadingCopy: { flex: 1 },
  sectionTitle: { fontSize: 16, lineHeight: 22, fontWeight: '800' },
  sectionSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  formulaText: { fontSize: 13, lineHeight: 20, fontWeight: '700' },
  caption: { fontSize: 12, lineHeight: 18 },
  verifyButton: { minHeight: 40, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  verifyText: { fontSize: 13, fontWeight: '800' },
  disclaimer: { fontSize: 11, lineHeight: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#B8C2BD', paddingTop: 9 },
  guidanceCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 11 },
  guidanceText: { fontSize: 14, lineHeight: 22 },
  mealHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 3 },
  totalBadge: { minWidth: 76, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 10, alignItems: 'center' },
  totalValue: { fontSize: 16, fontWeight: '900' },
  totalUnit: { fontSize: 10, fontWeight: '700' },
  mealCard: { borderWidth: 1, borderRadius: 17, paddingHorizontal: 15, paddingVertical: 13, gap: 10 },
  mealCardHeader: { minHeight: 35, flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#B8C2BD' },
  mealNumber: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  mealNumberText: { fontSize: 13, fontWeight: '900' },
  mealName: { flex: 1, fontSize: 15, fontWeight: '800' },
  mealCalories: { fontSize: 12, fontWeight: '800' },
  foodRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  foodName: { fontSize: 13, fontWeight: '700' },
  foodServing: { fontSize: 11, marginTop: 2 },
  foodCalories: { fontSize: 12, fontWeight: '800' },
  menuNote: { marginHorizontal: 2 },
  empty: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center' },
  heroIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  primaryButton: { minHeight: 50, borderRadius: 14, paddingHorizontal: 22, justifyContent: 'center', marginTop: 18 },
  primaryButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
