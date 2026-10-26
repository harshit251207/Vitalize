import { useTheme } from '@/hooks/use-theme';
import { Fonts } from '@/constants/theme';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface WorkoutProgressHeroProps {
  percent: number;
  completed: number;
  total: number;
}

const ARC_RADIUS = 92;
const ARC_LENGTH = Math.PI * ARC_RADIUS;

export function WorkoutProgressHero({
  percent,
  completed,
  total,
}: WorkoutProgressHeroProps) {
  const colors = useTheme();
  const boundedPercent = Math.max(0, Math.min(100, percent));

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.backgroundSelected, borderColor: colors.border },
      ]}
      accessibilityLabel={`Today's workout progress: ${boundedPercent} percent, ${completed} of ${total} exercises`}
    >
      <Text style={[styles.title, { color: colors.text }]}>Today&apos;s movement</Text>
      <View style={styles.visual}>
        <Svg width={220} height={132} viewBox="0 0 220 132" style={styles.arc}>
          <Path
            d="M 18 116 A 92 92 0 0 1 202 116"
            fill="none"
            stroke={colors.border}
            strokeWidth={9}
            strokeLinecap="round"
          />
          <Path
            d="M 18 116 A 92 92 0 0 1 202 116"
            fill="none"
            stroke={colors.primary}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${(ARC_LENGTH * boundedPercent) / 100} ${ARC_LENGTH}`}
          />
        </Svg>
        <Image
          source={require('@/assets/images/movement-wheelchair.png')}
          style={styles.image}
          resizeMode="contain"
          accessibilityLabel="A person exercising in a wheelchair"
        />
        <View style={[styles.percentBadge, { backgroundColor: colors.backgroundElement }]}>
          <Text style={[styles.percent, { color: colors.primary }]}>{boundedPercent}%</Text>
        </View>
      </View>
      <Text style={[styles.caption, { color: colors.textSecondary }]}>
        {total > 0 ? `${completed} of ${total} exercises completed` : 'Set your category to see your plan'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 18,
    borderRadius: 24,
    borderWidth: 0,
  },
  title: {
    alignSelf: 'flex-start',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
    fontFamily: Fonts.sans,
    lineHeight: 23,
  },
  visual: {
    height: 172,
    width: 220,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  arc: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  image: {
    position: 'absolute',
    bottom: 0,
    width: 170,
    height: 166,
  },
  percentBadge: {
    position: 'absolute',
    top: 36,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    elevation: 2,
  },
  percent: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: Fonts.sans,
  },
  caption: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
    lineHeight: 20,
    fontFamily: Fonts.sans,
  },
});
