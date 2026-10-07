import { View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { FloatingChatButton } from '@/components/chat/FloatingChatButton';

export default function AppTabs() {
  const colors = useTheme();

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
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
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
          title: 'My Plan',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="fitness-outline" size={size || 24} color={color} />
          ),
        }} 
      />
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
    <FloatingChatButton bottomInset={80} />
  </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});