import { db } from './firebase';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';

export interface VitalsData {
  bloodPressure?: string;
  bloodSugar?: number;
  heartRate?: number;
  weight?: number;
}

export interface VitalsEntry extends VitalsData {
  id: string;
  timestamp?: any;
}

/**
 * Adds a new vitals reading document to the user's vitals subcollection: users/{userId}/vitals/{vitalId}
 * with a server timestamp.
 */
export const addVitalsEntry = async (
  userId: string,
  vitalsData: {
    bloodPressure?: string;
    bloodSugar?: number;
    heartRate?: number;
    weight?: number;
  }
) => {
  const vitalsRef = collection(db, 'users', userId, 'vitals');
  const docRef = await addDoc(vitalsRef, {
    ...vitalsData,
    timestamp: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Queries the user's vitals subcollection ordered by timestamp descending.
 * Returns an array of vitals entries.
 */
export const getVitalsHistory = async (userId: string): Promise<VitalsEntry[]> => {
  const vitalsRef = collection(db, 'users', userId, 'vitals');
  const q = query(vitalsRef, orderBy('timestamp', 'desc'));
  const querySnapshot = await getDocs(q);

  const entries: VitalsEntry[] = [];
  querySnapshot.forEach((docSnap) => {
    entries.push({
      id: docSnap.id,
      ...docSnap.data(),
    } as VitalsEntry);
  });

  return entries;
};

/**
 * Updates only the classificationResult field on the user's profile document
 * using updateDoc without overwriting other fields.
 */
export const updateClassificationResult = async (userId: string, category: string) => {
  const userDocRef = doc(db, 'users', userId);
  await updateDoc(userDocRef, {
    classificationResult: category,
  });
};
