import { doc, updateDoc } from 'firebase/firestore';
import type { ActivityLevel, Gender } from '@/services/calorieCalculator';
import { db } from '@/services/firebase';
import { fetchUserProfile } from '@/services/authService';

export interface NutritionDetails {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: Gender;
  activityLevel: ActivityLevel;
}

export interface SavedNutritionProfile {
  details: NutritionDetails | null;
  previousAllergies: string;
}

function isNutritionDetails(value: unknown): value is NutritionDetails {
  if (!value || typeof value !== 'object') return false;
  const details = value as Record<string, unknown>;
  return (
    typeof details.weightKg === 'number' &&
    Number.isFinite(details.weightKg) &&
    details.weightKg > 0 &&
    typeof details.heightCm === 'number' &&
    Number.isFinite(details.heightCm) &&
    details.heightCm > 0 &&
    typeof details.age === 'number' &&
    Number.isFinite(details.age) &&
    details.age > 0 &&
    (details.gender === 'male' || details.gender === 'female') &&
    (details.activityLevel === 'sedentary' ||
      details.activityLevel === 'light' ||
      details.activityLevel === 'moderate')
  );
}

export async function fetchNutritionProfile(uid: string): Promise<SavedNutritionProfile> {
  const profile = await fetchUserProfile(uid);
  if (!profile) return { details: null, previousAllergies: '' };
  const details = isNutritionDetails(profile.nutritionProfile)
    ? profile.nutritionProfile
    : isNutritionDetails(profile.calorieCalculator)
      ? profile.calorieCalculator
      : null;
  return {
    details,
    previousAllergies: typeof profile.previousAllergies === 'string'
      ? profile.previousAllergies
      : '',
  };
}

export async function saveNutritionProfile(
  uid: string,
  details: NutritionDetails,
  previousAllergies: string,
): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    nutritionProfile: details,
    previousAllergies: previousAllergies.trim().slice(0, 500),
  });
}
