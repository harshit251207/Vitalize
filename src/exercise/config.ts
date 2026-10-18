export type ExerciseId = 'bicepCurl' | 'shoulderPress';
export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Side = 'left' | 'right';

export interface Thresholds {
  /** Elbow angle (deg) where a rep starts. Arm must return here before the next rep. */
  start: number;
  /** Elbow angle (deg) that must be reached to count the rep. */
  end: number;
}

export interface ExerciseConfig {
  id: ExerciseId;
  label: string;
  thresholds: Record<Level, Thresholds>;
  /** Curl: max angle (deg) between torso and upper arm before "elbow drifting". */
  maxUpperArmDrift?: Record<Level, number>;
  /** Press: rep only counts if wrist ends above shoulder. */
  wristAboveShoulderAtEnd?: boolean;
}

export const EXERCISES: Record<ExerciseId, ExerciseConfig> = {
  bicepCurl: {
    id: 'bicepCurl',
    label: 'Bicep Curl',
    thresholds: {
      beginner: { start: 120, end: 110 },
      intermediate: { start: 130, end: 105 },
      advanced: { start: 140, end: 95 },
    },
    maxUpperArmDrift: { beginner: 45, intermediate: 35, advanced: 25 },
  },
  shoulderPress: {
    id: 'shoulderPress',
    label: 'Shoulder Press',
    thresholds: {
      beginner: { start: 125, end: 130 },
      intermediate: { start: 115, end: 135 },
      advanced: { start: 105, end: 145 },
    },
  },
};

/** MediaPipe Pose landmark indices. */
export const LM = {
  left: { shoulder: 11, elbow: 13, wrist: 15, hip: 23 },
  right: { shoulder: 12, elbow: 14, wrist: 16, hip: 24 },
} as const;

export const MESSAGES = {
  incomplete: 'Move through the full range of motion.',
  elbowDrift: 'Keep your elbow close to your body.',
  notVisible: 'Keep your upper body fully visible in the camera.',
};
