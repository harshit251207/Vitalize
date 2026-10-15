import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type DocumentData,
  type QuerySnapshot,
} from 'firebase/firestore';
import { db } from '@/services/firebase';

export const ESSENTIAL_CATEGORIES = [
  'Medicine',
  'Catheter',
  'Diapers',
  'Vitamins/Supplements',
  'Gloves',
  'Skin care',
  'Wipes',
  'Other',
] as const;

export type EssentialCategory = (typeof ESSENTIAL_CATEGORIES)[number];

export interface EssentialItem {
  id: string;
  name: string;
  category: EssentialCategory;
  unitsLeft: number;
  unitsPerDay: number;
  runOutDate: Date;
  remindDaysBefore: 3 | 5 | 7 | 10;
  notificationId: string | null;
}

function cacheKey(uid: string) {
  return `essentials:${uid}`;
}

function pendingKey(uid: string) {
  return `essentials-pending:${uid}`;
}

function essentialsCollection(uid: string) {
  return collection(db, 'users', uid, 'essentials');
}

function itemDocument(uid: string, itemId: string) {
  return doc(db, 'users', uid, 'essentials', itemId);
}

function parseDate(value: unknown): Date {
  if (value && typeof value === 'object' && 'toDate' in value &&
      typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date;
  }
  return new Date();
}

function mapItem(id: string, data: DocumentData): EssentialItem {
  return {
    id,
    name: typeof data.name === 'string' ? data.name : 'Essential',
    category: data.category as EssentialCategory,
    unitsLeft: typeof data.unitsLeft === 'number' ? data.unitsLeft : 0,
    unitsPerDay: typeof data.unitsPerDay === 'number' ? data.unitsPerDay : 1,
    runOutDate: parseDate(data.runOutDate),
    remindDaysBefore: data.remindDaysBefore as EssentialItem['remindDaysBefore'],
    notificationId: typeof data.notificationId === 'string' ? data.notificationId : null,
  };
}

export async function readCachedEssentials(uid: string): Promise<EssentialItem[]> {
  const data = await AsyncStorage.getItem(cacheKey(uid));
  if (!data) return [];
  const parsed: unknown = JSON.parse(data);
  if (!Array.isArray(parsed)) throw new Error('Saved essentials data is invalid.');
  return parsed.filter((item): item is Record<string, unknown> => (
    Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  )).map((item) => mapItem(String(item.id), item));
}

export async function hasCachedEssentials(uid: string): Promise<boolean> {
  return (await AsyncStorage.getItem(cacheKey(uid))) !== null;
}

export async function cacheEssentials(uid: string, items: EssentialItem[]): Promise<void> {
  await AsyncStorage.setItem(cacheKey(uid), JSON.stringify(
    items.map((item) => ({ ...item, runOutDate: item.runOutDate.toISOString() })),
  ));
}

type PendingMutation =
  | { mutationId: string; type: 'save'; item: EssentialItem }
  | { mutationId: string; type: 'delete'; itemId: string };

async function readPendingMutations(uid: string): Promise<PendingMutation[]> {
  const value = await AsyncStorage.getItem(pendingKey(uid));
  if (!value) return [];
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error('Pending essentials changes are invalid.');
  return parsed.map((entry): PendingMutation => {
    if (!entry || typeof entry !== 'object') throw new Error('Pending essentials changes are invalid.');
    const mutation = entry as Record<string, unknown>;
    if (typeof mutation.mutationId !== 'string') throw new Error('Pending essentials changes are invalid.');
    if (mutation.type === 'delete' && typeof mutation.itemId === 'string') {
      return { mutationId: mutation.mutationId, type: 'delete', itemId: mutation.itemId };
    }
    if (
      mutation.type === 'save' &&
      mutation.item &&
      typeof mutation.item === 'object' &&
      typeof (mutation.item as Record<string, unknown>).id === 'string'
    ) {
      const item = mutation.item as Record<string, unknown>;
      return {
        mutationId: mutation.mutationId,
        type: 'save',
        item: mapItem(String(item.id), item),
      };
    }
    throw new Error('Pending essentials changes are invalid.');
  });
}

async function writePendingMutations(uid: string, mutations: PendingMutation[]): Promise<void> {
  await AsyncStorage.setItem(pendingKey(uid), JSON.stringify(mutations.map((mutation) => (
    mutation.type === 'save'
      ? {
          ...mutation,
          item: { ...mutation.item, runOutDate: mutation.item.runOutDate.toISOString() },
        }
      : mutation
  ))));
}

export async function queueEssentialSave(uid: string, item: EssentialItem): Promise<string> {
  const mutations = await readPendingMutations(uid);
  const next = mutations.filter((mutation) => (
    mutation.type === 'delete' ? mutation.itemId !== item.id : mutation.item.id !== item.id
  ));
  const mutationId = `${Date.now()}-${Math.random()}`;
  next.push({ mutationId, type: 'save', item });
  await writePendingMutations(uid, next);
  return mutationId;
}

export async function queueEssentialDelete(uid: string, itemId: string): Promise<string> {
  const mutations = await readPendingMutations(uid);
  const next = mutations.filter((mutation) => (
    mutation.type === 'delete' ? mutation.itemId !== itemId : mutation.item.id !== itemId
  ));
  const mutationId = `${Date.now()}-${Math.random()}`;
  next.push({ mutationId, type: 'delete', itemId });
  await writePendingMutations(uid, next);
  return mutationId;
}

export async function removeQueuedEssentialMutation(uid: string, mutationId: string): Promise<void> {
  const mutations = await readPendingMutations(uid);
  await writePendingMutations(uid, mutations.filter((mutation) => mutation.mutationId !== mutationId));
}

export async function syncQueuedEssentials(uid: string): Promise<void> {
  const mutations = await readPendingMutations(uid);
  for (const mutation of mutations) {
    if (mutation.type === 'save') {
      await saveEssential(uid, mutation.item);
    } else {
      await deleteEssential(uid, mutation.itemId);
    }
    await removeQueuedEssentialMutation(uid, mutation.mutationId);
  }
}

export function subscribeToEssentials(
  uid: string,
  onItems: (items: EssentialItem[], isFromCache: boolean) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(essentialsCollection(uid), orderBy('updatedAt', 'desc')),
    { includeMetadataChanges: true },
    (snapshot: QuerySnapshot<DocumentData>) => {
      onItems(
        snapshot.docs.map((item) => mapItem(item.id, item.data())),
        snapshot.metadata.fromCache,
      );
    },
    onError,
  );
}

export async function saveEssential(
  uid: string,
  item: EssentialItem,
): Promise<void> {
  await setDoc(itemDocument(uid, item.id), {
    name: item.name.trim(),
    category: item.category,
    unitsLeft: item.unitsLeft,
    unitsPerDay: item.unitsPerDay,
    runOutDate: item.runOutDate,
    remindDaysBefore: item.remindDaysBefore,
    notificationId: item.notificationId,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteEssential(uid: string, itemId: string): Promise<void> {
  await deleteDoc(itemDocument(uid, itemId));
}

export function newEssentialId(uid: string): string {
  return doc(essentialsCollection(uid)).id;
}
