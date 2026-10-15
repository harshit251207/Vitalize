import { FloatingChatButton } from '@/components/chat/FloatingChatButton';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_HEIGHT = 56;

export default function AppTabs() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.backgroundElement,
            borderTopColor: colors.border,
            height: TAB_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="pulse-outline" size={size || 24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="plan"
          options={{
            title: 'Plans',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="fitness-outline" size={size || 24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: 'Community',
            tabBarAccessibilityLabel: 'Community feed',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" size={size || 24} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="essentials"
          options={{
            title: 'Essentials',
            tabBarAccessibilityLabel: 'Shopping essentials and refills',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bag-handle-outline" size={size || 24} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="exercise" options={{ href: null }} />
        <Tabs.Screen name="diet" options={{ href: null }} />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-circle-outline" size={size || 24} color={color} />
            ),
          }}
        />
      </Tabs>
      <FloatingChatButton bottomInset={TAB_HEIGHT + insets.bottom + 16} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});