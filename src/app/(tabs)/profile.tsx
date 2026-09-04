import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/hooks/use-theme';
import { VitalsService } from '@/services/vitalsService';
import { UserProfile } from '@/types';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const colors = useTheme();
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        VitalsService.getUserProfile(user).then(setProfile);
      }
    }, [user])
  );

  const initial = user ? user.charAt(0).toUpperCase() : 'U';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.screenTitle, { color: colors.text }]}>Profile & Settings</Text>

        {/* User Hero Card */}
        <View style={[styles.userCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>

          <Text style={[styles.usernameText, { color: colors.text }]}>{user}</Text>
          <Text style={[styles.userRoleText, { color: colors.textSecondary }]}>Vitalize Account</Text>
        </View>

        {/* Disability Category Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="medical" size={22} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Disability Classification</Text>
          </View>

          <Text style={[styles.categoryValueText, { color: profile?.disabilityCategory ? colors.primary : colors.textSecondary }]}>
            {profile?.disabilityCategory || 'Not classified yet'}
          </Text>

          <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>
            {profile?.disabilityCategory 
              ? 'Your workout exercises and diet guidelines are tailored to this mobility classification.'
              : 'Upload a report photo or select your category to unlock personalized plans.'}
          </Text>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.primary }]} 
            onPress={() => router.push('/report-upload')}
            activeOpacity={0.85}
          >
            <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.actionButtonText}>
              {profile?.disabilityCategory ? 'Update Medical Report' : 'Classify Disability'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Calorie Calculator Profile Info */}
        {profile?.calorieCalculator && (
          <View style={[styles.sectionCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="flame" size={22} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Nutrition Parameters</Text>
            </View>

            <View style={styles.rangeRow}>
              <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>Weight / Height:</Text>
              <Text style={[styles.rangeValue, { color: colors.text }]}>
                {profile.calorieCalculator.weightKg} kg / {profile.calorieCalculator.heightCm} cm
              </Text>
            </View>
            <View style={styles.rangeRow}>
              <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>Age & Gender:</Text>
              <Text style={[styles.rangeValue, { color: colors.text, textTransform: 'capitalize' }]}>
                {profile.calorieCalculator.age} yrs • {profile.calorieCalculator.gender}
              </Text>
            </View>
            <View style={styles.rangeRow}>
              <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>Activity Level:</Text>
              <Text style={[styles.rangeValue, { color: colors.text, textTransform: 'capitalize' }]}>
                {profile.calorieCalculator.activityLevel}
              </Text>
            </View>
          </View>
        )}

        {/* Healthy Ranges Info Card */}
        <View style={[styles.sectionCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark" size={22} color={colors.success} style={{ marginRight: 8 }} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Target Healthy Ranges</Text>
          </View>

          <View style={styles.rangeRow}>
            <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>Systolic BP Max:</Text>
            <Text style={[styles.rangeValue, { color: colors.text }]}>{profile?.healthyRanges?.bpSysMax || 120} mmHg</Text>
          </View>
          <View style={styles.rangeRow}>
            <Text style={[styles.rangeLabel, { color: colors.textSecondary }]}>Blood Sugar Max:</Text>
            <Text style={[styles.rangeValue, { color: colors.text }]}>{profile?.healthyRanges?.sugarMax || 140} mg/dL</Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={[styles.logoutButton, { borderColor: colors.danger }]} 
          onPress={logout}
          accessibilityRole="button"
          accessibilityLabel="Logout Button"
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.danger} style={{ marginRight: 8 }} />
          <Text style={[styles.logoutButtonText, { color: colors.danger }]}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  screenTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
  },
  userCard: {
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '800',
  },
  usernameText: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  userRoleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionCard: {
    padding: 20,
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  categoryValueText: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  categoryDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  actionButton: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  rangeLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  rangeValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  logoutButton: {
    height: 54,
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
