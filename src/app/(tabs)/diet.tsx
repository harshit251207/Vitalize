import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DailyCalorieTracker } from '@/components/calorie-tracker/DailyCalorieTracker';
import { CATEGORY_LABELS } from '@/lib/categoryStorage';
import { useTheme } from '@/hooks/use-theme';
import { useAuth, useCategory } from '@/store/AuthContext';
import { VitalsService } from '@/services/vitalsService';
import {
  ActivityLevel,
  calculateCalories,
  DisabilityCategory,
  Gender,
  MacroResult,
} from '@/services/calorieCalculator';
import { PlanService } from '@/services/planService';

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light activity' },
  { value: 'moderate', label: 'Moderate activity' },
];

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
  const scrollRef = useRef<ScrollView>(null);
  const calculatorOffset = useRef(0);
  const [diet, setDiet] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<Gender>('male');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('sedentary');
  const [macroResult, setMacroResult] = useState<MacroResult | null>(null);
  const [activityPickerVisible, setActivityPickerVisible] = useState(false);
  const categoryLabel = category ? CATEGORY_LABELS[category] : undefined;
  const calculatorCategory = toCalculatorCategory(categoryLabel);
  const plan = categoryLabel ? PlanService.getPlanForCategory(categoryLabel) : null;

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      if (!user) return () => { isActive = false; };
      void VitalsService.getUserProfile(user).then((profile) => {
        if (!isActive) return;
        setDiet(plan?.diet ?? '');
        if (profile.calorieCalculator) {
          const saved = profile.calorieCalculator;
          setWeightKg(String(saved.weightKg));
          setHeightCm(String(saved.heightCm));
          setAge(String(saved.age));
          setGender(saved.gender);
          setActivityLevel(saved.activityLevel);
          if (calculatorCategory) {
            setMacroResult(calculateCalories({ ...saved, category: calculatorCategory }));
          }
        } else {
          setMacroResult(null);
        }
      }).catch((error: unknown) => {
        console.error('Unable to load diet preferences:', error);
      });
      return () => { isActive = false; };
    }, [user, plan?.diet, calculatorCategory]),
  );

  const calculateDailyNeeds = async () => {
    if (!user) return;
    const input = {
      weightKg: Number(weightKg),
      heightCm: Number(heightCm),
      age: Number(age),
      gender,
      activityLevel,
    };
    if (
      !calculatorCategory ||
      !input.weightKg ||
      !input.heightCm ||
      !input.age ||
      input.weightKg <= 0 ||
      input.heightCm <= 0 ||
      input.age <= 0
    ) {
      Alert.alert('Enter valid details', 'Enter a positive weight, height, and age to calculate your daily needs.');
      return;
    }

    try {
      const result = calculateCalories({ ...input, category: calculatorCategory });
      await VitalsService.updateUserProfile(user, { calorieCalculator: input });
      setMacroResult(result);
      Alert.alert('Nutrition target updated', 'Your daily calorie and macro estimates have been saved.');
    } catch (error) {
      console.error('Unable to calculate or save nutrition targets:', error);
      Alert.alert('Unable to save target', 'Please try again.');
    }
  };

  if (!category) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.empty}>
          <Ionicons name="nutrition-outline" size={44} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Diet</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Set your category to see personalized nutrition guidance and targets.
          </Text>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => router.push('/report-upload')}>
            <Text style={styles.primaryButtonText}>Set category</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const inputStyle = [
    styles.input,
    { color: colors.text, borderColor: colors.border, backgroundColor: colors.background },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.eyebrow, { color: colors.primary }]}>NOURISH YOUR WELLBEING</Text>
        <Text style={[styles.title, { color: colors.text }]}>Diet</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{categoryLabel} nutrition</Text>

        <View style={[styles.guidanceCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.cardHeading}>
            <View style={[styles.icon, { backgroundColor: colors.warning + '1E' }]}>
              <Ionicons name="nutrition" size={21} color={colors.warning} />
            </View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Diet guidelines</Text>
          </View>
          <Text style={[styles.guidance, { color: colors.textSecondary }]}>{diet}</Text>
        </View>

        <View onLayout={() => undefined}>
          <DailyCalorieTracker
            macroResult={macroResult}
            onOpenCalculator={() => scrollRef.current?.scrollTo({ y: calculatorOffset.current, animated: true })}
          />
        </View>

        <View
          onLayout={(event) => { calculatorOffset.current = event.nativeEvent.layout.y; }}
          style={[styles.calculatorCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
        >
          <View style={styles.cardHeading}>
            <View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="calculator" size={21} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Calorie & macro target</Text>
              <Text style={[styles.caption, { color: colors.textSecondary }]}>Research-based estimate for {categoryLabel}</Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Weight (kg)</Text>
              <TextInput value={weightKg} onChangeText={setWeightKg} keyboardType="decimal-pad" placeholder="e.g. 65" placeholderTextColor={colors.textSecondary} style={inputStyle} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Height (cm)</Text>
              <TextInput value={heightCm} onChangeText={setHeightCm} keyboardType="decimal-pad" placeholder="e.g. 170" placeholderTextColor={colors.textSecondary} style={inputStyle} />
            </View>
          </View>
          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Age</Text>
              <TextInput value={age} onChangeText={setAge} keyboardType="number-pad" placeholder="e.g. 30" placeholderTextColor={colors.textSecondary} style={inputStyle} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Activity level</Text>
              <TouchableOpacity style={[styles.input, styles.select, { borderColor: colors.border, backgroundColor: colors.background }]} onPress={() => setActivityPickerVisible(true)}>
                <Text style={[styles.selectText, { color: colors.text }]}>
                  {ACTIVITY_OPTIONS.find((option) => option.value === activityLevel)?.label}
                </Text>
                <Ionicons name="chevron-down" size={17} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>Gender</Text>
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
                <Text style={{ color: gender === option ? colors.primary : colors.textSecondary, fontWeight: '700' }}>
                  {option === 'male' ? 'Male' : 'Female'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.calculateButton, { backgroundColor: colors.primary }]} onPress={() => void calculateDailyNeeds()}>
            <Ionicons name="refresh-outline" size={18} color="#FFF" />
            <Text style={styles.calculateText}>{macroResult ? 'Update daily target' : 'Calculate my target'}</Text>
          </TouchableOpacity>
          {macroResult && (
            <View style={[styles.resultBox, { backgroundColor: colors.background }]}>
              <Text style={[styles.resultCalories, { color: colors.primary }]}>{macroResult.calories.toLocaleString()} kcal / day</Text>
              <Text style={[styles.resultMacros, { color: colors.textSecondary }]}>
                Protein {macroResult.proteinGrams}g · Carbs {macroResult.carbGrams}g · Fat {macroResult.fatGrams}g
              </Text>
              <Text style={[styles.disclaimer, { color: colors.textSecondary }]}>{macroResult.disclaimer}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal transparent visible={activityPickerVisible} animationType="fade" onRequestClose={() => setActivityPickerVisible(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setActivityPickerVisible(false)}>
          <Pressable style={[styles.activitySheet, { backgroundColor: colors.backgroundElement }]} onPress={() => undefined}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Activity level</Text>
            {ACTIVITY_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => {
                  setActivityLevel(option.value);
                  setActivityPickerVisible(false);
                }}
                style={styles.activityOption}
              >
                <Text style={[styles.selectText, { color: colors.text }]}>{option.label}</Text>
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
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  eyebrow: { fontSize: 11, letterSpacing: 1, fontWeight: '800' },
  title: { fontSize: 30, fontWeight: '900', marginTop: 4 },
  subtitle: { fontSize: 14, lineHeight: 21, marginTop: 4, marginBottom: 17 },
  guidanceCard: { borderWidth: 1, borderRadius: 18, padding: 17, marginBottom: 15 },
  calculatorCard: { borderWidth: 1, borderRadius: 18, padding: 17, marginTop: 16 },
  cardHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  caption: { fontSize: 12, marginTop: 3 },
  guidance: { fontSize: 14, lineHeight: 22 },
  inputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  inputGroup: { flex: 1 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  input: { height: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14, justifyContent: 'center' },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectText: { fontSize: 14, fontWeight: '600' },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  genderOption: { flex: 1, height: 44, borderWidth: 1.5, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  calculateButton: { minHeight: 50, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  calculateText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  resultBox: { padding: 13, borderRadius: 12, marginTop: 13 },
  resultCalories: { fontSize: 18, fontWeight: '900' },
  resultMacros: { fontSize: 13, marginTop: 5 },
  disclaimer: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  modalBackdrop: { flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' },
  activitySheet: { padding: 22, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  activityOption: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  empty: { flex: 1, padding: 28, justifyContent: 'center', alignItems: 'center' },
  primaryButton: { minHeight: 50, borderRadius: 14, paddingHorizontal: 22, justifyContent: 'center', marginTop: 18 },
  primaryButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
