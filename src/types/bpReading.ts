interface BPReadingBase {
  id: string;
  systolic: number;
  diastolic: number;
  measuredAt: Date;
}

export interface BPReading extends BPReadingBase {
  source: 'health_connect';
  sourceApp: string;
}

export interface ManualBPReading extends BPReadingBase {
  source: 'manual';
}

export type BPHistoryReading = BPReading | ManualBPReading;
