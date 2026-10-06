import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LineChart } from 'react-native-gifted-charts';

import { useAuth } from '@/store/AuthContext';
import { NotAuthenticatedError, getVitalHistoryForPeriod } from '@/services/vitalsService';
import { Vitals } from '@/types';
import { useTheme } from '@/hooks/use-theme';
import {
  type TimePeriod,
  type BPAnalyticsResult,
  type BPReading,
  computeBPAnalytics,
  extractBPReadings,
  BP_REFERENCE,
} from '@/services/bpAnalyticsService';

const screenWidth = Dimensions.get('window').width;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function trendLabel(trend: string): string {
  switch (trend) {
    case 'increasing':
      return '↑ Increasing';
    case 'decreasing':
      return '↓ Decreasing';
    case 'stable':
      return '→ Stable';
    default:
      return 'Insufficient data';
  }
}

function trendColor(trend: string, colors: ReturnType<typeof useTheme>): string {
  switch (trend) {
    case 'increasing':
      return colors.warning;
    case 'decreasing':
      return colors.primary;
    case 'stable':
      return colors.success;
    default:
      return colors.textSecondary;
  }
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function BPAnalyticsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const colors = useTheme();

  const [period, setPeriod] = useState<TimePeriod>('7d');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [vitals, setVitals] = useState<Vitals[]>([]);
  const [analytics, setAnalytics] = useState<BPAnalyticsResult | null>(null);

  const loadData = async (selectedPeriod: TimePeriod) => {
    if (!user) {
      setVitals([]);
      setAnalytics(null);
      setLoadError('Please sign in to view your BP analytics.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    try {
      const days = selectedPeriod === '7d' ? 7 : 30;
      const data = await getVitalHistoryForPeriod(days);
      setVitals(data);
      setAnalytics(computeBPAnalytics(data, selectedPeriod));
    } catch (e) {
      setVitals([]);
      setAnalytics(null);
      setLoadError(
        e instanceof NotAuthenticatedError
          ? e.message
          : 'Could not load your BP data. Please check your connection and try again.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData(period);
    }, [user, period]),
  );

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    if (newPeriod !== period) {
      setPeriod(newPeriod);
    }
  };

  // -----------------------------------------------------------------------
  // Chart data
  // -----------------------------------------------------------------------
  const bpReadings = extractBPReadings(vitals);

  // Build gifted-charts line data
  const systolicData = bpReadings.map((r, i) => ({
    value: r.systolic,
    label: i === 0 || i === bpReadings.length - 1 ? formatDate(r.recordedAt) : '',
    dataPointText: String(r.systolic),
  }));

  const diastolicData = bpReadings.map((r, i) => ({
    value: r.diastolic,
    label: i === 0 || i === bpReadings.length - 1 ? formatDate(r.recordedAt) : '',
    dataPointText: String(r.diastolic),
  }));

  const hasChartData = systolicData.length > 0;

  // Find out-of-range point indices for highlighting
  const outOfRangeIndices = new Set<number>();
  bpReadings.forEach((r, i) => {
    if (
      r.systolic > BP_REFERENCE.systolic.high ||
      r.systolic < BP_REFERENCE.systolic.low ||
      r.diastolic > BP_REFERENCE.diastolic.high ||
      r.diastolic < BP_REFERENCE.diastolic.low
    ) {
      outOfRangeIndices.add(i);
    }
  });

  // Customise data points to highlight out-of-range readings
  const systolicDataWithHighlights = systolicData.map((point, i) => ({
    ...point,
    customDataPoint: outOfRangeIndices.has(i)
      ? () => (
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.warning,
              borderWidth: 2,
              borderColor: '#FFFFFF',
            }}
          />
        )
      : undefined,
  }));

  const diastolicDataWithHighlights = diastolicData.map((point, i) => ({
    ...point,
    customDataPoint: outOfRangeIndices.has(i)
      ? () => (
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: colors.warning,
              borderWidth: 2,
              borderColor: '#FFFFFF',
            }}
          />
        )
      : undefined,
  }));

  // Chart width calculation
  const chartWidth = Math.max(screenWidth - 100, 200);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.backgroundElement }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>BP Analytics</Text>
        <View style={{ width: 42 }} />
      </View>

      {/* Latest Reading */}
      {analytics && analytics.latestReading && (
        <View
          style={[
            styles.latestCard,
            { backgroundColor: colors.backgroundElement, borderColor: colors.border },
          ]}
        >
          <View style={styles.latestCardHeader}>
            <View style={[styles.iconCircle, { backgroundColor: colors.bp + '18' }]}>
              <Ionicons name="heart" size={20} color={colors.bp} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.latestLabel, { color: colors.textSecondary }]}>
                Latest Reading
              </Text>
              <Text style={[styles.latestValue, { color: colors.text }]}>
                {analytics.latestReading.systolic}/{analytics.latestReading.diastolic}{' '}
                <Text style={[styles.latestUnit, { color: colors.textSecondary }]}>mmHg</Text>
              </Text>
            </View>
            <Text style={[styles.latestDate, { color: colors.textSecondary }]}>
              {formatDateTime(analytics.latestReading.recordedAt)}
            </Text>
          </View>
        </View>
      )}

      {/* Period Toggle */}
      <View
        style={[
          styles.toggleContainer,
          { backgroundColor: colors.backgroundElement, borderColor: colors.border },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.toggleButton,
            period === '7d' && { backgroundColor: colors.primary + '22' },
          ]}
          onPress={() => handlePeriodChange('7d')}
        >
          <Text
            style={[
              styles.toggleText,
              { color: period === '7d' ? colors.primary : colors.textSecondary },
            ]}
          >
            7 Days
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            period === '30d' && { backgroundColor: colors.primary + '22' },
          ]}
          onPress={() => handlePeriodChange('30d')}
        >
          <Text
            style={[
              styles.toggleText,
              { color: period === '30d' ? colors.primary : colors.textSecondary },
            ]}
          >
            30 Days
          </Text>
        </TouchableOpacity>
      </View>

      {/* Chart */}
      <View
        style={[
          styles.chartCard,
          { backgroundColor: colors.backgroundElement, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.chartTitle, { color: colors.text }]}>
          Blood Pressure Trend
        </Text>
        <Text style={[styles.chartSubtitle, { color: colors.textSecondary }]}>
          Systolic & Diastolic (mmHg)
        </Text>

        {isLoading ? (
          <View style={styles.emptyChartState}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.emptyChartState}>
            <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {loadError}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={() => loadData(period)}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : hasChartData ? (
          <View style={styles.chartWrapper}>
            <LineChart
              data={systolicDataWithHighlights}
              data2={diastolicDataWithHighlights}
              width={chartWidth}
              height={200}
              spacing={bpReadings.length > 1 ? Math.max(chartWidth / (bpReadings.length - 1), 40) : chartWidth}
              color1={colors.bp}
              color2={colors.primary}
              dataPointsColor1={colors.bp}
              dataPointsColor2={colors.primary}
              dataPointsRadius={5}
              textColor={colors.textSecondary}
              textFontSize={10}
              xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
              yAxisTextStyle={{ color: colors.textSecondary, fontSize: 10 }}
              yAxisColor={colors.border}
              xAxisColor={colors.border}
              curved
              isAnimated
              animationDuration={800}
              noOfSections={5}
              maxValue={Math.max(...bpReadings.map((r) => r.systolic), 160) + 10}
              showReferenceLine1
              referenceLine1Position={BP_REFERENCE.systolic.high}
              referenceLine1Config={{
                color: colors.warning + '60',
                dashWidth: 6,
                dashGap: 4,
                labelText: `${BP_REFERENCE.systolic.high} (Ref)`,
                labelTextStyle: { color: colors.warning, fontSize: 9 },
              }}
              showReferenceLine2
              referenceLine2Position={BP_REFERENCE.diastolic.high}
              referenceLine2Config={{
                color: colors.primary + '60',
                dashWidth: 6,
                dashGap: 4,
                labelText: `${BP_REFERENCE.diastolic.high} (Ref)`,
                labelTextStyle: { color: colors.primary, fontSize: 9 },
              }}
            />

            {/* Legend */}
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.bp }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                  Systolic
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                  Diastolic
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: colors.warning, borderWidth: 1, borderColor: '#FFF' },
                  ]}
                />
                <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                  Outside ref. range
                </Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.emptyChartState}>
            <Ionicons name="pulse-outline" size={48} color={colors.textSecondary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No blood pressure readings available yet.
            </Text>
            <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
              Add a BP reading to start tracking your trend.
            </Text>
          </View>
        )}
      </View>

      {/* Analytics Summary */}
      {analytics && analytics.readingCount > 0 && (
        <>
          {/* Averages & Moving Average */}
          <View
            style={[
              styles.statsCard,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionHeading, { color: colors.text }]}>
              Averages
            </Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Avg Systolic
                </Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {analytics.averageSystolic != null
                    ? `${Math.round(analytics.averageSystolic)} mmHg`
                    : '—'}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Avg Diastolic
                </Text>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {analytics.averageDiastolic != null
                    ? `${Math.round(analytics.averageDiastolic)} mmHg`
                    : '—'}
                </Text>
              </View>
              {analytics.movingAverage.systolic != null && (
                <View style={styles.statItem}>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Moving Avg (last 5)
                  </Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {Math.round(analytics.movingAverage.systolic)}/
                    {analytics.movingAverage.diastolic != null
                      ? Math.round(analytics.movingAverage.diastolic)
                      : '—'}{' '}
                    mmHg
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Trend Analysis */}
          <View
            style={[
              styles.statsCard,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionHeading, { color: colors.text }]}>
              Trend Analysis
            </Text>
            <View style={styles.trendRow}>
              <View style={styles.trendItem}>
                <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>
                  Systolic Trend
                </Text>
                <Text
                  style={[
                    styles.trendValue,
                    { color: trendColor(analytics.systolicTrend, colors) },
                  ]}
                >
                  {trendLabel(analytics.systolicTrend)}
                </Text>
              </View>
              <View style={styles.trendItem}>
                <Text style={[styles.trendLabel, { color: colors.textSecondary }]}>
                  Diastolic Trend
                </Text>
                <Text
                  style={[
                    styles.trendValue,
                    { color: trendColor(analytics.diastolicTrend, colors) },
                  ]}
                >
                  {trendLabel(analytics.diastolicTrend)}
                </Text>
              </View>
            </View>

            {analytics.systolicTrend !== 'insufficient_data' && (
              <Text style={[styles.trendNote, { color: colors.textSecondary }]}>
                Trend is based on a simple linear fit over your{' '}
                {analytics.readingCount} reading
                {analytics.readingCount !== 1 ? 's' : ''} in this period. This
                is a tracking indicator, not a medical assessment.
              </Text>
            )}
          </View>

          {/* Reference Range */}
          <View
            style={[
              styles.statsCard,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionHeading, { color: colors.text }]}>
              Reference Range
            </Text>
            <View style={styles.refRow}>
              <View
                style={[styles.refBadge, { backgroundColor: colors.success + '18' }]}
              >
                <Text style={[styles.refBadgeCount, { color: colors.success }]}>
                  {analytics.referenceRangeFlags.withinReference}
                </Text>
                <Text style={[styles.refBadgeLabel, { color: colors.success }]}>
                  Within range
                </Text>
              </View>
              <View
                style={[styles.refBadge, { backgroundColor: colors.warning + '18' }]}
              >
                <Text style={[styles.refBadgeCount, { color: colors.warning }]}>
                  {analytics.referenceRangeFlags.aboveReference}
                </Text>
                <Text style={[styles.refBadgeLabel, { color: colors.warning }]}>
                  Above range
                </Text>
              </View>
              <View
                style={[styles.refBadge, { backgroundColor: colors.primary + '18' }]}
              >
                <Text style={[styles.refBadgeCount, { color: colors.primary }]}>
                  {analytics.referenceRangeFlags.belowReference}
                </Text>
                <Text style={[styles.refBadgeLabel, { color: colors.primary }]}>
                  Below range
                </Text>
              </View>
            </View>
            <Text style={[styles.refDisclaimer, { color: colors.textSecondary }]}>
              Reference: {BP_REFERENCE.systolic.low}–{BP_REFERENCE.systolic.high}/
              {BP_REFERENCE.diastolic.low}–{BP_REFERENCE.diastolic.high} mmHg (general
              population). Your individual target may differ — please discuss
              with your healthcare provider.
            </Text>
          </View>

          {/* Unusual Readings */}
          {analytics.unusualReadings.length > 0 && (
            <View
              style={[
                styles.statsCard,
                { backgroundColor: colors.backgroundElement, borderColor: colors.border },
              ]}
            >
              <View style={styles.unusualHeader}>
                <Ionicons
                  name="alert-circle-outline"
                  size={20}
                  color={colors.warning}
                />
                <Text style={[styles.sectionHeading, { color: colors.text, marginLeft: 8 }]}>
                  Unusual Readings ({analytics.unusualReadings.length})
                </Text>
              </View>
              {analytics.unusualReadings.map((ur, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.unusualItem,
                    { borderColor: colors.warning + '40' },
                  ]}
                >
                  <View style={styles.unusualTopRow}>
                    <Text style={[styles.unusualBP, { color: colors.text }]}>
                      {ur.systolic}/{ur.diastolic} mmHg
                    </Text>
                    <Text style={[styles.unusualDate, { color: colors.textSecondary }]}>
                      {formatDateTime(ur.recordedAt)}
                    </Text>
                  </View>
                  <Text style={[styles.unusualReason, { color: colors.warning }]}>
                    {ur.reason}
                  </Text>
                </View>
              ))}
              <Text style={[styles.unusualDisclaimer, { color: colors.textSecondary }]}>
                "Unusual" means the reading differs significantly from your recent
                average. It does not indicate a medical condition. If you notice
                persistent unusual readings, consider discussing them with a
                healthcare professional.
              </Text>
            </View>
          )}
        </>
      )}

      {/* Informational footer */}
      {analytics && analytics.readingCount > 0 && (
        <View style={styles.footerInfo}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            This analytics section is for personal tracking only and should not be
            used as a substitute for professional medical advice, diagnosis, or
            treatment.
          </Text>
        </View>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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

  // Latest reading card
  latestCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  latestCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  latestLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  latestValue: {
    fontSize: 26,
    fontWeight: '800',
  },
  latestUnit: {
    fontSize: 14,
    fontWeight: '600',
  },
  latestDate: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Toggle
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '700',
  },

  // Chart
  chartCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  chartSubtitle: {
    fontSize: 12,
    marginBottom: 16,
  },
  chartWrapper: {
    alignItems: 'center',
  },
  emptyChartState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
    textAlign: 'center',
  },
  emptyHint: {
    marginTop: 4,
    fontSize: 13,
    textAlign: 'center',
    fontStyle: 'italic',
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

  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },

  // Stats cards
  statsCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  statsGrid: {
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
  },

  // Trend
  trendRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  trendItem: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.03)',
    alignItems: 'center',
  },
  trendLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  trendValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  trendNote: {
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
  },

  // Reference range
  refRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  refBadge: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  refBadgeCount: {
    fontSize: 22,
    fontWeight: '800',
  },
  refBadgeLabel: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  refDisclaimer: {
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
  },

  // Unusual readings
  unusualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  unusualItem: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  unusualTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  unusualBP: {
    fontSize: 15,
    fontWeight: '700',
  },
  unusualDate: {
    fontSize: 11,
    fontWeight: '600',
  },
  unusualReason: {
    fontSize: 12,
    fontWeight: '600',
  },
  unusualDisclaimer: {
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
    marginTop: 8,
  },

  // Footer
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  footerText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
});
