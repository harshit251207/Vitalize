import React, { useState, useCallback, useEffect } from 'react';
import { Alert, Linking, StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';

import { useAuth, useCategory } from '@/store/AuthContext';
import { CATEGORY_LABELS } from '@/lib/categoryStorage';
import { VitalsService } from '@/services/vitalsService';
import { getAutoBPReadings } from '@/services/autoBpService';
import { Vitals, UserProfile } from '@/types';
import type { BPReading } from '@/types/bpReading';
import { useAutoBpSync } from '@/hooks/use-auto-bp-sync';
import { useTheme } from '@/hooks/use-theme';
import { fetchUserProfile } from '@/services/authService';
import { SOSButton } from '@/components/SOSButton';
import { DOCTOR_URL } from '@/constants/links';
import { WorkoutProgressHero } from '@/components/WorkoutProgressHero';
import { useWorkoutProgress } from '@/hooks/use-workout-progress';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Fonts } from '@/constants/theme';

interface VitalMetricProps {
  label: string;
  value?: string;
  unit: string;
  iconName: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  isOutlier?: boolean;
  statusText?: string;
  onPressLog?: () => void;
  animationDelay?: number;
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
  animationDelay = 0,
}: VitalMetricProps) {
  const colors = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(animationDelay).duration(420)}
      style={[
        styles.vitalCard,
        {
          backgroundColor: colors.backgroundSelected,
          borderColor: isOutlier ? colors.danger : colors.border,
        },
        isOutlier && { borderWidth: 1 },
      ]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconCircle}>
          <Ionicons name={iconName} size={23} color={accentColor} />
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
    </Animated.View>
  );
}

