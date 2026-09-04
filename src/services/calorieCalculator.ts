// calorieCalculator.ts
// Vitalize — Category-based calorie & macro estimator
// IMPORTANT: These are RESEARCH-BASED ESTIMATES, not medical prescriptions.
// Always show the disclaimer string returned in the result.

export type DisabilityCategory =
  | 'Hemiplegia'
  | 'Paraplegia'
  | 'Quadriplegia'
  | 'Monoplegia'
  | 'Diplegia';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate';
export type Gender = 'male' | 'female';

export interface CalculatorInput {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
  activityLevel: ActivityLevel;
  category: DisabilityCategory;
}

export interface MacroResult {
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  formulaUsed: string;
  confidence: 'high' | 'general-estimate';
  disclaimer: string;
}

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
};

export const DISCLAIMER =
  'This is an estimate based on published clinical research, not a medical prescription. Please consult a registered dietitian or physician before making significant dietary changes.';

function mifflinStJeor(input: CalculatorInput): number {
  const { weightKg, heightCm, age, gender } = input;
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (gender === 'male' ? 5 : -161);
}

export function calculateCalories(input: CalculatorInput): MacroResult {
  let calories: number;
  let formulaUsed: string;
  let confidence: 'high' | 'general-estimate';

  switch (input.category) {
    case 'Paraplegia':
      calories = input.weightKg * 27.9;
      formulaUsed = 'Weight(kg) × 27.9 (AND SCI Guideline — Paraplegia)';
      confidence = 'high';
      break;

    case 'Quadriplegia':
      calories = input.weightKg * 22.7;
      formulaUsed = 'Weight(kg) × 22.7 (AND SCI Guideline — Tetraplegia)';
      confidence = 'high';
      break;

    case 'Hemiplegia':
    case 'Monoplegia':
    case 'Diplegia': {
      const bmr = mifflinStJeor(input);
      calories = bmr * ACTIVITY_MULTIPLIER[input.activityLevel];
      formulaUsed = `Mifflin-St Jeor BMR × ${ACTIVITY_MULTIPLIER[input.activityLevel]} activity factor (general estimate — no SCI-specific formula exists for ${input.category})`;
      confidence = 'general-estimate';
      break;
    }

    default:
      throw new Error(`Unknown category: ${input.category}`);
  }

  calories = Math.round(calories);

  const proteinGrams = Math.round(input.weightKg * 0.9);
  const proteinCalories = proteinGrams * 4;

  const carbCalories = calories * 0.5;
  const carbGrams = Math.round(carbCalories / 4);

  const fatCalories = calories - proteinCalories - carbCalories;
  const fatGrams = Math.round(Math.max(fatCalories, 0) / 9);

  return {
    calories,
    proteinGrams,
    carbGrams,
    fatGrams,
    formulaUsed,
    confidence,
    disclaimer: DISCLAIMER,
  };
}
