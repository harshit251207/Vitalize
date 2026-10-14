import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteField, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';

export type DisabilityCategory =
  | 'hemiplegia'
  | 'paraplegia'
  | 'quadriplegia'
  | 'monoplegia'
  | 'diplegia';

export type CategorySource = 'manual' | 'auto';

const CATEGORY_VALUES = new Set<DisabilityCategory>([
  'hemiplegia',
  'paraplegia',
  'quadriplegia',
  'monoplegia',
  'diplegia',
]);

export const CATEGORY_LABELS: Record<DisabilityCategory, string> = {
  hemiplegia: 'Hemiplegia',
  paraplegia: 'Paraplegia',
  quadriplegia: 'Quadriplegia/Tetraplegia',
  monoplegia: 'Monoplegia',
  diplegia: 'Diplegia',
};

function isDisabilityCategory(value: unknown): value is DisabilityCategory {
  return typeof value === 'string' && CATEGORY_VALUES.has(value as DisabilityCategory);
}

function categoryFromLegacyProfile(value: unknown): DisabilityCategory | null {
  if (!value || typeof value !== 'object') return null;
  const profile = value as Record<string, unknown>;
  if (typeof profile.disabilityCategory !== 'string') return null;

  const label = profile.disabilityCategory.toLowerCase();
  if (label === 'quadriplegia/tetraplegia' || label === 'quadriplegia') return 'quadriplegia';
  return isDisabilityCategory(label) ? label : null;
}

export async function saveCategory(
  uid: string,
  category: DisabilityCategory,
  source: CategorySource,
): Promise<boolean> {
  try {
    await AsyncStorage.setItem(`category:${uid}`, category);
  } catch (error) {
    console.error('Unable to cache disability category:', error);
    throw error;
  }

  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        disabilityCategory: category,
        categoryUpdatedAt: serverTimestamp(),
        categorySource: source,
      },
      { merge: true },
    );
    return true;
  } catch (error) {
    console.error('Unable to sync disability category to Firestore:', error);
    return false;
  }
}

export async function loadCategory(
  uid: string,
  onRefresh?: (category: DisabilityCategory | null) => void,
  onRefreshComplete?: () => void,
): Promise<DisabilityCategory | null> {
  let cachedCategory: DisabilityCategory | null = null;

  try {
    const cachedValue = await AsyncStorage.getItem(`category:${uid}`);
    if (isDisabilityCategory(cachedValue)) {
      cachedCategory = cachedValue;
    } else if (cachedValue !== null) {
      await AsyncStorage.removeItem(`category:${uid}`);
    }

    if (!cachedCategory) {
      const legacyProfile = await AsyncStorage.getItem(`@profile_${uid}`);
      if (legacyProfile) {
        cachedCategory = categoryFromLegacyProfile(JSON.parse(legacyProfile) as unknown);
        if (cachedCategory) {
          await AsyncStorage.setItem(`category:${uid}`, cachedCategory);
        }
      }
    }
  } catch (error) {
    console.error('Unable to read cached disability category:', error);
  }

  const refreshFromFirestore = async () => {
    try {
      const snapshot = await getDoc(doc(db, 'users', uid));
      const value: unknown = snapshot.exists()
        ? snapshot.data().disabilityCategory
        : null;
      const refreshedCategory = isDisabilityCategory(value)
        ? value
        : categoryFromLegacyProfile({ disabilityCategory: value });

      if (refreshedCategory) {
        await AsyncStorage.setItem(`category:${uid}`, refreshedCategory);
        onRefresh?.(refreshedCategory);
        if (!isDisabilityCategory(value)) {
          const synced = await saveCategory(uid, refreshedCategory, 'manual');
          if (!synced) {
            console.warn('Legacy Firestore disability category remains cached but was not normalized.');
          }
        }
      } else {
        onRefresh?.(cachedCategory);
        if (cachedCategory) {
          const synced = await saveCategory(uid, cachedCategory, 'manual');
          if (!synced) {
            console.warn('Legacy disability category remains cached but was not synced.');
          }
        }
      }
    } catch (error) {
      console.error('Unable to refresh disability category from Firestore:', error);
      onRefresh?.(cachedCategory);
    } finally {
      onRefreshComplete?.();
    }
  };

  void refreshFromFirestore();
  return cachedCategory;
}

export async function clearCategory(uid: string): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(`category:${uid}`);
    const legacyProfile = await AsyncStorage.getItem(`@profile_${uid}`);
    if (legacyProfile) {
      const parsed: unknown = JSON.parse(legacyProfile);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const profile = { ...(parsed as Record<string, unknown>) };
        delete profile.disabilityCategory;
        await AsyncStorage.setItem(`@profile_${uid}`, JSON.stringify(profile));
      }
    }
  } catch (error) {
    console.error('Unable to clear cached disability category:', error);
    throw error;
  }

  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        disabilityCategory: deleteField(),
        categoryUpdatedAt: serverTimestamp(),
      },
      { merge: true },
    );
    return true;
  } catch (error) {
    console.error('Unable to clear disability category from Firestore:', error);
    return false;
  }
}
