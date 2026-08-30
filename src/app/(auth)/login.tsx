import React, { useState } from 'react';
import { StyleSheet, TextInput, View, Text, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/store/AuthContext';
import { Storage } from '@/services/storage';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const router = useRouter();
  const colors = useTheme();

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Missing Details', 'Please enter both your username and password.');
      return;
    }

    try {
      const storedUsers = await Storage.getItem('users');
      console.log('Stored users raw:', storedUsers);
      const users = storedUsers ? JSON.parse(storedUsers) : {};
      console.log('Parsed users:', JSON.stringify(users));

      if (users[username] && users[username] === password) {
        await login(username);
      } else {
        Alert.alert('Invalid Credentials', 'The username or password you entered is incorrect. If you forgot your credentials, use "Reset Data" below.');
      }
    } catch (e) {
      console.error('Login error:', e);
      Alert.alert('Error', 'Stored data may be corrupted. Please use "Reset Data" below to fix this.');
    }
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset All Data',
      'This will clear all saved accounts and app data. You can then create a new account. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await Storage.removeItem('users');
              await Storage.removeItem('currentUser');
              Alert.alert('Data Reset', 'All data has been cleared. Please sign up with a new account.', [
                { text: 'Go to Sign Up', onPress: () => router.push('/(auth)/signup') }
              ]);
            } catch (e) {
              console.error('Reset error:', e);
              Alert.alert('Error', 'Failed to reset data.');
            }
          }
        }
      ]
    );
  };

  return (
    <KeyboardAvoidingView 
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.headerSection}>
          <View style={[styles.logoBadge, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="heart-pulse" size={54} color={colors.primary} />
          </View>
          <Text style={[styles.brandTitle, { color: colors.text }]}>Vitalize</Text>
          <Text style={[styles.brandTagline, { color: colors.textSecondary }]}>
            Health & Mobility Monitoring
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Welcome Back</Text>
          <Text style={[styles.cardSubtitle, { color: colors.textSecondary }]}>
            Log in to access your vitals & plans
          </Text>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Username</Text>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="person-outline" size={22} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Enter your username"
                placeholderTextColor={colors.textSecondary}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                accessibilityLabel="Username input"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.text }]}>Password</Text>
            <View style={[styles.inputWrapper, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Enter your password"
                placeholderTextColor={colors.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                accessibilityLabel="Password input"
              />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: colors.primary }]} 
            onPress={handleLogin}
            accessibilityRole="button"
            accessibilityLabel="Login Button"
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Log In</Text>
            <Ionicons name="arrow-forward" size={22} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          onPress={() => router.push('/(auth)/signup')}
          style={styles.linkButton}
          accessibilityRole="button"
          accessibilityLabel="Go to Signup"
        >
          <Text style={[styles.linkText, { color: colors.textSecondary }]}>
            Don't have an account? <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Sign Up</Text>
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={handleResetData}
          style={styles.resetButton}
          accessibilityRole="button"
          accessibilityLabel="Reset Data"
        >
          <Ionicons name="refresh-circle-outline" size={18} color={colors.danger || '#E53E3E'} style={{ marginRight: 6 }} />
          <Text style={[styles.resetText, { color: colors.danger || '#E53E3E' }]}>
            Reset Data & Start Fresh
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  brandTagline: {
    fontSize: 16,
    marginTop: 4,
    fontWeight: '500',
  },
  card: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 17,
  },
  button: {
    height: 60,
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 24,
    alignItems: 'center',
    padding: 12,
  },
  linkText: {
    fontSize: 16,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
