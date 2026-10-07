import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { BotReply } from '@/services/ai/vitalizeAgent';

const DARK_CARD = '#1A2436';
const ACCENT = '#7DD3FC';

interface BotMessageProps {
  reply: BotReply;
  timestamp: string;
}

export function BotMessage({ reply, timestamp }: BotMessageProps) {
  const colors = useTheme();
  const scheme = useColorScheme();
  const isDark = scheme !== 'light';

  const cardBg = isDark ? DARK_CARD : colors.backgroundElement;
  const textColor = colors.text;
  const muted = colors.textSecondary;
  const accent = isDark ? ACCENT : colors.primary;
  const border = isDark ? '#2A3548' : colors.border;

  const intro = reply.intro.trim();
  const workout = reply.workout.filter((w) => w.name.trim());
  const vitalsNote = reply.vitals_note.trim();
  const dietTip = reply.diet_tip.trim();
  const motivation = reply.motivation.trim();
  const hasContent = !!(intro || workout.length || vitalsNote || dietTip || motivation);

  return (
    <View style={styles.wrap}>
      {hasContent ? (
        !!intro && <Text style={[styles.intro, { color: textColor }]}>{intro}</Text>
      ) : (
        <Text style={[styles.intro, { color: textColor }]}>
          I couldn't generate a readable reply. Please try again.
        </Text>
      )}

      {workout.length > 0 && (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="barbell-outline" size={16} color={accent} />
            <Text style={[styles.cardTitle, { color: accent }]}>Workout</Text>
          </View>
          {workout.map((item, index) => (
            <View
              key={`${item.name}-${index}`}
              style={[
                styles.workoutRow,
                index < workout.length - 1 && { borderBottomColor: border, borderBottomWidth: 1 },
              ]}
            >
              <Text style={[styles.exerciseName, { color: textColor }]}>{item.name}</Text>
              <Text style={[styles.reps, { color: muted }]}>{item.reps_or_duration}</Text>
            </View>
          ))}
        </View>
      )}

      {!!vitalsNote && (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="pulse-outline" size={16} color={accent} />
            <Text style={[styles.cardTitle, { color: accent }]}>Vitals</Text>
          </View>
          <Text style={[styles.bodyText, { color: textColor }]}>{vitalsNote}</Text>
        </View>
      )}

      {!!dietTip && (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="leaf-outline" size={16} color={accent} />
            <Text style={[styles.cardTitle, { color: accent }]}>Diet tip</Text>
          </View>
          <Text style={[styles.bodyText, { color: textColor }]}>{dietTip}</Text>
        </View>
      )}

      {!!motivation && (
        <Text style={[styles.motivation, { color: muted }]}>{motivation}</Text>
      )}

      <Text style={[styles.timestamp, { color: muted }]}>{timestamp}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    maxWidth: '100%',
  },
  intro: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  exerciseName: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  reps: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
    maxWidth: '42%',
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  motivation: {
    fontSize: 14,
    lineHeight: 22,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-start',
  },
});
