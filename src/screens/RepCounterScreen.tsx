import { Ionicons } from '@expo/vector-icons';
import { PoseCameraView } from 'expo-mediapipe-pose';
import type { PoseFrame } from 'expo-mediapipe-pose';
import { useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCameraPermissions } from 'expo-camera';

import { Fonts } from '@/constants/theme';
import { EXERCISES } from '@/exercise/config';
import type { ExerciseId, Level } from '@/exercise/config';
import { useRepCounter } from '@/exercise/useRepCounter';
import { useTheme } from '@/hooks/use-theme';
import { PlanService } from '@/services/planService';
import { saveRepCounterSession } from '@/services/repCounterSessionService';
import { useAuth } from '@/store/AuthContext';

const TARGET_REPS = 6;

interface RepCounterScreenProps {
  exercise: ExerciseId;
  level: Level;
  planExerciseId?: string;
}

function workoutDateKey(): string {
  return new Date().toISOString().split('T')[0];
}

export function RepCounterScreen({
  exercise,
  level,
  planExerciseId,
}: RepCounterScreenProps) {
  const colors = useTheme();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [counterFacing, setCounterFacing] = useState<'front' | 'back'>('front');
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [wasSaved, setWasSaved] = useState(false);
  const [exerciseCompleted, setExerciseCompleted] = useState(false);
  const [cameraKey, setCameraKey] = useState(0);
  const counter = useRepCounter(exercise, level);
  const counterRef = useRef(counter);
  const resetCounter = counter.reset;
  const startedAtRef = useRef<number | null>(null);
  const workoutDateRef = useRef(workoutDateKey());
  const savedRef = useRef(false);
  const completionRef = useRef(false);
  const completionAttemptedRef = useRef(false);
  const completionPromiseRef = useRef<Promise<boolean> | null>(null);

  useLayoutEffect(() => {
    counterRef.current = counter;
  }, [counter]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  const markExerciseCompleted = useCallback(async (): Promise<boolean> => {
    if (
      !user ||
      !planExerciseId ||
      counterRef.current.reps < TARGET_REPS ||
      completionRef.current
    ) {
      return completionRef.current;
    }

    if (completionPromiseRef.current) return completionPromiseRef.current;
    if (completionAttemptedRef.current) return false;

    completionAttemptedRef.current = true;
    const completionTask = (async () => {
      try {
        await PlanService.markExerciseCompleted(user, workoutDateRef.current, planExerciseId);
        completionRef.current = true;
        setExerciseCompleted(true);
        return true;
      } catch (error) {
        console.error('Unable to mark rep-counter exercise as completed:', error);
        setSessionError('Your 6 reps are done, but workout progress could not be saved. Tap Finish to retry.');
        return false;
      }
    })();
    completionPromiseRef.current = completionTask;

    try {
      return await completionTask;
    } finally {
      completionPromiseRef.current = null;
    }
  }, [planExerciseId, user]);

  const saveSession = useCallback(async (): Promise<void> => {
    const startedAt = startedAtRef.current;
    if (!user || startedAt === null) return;

    const current = counterRef.current;
    const timestamp = new Date().toISOString();
    if (!savedRef.current) {
      await saveRepCounterSession(user, {
        exerciseId: exercise,
        level,
        reps: current.reps,
        cleanReps: current.cleanReps,
        formAccuracy: current.reps > 0
          ? Math.round((current.cleanReps / current.reps) * 100)
          : null,
        durationMs: Math.max(0, Date.now() - startedAt),
        timestamp,
      });
      savedRef.current = true;
      setWasSaved(true);
    }

    if (current.reps >= TARGET_REPS && planExerciseId && !completionRef.current) {
      await markExerciseCompleted();
    }
  }, [exercise, level, markExerciseCompleted, planExerciseId, user]);

  useFocusEffect(
    useCallback(() => {
      startedAtRef.current = Date.now();
      workoutDateRef.current = workoutDateKey();
      savedRef.current = false;
      completionRef.current = false;
      completionAttemptedRef.current = false;
      setWasSaved(false);
      setExerciseCompleted(false);
      setSessionError(null);
      setCameraError(null);
      resetCounter();

      return () => {
        void saveSession().catch((error: unknown) => {
          console.error('Unable to save rep-counter session when leaving:', error);
        });
      };
    }, [resetCounter, saveSession]),
  );

  const handleLandmark = useCallback((frame: PoseFrame) => {
    if (frame.landmarks.length < 33) {
      counterRef.current.onFrame(null);
      return;
    }

    const next = counterRef.current.onFrame({
      landmarks: frame.landmarks,
      worldLandmarks: frame.worldLandmarks.length >= 33 ? frame.worldLandmarks : undefined,
      size: { width: frame.additionalData.width, height: frame.additionalData.height },
      timestamp: frame.additionalData.receivedAtMs,
    });
    if (next.reps >= TARGET_REPS) void markExerciseCompleted();
  }, [markExerciseCompleted]);

  const finishSession = async () => {
    setSessionError(null);
    if (counterRef.current.reps >= TARGET_REPS && planExerciseId && !completionRef.current) {
      completionAttemptedRef.current = false;
    }
    try {
      await saveSession();
      if (counterRef.current.reps >= TARGET_REPS && planExerciseId && !completionRef.current) {
        setSessionError('Workout completion could not be saved. Check your storage and tap Finish to retry.');
        return;
      }
      router.back();
    } catch (error) {
      console.error('Unable to finish rep-counter session:', error);
      setSessionError('Could not save this session. Please try Finish again.');
    }
  };

  const retryCamera = () => {
    setCameraError(null);
    setCameraKey((key) => key + 1);
  };

  const accuracy = counter.reps > 0
    ? Math.round((counter.cleanReps / counter.reps) * 100)
    : null;
  const cameraActive =
    Platform.OS !== 'web' &&
    isFocused &&
    foreground &&
    permission?.granted === true &&
    counter.reps < TARGET_REPS &&
    cameraError === null;

  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="phone-portrait-outline" size={44} color={colors.primary} />
        <Text style={[styles.message, { color: colors.text }]}>
          Rep Counter needs the Vitalize Android or iOS development build.
        </Text>
        <Pressable style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
          <Text style={styles.actionText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.message, { color: colors.text }]}>Checking camera permission…</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    const canRequest = permission.canAskAgain;
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="camera-outline" size={44} color={colors.primary} />
        <Text style={[styles.message, { color: colors.text }]}>
          Camera access is needed to count your reps on this device.
        </Text>
        <Pressable
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            if (canRequest) {
              void requestPermission();
            } else {
              void Linking.openSettings().catch((error: unknown) => {
                console.error('Unable to open camera settings:', error);
                setSessionError('Could not open settings. Enable camera access in your device settings.');
              });
            }
          }}
        >
          <Text style={styles.actionText}>{canRequest ? 'Allow camera' : 'Open settings'}</Text>
        </Pressable>
        {sessionError ? <Text style={[styles.errorText, { color: colors.danger }]}>{sessionError}</Text> : null}
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <PoseCameraView
        key={cameraKey}
        style={StyleSheet.absoluteFill}
        isActive={cameraActive}
        cameraFacing={counterFacing}
        frameLimit={15}
        callbackFps={15}
        poseModelVariant="full"
        skeleton={{ bodyParts: ['leftArm', 'rightArm', 'torso'], color: colors.primary, jointRadius: 4, lineWidth: 3 }}
        onLandmark={handleLandmark}
        onInferenceError={(error) => {
          console.warn('Pose camera error:', error.code);
          setCameraError(error.code === 'cameraConfiguration'
            ? 'No usable camera was found. Check your device camera and try again.'
            : 'Pose detection could not start. Please try again.');
        }}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Leave rep counter"
          >
            <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
          </Pressable>
          <View style={styles.titlePanel}>
            <Text style={styles.exerciseTitle}>{EXERCISES[exercise].label}</Text>
            <Text style={styles.levelText}>{level[0].toUpperCase() + level.slice(1)} · Target {TARGET_REPS}</Text>
          </View>
          <Pressable
            style={styles.iconButton}
            onPress={() => setCounterFacing((facing) => facing === 'front' ? 'back' : 'front')}
            accessibilityRole="button"
            accessibilityLabel="Flip camera"
          >
            <Ionicons name="camera-reverse-outline" size={23} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={styles.counterPanel} pointerEvents="none">
          <Text style={styles.reps}>{counter.reps}</Text>
          <Text style={styles.targetText}>of {TARGET_REPS} reps</Text>
          <Text style={styles.metricsText}>
            {accuracy !== null ? `Form ${accuracy}%` : 'Form accuracy will appear here'}
            {counter.angle !== null ? `  ·  ${Math.round(counter.angle)}°` : ''}
          </Text>
        </View>

        <View style={styles.bottomPanel}>
          <Text style={styles.feedback}>
            {cameraError ??
              (!counter.poseVisible
                ? 'Move into view and keep your upper body visible.'
                : counter.feedback ?? 'Pose detected — begin when you are ready.')}
          </Text>
          {counter.reps >= TARGET_REPS ? (
            <View style={styles.completionPill}>
              <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
              <Text style={styles.completionText}>
                {planExerciseId
                  ? exerciseCompleted ? 'Exercise completed!' : '6 reps complete — saving progress…'
                  : '6 reps complete!'}
              </Text>
            </View>
          ) : null}
          {wasSaved ? <Text style={styles.savedText}>Session saved</Text> : null}
          {sessionError ? <Text style={styles.errorText}>{sessionError}</Text> : null}
          {cameraError ? (
            <Pressable style={[styles.actionButton, { backgroundColor: colors.primary }]} onPress={retryCamera}>
              <Text style={styles.actionText}>Try again</Text>
            </Pressable>
          ) : null}
          <View style={styles.controls}>
            <Pressable
              style={[styles.secondaryButton, counter.reps >= TARGET_REPS && styles.disabledButton]}
              onPress={counter.reset}
              disabled={counter.reps >= TARGET_REPS}
            >
              <Text style={styles.secondaryText}>Reset</Text>
            </Pressable>
            <Pressable style={[styles.finishButton, { backgroundColor: colors.primary }]} onPress={() => void finishSession()}>
              <Text style={styles.actionText}>Finish</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#101512' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  message: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(12, 20, 16, 0.68)', alignItems: 'center', justifyContent: 'center' },
  titlePanel: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, backgroundColor: 'rgba(12, 20, 16, 0.68)' },
  exerciseTitle: { color: '#FFFFFF', fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  levelText: { color: '#E8F5ED', fontFamily: Fonts.sans, fontSize: 12, marginTop: 2 },
  counterPanel: { alignSelf: 'center', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 30, borderRadius: 24, backgroundColor: 'rgba(12, 20, 16, 0.56)' },
  reps: { color: '#FFFFFF', fontFamily: Fonts.sans, fontSize: 104, lineHeight: 116, fontWeight: '900' },
  targetText: { color: '#FFFFFF', fontFamily: Fonts.sans, fontSize: 17, fontWeight: '700' },
  metricsText: { color: '#E8F5ED', fontFamily: Fonts.sans, fontSize: 13, marginTop: 8 },
  bottomPanel: { alignItems: 'center', gap: 10, padding: 14, borderRadius: 20, backgroundColor: 'rgba(12, 20, 16, 0.78)' },
  feedback: { color: '#FFFFFF', fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  completionPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 15, backgroundColor: '#168B63' },
  completionText: { color: '#FFFFFF', fontFamily: Fonts.sans, fontWeight: '800', fontSize: 13 },
  savedText: { color: '#CDECDD', fontFamily: Fonts.sans, fontSize: 12 },
  errorText: { color: '#FFB4AB', fontFamily: Fonts.sans, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  controls: { flexDirection: 'row', width: '100%', gap: 10, marginTop: 2 },
  actionButton: { minHeight: 46, borderRadius: 13, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  finishButton: { flex: 1, minHeight: 46, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: '#FFFFFF', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  secondaryButton: { flex: 1, minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.38)', alignItems: 'center', justifyContent: 'center' },
  disabledButton: { opacity: 0.45 },
  secondaryText: { color: '#FFFFFF', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
});
