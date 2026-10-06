import { db } from './firebase';
import { doc, updateDoc } from 'firebase/firestore';
import {
  addVitalReading,
  getVitalHistory,
  type VitalReadingInput,
} from './vitalsService';

export type { VitalReadingInput };

export interface VitalsEntry {
  id: string;
  date: string;
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  bloodSugar?: number;
  heartRate?: number;
  weight?: number;
}

/**
 * Adds a vitals reading for the currently authenticated user.
 * Stored at users/{uid}/vitals/{vitalId} with serverTimestamp recordedAt.
 */
export const addVitalsEntry = async (vitalsData: VitalReadingInput) => {
  return addVitalReading(vitalsData);
};

/**
 * Returns the signed-in user's vitals, oldest → newest.
 */
export const getVitalsHistory = async (): Promise<VitalsEntry[]> => {
  return getVitalHistory();
};

/**
 * Updates only the classificationResult field on the user's profile document
 * using updateDoc without overwriting other fields.
 */
export const updateClassificationResult = async (
  userId: string,
  category: string
) => {
  const userDocRef = doc(db, 'users', userId);
  await updateDoc(userDocRef, {
    classificationResult: category,
  });
};