export default function HomeScreen() {
  const { user } = useAuth();
  const autoBpSync = useAutoBpSync({ uid: user, syncOnAppActive: true });
  const { category } = useCategory();
  const { completedCount, totalCount, progressPercent } = useWorkoutProgress();
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

  const loadData = useCallback(async () => {
    if (user) {
      try {
        const vitals = await VitalsService.getVitalHistory();
        let automaticReadings: BPReading[] = [];
        try {
          automaticReadings = await getAutoBPReadings(user);
        } catch (error) {
          console.warn('Could not load automatic BP readings for home:', error);
        }
        const latestManualVitals = [...vitals].sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        )[0] ?? null;
        const latestManualBp = [...vitals]
          .filter(
            (reading) =>
              typeof reading.bloodPressureSys === 'number' &&
              typeof reading.bloodPressureDia === 'number',
          )
          .sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          )[0] ?? null;
        const latestAutomaticBp = [...automaticReadings].sort(
          (a, b) => b.measuredAt.getTime() - a.measuredAt.getTime()
        )[0] ?? null;
        const useAutomaticBp =
          latestAutomaticBp !== null &&
          (!latestManualBp ||
            latestAutomaticBp.measuredAt.getTime() >
              new Date(latestManualBp.date).getTime());

        if (useAutomaticBp && latestAutomaticBp) {
          setLatestVitals({
            ...(latestManualVitals ?? {
              id: latestAutomaticBp.id,
              date: latestAutomaticBp.measuredAt.toISOString(),
            }),
            bloodPressureSys: latestAutomaticBp.systolic,
            bloodPressureDia: latestAutomaticBp.diastolic,
          });
        } else {
          setLatestVitals(latestManualVitals);
        }
      } catch {
        setLatestVitals(null);
      }
      const p = await VitalsService.getUserProfile(user);
      setProfile(p);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      void (async () => {
        await autoBpSync.syncNow();
        if (isActive) await loadData();
      })();
      return () => {
        isActive = false;
      };
    }, [autoBpSync.syncNow, loadData])
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

  const quickLinks: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
  }[] = [
    { label: 'My vitals', icon: 'pulse-outline', onPress: () => router.push('/vitals-history') },
    { label: 'Movement', icon: 'fitness-outline', onPress: () => router.push(category ? '/exercise' : '/report-upload') },
    { label: 'Nutrition', icon: 'nutrition-outline', onPress: () => router.push(category ? '/diet' : '/report-upload') },
    { label: 'Community', icon: 'people-outline', onPress: () => router.push('/community') },
    { label: 'Essentials', icon: 'bag-handle-outline', onPress: () => router.push('/essentials') },
    { label: 'Care team', icon: 'people-circle-outline', onPress: () => router.push('/emergency-contacts') },
  ];

  const openDoctorPage = async () => {
    try {
      await WebBrowser.openBrowserAsync(DOCTOR_URL);
    } catch (browserError) {
      console.warn('In-app browser failed to open doctor page:', browserError);
      try {
        await Linking.openURL(DOCTOR_URL);
      } catch (linkError) {
        console.error('Unable to open doctor page:', linkError);
        Alert.alert(
          'Unable to open doctor services',
          'Please try again later or visit Apollo 24|7 in your browser.',
        );
      }
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Greeting */}
        <Animated.View entering={FadeInDown.duration(420)} style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              {todayFormatted}
            </Text>
            <Text style={[styles.userName, { color: colors.text }]}>
              {profileUsername ? `Hello, ${profileUsername} 👋` : 'Hello!'}
            </Text>
          </View>

          {category ? (
            <View style={[styles.categoryPill, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="medical" size={14} color={colors.primary} style={{ marginRight: 5 }} />
              <Text style={[styles.categoryPillText, { color: colors.primary }]}>
                {CATEGORY_LABELS[category]}
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
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).duration(420)} style={styles.sectionHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Health overview</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>Your latest readings</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => router.push('/bp-analytics')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.viewHistoryLink, { color: colors.bp }]}>BP Analytics</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/vitals-history')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={[styles.viewHistoryLink, { color: colors.primary }]}>History →</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

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
            iconName="heart-outline"
            accentColor={colors.bp}
            isOutlier={isBpOutlier}
            animationDelay={100}
            onPressLog={() => router.push('/vitals-entry')}
          />
          <VitalCard
            label="Blood Sugar"
            value={latestVitals?.bloodSugar ? `${latestVitals.bloodSugar}` : undefined}
            unit="mg/dL"
            iconName="water-outline"
            accentColor={colors.sugar}
            isOutlier={isSugarOutlier}
            animationDelay={160}
            onPressLog={() => router.push('/vitals-entry')}
          />
          <VitalCard
            label="Heart Rate"
            value={latestVitals?.heartRate ? `${latestVitals.heartRate}` : undefined}
            unit="bpm"
            iconName="fitness-outline"
            accentColor={colors.heartRate}
            animationDelay={220}
            onPressLog={() => router.push('/vitals-entry')}
          />
          <VitalCard
            label="Body Weight"
            value={latestVitals?.weight ? `${latestVitals.weight}` : undefined}
            unit="kg"
            iconName="scale-outline"
            accentColor={colors.weight}
            animationDelay={280}
            onPressLog={() => router.push('/vitals-entry')}
          />
        </View>

        <Animated.View entering={FadeInDown.delay(320).duration(450)}>
          <WorkoutProgressHero
            percent={category ? progressPercent : 0}
            completed={category ? completedCount : 0}
            total={totalCount}
          />
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(360).duration(420)}
          style={styles.exploreHeader}
        >
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Explore Vitalize</Text>
        </Animated.View>
        <View style={styles.quickLinksGrid}>
          {quickLinks.map((item, index) => (
            <Animated.View
              key={item.label}
              entering={FadeInDown.delay(390 + index * 55).duration(420)}
              style={styles.quickLinkItem}
            >
              <TouchableOpacity
                style={[styles.quickLinkCard, { backgroundColor: colors.backgroundSelected }]}
                onPress={item.onPress}
                accessibilityRole="button"
                accessibilityLabel={`Open ${item.label}`}
                activeOpacity={0.78}
              >
                <Ionicons name={item.icon} size={23} color={colors.primary} />
                <Text style={[styles.quickLinkLabel, { color: colors.text }]}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={FadeInDown.delay(440).duration(450)} style={styles.actionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick actions</Text>
        </Animated.View>
        <TouchableOpacity
          onPress={() => void openDoctorPage()}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Contact a doctor"
          style={styles.doctorButton}
        >
          <View style={[styles.doctorGradient, { backgroundColor: colors.primary }]}>
            <MaterialCommunityIcons name="stethoscope" size={24} color="#FFFFFF" />
            <Text style={styles.doctorButtonText}>Contact a doctor</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </View>
        </TouchableOpacity>
        <Text style={[styles.doctorCaption, { color: colors.textSecondary }]}>
          Disability & rehabilitation specialists on Apollo 24|7
        </Text>
        <View style={styles.secondaryActions}>
          <TouchableOpacity
            style={[styles.logVitalsButton, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
            onPress={() => router.push('/vitals-entry')}
            accessibilityRole="button"
            accessibilityLabel="Log new vitals"
          >
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.logVitalsButtonText, { color: colors.primary }]}>Log vitals</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.contactsButton, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
            onPress={() => router.push('/emergency-contacts')}
            accessibilityRole="button"
            accessibilityLabel="Manage emergency contacts"
          >
            <Ionicons name="people-outline" size={20} color={colors.text} />
            <Text style={[styles.contactsText, { color: colors.text }]}>Contacts</Text>
          </TouchableOpacity>
        </View>
        <SOSButton />

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
    paddingHorizontal: 22,
    paddingTop: 16,
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
    fontWeight: '500',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: -0.2,
    fontFamily: Fonts.sans,
    lineHeight: 30,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  categoryPillPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  exploreHeader: {
    marginBottom: 12,
  },
  quickLinksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
  quickLinkItem: {
    width: '48%',
  },
  quickLinkCard: {
    minHeight: 76,
    borderRadius: 23,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  quickLinkLabel: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  logVitalsButton: {
    minHeight: 48,
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  logVitalsButtonText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  contactsButton: {
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 10,
    justifyContent: 'center',
    gap: 7,
  },
  contactsText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 12,
  },
  actionHeader: {
    marginBottom: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    fontFamily: Fonts.sans,
    lineHeight: 29,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: 1,
    lineHeight: 19,
    fontFamily: Fonts.sans,
  },
  viewHistoryLink: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Fonts.sans,
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
    borderRadius: 24,
    padding: 16,
    borderWidth: 0,
    minHeight: 154,
    shadowColor: '#171717',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  iconCircle: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vitalLabel: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    flex: 1,
    fontFamily: Fonts.sans,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  vitalValue: {
    fontSize: 24,
    fontWeight: '800',
    marginRight: 4,
    fontFamily: Fonts.sans,
  },
  vitalUnit: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  noDataRow: {
    paddingVertical: 6,
    marginBottom: 6,
  },
  noDataText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Fonts.sans,
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
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Fonts.sans,
  },
  timestampText: {
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: Fonts.sans,
  },
  doctorButton: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  doctorGradient: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    gap: 12,
  },
  doctorButtonText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Fonts.sans,
  },
  doctorCaption: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
    fontFamily: Fonts.sans,
  },
});
