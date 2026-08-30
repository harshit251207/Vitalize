import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/store/AuthContext';
import { VitalsService } from '@/services/vitalsService';
import { Vitals, UserProfile } from '@/types';
import { useTheme } from '@/hooks/use-theme';

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

function VitalCard({ label, value, unit, iconName, accentColor, isOutlier, statusText, onPressLog }: VitalMetricProps) {
  const colors = useTheme();

  return (
    <View style={[
      styles.vitalCard, 
      { backgroundColor: colors.backgroundElement, borderColor: isOutlier ? colors.danger : colors.border },
      isOutlier && { borderWidth: 2 }
    ]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconCircle, { backgroundColor: accentColor + '1E' }]}>
          <Ionicons name={iconName} size={22} color={accentColor} />
        </View>
        <Text style={[styles.vitalLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>

      {value ? (
        <View style={styles.valueRow}>
          <Text style={[styles.vitalValue, { color: colors.text }]}>{value}</Text>
          <Text style={[styles.vitalUnit, { color: colors.textSecondary }]}>{unit}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.noDataRow} onPress={onPressLog}>
          <Text style={[styles.noDataText, { color: colors.primary }]}>+ Log reading</Text>
        </TouchableOpacity>
      )}

      <View style={styles.cardFooter}>
        {isOutlier ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.danger + '1E' }]}>
            <Ionicons name="alert-circle" size={14} color={colors.danger} />
            <Text style={[styles.statusText, { color: colors.danger }]}>High Reading</Text>
          </View>
        ) : value ? (
          <View style={[styles.statusBadge, { backgroundColor: colors.success + '1E' }]}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={[styles.statusText, { color: colors.success }]}>{statusText || 'Normal Range'}</Text>
          </View>
        ) : (
          <Text style={[styles.timestampText, { color: colors.textSecondary }]}>Not logged today</Text>
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
        const sorted = vitals.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
  const isBpOutlier = latestVitals?.bloodPressureSys && ranges?.bpSysMax 
    ? latestVitals.bloodPressureSys > ranges.bpSysMax 
    : false;
  const isSugarOutlier = latestVitals?.bloodSugar && ranges?.sugarMax 
    ? latestVitals.bloodSugar > ranges.sugarMax 
    : false;

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Header Greeting */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              {todayFormatted}
            </Text>
            <Text style={[styles.userName, { color: colors.text }]}>
              Hello, {user || 'User'} 👋
            </Text>
          </View>

          {profile?.disabilityCategory ? (
            <View style={[styles.categoryPill, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="medical" size={14} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={[styles.categoryPillText, { color: colors.primary }]}>
                {profile.disabilityCategory}
              </Text>
            </View>
          ) : (
            <TouchableOpacity 
              style={[styles.categoryPillPrompt, { backgroundColor: colors.warning + '1E' }]}
              onPress={() => router.push('/report-upload')}
            >
              <Ionicons name="alert-circle-outline" size={14} color={colors.warning} style={{ marginRight: 4 }} />
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
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle" size={20} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.heroButtonText, { color: colors.primary }]}>Log New Vitals</Text>
            </TouchableOpacity>
          </View>
          <Ionicons name="pulse" size={90} color="rgba(255,255,255,0.2)" style={styles.heroBgIcon} />
        </View>

        {/* Vitals Grid */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Overview</Text>
          <TouchableOpacity onPress={() => router.push('/vitals-history')}>
            <Text style={[styles.viewHistoryLink, { color: colors.primary }]}>View History →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.vitalsGrid}>
          <VitalCard 
            label="Blood Pressure" 
            value={latestVitals?.bloodPressureSys && latestVitals?.bloodPressureDia ? `${latestVitals.bloodPressureSys}/${latestVitals.bloodPressureDia}` : undefined} 
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
            label="Weight" 
            value={latestVitals?.weight ? `${latestVitals.weight}` : undefined} 
            unit="kg" 
            iconName="scale" 
            accentColor={colors.weight}
            onPressLog={() => router.push('/vitals-entry')}
          />
        </View>

        {/* Quick Plan Navigation */}
        <TouchableOpacity 
          style={[styles.quickPlanCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}
          onPress={() => router.push('/plan')}
          activeOpacity={0.8}
        >
          <View style={[styles.quickPlanIconCircle, { backgroundColor: colors.success + '18' }]}>
            <Ionicons name="barbell-outline" size={28} color={colors.success} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.quickPlanTitle, { color: colors.text }]}>My Personalized Plan</Text>
            <Text style={[styles.quickPlanSubtitle, { color: colors.textSecondary }]}>
              {profile?.disabilityCategory ? `Workouts & Diet for ${profile.disabilityCategory}` : 'Set category to view plan'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
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
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  userName: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  categoryPillPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 4,
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  heroBanner: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  heroContent: {
    zIndex: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  heroSubtitle: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 14,
    marginBottom: 18,
    maxWidth: '80%',
    lineHeight: 20,
  },
  heroButton: {
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  heroButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
  heroBgIcon: {
    position: 'absolute',
    right: -10,
    bottom: -10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  viewHistoryLink: {
    fontSize: 15,
    fontWeight: '600',
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 24,
  },
  vitalCard: {
    width: '47.5%',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  vitalLabel: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  vitalValue: {
    fontSize: 24,
    fontWeight: '800',
    marginRight: 4,
  },
  vitalUnit: {
    fontSize: 12,
    fontWeight: '600',
  },
  noDataRow: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  noDataText: {
    fontSize: 15,
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
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 4,
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
  },
  quickPlanIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontSize: 13,
  },
});
