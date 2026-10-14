import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import { EmergencyConfig, FamilyContact } from '@/types/contacts';

export const DEFAULT_EMERGENCY_CONFIG: EmergencyConfig = {
  family: [],
  ambulance: '108',
};

export function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, '');
}

export function isValidMobilePhone(phone: string): boolean {
  return /^(\+91)?[6-9]\d{9}$/.test(normalizePhone(phone));
}

export function isValidEmergencyNumber(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^(108|112|100)$/.test(normalized) || isValidMobilePhone(normalized);
}

function isContact(value: unknown): value is FamilyContact {
  if (!value || typeof value !== 'object') return false;
  const contact = value as Record<string, unknown>;
  return (
    typeof contact.id === 'string' &&
    typeof contact.name === 'string' &&
    typeof contact.relation === 'string' &&
    typeof contact.phone === 'string' &&
    typeof contact.isPrimary === 'boolean'
  );
}

function parseEmergencyConfig(value: unknown): EmergencyConfig | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (
    !Array.isArray(data.family) ||
    data.family.some((contact) => !isContact(contact) || !isValidMobilePhone(contact.phone))
  ) {
    return null;
  }

  const family = data.family as FamilyContact[];
  const primaryIndex = family.findIndex((contact) => contact.isPrimary);
  const normalizedFamily = family.map((contact, index) => ({
    ...contact,
    phone: normalizePhone(contact.phone),
    isPrimary: index === (primaryIndex >= 0 ? primaryIndex : 0),
  }));
  const ambulance =
    typeof data.ambulance === 'string' && isValidEmergencyNumber(data.ambulance)
      ? normalizePhone(data.ambulance)
      : DEFAULT_EMERGENCY_CONFIG.ambulance;

  return { family: normalizedFamily, ambulance };
}

async function readCache(uid: string): Promise<EmergencyConfig | null> {
  try {
    const cachedValue = await AsyncStorage.getItem(`emergency:${uid}`);
    if (!cachedValue) return null;
    const parsed: unknown = JSON.parse(cachedValue);
    return parseEmergencyConfig(parsed);
  } catch (error) {
    console.error('Unable to read cached emergency contacts:', error);
    return null;
  }
}

export async function loadEmergencyConfig(uid: string): Promise<EmergencyConfig> {
  const cached = await readCache(uid);
  if (cached) {
    void refreshEmergencyConfig(uid);
    return cached;
  }

  try {
    const snapshot = await getDoc(doc(db, 'users', uid));
    const remoteValue: unknown = snapshot.exists() ? snapshot.data().emergencyConfig : null;
    const remoteConfig = parseEmergencyConfig(remoteValue);
    if (remoteConfig) {
      await AsyncStorage.setItem(`emergency:${uid}`, JSON.stringify(remoteConfig));
      return remoteConfig;
    }
  } catch (error) {
    console.error('Unable to load emergency contacts from Firestore:', error);
  }

  return DEFAULT_EMERGENCY_CONFIG;
}

async function refreshEmergencyConfig(uid: string): Promise<void> {
  try {
    const snapshot = await getDoc(doc(db, 'users', uid));
    const remoteValue: unknown = snapshot.exists() ? snapshot.data().emergencyConfig : null;
    const remoteConfig = parseEmergencyConfig(remoteValue);
    if (remoteConfig) {
      await AsyncStorage.setItem(`emergency:${uid}`, JSON.stringify(remoteConfig));
    }
  } catch (error) {
    console.error('Unable to refresh emergency contacts from Firestore:', error);
  }
}

export async function saveEmergencyConfig(
  uid: string,
  config: EmergencyConfig,
): Promise<boolean> {
  if (!isValidEmergencyNumber(config.ambulance)) {
    throw new Error('Ambulance number must be 108, 112, 100, or a valid Indian mobile number.');
  }
  if (
    config.family.some(
      (contact) =>
        !contact.name.trim() ||
        !contact.relation.trim() ||
        !isValidMobilePhone(contact.phone),
    )
  ) {
    throw new Error('Every family contact must have a name, relationship, and valid Indian mobile number.');
  }

  const primaryIndex = config.family.findIndex((contact) => contact.isPrimary);
  const normalizedConfig: EmergencyConfig = {
    family: config.family.map((contact, index) => ({
      ...contact,
      phone: normalizePhone(contact.phone),
      isPrimary: index === (primaryIndex >= 0 ? primaryIndex : 0),
    })),
    ambulance: normalizePhone(config.ambulance),
  };
  await AsyncStorage.setItem(`emergency:${uid}`, JSON.stringify(normalizedConfig));

  try {
    await setDoc(doc(db, 'users', uid), { emergencyConfig: normalizedConfig }, { merge: true });
    return true;
  } catch (error) {
    console.error('Unable to sync emergency contacts to Firestore:', error);
    return false;
  }
}
