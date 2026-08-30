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

  return (
    <TouchableOpacity 
      style={[
        styles.card, 
        { 
          backgroundColor: colors.backgroundElement, 
          borderColor: isCompleted ? colors.success : colors.border 
        },
        isCompleted && { borderWidth: 2, backgroundColor: colors.success + '0C' }
      ]}
      onPress={onToggle}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ checked: isCompleted }}
      accessibilityLabel={`Toggle completion for ${exercise.name}`}
    >
      <View style={styles.imageWrapper}>
        <Image 
          source={{ uri: exercise.gifUrl }} 
          style={styles.image} 
          resizeMode="cover" 
        />
        <View style={[styles.repsTag, { backgroundColor: colors.primary }]}>
          <Ionicons name="repeat" size={14} color="#FFF" style={{ marginRight: 4 }} />
          <Text style={styles.repsText}>{exercise.reps}</Text>
        </View>
      </View>
      
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.text }]}>{exercise.name}</Text>
          
          <View style={[
            styles.checkbox, 
            { borderColor: isCompleted ? colors.success : colors.textSecondary },
            isCompleted && { backgroundColor: colors.success }
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
  },
  imageWrapper: {
    position: 'relative',
    width: '100%',
    height: 180,
    backgroundColor: '#E2E8F0',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  repsTag: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    paddingRight: 10,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
});
