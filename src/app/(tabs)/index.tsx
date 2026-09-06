import React, { useState, useCallback, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/store/AuthContext';
import { VitalsService } from '@/services/vitalsService';
import { Vitals, UserProfile } from '@/types';
import { useTheme } from '@/hooks/use-theme';
import { DailyCalorieTracker } from '@/components/calorie-tracker/DailyCalorieTracker';
import { fetchUserProfile } from '@/services/authService';

interface VitalMetricProps {
  label: string;
  value?: string;
  unit: string;
  iconName: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  isOutlier?: boolean;
  statusText?: string;
  onPressLog?: () => void;
}

function VitalCard({
  label,
  value,
  unit,
  iconName,
  accentColor,
  isOutlier,
  statusText,
  onPressLog,
}: VitalMetricProps) {
  const colors = useTheme();

  return (
    <View
      style={[
        styles.vitalCard,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: isOutlier ? colors.danger : colors.border,
        },
        isOutlier && { borderWidth: 2 },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: accentColor + '1E' }]}>
          <Ionicons name={iconName} size={20} color={accentColor} />
        </View>
        <Text style={[styles.vitalLabel, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>

      {value ? (
        <View style={styles.valueRow}>
          <Text style={[styles.vitalValue, { color: colors.text }]}>{value}</Text>
          <Text style={[styles.vitalUnit, { color: colors.textSecondary }]}>{unit}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.noDataRow} onPress={onPressLog} activeOpacity={0.7}>
          <Text style={[styles.noDataText, { color: colors.primary }]}>+ Log reading</Text>
        </TouchableOpacity>
      )}

      <View style={styles.cardFooter}>
        {isOutlier ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.danger + '1A' }]}>
            <Ionicons name="alert-circle" size={13} color={colors.danger} />
            <Text style={[styles.statusText, { color: colors.danger }]}>High Reading</Text>
          </View>
        ) : value ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.success + '1A' }]}>
            <Ionicons name="checkmark-circle" size={13} color={colors.success} />
            <Text style={[styles.statusText, { color: colors.success }]}>
              {statusText || 'Normal Range'}
            </Text>
          </View>
        ) : (
          <Text style={[styles.timestampText, { color: colors.textSecondary }]}>
            Not logged today
          </Text>
        )}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colors = useTheme();

  const [latestVitals, setLatestVitals] = useState<Vitals | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadProfileUsername = async () => {
      if (!user) {
        setProfileUsername(null);
        return;
      }

      try {
        const firebaseProfile = await fetchUserProfile(user);
        const username = firebaseProfile?.username;
        if (isActive) {
          setProfileUsername(typeof username === 'string' && username.trim() ? username.trim() : null);
        }
      } catch {
        if (isActive) {
          setProfileUsername(null);
        }
      }
    };

    loadProfileUsername();

    return () => {
      isActive = false;
    };
  }, [user]);

  const loadData = async () => {
    if (user) {
      const vitals = await VitalsService.getVitals(user);
      if (vitals.length > 0) {
        const sorted = vitals.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setLatestVitals(sorted[0]);
      } else {
        setLatestVitals(null);
      }
      const p = await VitalsService.getUserProfile(user);
      setProfile(p);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user])
  );

  const ranges = profile?.healthyRanges;
  const isBpOutlier =
    latestVitals?.bloodPressureSys && ranges?.bpSysMax
      ? latestVitals.bloodPressureSys > ranges.bpSysMax
      : false;
  const isSugarOutlier =
    latestVitals?.bloodSugar && ranges?.sugarMax
      ? latestVitals.bloodSugar > ranges.sugarMax
      : false;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Greeting */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              {todayFormatted}
            </Text>
            <Text style={[styles.userName, { color: colors.text }]}>
              {profileUsername ? `Hello, ${profileUsername} 👋` : 'Hello!'}
            </Text>
          </View>

          {profile?.disabilityCategory ? (
            <View style={[styles.categoryPill, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="medical" size={14} color={colors.primary} style={{ marginRight: 5 }} />
              <Text style={[styles.categoryPillText, { color: colors.primary }]}>
                {profile.disabilityCategory}
              </Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.categoryPillPrompt, { backgroundColor: colors.warning + '1E' }]}
              onPress={() => router.push('/report-upload')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="alert-circle-outline"
                size={14}
                color={colors.warning}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.categoryPillText, { color: colors.warning }]}>
                Set Category
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text
          style={[
            styles.sectionTitle,
            styles.careHeading,
            { color: colors.text },
          ]}
        >
          SPECIAL CARE FOR SPECIAL PEOPLE
        </Text>

        <Image
          source={require('@/assets/images/disability-illustration.png')}
          style={styles.careIllustration}
          resizeMode="contain"
          accessibilityLabel="People with different disabilities"
        />

        <TouchableOpacity
          style={[styles.logVitalsButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/vitals-entry')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.logVitalsButtonText}>Log New Vitals</Text>
        </TouchableOpacity>

        {/* Vitals Section Header */}
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Overview</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Key health markers</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/vitals-history')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={[styles.viewHistoryLink, { color: colors.primary }]}>View History →</Text>
          </TouchableOpacity>
        </View>

        {/* Vitals Grid */}
        <View style={styles.vitalsGrid}>
          <VitalCard
            label="Blood Pressure"
            value={
              latestVitals?.bloodPressureSys && latestVitals?.bloodPressureDia
                ? `${latestVitals.bloodPressureSys}/${latestVitals.bloodPressureDia}`
                : undefined
            }
            unit="mmHg"
            iconName="heart"
            accentColor={colors.bp}
            isOutlier={isBpOutlier}
            onPressLog={() => router.push('/vitals-entry')}
          />
          <VitalCard
            label="Blood Sugar"
            value={latestVitals?.bloodSugar ? `${latestVitals.bloodSugar}` : undefined}
            unit="mg/dL"
            iconName="water"
            accentColor={colors.sugar}
            isOutlier={isSugarOutlier}
            onPressLog={() => router.push('/vitals-entry')}
          />
          <VitalCard
            label="Heart Rate"
            value={latestVitals?.heartRate ? `${latestVitals.heartRate}` : undefined}
            unit="bpm"
            iconName="fitness"
            accentColor={colors.heartRate}
            onPressLog={() => router.push('/vitals-entry')}
          />
          <VitalCard
            label="Body Weight"
            value={latestVitals?.weight ? `${latestVitals.weight}` : undefined}
            unit="kg"
            iconName="scale"
            accentColor={colors.weight}
            onPressLog={() => router.push('/vitals-entry')}
          />
        </View>

        {/* Daily Calorie Tracker Section */}
        <DailyCalorieTracker />

        {/* Quick Plan Navigation Card */}
        <TouchableOpacity
          style={[
            styles.quickPlanCard,
            { backgroundColor: colors.backgroundElement, borderColor: colors.border },
          ]}
          onPress={() => router.push('/plan')}
          activeOpacity={0.85}
        >
          <View style={[styles.quickPlanIconCircle, { backgroundColor: colors.success + '18' }]}>
            <Ionicons name="barbell-outline" size={26} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.quickPlanTitle, { color: colors.text }]}>My Personalized Plan</Text>
            <Text style={[styles.quickPlanSubtitle, { color: colors.textSecondary }]}>
              {profile?.disabilityCategory
                ? `6 Target Workouts & Diet for ${profile.disabilityCategory}`
                : 'Set category to view workouts & nutrition'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
    gap: 12,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: 25,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  categoryPillPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  careHeading: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  careIllustration: {
    width: '100%',
    height: 190,
    marginBottom: 16,
  },
  logVitalsButton: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 22,
  },
  logVitalsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  viewHistoryLink: {
    fontSize: 14,
    fontWeight: '700',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  vitalCard: {
    width: '48%',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vitalLabel: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  vitalValue: {
    fontSize: 22,
    fontWeight: '800',
    marginRight: 4,
  },
  vitalUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
  noDataRow: {
    paddingVertical: 6,
    marginBottom: 6,
  },
  noDataText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardFooter: {
    marginTop: 'auto',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  timestampText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  quickPlanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  quickPlanIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  quickPlanTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  quickPlanSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
});
