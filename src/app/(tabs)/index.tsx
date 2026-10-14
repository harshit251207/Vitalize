import React, { useState, useCallback, useEffect } from 'react';
import { Alert, Linking, StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';

import { useAuth, useCategory } from '@/store/AuthContext';
import { CATEGORY_LABELS } from '@/lib/categoryStorage';
import { VitalsService } from '@/services/vitalsService';
import { Vitals, UserProfile } from '@/types';
import { useTheme } from '@/hooks/use-theme';
import { fetchUserProfile } from '@/services/authService';
import { SOSButton } from '@/components/SOSButton';
import { DOCTOR_URL } from '@/constants/links';
import { WorkoutProgressHero } from '@/components/WorkoutProgressHero';
import { useWorkoutProgress } from '@/hooks/use-workout-progress';

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
        if (vitals.length > 0) {
          const sorted = vitals.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          setLatestVitals(sorted[0]);
        } else {
          setLatestVitals(null);
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
      void loadData();
    }, [loadData])
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
        <View style={styles.header}>
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
        </View>

        <View style={styles.sectionHeaderRow}>
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

        <WorkoutProgressHero
          percent={category ? progressPercent : 0}
          completed={category ? completedCount : 0}
          total={totalCount}
        />

        <View style={styles.sectionsHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your plan</Text>
          <TouchableOpacity onPress={() => router.push('/plan')} accessibilityRole="button">
            <Text style={[styles.viewHistoryLink, { color: colors.primary }]}>View all</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.planSections}>
          <TouchableOpacity
            style={[styles.planSectionCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
            onPress={() => router.push(category ? '/exercise' : '/report-upload')}
            accessibilityRole="button"
            accessibilityLabel="Open exercise section"
            activeOpacity={0.85}
          >
            <View style={[styles.planSectionIcon, { backgroundColor: colors.success + '18' }]}>
              <Ionicons name="barbell-outline" size={22} color={colors.success} />
            </View>
            <Text style={[styles.planSectionTitle, { color: colors.text }]}>Exercise</Text>
            <Text style={[styles.planSectionCaption, { color: colors.textSecondary }]}>
              {category ? `${progressPercent}% complete today` : 'Personalized workouts'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.planSectionCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
            onPress={() => router.push(category ? '/diet' : '/report-upload')}
            accessibilityRole="button"
            accessibilityLabel="Open diet section"
            activeOpacity={0.85}
          >
            <View style={[styles.planSectionIcon, { backgroundColor: colors.warning + '1E' }]}>
              <Ionicons name="nutrition-outline" size={22} color={colors.warning} />
            </View>
            <Text style={[styles.planSectionTitle, { color: colors.text }]}>Diet</Text>
            <Text style={[styles.planSectionCaption, { color: colors.textSecondary }]}>Meals & nutrition</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick actions</Text>
        </View>
        <TouchableOpacity
          onPress={() => void openDoctorPage()}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="Contact a doctor"
          style={styles.doctorButton}
        >
          <LinearGradient
            colors={['#16B8B1', '#078A9B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.doctorGradient}
          >
            <MaterialCommunityIcons name="stethoscope" size={24} color="#FFFFFF" />
            <Text style={styles.doctorButtonText}>Contact a doctor</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </LinearGradient>
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
  logVitalsButton: {
    minHeight: 48,
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
  },
  logVitalsButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  contactsButton: {
    minHeight: 48,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    justifyContent: 'center',
    gap: 7,
  },
  contactsText: {
    fontSize: 14,
    fontWeight: '700',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    marginBottom: 12,
  },
  sectionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  planSections: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  planSectionCard: {
    flex: 1,
    minHeight: 132,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  planSectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  planSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  planSectionCaption: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 4,
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
  doctorButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  doctorGradient: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    gap: 12,
  },
  doctorButtonText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  doctorCaption: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
  },
});
