import React, { useState, useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, ScrollView, Dimensions, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/store/AuthContext';
import { NotAuthenticatedError, getVitalHistory } from '@/services/vitalsService';
import { getAutoBPReadings } from '@/services/autoBpService';
import { isHealthConnectSupportedPlatform, openHealthConnectAppSettings, openHealthConnectStore } from '@/services/healthConnectBP';
import { useAutoBpSync } from '@/hooks/use-auto-bp-sync';
import { Vitals } from '@/types';
import type { BPReading } from '@/types/bpReading';
import { useTheme } from '@/hooks/use-theme';

const screenWidth = Dimensions.get('window').width;

type MetricType = 'bp' | 'sugar' | 'hr' | 'weight';

type HistoryRow =
  | { kind: 'manual'; id: string; date: Date; reading: Vitals }
  | { kind: 'auto'; id: string; date: Date; reading: BPReading };

export default function VitalsHistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colors = useTheme();
  const autoBp = useAutoBpSync({ uid: user });
  const syncNow = autoBp.syncNow;
  
  const [vitals, setVitals] = useState<Vitals[]>([]);
  const [automaticReadings, setAutomaticReadings] = useState<BPReading[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('bp');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) {
      setVitals([]);
      setAutomaticReadings([]);
      setLoadError('Please sign in to view your vitals history.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    setConnectionError(null);
    try {
      const data = await getVitalHistory();
      const sorted = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setVitals(sorted);
      try {
        setAutomaticReadings(await getAutoBPReadings(user));
      } catch {
        setAutomaticReadings([]);
        setConnectionError('Could not load automatic BP readings. Your manual history is still available.');
      }
    } catch (e) {
      setVitals([]);
      setAutomaticReadings([]);
      setLoadError(
        e instanceof NotAuthenticatedError
          ? e.message
          : 'Could not load your vitals history. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      void syncNow().then(loadData);
    }, [syncNow, loadData])
  );

  const historyRows = useMemo<HistoryRow[]>(
    () =>
      [
        ...vitals.map((reading) => ({
          kind: 'manual' as const,
          id: reading.id,
          date: new Date(reading.date),
          reading,
        })),
        ...automaticReadings.map((reading) => ({
          kind: 'auto' as const,
          id: reading.id,
          date: reading.measuredAt,
          reading,
        })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime()),
    [automaticReadings, vitals],
  );

  const refreshHistory = async () => {
    setIsRefreshing(true);
    try {
      await autoBp.syncNow();
      await loadData();
    } finally {
      setIsRefreshing(false);
    }
  };

  const connectHealthConnect = async () => {
    setConnectionError(null);
    if (await autoBp.connect()) {
      await autoBp.syncNow();
      await loadData();
    }
  };

  const openHealthConnectStorePage = async () => {
    setConnectionError(null);
    try {
      await openHealthConnectStore();
    } catch {
      setConnectionError('Could not open Google Play. Search for Health Connect in the Play Store.');
    }
  };

  const openHealthConnectSettingsPage = async () => {
    setConnectionError(null);
    try {
      await openHealthConnectAppSettings();
    } catch {
      setConnectionError('Could not open Health Connect settings. Open it from your device settings.');
    }
  };

  const getMetricData = () => {
    const filtered =
      selectedMetric === 'bp'
        ? [
            ...vitals
              .filter(
                (reading): reading is Vitals & { bloodPressureSys: number } =>
                  typeof reading.bloodPressureSys === 'number',
              )
              .map((reading) => ({
                date: new Date(reading.date),
                value: reading.bloodPressureSys,
              })),
            ...automaticReadings.map((reading) => ({
              date: reading.measuredAt,
              value: reading.systolic,
            })),
          ].sort((a, b) => a.date.getTime() - b.date.getTime())
        : vitals
            .filter((reading) => {
              const key: keyof Vitals =
                selectedMetric === 'sugar'
                  ? 'bloodSugar'
                  : selectedMetric === 'hr'
                    ? 'heartRate'
                    : 'weight';
              return reading[key] !== undefined;
            })
            .map((reading) => {
              const key: keyof Vitals =
                selectedMetric === 'sugar'
                  ? 'bloodSugar'
                  : selectedMetric === 'hr'
                    ? 'heartRate'
                    : 'weight';
              return {
                date: new Date(reading.date),
                value: reading[key] as number,
              };
            });
    if (filtered.length === 0) return null;

    const visible = filtered.slice(-7);
    const labels = visible.map(({ date }) => `${date.getMonth() + 1}/${date.getDate()}`);
    const data = visible.map(({ value }) => value);

    return {
      labels,
      datasets: [{ data }],
    };
  };

  const metricColorMap = {
    bp: colors.bp,
    sugar: colors.sugar,
    hr: colors.heartRate,
    weight: colors.weight,
  };

  const metricTitleMap = {
    bp: 'Blood Pressure (Systolic)',
    sugar: 'Blood Sugar (mg/dL)',
    hr: 'Heart Rate (bpm)',
    weight: 'Weight (kg)',
  };

  const chartData = getMetricData();
  const currentColor = metricColorMap[selectedMetric];

  const chartConfig = {
    backgroundGradientFrom: colors.backgroundElement,
    backgroundGradientTo: colors.backgroundElement,
    color: (opacity = 1) => currentColor,
    labelColor: (opacity = 1) => colors.textSecondary,
    strokeWidth: 3,
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: colors.backgroundElement,
    },
    decimalPlaces: 0,
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => void refreshHistory()}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.backgroundElement }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Vitals History</Text>
        <View style={{ width: 40 }} />
      </View>

      {isHealthConnectSupportedPlatform && (
        <View style={[styles.healthConnectCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <View style={styles.healthConnectHeading}>
            <View style={[styles.healthConnectIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="heart-circle-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.healthConnectCopy}>
              <Text style={[styles.healthConnectTitle, { color: colors.text }]}>Connect Omron (via Health Connect)</Text>
              <Text style={[styles.healthConnectStatus, { color: colors.textSecondary }]}>
                {!autoBp.availability
                  ? 'Checking Health Connect…'
                  : autoBp.availability === 'not-installed'
                    ? 'Health Connect is not installed.'
                    : autoBp.availability === 'update-required'
                      ? 'Health Connect needs an update.'
                      : autoBp.availability !== 'available'
                        ? 'Health Connect is not available on this device.'
                        : autoBp.permissionGranted
                          ? 'Connected'
                          : 'Blood pressure permission needed'}
              </Text>
            </View>
          </View>
          <Text style={[styles.healthConnectHelp, { color: colors.textSecondary }]}>
            Take a reading on your Omron monitor → make sure Omron Connect has synced it → tap Sync now.
          </Text>
          {autoBp.availability === 'not-installed' || autoBp.availability === 'update-required' ? (
            <TouchableOpacity style={[styles.healthConnectButton, { backgroundColor: colors.primary }]} onPress={() => void openHealthConnectStorePage()}>
              <Text style={styles.healthConnectButtonText}>
                {autoBp.availability === 'update-required' ? 'Update Health Connect' : 'Get Health Connect'}
              </Text>
            </TouchableOpacity>
          ) : autoBp.availability === 'available' && !autoBp.permissionGranted ? (
            <View style={styles.healthConnectActions}>
              <TouchableOpacity style={[styles.healthConnectButton, { backgroundColor: colors.primary }]} onPress={() => void connectHealthConnect()}>
                <Text style={styles.healthConnectButtonText}>Connect</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.settingsButton, { borderColor: colors.border }]} onPress={openHealthConnectSettingsPage}>
                <Text style={[styles.settingsButtonText, { color: colors.text }]}>Open Health Connect settings</Text>
              </TouchableOpacity>
            </View>
          ) : autoBp.permissionGranted ? (
            <View style={styles.syncRow}>
              <TouchableOpacity
                style={[styles.healthConnectButton, { backgroundColor: colors.primary, opacity: autoBp.isSyncing ? 0.65 : 1 }]}
                onPress={() => void autoBp.syncNow().then(loadData)}
                disabled={autoBp.isSyncing}
              >
                {autoBp.isSyncing ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                <Text style={styles.healthConnectButtonText}>{autoBp.isSyncing ? 'Syncing…' : 'Sync now'}</Text>
              </TouchableOpacity>
              <Text style={[styles.lastSyncText, { color: colors.textSecondary }]}>
                {autoBp.lastSyncedAt ? `Last synced ${autoBp.lastSyncedAt.toLocaleString()}` : 'Not synced yet'}
              </Text>
            </View>
          ) : null}
          {(autoBp.syncError || connectionError) && (
            <Text style={[styles.syncErrorText, { color: colors.danger }]}>{autoBp.syncError ?? connectionError}</Text>
          )}
        </View>
      )}

      {/* Filter Tabs */}
      <View style={[styles.filterContainer, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <TouchableOpacity 
          style={[styles.filterChip, selectedMetric === 'bp' && { backgroundColor: colors.bp + '22' }]} 
          onPress={() => setSelectedMetric('bp')}
        >
          <Ionicons name="heart" size={16} color={selectedMetric === 'bp' ? colors.bp : colors.textSecondary} />
          <Text style={[styles.filterText, { color: selectedMetric === 'bp' ? colors.bp : colors.textSecondary }]}>BP</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterChip, selectedMetric === 'sugar' && { backgroundColor: colors.sugar + '22' }]} 
          onPress={() => setSelectedMetric('sugar')}
        >
          <Ionicons name="water" size={16} color={selectedMetric === 'sugar' ? colors.sugar : colors.textSecondary} />
          <Text style={[styles.filterText, { color: selectedMetric === 'sugar' ? colors.sugar : colors.textSecondary }]}>Sugar</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterChip, selectedMetric === 'hr' && { backgroundColor: colors.heartRate + '22' }]} 
          onPress={() => setSelectedMetric('hr')}
        >
          <Ionicons name="fitness" size={16} color={selectedMetric === 'hr' ? colors.heartRate : colors.textSecondary} />
          <Text style={[styles.filterText, { color: selectedMetric === 'hr' ? colors.heartRate : colors.textSecondary }]}>HR</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.filterChip, selectedMetric === 'weight' && { backgroundColor: colors.weight + '22' }]} 
          onPress={() => setSelectedMetric('weight')}
        >
          <Ionicons name="scale" size={16} color={selectedMetric === 'weight' ? colors.weight : colors.textSecondary} />
          <Text style={[styles.filterText, { color: selectedMetric === 'weight' ? colors.weight : colors.textSecondary }]}>Weight</Text>
        </TouchableOpacity>
      </View>

      {/* Chart Display */}
      <View style={[styles.chartCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <Text style={[styles.chartTitle, { color: colors.text }]}>{metricTitleMap[selectedMetric]}</Text>
        
        {isLoading ? (
          <View style={styles.emptyChartState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : chartData ? (
          <LineChart
            data={chartData}
            width={screenWidth - 72}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={styles.chartStyle}
          />
        ) : (
          <View style={styles.emptyChartState}>
            <Ionicons name="stats-chart-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No readings logged for this metric yet.
            </Text>
          </View>
        )}
      </View>

      {/* Timeline Logs List */}
      <Text style={[styles.sectionHeading, { color: colors.text }]}>Recent Log Entries</Text>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Loading your vitals…</Text>
        </View>
      ) : loadError ? (
        <View style={styles.loadingState}>
          <Text style={[styles.noLogsText, { color: colors.textSecondary }]}>{loadError}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={loadData}
            activeOpacity={0.8}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : historyRows.length > 0 ? (
        historyRows.map((row) => {
          const dateStr = row.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

          if (row.kind === 'auto') {
            const sourceLabel = row.reading.sourceApp?.toLowerCase().includes('omron') ? 'Omron' : 'Health Connect';
            return (
              <View key={`auto-${row.id}`} style={[styles.logCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
                <View style={styles.logHeader}>
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                  <Text style={[styles.logDate, { color: colors.textSecondary }]}>{dateStr}</Text>
                  <View style={[styles.autoBadge, { backgroundColor: colors.primaryLight }]}>
                    <Ionicons name="sync-outline" size={12} color={colors.primary} />
                    <Text style={[styles.autoBadgeText, { color: colors.primary }]}>{`Auto · ${sourceLabel}`}</Text>
                  </View>
                </View>
                <View style={styles.logMetricsRow}>
                  <View style={styles.logMetricPill}>
                    <Text style={[styles.logMetricLabel, { color: colors.textSecondary }]}>BP:</Text>
                    <Text style={[styles.logMetricValue, { color: colors.text }]}>{row.reading.systolic}/{row.reading.diastolic}</Text>
                  </View>
                </View>
              </View>
            );
          }

          const v = row.reading;
          return (
            <View key={`manual-${row.id}`} style={[styles.logCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
              <View style={styles.logHeader}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={[styles.logDate, { color: colors.textSecondary }]}>{dateStr}</Text>
              </View>

              <View style={styles.logMetricsRow}>
                {v.bloodPressureSys && v.bloodPressureDia && (
                  <View style={styles.logMetricPill}>
                    <Text style={[styles.logMetricLabel, { color: colors.textSecondary }]}>BP:</Text>
                    <Text style={[styles.logMetricValue, { color: colors.text }]}>{v.bloodPressureSys}/{v.bloodPressureDia}</Text>
                  </View>
                )}
                {v.bloodSugar && (
                  <View style={styles.logMetricPill}>
                    <Text style={[styles.logMetricLabel, { color: colors.textSecondary }]}>Sugar:</Text>
                    <Text style={[styles.logMetricValue, { color: colors.text }]}>{v.bloodSugar}</Text>
                  </View>
                )}
                {v.heartRate && (
                  <View style={styles.logMetricPill}>
                    <Text style={[styles.logMetricLabel, { color: colors.textSecondary }]}>HR:</Text>
                    <Text style={[styles.logMetricValue, { color: colors.text }]}>{v.heartRate}</Text>
                  </View>
                )}
                {v.weight && (
                  <View style={styles.logMetricPill}>
                    <Text style={[styles.logMetricLabel, { color: colors.textSecondary }]}>Wt:</Text>
                    <Text style={[styles.logMetricValue, { color: colors.text }]}>{v.weight} kg</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })
      ) : (
        <Text style={[styles.noLogsText, { color: colors.textSecondary }]}>No vitals history recorded yet.</Text>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 20,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  filterContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 6,
    borderWidth: 1,
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '700',
  },
  chartCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    marginBottom: 24,
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  chartStyle: {
    borderRadius: 16,
    marginRight: 16,
  },
  emptyChartState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  loadingState: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  logCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  logDate: {
    fontSize: 13,
    fontWeight: '600',
  },
  logMetricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  logMetricPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logMetricLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  logMetricValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  noLogsText: {
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 20,
  },
  healthConnectCard: {
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    marginBottom: 20,
    gap: 11,
  },
  healthConnectHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  healthConnectIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  healthConnectCopy: { flex: 1, gap: 3 },
  healthConnectTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  healthConnectStatus: { fontSize: 12, lineHeight: 17 },
  healthConnectHelp: { fontSize: 12, lineHeight: 17 },
  healthConnectActions: { gap: 8 },
  healthConnectButton: { minHeight: 42, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  healthConnectButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  settingsButton: { minHeight: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  settingsButtonText: { fontSize: 12, fontWeight: '600' },
  syncRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lastSyncText: { flex: 1, fontSize: 11, lineHeight: 15 },
  syncErrorText: { fontSize: 11, lineHeight: 16 },
  autoBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9, marginLeft: 'auto' },
  autoBadgeText: { fontSize: 10, lineHeight: 14, fontWeight: '700' },
});
