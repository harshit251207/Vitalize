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
        gifUrl: 'https://i.pinimg.com/originals/41/ab/59/41ab5945f4cdb6253337b6fb6f9ffd64.gif',
        reps: '8-10 reps × 3 sets',
      },
      {
        id: 'para_2',
        name: 'Seated Twists',
        description: 'Sit tall with core engaged, rotate your upper torso slowly from side to side while keeping hips stable.',
        gifUrl: 'https://liftmanual.com/wp-content/uploads/2023/04/spinetwist.gif',
        reps: '12-15 reps each side',
      },
      {
        id: 'para_3',
        name: 'Seated Leg Lifts',
        description: 'From a seated position, lift one leg forward as high as comfortable, hold for a moment, and lower.',
        gifUrl: 'https://i.pinimg.com/originals/3c/24/17/3c241745358dcaaeb41f130c318182ed.gif',
        reps: '8-10 reps each leg',
      },
      {
        id: 'para_4',
        name: 'Seated Russian Twists',
        description: 'Lean slightly back in your seat with engaged core, clasp hands and rotate side-to-side across your body.',
        gifUrl: 'https://i.pinimg.com/originals/4f/3b/d5/4f3bd5506b5694667e3f3de34a88d3e0.gif',
        reps: '15-20 reps total',
      },
      {
        id: 'para_5',
        name: 'Wheelchair Sprints',
        description: 'Perform rapid, controlled propulsion strokes in your wheelchair for short interval bursts.',
        gifUrl: 'https://media1.popsugar-assets.com/files/thumbor/lqIbyxuqDc2QsYHhQFJo7cpkukI=/fitin/792x446/top/filters:format_auto():upscale()/2021/01/26/975/n/1922729/6c3726025aadd59a_skierg.GIF',
        reps: '5-8 intervals × 20-30s',
      },
      {
        id: 'para_6',
        name: 'Seated Core Tilts',
        description: 'Sit upright, gently engage abdominal muscles to tilt your pelvis forward and backward with control.',
        gifUrl: 'https://media.post.rvohealth.io/wp-content/uploads/2025/01/400x400_Anterior_Pelvic_Tilt_Exercises_Thomas_Test.gif',
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
        gifUrl: 'https://i.makeagif.com/media/11-25-2021/KPBpy.gif',
        reps: '5-10 mins daily',
      },
      {
        id: 'quad_2',
        name: 'Sitting Balance Practice',
        description: 'Sit upright supported, maintaining center of gravity and postural alignment with assistance.',
        gifUrl: 'https://post.healthline.com/wp-content/uploads/2020/06/400x400_Exercises_for_Better_Balance_and_Coordination_Hip_Marching.gif',
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
        gifUrl: 'https://cdn.shopify.com/s/files/1/0618/9462/3460/files/104--Hip-AbductionGIF-0f7b74d948f849d78864da9605a3eaa8.gif?v=1755849838',
        reps: '8-10 reps per leg',
      },
      {
        id: 'quad_5',
        name: 'Finger Extension/Flexion',
        description: 'Practice opening and closing the fingers or use passive stretching to preserve hand flexibility.',
        gifUrl: 'https://i.makeagif.com/media/3-29-2015/-8uNZK.gif',
        reps: '10-12 reps or stretches',
      },
      {
        id: 'quad_6',
        name: 'Assisted Upper-Body Strengthening',
        description: 'Perform guided or assisted arm movements against gravity or light resistance.',
        gifUrl: 'https://www.24hourfitness.com/24life/fitness/2019/media_12c2a72cd7034581e7ac5b5e298ae34ebdf55b970.gif?width=750&format=gif&optimize=medium',
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
        gifUrl: 'https://i.makeagif.com/media/11-25-2021/KPBpy.gif',
        reps: '5-10 mins daily',
      },
      {
        id: 'quad_2',
        name: 'Sitting Balance Practice',
        description: 'Sit upright supported, maintaining center of gravity and postural alignment with assistance.',
        gifUrl: 'https://post.healthline.com/wp-content/uploads/2020/06/400x400_Exercises_for_Better_Balance_and_Coordination_Hip_Marching.gif',
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
        gifUrl: 'https://cdn.shopify.com/s/files/1/0618/9462/3460/files/104--Hip-AbductionGIF-0f7b74d948f849d78864da9605a3eaa8.gif?v=1755849838',
        reps: '8-10 reps per leg',
      },
      {
        id: 'quad_5',
        name: 'Finger Extension/Flexion',
        description: 'Practice opening and closing the fingers or use passive stretching to preserve hand flexibility.',
        gifUrl: 'https://i.makeagif.com/media/3-29-2015/-8uNZK.gif',
        reps: '10-12 reps or stretches',
      },
      {
        id: 'quad_6',
        name: 'Assisted Upper-Body Strengthening',
        description: 'Perform guided or assisted arm movements against gravity or light resistance.',
        gifUrl: 'https://www.24hourfitness.com/24life/fitness/2019/media_12c2a72cd7034581e7ac5b5e298ae34ebdf55b970.gif?width=750&format=gif&optimize=medium',
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
        gifUrl: 'https://www.vissco.com/wp-content/uploads/animation/sub/wrist-flexion-stretch-with-elbow-flexed.gif',
        reps: '10-12 reps × 2 sets',
      },
      {
        id: 'hemi_3',
        name: 'Seated Reaching & Grasping',
        description: 'Reach forward and diagonally with the affected arm to grasp and release everyday target objects.',
        gifUrl: 'https://moleac.com/wp-content/uploads/2023/11/unnamed-1.gif',
        reps: '12-15 reaches',
      },
      {
        id: 'hemi_4',
        name: 'Sit-to-Stand Practice',
        description: 'From a sturdy chair, practice shifting weight symmetrically to stand up and slowly sit down.',
        gifUrl: 'https://www.felixhospital.com/sites/default/files/inline-images/Sit%20To%20Stand.gif',
        reps: '6-8 reps with support',
      },
      {
        id: 'hemi_5',
        name: 'Seated Trunk Rotation',
        description: 'Clasp hands together and rotate your torso slowly toward the affected side, holding gently.',
        gifUrl: 'https://cdn.jefit.com/assets/img/exercises/gifs/681.gif',
        reps: '10 reps each side',
      },
      {
        id: 'hemi_6',
        name: 'Assisted Gait & Weight-Shifting',
        description: 'Practice shifting your body weight from side to side while maintaining supported upright balance.',
        gifUrl: 'https://www.vissco.com/wp-content/uploads/animation/sub/standing-weight-shift.gif',
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
        gifUrl: 'https://www.vissco.com/wp-content/uploads/animation/sub/bridge-with-theraband.gif',
        reps: '8-10 reps × 3 sets',
      },
      {
        id: 'di_2',
        name: 'Modified Plank',
        description: 'Hold a forearm plank with knees or elevated surface supported to build core and pelvic stability.',
        gifUrl: 'https://workoutlabs.com/train/wp-content/uploads/2023/05/Modified_Plank_Shoulder_Taps-c.gif',
        reps: '20-30 secs hold × 3 sets',
      },
      {
        id: 'di_3',
        name: 'Superman/Superhero Pose',
        description: 'Lie face down, gently lift your chest and limbs slightly off the ground to strengthen spinal extensors.',
        gifUrl: 'https://i.makeagif.com/media/9-07-2022/PutJbD.gif',
        reps: '8-10 reps (3s hold)',
      },
      {
        id: 'di_4',
        name: 'Supported Kneeling',
        description: 'Practice tall kneeling with hands resting on a sturdy surface to strengthen hips and trunk.',
        gifUrl: 'https://www.vissco.com/wp-content/uploads/animation/sub/single-hand-wall-push-plus-to-kneeling.gif',
        reps: '30-45 secs hold × 2 sets',
      },
      {
        id: 'di_5',
        name: 'Neck-Trunk Stabilization',
        description: 'Engage deep neck and abdominal muscles to keep spine neutral against gentle destabilization.',
        gifUrl: 'https://i.makeagif.com/media/7-12-2024/OKOcT8.gif',
        reps: '10 reps with control',
      },
      {
        id: 'di_6',
        name: 'Supported Standing/Gait Training',
        description: 'Stand with walker or parallel bar support, practicing controlled reciprocal leg stepping.',
        gifUrl: 'https://i.makeagif.com/media/7-19-2014/0Cng7l.gif',
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
        gifUrl: 'https://media.self.com/photos/65d51d7fbffdd4b0113fa982/master/w_1024%2Cc_limit/Robyn-banded-pull-apart.gif',
        reps: '10-12 reps × 2 sets',
      },
      {
        id: 'mono_3',
        name: 'Grip/Finger Strengthening',
        description: 'Squeeze a soft therapy ball or use hand resistance putty to build finger and grip strength.',
        gifUrl: 'https://i.makeagif.com/media/7-27-2016/4xgB4A.gif',
        reps: '15 squeezes (3s hold)',
      },
      {
        id: 'mono_4',
        name: 'Ankle Pumps',
        description: 'Slowly flex foot upward toward shin, then point toes down to enhance circulation and mobility.',
        gifUrl: 'https://rehabforbetterlife.com/wp-content/uploads/2021/06/ankle-pumps-demo.gif',
        reps: '20 pumps each side',
      },
      {
        id: 'mono_5',
        name: 'Functional Reaching/Stepping',
        description: 'Step or reach deliberately with the affected limb towards designated floor or table targets.',
        gifUrl: 'https://i.makeagif.com/media/1-31-2024/Is4UFE.gif',
        reps: '10-12 targets',
      },
      {
        id: 'mono_6',
        name: 'Passive Stretching',
        description: 'Gently hold prolonged stretches on the affected muscles to maintain flexibility and reduce stiffness.',
        gifUrl: 'https://i.pinimg.com/originals/ab/c9/fb/abc9fb8b0014d55d1c4a5beafefb1992.gif',
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
