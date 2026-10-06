import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { Vitals, UserProfile, DEFAULT_RANGES } from '@/types';
import { auth, db } from '@/services/firebase';

/** Fields stored on each `users/{uid}/vitals/{vitalId}` document. */
export type VitalReadingInput = {
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  bloodSugar?: number;
  weight?: number;
};

export class NotAuthenticatedError extends Error {
  constructor() {
    super('You must be signed in to save or view vitals.');
    this.name = 'NotAuthenticatedError';
  }
}

function requireCurrentUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new NotAuthenticatedError();
  }
  return uid;
}

function vitalsCollection(uid: string) {
  return collection(db, 'users', uid, 'vitals');
}

function vitalDoc(uid: string, vitalId: string) {
  return doc(db, 'users', uid, 'vitals', vitalId);
}

function omitUndefined<T extends Record<string, unknown>>(data: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as Partial<T>;
}

function toIsoDate(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return new Date(0).toISOString();
}

function mapFirestoreDocToVitals(
  id: string,
  data: Record<string, unknown>
): Vitals {
  return {
    id,
    date: toIsoDate(data.recordedAt),
    bloodPressureSys:
      typeof data.systolic === 'number' ? data.systolic : undefined,
    bloodPressureDia:
      typeof data.diastolic === 'number' ? data.diastolic : undefined,
    bloodSugar:
      typeof data.bloodSugar === 'number' ? data.bloodSugar : undefined,
    heartRate:
      typeof data.heartRate === 'number' ? data.heartRate : undefined,
    weight: typeof data.weight === 'number' ? data.weight : undefined,
  };
}

/**
 * Saves a vital reading under the signed-in user's UID.
 * `recordedAt` is set with Firestore serverTimestamp().
 */
export async function addVitalReading(
  reading: VitalReadingInput
): Promise<string> {
  const uid = requireCurrentUid();
  const firestorePath = `users/${uid}/vitals`;
  const payload = omitUndefined({
    systolic: reading.systolic,
    diastolic: reading.diastolic,
    heartRate: reading.heartRate,
    bloodSugar: reading.bloodSugar,
    weight: reading.weight,
    recordedAt: serverTimestamp(),
  });

  const numericFields = ['systolic', 'diastolic', 'heartRate', 'bloodSugar', 'weight'] as const;
  const invalidNumbers = numericFields.filter((field) => {
    const value = payload[field];
    return typeof value === 'number' && !Number.isFinite(value);
  });

  console.log('[addVitalReading] write debug', {
    uid,
    authUid: auth.currentUser?.uid ?? null,
    isAuthenticated: Boolean(auth.currentUser),
    firestorePath,
    payloadKeys: Object.keys(payload),
    payloadValues: Object.fromEntries(
      Object.entries(payload).map(([key, value]) => [
        key,
        key === 'recordedAt' ? 'serverTimestamp()' : value,
      ])
    ),
    invalidNumbers,
  });

  try {
    const docRef = await addDoc(vitalsCollection(uid), payload);
    console.log('[addVitalReading] write succeeded', { uid, firestorePath, docId: docRef.id });
    return docRef.id;
  } catch (error) {
    const firebaseError = error as { code?: string; message?: string; name?: string };
    console.error('[addVitalReading] Firestore write failed', {
      errorCode: firebaseError.code ?? '(none)',
      errorMessage: firebaseError.message ?? String(error),
      errorName: firebaseError.name ?? error?.constructor?.name,
      uid,
      authUid: auth.currentUser?.uid ?? null,
      firestorePath,
      payloadKeys: Object.keys(payload),
      invalidNumbers,
    });
    throw error;
  }
}

/**
 * Returns the signed-in user's vitals, oldest → newest, for charts and history.
 */
export async function getVitalHistory(): Promise<Vitals[]> {
  const uid = requireCurrentUid();
  const snapshot = await getDocs(
    query(vitalsCollection(uid), orderBy('recordedAt', 'asc'))
  );

  return snapshot.docs.map((snap) =>
    mapFirestoreDocToVitals(snap.id, snap.data() as Record<string, unknown>)
  );
}

/**
 * Returns the signed-in user's vitals recorded within the last `days` days,
 * ordered oldest → newest. Uses a server-side `where` clause on `recordedAt`
 * to avoid downloading the entire vitals history.
 */
export async function getVitalHistoryForPeriod(days: number): Promise<Vitals[]> {
  const uid = requireCurrentUid();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffTimestamp = Timestamp.fromDate(cutoff);

  const snapshot = await getDocs(
    query(
      vitalsCollection(uid),
      where('recordedAt', '>=', cutoffTimestamp),
      orderBy('recordedAt', 'asc'),
    )
  );

  return snapshot.docs.map((snap) =>
    mapFirestoreDocToVitals(snap.id, snap.data() as Record<string, unknown>)
  );
}

export async function updateVitalReading(
  vitalId: string,
  reading: VitalReadingInput
): Promise<void> {
  const uid = requireCurrentUid();
  const payload = omitUndefined({
    systolic: reading.systolic,
    diastolic: reading.diastolic,
    heartRate: reading.heartRate,
    bloodSugar: reading.bloodSugar,
    weight: reading.weight,
  });

  if (Object.keys(payload).length === 0) {
    return;
  }

  await updateDoc(vitalDoc(uid, vitalId), payload);
}

export async function deleteVitalReading(vitalId: string): Promise<void> {
  const uid = requireCurrentUid();
  await deleteDoc(vitalDoc(uid, vitalId));
}

export const VitalsService = {
  addVitalReading,
  getVitalHistory,
  updateVitalReading,
  deleteVitalReading,

  /** Loads vitals from Firestore for the signed-in user (UID from Auth). */
  async getVitals(_username?: string): Promise<Vitals[]> {
    return getVitalHistory();
  },

  async addVital(
    _username: string,
    vital: Omit<Vitals, 'id'>
  ): Promise<void> {
    await addVitalReading({
      systolic: vital.bloodPressureSys,
      diastolic: vital.bloodPressureDia,
      heartRate: vital.heartRate,
      bloodSugar: vital.bloodSugar,
      weight: vital.weight,
    });
  },

  async getUserProfile(username: string): Promise<UserProfile> {
    try {
      const data = await AsyncStorage.getItem(`@profile_${username}`);
      if (data) {
        return JSON.parse(data);
      }
      return { username, healthyRanges: DEFAULT_RANGES };
    } catch (e) {
      return { username, healthyRanges: DEFAULT_RANGES };
    }
  },

  async updateUserProfile(
    username: string,
    profile: Partial<UserProfile>
  ): Promise<void> {
    try {
      const current = await this.getUserProfile(username);
      const updated = { ...current, ...profile };
      await AsyncStorage.setItem(`@profile_${username}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Error updating profile', e);
    }
  },
};
