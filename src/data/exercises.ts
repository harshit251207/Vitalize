// exercises.ts
// Vitalize — Evidence-based exercise lists per disability category

export type ExerciseConfidence = 'high' | 'moderate' | 'low';

export interface ExerciseItem {
  id: string;
  name: string;
  description: string;
  gifUrl: string;
  reps?: string;
}

export interface CategoryExerciseGroup {
  confidence: ExerciseConfidence;
  notes?: string;
  exercises: ExerciseItem[];
}

export const PLACEHOLDER_GIF_URL = 'PLACEHOLDER_GIF_URL';

export const EXERCISES_BY_CATEGORY: Record<string, CategoryExerciseGroup> = {
  Paraplegia: {
    confidence: 'high',
    exercises: [
      {
        id: 'para_1',
        name: 'Seated Push-Ups',
        description: 'Place hands on armrests or chair seat, push down to lift your body, hold briefly, then lower slowly.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '8-10 reps × 3 sets',
      },
      {
        id: 'para_2',
        name: 'Seated Twists',
        description: 'Sit tall with core engaged, rotate your upper torso slowly from side to side while keeping hips stable.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '12-15 reps each side',
      },
      {
        id: 'para_3',
        name: 'Seated Leg Lifts',
        description: 'From a seated position, lift one leg forward as high as comfortable, hold for a moment, and lower.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '8-10 reps each leg',
      },
      {
        id: 'para_4',
        name: 'Seated Russian Twists',
        description: 'Lean slightly back in your seat with engaged core, clasp hands and rotate side-to-side across your body.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '15-20 reps total',
      },
      {
        id: 'para_5',
        name: 'Wheelchair Sprints',
        description: 'Perform rapid, controlled propulsion strokes in your wheelchair for short interval bursts.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '5-8 intervals × 20-30s',
      },
      {
        id: 'para_6',
        name: 'Seated Core Tilts',
        description: 'Sit upright, gently engage abdominal muscles to tilt your pelvis forward and backward with control.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '10-12 reps × 2 sets',
      },
    ],
  },
  Quadriplegia: {
    confidence: 'high',
    exercises: [
      {
        id: 'quad_1',
        name: 'Passive/Assisted Range of Motion (ROM)',
        description: 'Gently move limbs through their full comfortable range with assistance or caregiver guidance.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '5-10 mins daily',
      },
      {
        id: 'quad_2',
        name: 'Sitting Balance Practice',
        description: 'Sit upright supported, maintaining center of gravity and postural alignment with assistance.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '3-5 mins × 2 sets',
      },
      {
        id: 'quad_3',
        name: 'Assisted Rolling',
        description: 'Practice assisted side-to-side rolling movements in a supine position to engage trunk stabilizers.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '5-8 rolls each direction',
      },
      {
        id: 'quad_4',
        name: 'Supine Leg Movements',
        description: 'While lying on your back, gently perform caregiver-assisted flexion and extension of the legs.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '8-10 reps per leg',
      },
      {
        id: 'quad_5',
        name: 'Finger Extension/Flexion',
        description: 'Practice opening and closing the fingers or use passive stretching to preserve hand flexibility.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '10-12 reps or stretches',
      },
      {
        id: 'quad_6',
        name: 'Assisted Upper-Body Strengthening',
        description: 'Perform guided or assisted arm movements against gravity or light resistance.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '8-10 reps × 2 sets',
      },
    ],
  },
  'Quadriplegia/Tetraplegia': {
    confidence: 'high',
    exercises: [
      {
        id: 'quad_1',
        name: 'Passive/Assisted Range of Motion (ROM)',
        description: 'Gently move limbs through their full comfortable range with assistance or caregiver guidance.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '5-10 mins daily',
      },
      {
        id: 'quad_2',
        name: 'Sitting Balance Practice',
        description: 'Sit upright supported, maintaining center of gravity and postural alignment with assistance.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '3-5 mins × 2 sets',
      },
      {
        id: 'quad_3',
        name: 'Assisted Rolling',
        description: 'Practice assisted side-to-side rolling movements in a supine position to engage trunk stabilizers.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '5-8 rolls each direction',
      },
      {
        id: 'quad_4',
        name: 'Supine Leg Movements',
        description: 'While lying on your back, gently perform caregiver-assisted flexion and extension of the legs.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '8-10 reps per leg',
      },
      {
        id: 'quad_5',
        name: 'Finger Extension/Flexion',
        description: 'Practice opening and closing the fingers or use passive stretching to preserve hand flexibility.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '10-12 reps or stretches',
      },
      {
        id: 'quad_6',
        name: 'Assisted Upper-Body Strengthening',
        description: 'Perform guided or assisted arm movements against gravity or light resistance.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '8-10 reps × 2 sets',
      },
    ],
  },
  Hemiplegia: {
    confidence: 'moderate',
    notes: 'General adaptation — consult a physiotherapist',
    exercises: [
      {
        id: 'hemi_1',
        name: 'Constraint-Induced Movement Therapy (CIMT)',
        description: 'Engage the affected arm/hand in repetitive functional tasks while gently restricting unaffected side.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '10-15 mins structured',
      },
      {
        id: 'hemi_2',
        name: 'FES-Assisted Hand/Wrist Movement',
        description: 'Perform wrist and finger extensions assisted by functional electrical stimulation or caregiver.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '10-12 reps × 2 sets',
      },
      {
        id: 'hemi_3',
        name: 'Seated Reaching & Grasping',
        description: 'Reach forward and diagonally with the affected arm to grasp and release everyday target objects.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '12-15 reaches',
      },
      {
        id: 'hemi_4',
        name: 'Sit-to-Stand Practice',
        description: 'From a sturdy chair, practice shifting weight symmetrically to stand up and slowly sit down.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '6-8 reps with support',
      },
      {
        id: 'hemi_5',
        name: 'Seated Trunk Rotation',
        description: 'Clasp hands together and rotate your torso slowly toward the affected side, holding gently.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '10 reps each side',
      },
      {
        id: 'hemi_6',
        name: 'Assisted Gait & Weight-Shifting',
        description: 'Practice shifting your body weight from side to side while maintaining supported upright balance.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '5 mins guided drill',
      },
    ],
  },
  Diplegia: {
    confidence: 'moderate',
    notes: 'General adaptation — consult a physiotherapist',
    exercises: [
      {
        id: 'di_1',
        name: 'Bridging',
        description: 'Lie on your back with knees bent, squeeze glutes and lift your hips upward into a straight bridge.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '8-10 reps × 3 sets',
      },
      {
        id: 'di_2',
        name: 'Modified Plank',
        description: 'Hold a forearm plank with knees or elevated surface supported to build core and pelvic stability.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '20-30 secs hold × 3 sets',
      },
      {
        id: 'di_3',
        name: 'Superman/Superhero Pose',
        description: 'Lie face down, gently lift your chest and limbs slightly off the ground to strengthen spinal extensors.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '8-10 reps (3s hold)',
      },
      {
        id: 'di_4',
        name: 'Supported Kneeling',
        description: 'Practice tall kneeling with hands resting on a sturdy surface to strengthen hips and trunk.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '30-45 secs hold × 2 sets',
      },
      {
        id: 'di_5',
        name: 'Neck-Trunk Stabilization',
        description: 'Engage deep neck and abdominal muscles to keep spine neutral against gentle destabilization.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '10 reps with control',
      },
      {
        id: 'di_6',
        name: 'Supported Standing/Gait Training',
        description: 'Stand with walker or parallel bar support, practicing controlled reciprocal leg stepping.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '5-10 mins with supervision',
      },
    ],
  },
  Monoplegia: {
    confidence: 'low',
    notes: 'General adaptation — consult a physiotherapist',
    exercises: [
      {
        id: 'mono_1',
        name: 'Affected-Limb ROM',
        description: 'Perform active-assisted movements through the full natural range of motion for the affected limb.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '10-12 reps per movement',
      },
      {
        id: 'mono_2',
        name: 'Resistance Band Exercise',
        description: 'Anchor an elastic resistance band and execute controlled pulls or extensions targeting the affected limb.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '10-12 reps × 2 sets',
      },
      {
        id: 'mono_3',
        name: 'Grip/Finger Strengthening',
        description: 'Squeeze a soft therapy ball or use hand resistance putty to build finger and grip strength.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '15 squeezes (3s hold)',
      },
      {
        id: 'mono_4',
        name: 'Ankle Pumps',
        description: 'Slowly flex foot upward toward shin, then point toes down to enhance circulation and mobility.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '20 pumps each side',
      },
      {
        id: 'mono_5',
        name: 'Functional Reaching/Stepping',
        description: 'Step or reach deliberately with the affected limb towards designated floor or table targets.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '10-12 targets',
      },
      {
        id: 'mono_6',
        name: 'Passive Stretching',
        description: 'Gently hold prolonged stretches on the affected muscles to maintain flexibility and reduce stiffness.',
        gifUrl: PLACEHOLDER_GIF_URL,
        reps: '20-30 secs hold each',
      },
    ],
  },
};

export function getExercisesForCategory(category?: string | null): CategoryExerciseGroup | null {
  if (!category) return null;
  if (category in EXERCISES_BY_CATEGORY) {
    return EXERCISES_BY_CATEGORY[category];
  }
  // Try normalising
  if (category.toLowerCase().includes('quad') || category.toLowerCase().includes('tetra')) {
    return EXERCISES_BY_CATEGORY['Quadriplegia'];
  }
  if (category.toLowerCase().includes('para')) {
    return EXERCISES_BY_CATEGORY['Paraplegia'];
  }
  if (category.toLowerCase().includes('hemi')) {
    return EXERCISES_BY_CATEGORY['Hemiplegia'];
  }
  if (category.toLowerCase().includes('di')) {
    return EXERCISES_BY_CATEGORY['Diplegia'];
  }
  if (category.toLowerCase().includes('mono')) {
    return EXERCISES_BY_CATEGORY['Monoplegia'];
  }
  return null;
}
