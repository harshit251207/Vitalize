import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';

interface FloatingChatButtonProps {
  bottomInset?: number;
}

export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({
  bottomInset = 76,
}) => {
  const router = useRouter();
  const colors = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.primary,
          bottom: bottomInset,
          shadowColor: colors.primary,
        },
      ]}
      onPress={() => router.push('/chat')}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Open Vitalize AI Assistant"
      accessibilityHint="Opens the AI health companion to ask questions about BP trends, workouts, and vitals"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.iconWrapper}>
        <Ionicons name="sparkles" size={24} color="#FFFFFF" />
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>AI</Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
      },
      android: {
        elevation: 7,
      },
      default: {
        boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)',
      },
    }),
  },
  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
});
