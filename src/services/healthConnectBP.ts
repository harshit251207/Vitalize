import { AppOwnership, default as Constants } from 'expo-constants';
import { Linking, Platform } from 'react-native';

import type { BPReading } from '@/types/bpReading';

const BLOOD_PRESSURE_PERMISSION = {
  accessType: 'read',
  recordType: 'BloodPressure',
} as const;

export type HealthConnectAvailability =
  | 'unsupported'
  | 'expo-go'
  | 'not-installed'
  | 'update-required'
  | 'available';

export const isHealthConnectSupportedPlatform =
  Platform.OS === 'android' && Constants.appOwnership !== AppOwnership.Expo;

export async function getAvailability(): Promise<HealthConnectAvailability> {
  if (Platform.OS !== 'android') return 'unsupported';
  if (Constants.appOwnership === AppOwnership.Expo) return 'expo-go';

  const healthConnect = await import('react-native-health-connect');
  const status = await healthConnect.getSdkStatus();
  if (status === healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
  if (status === healthConnect.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return 'update-required';
  }
  if (status === healthConnect.SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'not-installed';
  throw new Error(`Health Connect returned an unrecognized SDK status: ${status}`);
}

export async function initialize(): Promise<boolean> {
  if (!isHealthConnectSupportedPlatform) return false;
  const healthConnect = await import('react-native-health-connect');
  return healthConnect.initialize();
}

export async function hasBPPermission(): Promise<boolean> {
  if (!isHealthConnectSupportedPlatform) return false;
  const healthConnect = await import('react-native-health-connect');
  const permissions = await healthConnect.getGrantedPermissions();
  return permissions.some(
    (permission) =>
      permission.accessType === 'read' &&
      permission.recordType === 'BloodPressure',
  );
}

export async function requestBPPermission(): Promise<boolean> {
  if (!isHealthConnectSupportedPlatform) return false;
  const initialized = await initialize();
  if (!initialized) return false;

  const healthConnect = await import('react-native-health-connect');
  const granted = await healthConnect.requestPermission([BLOOD_PRESSURE_PERMISSION]);
  return granted.some(
    (permission) =>
      permission.accessType === 'read' &&
      permission.recordType === 'BloodPressure',
  );
}

export async function openHealthConnectAppSettings(): Promise<void> {
  if (!isHealthConnectSupportedPlatform) return;
  const healthConnect = await import('react-native-health-connect');
  healthConnect.openHealthConnectSettings();
}

export async function openHealthConnectStore(): Promise<void> {
  await Linking.openURL(
    'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata',
  );
}

function isValidBloodPressure(systolic: number, diastolic: number): boolean {
  return (
    Number.isFinite(systolic) &&
    Number.isFinite(diastolic) &&
    systolic > diastolic &&
    systolic >= 40 &&
    systolic <= 300 &&
    diastolic >= 20 &&
    diastolic <= 200
  );
}

export async function fetchBPReadings(since: Date): Promise<BPReading[]> {
  if (!isHealthConnectSupportedPlatform) return [];
  if (!(since instanceof Date) || !Number.isFinite(since.getTime())) {
    throw new TypeError('A valid start date is required to read blood pressure.');
  }
  if (!(await hasBPPermission())) {
    throw new Error('Blood pressure read permission is not granted in Health Connect.');
  }

  const healthConnect = await import('react-native-health-connect');
  const endTime = new Date().toISOString();
  let pageToken: string | undefined;
  const readings = new Map<string, BPReading>();

  do {
    const page = await healthConnect.readRecords('BloodPressure', {
      timeRangeFilter: {
        operator: 'between',
        startTime: since.toISOString(),
        endTime,
      },
      pageSize: 1000,
      ...(pageToken ? { pageToken } : {}),
    });

    for (const record of page.records) {
      const id = record.metadata?.id;
      const measuredAt = new Date(record.time);
      const systolic = record.systolic.inMillimetersOfMercury;
      const diastolic = record.diastolic.inMillimetersOfMercury;
      if (
        !id ||
        !Number.isFinite(measuredAt.getTime()) ||
        !isValidBloodPressure(systolic, diastolic)
      ) {
        continue;
      }

      readings.set(id, {
        id,
        systolic,
        diastolic,
        measuredAt,
        source: 'health_connect',
        sourceApp: record.metadata?.dataOrigin ?? 'unknown',
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);

  return [...readings.values()].sort(
    (a, b) => a.measuredAt.getTime() - b.measuredAt.getTime(),
  );
}
