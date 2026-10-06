import React, { useState, useCallback } from 'react';
import { StyleSheet, View, Text, ScrollView, Dimensions, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '@/store/AuthContext';
import { NotAuthenticatedError, getVitalHistory } from '@/services/vitalsService';
import { Vitals } from '@/types';
import { useTheme } from '@/hooks/use-theme';

const screenWidth = Dimensions.get('window').width;

type MetricType = 'bp' | 'sugar' | 'hr' | 'weight';

export default function VitalsHistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colors = useTheme();
  
  const [vitals, setVitals] = useState<Vitals[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('bp');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = async () => {
    if (!user) {
      setVitals([]);
      setLoadError('Please sign in to view your vitals history.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await getVitalHistory();
      const sorted = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setVitals(sorted);
    } catch (e) {
      setVitals([]);
      setLoadError(
        e instanceof NotAuthenticatedError
          ? e.message
          : 'Could not load your vitals history. Please check your connection and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user])
  );

  const getMetricData = () => {
    let key: keyof Vitals = 'bloodPressureSys';
    if (selectedMetric === 'sugar') key = 'bloodSugar';
    if (selectedMetric === 'hr') key = 'heartRate';
    if (selectedMetric === 'weight') key = 'weight';

    const filtered = vitals.filter(v => v[key] !== undefined);
    if (filtered.length === 0) return null;

    const labels = filtered.map(v => {
      const d = new Date(v.date);
      return `${d.getMonth()+1}/${d.getDate()}`;
    });
    const data = filtered.map(v => v[key] as number);

    return {
      labels: labels.slice(-7),
      datasets: [{ data: data.slice(-7) }],
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
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.backgroundElement }]} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Vitals History</Text>
        <View style={{ width: 40 }} />
      </View>

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
      ) : vitals.length > 0 ? (
        vitals.slice().reverse().map((v) => {
          const dateObj = new Date(v.date);
          const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

          return (
            <View key={v.id} style={[styles.logCard, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
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
});
