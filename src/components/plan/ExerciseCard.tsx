import React from 'react';
import { StyleSheet, View, Text, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { Exercise } from '@/services/planService';

interface ExerciseCardProps {
  exercise: Exercise;
  isCompleted: boolean;
  onToggle: () => void;
}

export function ExerciseCard({ exercise, isCompleted, onToggle }: ExerciseCardProps) {
  const colors = useTheme();
  const isPlaceholder = !exercise.gifUrl || exercise.gifUrl === 'PLACEHOLDER_GIF_URL' || !exercise.gifUrl.startsWith('http');

  return (
    <TouchableOpacity 
      style={[
        styles.card, 
        { 
          backgroundColor: colors.backgroundElement, 
          borderColor: isCompleted ? colors.success : colors.border,
        },
        isCompleted && { borderWidth: 2, backgroundColor: colors.success + '0C' }
      ]}
      onPress={onToggle}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityState={{ checked: isCompleted }}
      accessibilityLabel={`Toggle completion for ${exercise.name}`}
    >
      <View style={[styles.mediaContainer, { backgroundColor: colors.primary + '0D' }]}>
        {isPlaceholder ? (
          <View style={styles.placeholderContainer}>
            <View style={[styles.placeholderIconBadge, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="fitness-outline" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.placeholderTitle, { color: colors.text }]}>Exercise Demonstration</Text>
            <Text style={[styles.placeholderSubtitle, { color: colors.textSecondary }]}>Demo preview & animation guide</Text>
          </View>
        ) : (
          <Image 
            source={{ uri: exercise.gifUrl }} 
            style={styles.image} 
            resizeMode="cover" 
          />
        )}

        {exercise.reps && (
          <View style={[styles.repsTag, { backgroundColor: colors.primary }]}>
            <Ionicons name="repeat" size={13} color="#FFF" style={{ marginRight: 4 }} />
            <Text style={styles.repsText}>{exercise.reps}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>{exercise.name}</Text>
          
          <View style={[
            styles.checkbox, 
            { borderColor: isCompleted ? colors.success : colors.border },
            isCompleted && { backgroundColor: colors.success, borderColor: colors.success }
          ]}>
            {isCompleted && <Ionicons name="checkmark" size={18} color="#FFF" />}
          </View>
        </View>

        <Text style={[styles.description, { color: colors.textSecondary }]}>
          {exercise.description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  mediaContainer: {
    position: 'relative',
    width: '100%',
    height: 148,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  placeholderIconBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  placeholderTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  placeholderSubtitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  repsTag: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  repsText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: 18,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    paddingRight: 10,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 21,
  },
});
