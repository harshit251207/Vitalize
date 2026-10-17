import { FloatingChatButton } from '@/components/chat/FloatingChatButton';
import { useTheme } from '@/hooks/use-theme';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAB_HEIGHT = 64;

export default function AppTabs() {
  const colors = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarStyle: {
            backgroundColor: colors.backgroundElement,
            borderTopColor: colors.border,
            borderTopWidth: StyleSheet.hairlineWidth,
            height: TAB_HEIGHT + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 7,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
            marginTop: 1,
          },
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={21} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="plan"
          options={{
            title: 'Plans',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'fitness' : 'fitness-outline'} size={21} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="community"
          options={{
            title: 'Community',
            tabBarAccessibilityLabel: 'Community feed',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'people' : 'people-outline'} size={21} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="essentials"
          options={{
            title: 'Essentials',
            tabBarAccessibilityLabel: 'Shopping essentials and refills',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'bag-handle' : 'bag-handle-outline'} size={21} color={color} />
            ),
          }}
        />
        <Tabs.Screen name="exercise" options={{ href: null }} />
        <Tabs.Screen name="diet" options={{ href: null }} />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profile',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={21} color={color} />
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