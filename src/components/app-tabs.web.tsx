import { Ionicons } from '@expo/vector-icons';
import {
  TabList,
  TabListProps,
  TabSlot,
  TabTrigger,
  TabTriggerSlotProps,
  Tabs,
} from 'expo-router/ui';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { usePathname } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';
import { FloatingChatButton } from './chat/FloatingChatButton';

export default function AppTabs() {
  const pathname = usePathname();

  return (
    <View style={styles.container}>
      <Tabs>
        <Animated.View key={pathname} entering={FadeIn.duration(220)} style={styles.content}>
          <TabSlot style={styles.content} />
        </Animated.View>
        <TabList asChild>
          <CustomTabList>
            <TabTrigger name="index" href="/" asChild>
              <TabButton icon="pulse-outline">Home</TabButton>
            </TabTrigger>
            <TabTrigger name="plan" href="/plan" asChild>
              <TabButton icon="fitness-outline">Plans</TabButton>
            </TabTrigger>
            <TabTrigger name="community" href="/community" asChild>
              <TabButton icon="people-outline">Community</TabButton>
            </TabTrigger>
            <TabTrigger name="essentials" href="/essentials" asChild>
              <TabButton icon="bag-handle-outline">Essentials</TabButton>
            </TabTrigger>
            <TabTrigger name="profile" href="/profile" asChild>
              <TabButton icon="person-circle-outline">Profile</TabButton>
            </TabTrigger>
          </CustomTabList>
        </TabList>
      </Tabs>
      <FloatingChatButton bottomInset={104} />
    </View>
  );
}

interface TabButtonProps extends TabTriggerSlotProps {
  icon: keyof typeof Ionicons.glyphMap;
}

function TabButton({ children, icon, isFocused, ...props }: TabButtonProps) {
  const colors = useTheme();

  return (
    <Pressable
      {...props}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}
    >
      <View style={styles.tabButtonContent}>
        <Ionicons name={icon} size={21} color={isFocused ? colors.text : colors.textSecondary} />
        <Text style={[styles.tabLabel, { color: isFocused ? colors.text : colors.textSecondary }]}>
          {children}
        </Text>
      </View>
    </Pressable>
  );
}

function CustomTabList(props: TabListProps) {
  const colors = useTheme();

  return (
    <View {...props} style={[props.style, styles.tabListContainer]}>
      <View
        style={[
          styles.innerContainer,
          { backgroundColor: colors.backgroundElement, borderColor: colors.border },
        ]}
      >
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    paddingBottom: 88,
  },
  tabListContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
  },
  innerContainer: {
    width: '100%',
    maxWidth: 800,
    minHeight: 78,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderRadius: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonContent: {
    minWidth: 58,
    minHeight: 56,
    paddingHorizontal: 8,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.7,
  },
});
