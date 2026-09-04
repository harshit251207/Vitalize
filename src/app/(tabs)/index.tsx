import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/store/AuthContext';
import { VitalsService } from '@/services/vitalsService';
import { Vitals, UserProfile } from '@/types';
import { useTheme } from '@/hooks/use-theme';
import { DailyCalorieTracker } from '@/components/calorie-tracker/DailyCalorieTracker';

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
              Hello, {user || 'User'} 👋
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

        {/* Hero CTA Banner */}
        <View style={[styles.heroBanner, { backgroundColor: colors.primary }]}>
          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>Track Your Daily Vitals</Text>
            <Text style={styles.heroSubtitle}>Stay ahead by logging BP, sugar, HR, and weight.</Text>

            <TouchableOpacity
              style={styles.heroButton}
              onPress={() => router.push('/vitals-entry')}
              activeOpacity={0.88}
            >
              <Ionicons name="add-circle" size={19} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.heroButtonText, { color: colors.primary }]}>Log New Vitals</Text>
            </TouchableOpacity>
          </View>
          <Ionicons name="pulse" size={96} color="rgba(255,255,255,0.18)" style={styles.heroBgIcon} />
        </View>

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
  heroBanner: {
    borderRadius: 22,
    padding: 22,
    marginBottom: 22,
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  heroContent: {
    zIndex: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 13,
    marginBottom: 16,
    maxWidth: '82%',
    lineHeight: 18,
  },
  heroButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  heroButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  heroBgIcon: {
    position: 'absolute',
    right: -12,
    bottom: -16,
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
