export interface Vitals {
  id: string;
  date: string; // ISO string
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  bloodSugar?: number;
  heartRate?: number;
  weight?: number;
}

export interface UserProfile {
  username: string;
  disabilityCategory?: string;
  calorieCalculator?: {
    weightKg: number;
    heightCm: number;
    age: number;
    gender: 'male' | 'female';
    activityLevel: 'sedentary' | 'light' | 'moderate';
  };
  healthyRanges: {
    bpSysMax: number;
    bpDiaMax: number;
    sugarMax: number;
  };
}

export const DEFAULT_RANGES = {
  bpSysMax: 120,
  bpDiaMax: 80,
  sugarMax: 140, // standard post-meal approx
};
