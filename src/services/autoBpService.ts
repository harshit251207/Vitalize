import {
  Timestamp,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

import { auth, db } from '@/services/firebase';
import type { BPReading } from '@/types/bpReading';

const MAX_BATCH_SIZE = 500;

function readingsCollection(uid: string) {
  return collection(db, 'users', uid, 'autoBpReadings');
}

export function mapBPReadingToFirestore(reading: BPReading) {
  return {
    systolic: reading.systolic,
    diastolic: reading.diastolic,
    measuredAt: Timestamp.fromDate(reading.measuredAt),
    source: reading.source,
    deviceSourceApp: reading.sourceApp ?? 'unknown',
    syncedAt: serverTimestamp(),
  };
}

function mapFirestoreDocToBPReading(
  id: string,
  data: Record<string, unknown>,
): BPReading | null {
  if (
    data.hidden === true ||
    data.source !== 'health_connect' ||
    typeof data.systolic !== 'number' ||
    typeof data.diastolic !== 'number' ||
    !Number.isFinite(data.systolic) ||
    !Number.isFinite(data.diastolic) ||
    data.systolic <= data.diastolic ||
    typeof data.deviceSourceApp !== 'string'
  ) {
    return null;
  }

  const measuredAt =
    data.measuredAt instanceof Timestamp
      ? data.measuredAt.toDate()
      : data.measuredAt &&
          typeof data.measuredAt === 'object' &&
          'toDate' in data.measuredAt &&
          typeof (data.measuredAt as { toDate?: unknown }).toDate === 'function'
        ? (data.measuredAt as Timestamp).toDate()
        : null;

  if (!measuredAt || !Number.isFinite(measuredAt.getTime())) return null;

  return {
    id,
    systolic: data.systolic,
    diastolic: data.diastolic,
    measuredAt,
    source: 'health_connect',
    sourceApp: data.deviceSourceApp,
  };
}

export async function saveAutoBPReadings(
  uid: string,
  readings: BPReading[],
): Promise<void> {
  for (let start = 0; start < readings.length; start += MAX_BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = readings.slice(start, start + MAX_BATCH_SIZE);
    for (const reading of chunk) {
      batch.set(
        doc(readingsCollection(uid), reading.id),
        mapBPReadingToFirestore(reading),
        { merge: true },
      );
    }
    if (chunk.length > 0) await batch.commit();
  }
}

export async function getAutoBPReadings(
  uid: string,
  since?: Date,
): Promise<BPReading[]> {
  const baseCollection = readingsCollection(uid);
  const readingsQuery = since
    ? query(
        baseCollection,
        where('measuredAt', '>=', Timestamp.fromDate(since)),
        orderBy('measuredAt', 'asc'),
      )
    : query(baseCollection, orderBy('measuredAt', 'asc'));
  const snapshot = await getDocs(
    readingsQuery,
  );

  return snapshot.docs
    .map((snapshotDoc) =>
      mapFirestoreDocToBPReading(
        snapshotDoc.id,
        snapshotDoc.data() as Record<string, unknown>,
      ),
    )
    .filter((reading): reading is BPReading => reading !== null);
}

export async function hideAutoBPReading(uid: string, readingId: string): Promise<void> {
  if (auth.currentUser?.uid !== uid) {
    throw new Error('Cannot hide a blood pressure reading for another user.');
  }
  await updateDoc(doc(readingsCollection(uid), readingId), { hidden: true });
}
