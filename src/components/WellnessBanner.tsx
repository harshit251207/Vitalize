import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type WellnessBannerVariant = 'community' | 'essentials' | 'plans' | 'profile';

interface WellnessBannerProps {
  title: string;
  subtitle?: string;
  variant: WellnessBannerVariant;
}

const ICONS: Record<WellnessBannerVariant, keyof typeof Ionicons.glyphMap> = {
  community: 'people-outline',
  essentials: 'bag-handle-outline',
  plans: 'fitness-outline',
  profile: 'heart-outline',
};

export function WellnessBanner({ title, subtitle, variant }: WellnessBannerProps) {
  const colors = useTheme();
  const isCommunityQuote = variant === 'community';

  return (
    <View style={[styles.banner, { backgroundColor: colors.backgroundSelected }]}>
      <View style={styles.copy}>
        <Text style={[styles.title, isCommunityQuote && styles.quote, { color: colors.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        ) : null}
      </View>
      {!isCommunityQuote ? (
        <View
          style={styles.art}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <Svg width={52} height={52} viewBox="0 0 52 52">
            <Circle cx="26" cy="26" r="24" fill="#D9EEDF" />
            <Path
              d="M17 36c3-9 9-17 20-23M24 29c-7-1-11-5-12-12 7 0 11 4 12 12ZM30 23c1-8 5-12 13-13 0 7-4 12-13 13Z"
              fill="none"
              stroke="#198B65"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <View style={styles.iconBadge}>
            <Ionicons name={ICONS[variant]} size={27} color="#087F5B" />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 108,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
  },
  quote: {
    fontFamily: Fonts.serif,
    fontSize: 19,
    lineHeight: 27,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  art: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
