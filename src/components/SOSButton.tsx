import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/hooks/use-theme';
import { SOSSheet } from '@/components/SOSSheet';

const HOLD_DURATION_MS = 1500;
const RING_SIZE = 52;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function SOSButton() {
  const colors = useTheme();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [progress] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdCompleted = useRef(false);
  const suppressNextTap = useRef(false);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const startHold = () => {
    holdCompleted.current = false;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: HOLD_DURATION_MS,
      useNativeDriver: false,
    }).start();
    timer.current = setTimeout(() => {
      holdCompleted.current = true;
      suppressNextTap.current = true;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch((error: unknown) => {
        console.warn('SOS haptic feedback failed:', error);
      });
      setSheetVisible(true);
    }, HOLD_DURATION_MS);
  };

  const endHold = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (!holdCompleted.current) {
      progress.stopAnimation();
      Animated.timing(progress, {
        toValue: 0,
        duration: 120,
        useNativeDriver: false,
      }).start();
    }
  };

  const handleTap = () => {
    if (suppressNextTap.current) {
      suppressNextTap.current = false;
      return;
    }
    Alert.alert(
      'Emergency help',
      'Open emergency calling and messaging options?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => setSheetVisible(true) },
      ],
    );
  };

  const ringOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [RING_CIRCUMFERENCE, 0],
  });

  return (
    <>
      <Pressable
        style={[styles.button, { backgroundColor: colors.danger }]}
        onPressIn={startHold}
        onPressOut={endHold}
        onPress={handleTap}
        accessibilityRole="button"
        accessibilityLabel="SOS emergency help"
        accessibilityHint="Press and hold for 1.5 seconds to open emergency options, or tap once to confirm."
      >
        <View style={styles.content}>
          <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke="#FFFFFF66"
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              stroke="#FFFFFF"
              strokeWidth={RING_STROKE}
              strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              fill="none"
              rotation="-90"
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            />
          </Svg>
          <Ionicons name="alert" size={28} color="#FFFFFF" />
          <Text style={styles.buttonText}>SOS</Text>
        </View>
        <Text style={styles.hintText}>Hold 1.5 seconds or tap for options</Text>
      </Pressable>
      <SOSSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 76,
    borderRadius: 17,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  content: {
    width: RING_SIZE,
    height: RING_SIZE,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  hintText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
